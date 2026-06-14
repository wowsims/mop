package reforgeoptimizer

import (
	"context"
	"fmt"
	"log"
	"math"
	"slices"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	"github.com/wowsims/mop/sim/core/stats"
)

type mipVariable struct {
	slotIdx   int
	choiceIdx int
	objective float64
	upper     float64
	integer   bool
}

type mipConstraint struct {
	lower   float64
	upper   float64
	indices []int
	values  []float64
}

type mipModel struct {
	variables   []mipVariable
	constraints []mipConstraint
}

type mipSolution struct {
	values []float64
}

type mipStatConstraint struct {
	unitStat       stats.UnitStat
	lower          float64
	upper          float64
	actualLower    float64
	actualUpper    float64
	hasActualLower bool
	hasActualUpper bool
}

func reforgeDebug(search *reforgeSearchState) bool {
	return search != nil && search.request != nil && search.request.GetDebug()
}

func trySolveWithHiGHS(search *reforgeSearchState, signals simsignals.Signals) ([]reforgeChoice, float64, bool, error) {
	weights := search.weights
	softCaps := cloneSoftCaps(search.softCaps)
	relativeCaps := slices.Clone(search.relativeCaps)
	statConstraints := make([]mipStatConstraint, 0, len(search.hardCaps)+len(search.softCaps))
	constrainedStats := make(map[stats.UnitStat]bool, len(search.hardCaps)+1)
	maxPasses := max(1, 2*(len(search.hardCaps)+countSoftCapBreakpoints(search.softCaps)+1))
	deadline := time.Now().Add(highsOptimizerTimeout(search))
	debug := reforgeDebug(search)

	for passIdx := 0; passIdx < maxPasses; passIdx++ {
		if signals.Abort.IsTriggered() {
			return nil, 0, false, context.Canceled
		}
		remainingTimeout := highsOptimizerPassTimeout(deadline)
		if remainingTimeout <= 0 {
			return nil, 0, false, nil
		}
		var passStartedAt time.Time
		var modelStartedAt time.Time
		if debug {
			passStartedAt = time.Now()
			modelStartedAt = time.Now()
		}
		model := buildChoiceMIPModel(search, weights, statConstraints, relativeCaps)
		var modelDuration time.Duration
		var solveStartedAt time.Time
		if debug {
			modelDuration = time.Since(modelStartedAt)
			solveStartedAt = time.Now()
		}
		solution, ok, err := solveMIPWithHiGHS(model, remainingTimeout, highsOptimizerMIPRelGap(search))
		if signals.Abort.IsTriggered() {
			return nil, 0, false, context.Canceled
		}
		var solveDuration time.Duration
		if debug {
			solveDuration = time.Since(solveStartedAt)
		}
		if err != nil || !ok {
			if debug {
				log.Printf("[reforgeOptimize] HiGHS pass=%d failure vars=%d constraints=%d err=%v", passIdx+1, len(model.variables), len(model.constraints), err)
			}
			return nil, 0, ok, err
		}

		var selectStartedAt time.Time
		if debug {
			selectStartedAt = time.Now()
		}
		choices, err := choicesFromMIPSolution(search, model, solution)
		if err != nil {
			return nil, 0, false, err
		}
		if !selectedChoicesValid(choices) {
			return nil, 0, false, nil
		}
		delta, err := selectedChoicesCapDelta(search, choices)
		if err != nil {
			return nil, 0, false, err
		}
		var selectDuration time.Duration
		if debug {
			selectDuration = time.Since(selectStartedAt)
		}

		var capStartedAt time.Time
		if debug {
			capStartedAt = time.Now()
		}
		updated, nextWeights, nextSoftCaps, nextStatConstraints, nextRelativeCaps := updateHiGHSCapPass(search, passIdx, delta, weights, softCaps, statConstraints, relativeCaps, constrainedStats)
		var capDuration time.Duration
		if debug {
			capDuration = time.Since(capStartedAt)
			log.Printf("[reforgeOptimize] solver pass=%d vars=%d constraints=%d timings=model:%s solve:%s select:%s cap:%s total:%s", passIdx+1, len(model.variables), len(model.constraints), modelDuration, solveDuration, selectDuration, capDuration, time.Since(passStartedAt))
		}
		if !updated {
			score, ok := search.evaluate(delta)
			return choices, score, ok, nil
		}
		weights = nextWeights
		softCaps = nextSoftCaps
		statConstraints = nextStatConstraints
		relativeCaps = nextRelativeCaps
	}

	return nil, 0, false, fmt.Errorf("HiGHS optimizer reached cap refinement pass limit")
}

func highsOptimizerTimeout(search *reforgeSearchState) time.Duration {
	if len(search.relativeCaps) > 0 {
		return relativeStatCapOptimizerTimeout
	}
	return optimizerTimeout
}

func highsOptimizerPassTimeout(deadline time.Time) time.Duration {
	remaining := time.Until(deadline)
	if remaining < time.Second {
		return time.Second
	}
	return remaining
}

func highsOptimizerMIPRelGap(search *reforgeSearchState) float64 {
	if len(search.relativeCaps) > 0 {
		return relativeStatCapMIPRelGap
	}
	return 0
}

func choicesFromMIPSolution(search *reforgeSearchState, model mipModel, solution mipSolution) ([]reforgeChoice, error) {
	choices := make([]reforgeChoice, len(search.slots))
	selected := make([]bool, len(search.slots))
	for slotIdx, slot := range search.slots {
		if len(slot.choices) > 0 {
			choices[slotIdx] = slot.choices[0]
			selected[slotIdx] = true
		}
	}
	for varIdx, value := range solution.values {
		if value < 0.5 {
			continue
		}
		variable := model.variables[varIdx]
		if !variable.integer {
			continue
		}
		choices[variable.slotIdx] = search.slots[variable.slotIdx].choices[variable.choiceIdx]
		selected[variable.slotIdx] = true
	}

	for slotIdx := range choices {
		if !selected[slotIdx] {
			return nil, fmt.Errorf("HiGHS did not select a choice for slot %s", search.slots[slotIdx].slot.String())
		}
	}
	return choices, nil
}

func buildChoiceMIPModel(search *reforgeSearchState, weights core.UnitStats, statConstraints []mipStatConstraint, relativeCaps []reforgeRelativeStatCap) mipModel {
	variableCount := countMIPChoiceVariables(search.slots)
	uniqueGemIDs := search.uniqueGemIDs
	if uniqueGemIDs == nil {
		uniqueGemIDs = buildUniqueGemLimitIDs(search.slots)
	}
	model := mipModel{
		variables:   make([]mipVariable, 0, variableCount),
		constraints: make([]mipConstraint, 0, estimateMIPConstraintCount(search, statConstraints, relativeCaps, len(uniqueGemIDs))),
	}
	choiceVarIdx := search.choiceVarIdx
	if len(choiceVarIdx) != len(search.slots) {
		choiceVarIdx = make([][]int, len(search.slots))
		for i, slot := range search.slots {
			choiceVarIdx[i] = make([]int, len(slot.choices))
		}
	}
	for slotIdx, slot := range search.slots {
		for choiceIdx := range slot.choices {
			choiceVarIdx[slotIdx][choiceIdx] = -1
		}
		for choiceIdx, choice := range slot.choices {
			if !choiceMIPActive(choice) {
				continue
			}
			choiceVarIdx[slotIdx][choiceIdx] = len(model.variables)
			model.variables = append(model.variables, mipVariable{
				slotIdx:   slotIdx,
				choiceIdx: choiceIdx,
				objective: dotUnitStats(choiceObjectiveDelta(choice), weights),
				upper:     1,
				integer:   true,
			})
		}
	}

	for slotIdx := range search.slots {
		if reforgeSlotChoicesAreSocketBonus(search.slots[slotIdx]) {
			continue
		}
		constraint := newMIPConstraint(math.Inf(-1), 1, len(search.slots[slotIdx].choices))
		for choiceIdx := range search.slots[slotIdx].choices {
			if choiceVarIdx[slotIdx][choiceIdx] >= 0 {
				constraint.addCoefficient(choiceVarIdx[slotIdx][choiceIdx], 1)
			}
		}
		if constraint.coefficientCount() > 0 {
			model.constraints = append(model.constraints, constraint)
		}
	}
	addSocketBonusLinkConstraints(search, choiceVarIdx, &model)

	if constraint := buildChoiceLimitConstraint(search, choiceVarIdx, func(choice reforgeChoice) float64 { return float64(choice.jewelcraftingGems) }, 2); constraint.coefficientCount() > 0 {
		model.constraints = append(model.constraints, constraint)
	}
	if constraint := buildChoiceLimitConstraint(search, choiceVarIdx, func(choice reforgeChoice) float64 { return float64(choice.shaTouchedGems) }, 1); constraint.coefficientCount() > 0 {
		model.constraints = append(model.constraints, constraint)
	}
	addRelativeStatCapConstraints(search, choiceVarIdx, &model, relativeCaps)

	for _, gemID := range uniqueGemIDs {
		constraint := buildChoiceLimitConstraint(search, choiceVarIdx, func(choice reforgeChoice) float64 {
			for _, choiceGemID := range choice.uniqueGemIDs {
				if choiceGemID == gemID {
					return 1
				}
			}
			return 0
		}, 1)
		if constraint.coefficientCount() > 0 {
			model.constraints = append(model.constraints, constraint)
		}
	}

	for _, statConstraint := range statConstraints {
		constraint := newMIPConstraint(statConstraint.lower, statConstraint.upper, variableCount)
		for slotIdx, slot := range search.slots {
			for choiceIdx, choice := range slot.choices {
				if choiceVarIdx[slotIdx][choiceIdx] < 0 {
					continue
				}
				if delta := getUnitStat(choiceCoefficientDelta(choice), statConstraint.unitStat); delta != 0 {
					constraint.addCoefficient(choiceVarIdx[slotIdx][choiceIdx], delta)
				}
			}
		}
		if constraint.coefficientCount() > 0 {
			model.constraints = append(model.constraints, constraint)
		}
	}

	return model
}

func countMIPChoiceVariables(slots []reforgeSlotChoices) int {
	count := 0
	for _, slot := range slots {
		for _, choice := range slot.choices {
			if choiceMIPActive(choice) {
				count++
			}
		}
	}
	return count
}

func choiceMIPActive(choice reforgeChoice) bool {
	if choice.hasReforge {
		return choice.reforgeID != 0
	}
	if choice.socketChoice {
		return len(choice.gems) > 0 && choice.gems[0].gemID != 0
	}
	if choice.socketBonus {
		return len(choice.bonusSocketIdxs) > 0
	}
	return false
}

func reforgeSlotChoicesAreSocketBonus(slot reforgeSlotChoices) bool {
	return len(slot.choices) > 0 && slot.choices[0].socketBonus
}

func estimateMIPConstraintCount(search *reforgeSearchState, statConstraints []mipStatConstraint, relativeCaps []reforgeRelativeStatCap, uniqueGemLimitCount int) int {
	count := len(search.slots) + countSocketBonusLinkConstraints(search) + len(statConstraints) + len(relativeCaps) + uniqueGemLimitCount
	count += 2
	return count
}

func countSocketBonusLinkConstraints(search *reforgeSearchState) int {
	count := 0
	for _, group := range search.slots {
		for _, choice := range group.choices {
			if choice.socketBonus {
				count += len(choice.bonusSocketIdxs)
			}
		}
	}
	return count
}

func buildUniqueGemLimitIDs(slots []reforgeSlotChoices) []int32 {
	uniqueGemIDs := make([]int32, 0)
	seen := map[int32]bool{}
	for _, slot := range slots {
		for _, choice := range slot.choices {
			for _, gemID := range choice.uniqueGemIDs {
				if seen[gemID] {
					continue
				}
				seen[gemID] = true
				uniqueGemIDs = append(uniqueGemIDs, gemID)
			}
		}
	}
	return uniqueGemIDs
}

func newMIPConstraint(lower float64, upper float64, capacity int) mipConstraint {
	return mipConstraint{
		lower:   lower,
		upper:   upper,
		indices: make([]int, 0, capacity),
		values:  make([]float64, 0, capacity),
	}
}

func (constraint *mipConstraint) addCoefficient(index int, value float64) {
	constraint.indices = append(constraint.indices, index)
	constraint.values = append(constraint.values, value)
}

func (constraint mipConstraint) coefficientCount() int {
	return len(constraint.indices)
}

func exactRelativeCapViolation(relativeCaps []reforgeRelativeStatCap, delta core.UnitStats) (reforgeRelativeStatCap, float64, bool) {
	for _, relativeCap := range relativeCaps {
		actualMinDelta := relativeCap.actualMinDelta
		if actualMinDelta == 0 {
			actualMinDelta = relativeCap.minDelta
		}
		value := getUnitStat(delta, relativeCap.forcedStat) - getUnitStat(delta, relativeCap.constrainedStat)
		if value+1e-6 < actualMinDelta {
			relativeCap.actualMinDelta = actualMinDelta
			return relativeCap, value, true
		}
	}
	return reforgeRelativeStatCap{}, 0, false
}

func addRelativeStatCapConstraints(search *reforgeSearchState, choiceVarIdx [][]int, model *mipModel, relativeCaps []reforgeRelativeStatCap) {
	for _, relativeCap := range relativeCaps {
		constraint := newMIPConstraint(relativeCap.minDelta, math.Inf(1), 0)
		for slotIdx, slot := range search.slots {
			for choiceIdx, choice := range slot.choices {
				if choiceVarIdx[slotIdx][choiceIdx] < 0 {
					continue
				}
				coefficientDelta := choiceRelativeCapDelta(choice)
				coefficient := getUnitStat(coefficientDelta, relativeCap.forcedStat) - getUnitStat(coefficientDelta, relativeCap.constrainedStat)
				if coefficient != 0 {
					constraint.addCoefficient(choiceVarIdx[slotIdx][choiceIdx], coefficient)
				}
			}
		}
		if constraint.coefficientCount() > 0 {
			model.constraints = append(model.constraints, constraint)
		}
	}
}

func choiceObjectiveDelta(choice reforgeChoice) core.UnitStats {
	if !isEmptyUnitStats(choice.objectiveDelta) {
		return choice.objectiveDelta
	}
	return choice.delta
}

func choiceCoefficientDelta(choice reforgeChoice) core.UnitStats {
	if !isEmptyUnitStats(choice.delta) {
		return choice.delta
	}
	return choiceObjectiveDelta(choice)
}

func choiceRelativeCapDelta(choice reforgeChoice) core.UnitStats {
	return choiceObjectiveDelta(choice)
}

func addSocketBonusLinkConstraints(search *reforgeSearchState, choiceVarIdx [][]int, model *mipModel) {
	for groupIdx, group := range search.slots {
		for choiceIdx, choice := range group.choices {
			if !choice.socketBonus || len(choice.bonusSocketIdxs) == 0 {
				continue
			}
			bonusVarIdx := choiceVarIdx[groupIdx][choiceIdx]
			if bonusVarIdx < 0 {
				continue
			}
			for _, socketIdx := range choice.bonusSocketIdxs {
				constraint := newMIPConstraint(math.Inf(-1), 0, 1)
				constraint.addCoefficient(bonusVarIdx, 1)
				for socketGroupIdx, socketGroup := range search.slots {
					for socketChoiceIdx, socketChoice := range socketGroup.choices {
						if socketChoice.slot == choice.slot && socketChoice.socketChoice && socketChoice.socketIdx == socketIdx && socketChoice.socketMatches && choiceVarIdx[socketGroupIdx][socketChoiceIdx] >= 0 {
							constraint.addCoefficient(choiceVarIdx[socketGroupIdx][socketChoiceIdx], -1)
						}
					}
				}
				model.constraints = append(model.constraints, constraint)
			}
		}
	}
}

func updateHiGHSCapPass(search *reforgeSearchState, passIdx int, delta core.UnitStats, weights core.UnitStats, softCaps []reforgeSoftCap, statConstraints []mipStatConstraint, relativeCaps []reforgeRelativeStatCap, constrainedStats map[stats.UnitStat]bool) (bool, core.UnitStats, []reforgeSoftCap, []mipStatConstraint, []reforgeRelativeStatCap) {
	for idx, constraint := range statConstraints {
		value := getUnitStat(delta, constraint.unitStat)
		if constraint.hasActualLower && value < constraint.actualLower-1e-6 {
			missing := constraint.actualLower - value
			// If the actual value also violates the tightened LP lower bound, the LP
			// approximation has a systematic error. Tighten by the larger LP violation
			// to avoid many small increments before the LP produces a different solution.
			if lpMissing := constraint.lower - value; lpMissing > missing+1e-6 {
				statConstraints[idx].lower += lpMissing + 1e-6
			} else {
				statConstraints[idx].lower += missing + 1e-6
			}
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d tightening min cap stat=%s valueDelta=%.3f requiredDelta=%.3f adjustedDelta=%.3f", passIdx+1, unitStatName(constraint.unitStat), value, constraint.actualLower, statConstraints[idx].lower)
			}
			return true, weights, softCaps, statConstraints, relativeCaps
		}
		if constraint.hasActualUpper && value > constraint.actualUpper+1e-6 {
			excess := value - constraint.actualUpper
			statConstraints[idx].upper -= excess + 1e-6
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d tightening max cap stat=%s valueDelta=%.3f requiredDelta=%.3f adjustedDelta=%.3f", passIdx+1, unitStatName(constraint.unitStat), value, constraint.actualUpper, statConstraints[idx].upper)
			}
			return true, weights, softCaps, statConstraints, relativeCaps
		}
	}

	for _, hardCap := range search.hardCaps {
		value := getUnitStat(delta, hardCap.unitStat)
		if hardCap.cap == 0 || value <= hardCap.cap+1e-9 || constrainedStats[hardCap.unitStat] {
			continue
		}
		if hardCap.undershoot {
			statConstraints = append(statConstraints, mipStatConstraint{unitStat: hardCap.unitStat, lower: math.Inf(-1), upper: hardCap.cap, actualUpper: hardCap.cap, hasActualUpper: true})
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d adding max cap stat=%s valueDelta=%.3f capDelta=%.3f", passIdx+1, unitStatName(hardCap.unitStat), value, hardCap.cap)
			}
		} else {
			statConstraints = append(statConstraints, mipStatConstraint{unitStat: hardCap.unitStat, lower: hardCap.cap, upper: math.Inf(1), actualLower: hardCap.cap, hasActualLower: true})
			weights = setUnitStat(weights, hardCap.unitStat, 0)
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d adding min cap stat=%s valueDelta=%.3f capDelta=%.3f newWeight=0", passIdx+1, unitStatName(hardCap.unitStat), value, hardCap.cap)
			}
		}
		constrainedStats[hardCap.unitStat] = true
		return true, weights, softCaps, statConstraints, relativeCaps
	}

	remainingSoftCaps := make([]reforgeSoftCap, 0, len(softCaps))
	for softCapIdx, softCap := range softCaps {
		value := getUnitStat(delta, softCap.unitStat)
		exceededBreakpointIdx := -1
		for idx, breakpoint := range softCap.breakpoints {
			if value > breakpoint+1e-9 {
				exceededBreakpointIdx = idx
				break
			}
		}
		if exceededBreakpointIdx == -1 {
			remainingSoftCaps = append(remainingSoftCaps, softCap)
			continue
		}

		statConstraints = append(statConstraints, mipStatConstraint{unitStat: softCap.unitStat, lower: softCap.breakpoints[exceededBreakpointIdx], upper: math.Inf(1), actualLower: softCap.breakpoints[exceededBreakpointIdx], hasActualLower: true})
		if exceededBreakpointIdx < len(softCap.postCapEPs) {
			weights = setUnitStat(weights, softCap.unitStat, softCap.postCapEPs[exceededBreakpointIdx])
		}
		if reforgeDebug(search) {
			log.Printf("[reforgeOptimize] HiGHS pass=%d adding breakpoint stat=%s valueDelta=%.3f breakpointDelta=%.3f newWeight=%.3f", passIdx+1, unitStatName(softCap.unitStat), value, softCap.breakpoints[exceededBreakpointIdx], getUnitStat(weights, softCap.unitStat))
		}
		if softCap.capType == proto.StatCapType_TypeSoftCap {
			softCap.breakpoints = softCap.breakpoints[exceededBreakpointIdx+1:]
			softCap.postCapEPs = softCap.postCapEPs[min(exceededBreakpointIdx+1, len(softCap.postCapEPs)):]
			if len(softCap.breakpoints) > 0 {
				remainingSoftCaps = append(remainingSoftCaps, softCap)
			}
			remainingSoftCaps = append(remainingSoftCaps, softCaps[softCapIdx+1:]...)
		} else {
			remainingSoftCaps = append(remainingSoftCaps, softCaps[softCapIdx+1:]...)
		}
		return true, weights, remainingSoftCaps, statConstraints, relativeCaps
	}

	if relativeCap, value, violated := exactRelativeCapViolation(relativeCaps, delta); violated {
		for idx := range relativeCaps {
			if relativeCaps[idx].forcedStat != relativeCap.forcedStat || relativeCaps[idx].constrainedStat != relativeCap.constrainedStat {
				continue
			}
			missing := relativeCap.actualMinDelta - value
			relativeCaps[idx].minDelta += missing + 1e-6
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d tightening relative cap forced=%s constrained=%s valueDelta=%.3f requiredDelta=%.3f adjustedDelta=%.3f", passIdx+1, unitStatName(relativeCap.forcedStat), unitStatName(relativeCap.constrainedStat), value, relativeCap.actualMinDelta, relativeCaps[idx].minDelta)
			}
			return true, weights, softCaps, statConstraints, relativeCaps
		}
	}

	return false, weights, softCaps, statConstraints, relativeCaps
}

func selectedChoicesValid(choices []reforgeChoice) bool {
	jewelcraftingGems := 0
	shaTouchedGems := 0
	uniqueGemIDs := map[int32]bool{}
	for _, choice := range choices {
		if !canAddChoice(choice, jewelcraftingGems, shaTouchedGems, uniqueGemIDs) {
			return false
		}
		jewelcraftingGems += choice.jewelcraftingGems
		shaTouchedGems += choice.shaTouchedGems
		for _, gemID := range choice.uniqueGemIDs {
			uniqueGemIDs[gemID] = true
		}
	}
	return true
}

func selectedChoicesCapDelta(search *reforgeSearchState, choices []reforgeChoice) (core.UnitStats, error) {
	gear := equipmentSpecWithChoices(search.baseEquipment, choices)
	search.workingRaid.Parties[0].Players[0].Equipment = gear
	result := computeReforgeStats(search.workingStatsRequest)
	if result.ErrorResult != "" {
		return core.UnitStats{}, fmt.Errorf("computing selected reforge choices: %s", result.ErrorResult)
	}
	optimizedStats := protoToCoreUnitStats(result.RaidStats.Parties[0].Players[0].FinalStats)
	optimizedStats.Stats[stats.MasteryRating] += 8 * core.MasteryRatingPerMasteryPoint
	return subtractUnitStats(optimizedStats, search.capBaseStats), nil
}

func cloneSoftCaps(softCaps []reforgeSoftCap) []reforgeSoftCap {
	cloned := make([]reforgeSoftCap, len(softCaps))
	for idx, softCap := range softCaps {
		cloned[idx] = reforgeSoftCap{
			unitStat:    softCap.unitStat,
			breakpoints: slices.Clone(softCap.breakpoints),
			postCapEPs:  slices.Clone(softCap.postCapEPs),
			capType:     softCap.capType,
		}
	}
	return cloned
}

func countSoftCapBreakpoints(softCaps []reforgeSoftCap) int {
	count := 0
	for _, softCap := range softCaps {
		count += len(softCap.breakpoints)
	}
	return count
}

func buildChoiceLimitConstraint(search *reforgeSearchState, choiceVarIdx [][]int, coefficient func(reforgeChoice) float64, upper float64) mipConstraint {
	constraint := newMIPConstraint(math.Inf(-1), upper, 0)
	for slotIdx, slot := range search.slots {
		for choiceIdx, choice := range slot.choices {
			if choiceVarIdx[slotIdx][choiceIdx] < 0 {
				continue
			}
			if value := coefficient(choice); value != 0 {
				constraint.addCoefficient(choiceVarIdx[slotIdx][choiceIdx], value)
			}
		}
	}
	return constraint
}
