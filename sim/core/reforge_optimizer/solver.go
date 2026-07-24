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

func hasStatConstraint(statConstraints []mipStatConstraint, unitStat stats.UnitStat) bool {
	for _, constraint := range statConstraints {
		if constraint.unitStat == unitStat {
			return true
		}
	}
	return false
}

// Iterative cap-refinement loop: solve the MIP → evaluate caps on the real sim result →
// tighten constraints → repeat until no cap is violated or the pass limit is reached.
// Hard caps, soft cap breakpoints, and relative caps are each handled as separate
// constraint-tightening events within updateHiGHSCapPass.
//
// Pre-seeding every hard cap's constraint up front (see trySolveWithHiGHSPass) assumes
// each one is individually reachable. When multiple hard caps are configured, they can be
// jointly infeasible even though most are perfectly achievable on their own (e.g. an
// Expertise floor and a Hit floor both reachable, alongside a Crit floor set above what
// any gear combination on this character can produce). Demanding all of them
// simultaneously makes the LP outright infeasible; the correct answer is to keep
// enforcing every cap that IS reachable and only give up on the one that isn't — not
// abandon cap enforcement entirely.
//
// So: try with every hard cap seeded. If that's infeasible, drop the single
// largest-magnitude cap (the most likely culprit — the most demanding ask is the most
// likely to be the unreachable one) and retry, repeating until either a solve succeeds or
// every hard cap has been dropped. Dropped caps just float unconstrained for that solve,
// same as if they were never configured.
func trySolveWithHiGHS(search *reforgeSearchState, signals simsignals.Signals) ([]reforgeChoice, float64, bool, error) {
	dropped := map[stats.UnitStat]bool{}
	for _, hardCap := range search.hardCaps {
		if hardCap.cap == 0 || dropped[hardCap.unitStat] {
			continue
		}
		if !hardCapIndividuallyReachable(search, hardCap) {
			dropped[hardCap.unitStat] = true
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] hard cap stat=%s unreachable even in isolation (best possible falls short of cap=%.3f), dropping before HiGHS", unitStatName(hardCap.unitStat), hardCap.cap)
			}
		}
	}
	for {
		choices, score, ok, err, infeasible := trySolveWithHiGHSPass(search, signals, dropped)
		if !infeasible {
			return choices, score, ok, err
		}
		victim, found := largestUndroppedHardCap(search.hardCaps, dropped)
		if !found {
			return choices, score, ok, err
		}
		dropped[victim] = true
		if reforgeDebug(search) {
			log.Printf("[reforgeOptimize] HiGHS caps infeasible, giving up on stat=%s (likely unreachable with available gear) and retrying", unitStatName(victim))
		}
	}
}

// Cheap, generous bound on whether a single hard cap could possibly be met on its own,
// ignoring every other constraint (cross-stat interactions, unique-gem limits,
// socket-bonus links) — those can only make the true achievable value worse, never better,
// so this only ever proves a cap unreachable, never wrongly proves one reachable. It sums,
// per slot, the best single choice's contribution to this stat (0 if the no-op choice is
// best) — a strict overestimate of what's jointly achievable once every other constraint is
// back in play.
//
// Catching a truly unreachable cap here means it never gets pre-seeded into pass 0, so
// HiGHS never has to spend a full (potentially 1s+) infeasibility proof on a cap this
// single pass over choices already knows can't be met.
func hardCapIndividuallyReachable(search *reforgeSearchState, hardCap reforgeHardCap) bool {
	extreme := 0.0
	for _, slot := range search.slots {
		best := 0.0 // the slot's no-op choice always contributes 0
		for _, choice := range slot.choices {
			if !choiceMIPActive(choice) {
				continue
			}
			value := getUnitStat(choiceCoefficientDelta(choice), hardCap.unitStat)
			if hardCap.undershoot {
				if value < best {
					best = value
				}
			} else if value > best {
				best = value
			}
		}
		extreme += best
	}
	if hardCap.undershoot {
		return extreme <= hardCap.cap+1e-6
	}
	return extreme >= hardCap.cap-1e-6
}

// Returns the hard cap that's the most likely culprit among those still genuinely unmet
// (cap > 0 — a floor still short of its target, or a ceiling already being pushed past).
// A cap already satisfied at baseline (cap <= 0, e.g. a floor already exceeded before any
// reforging) can never be the source of infeasibility and must never be a drop candidate:
// dropping it wouldn't help feasibility, and it would also stop that stat's weight from
// ever being reactively zeroed once over-satisfied, leaving the solver free to keep
// dumping unlimited rating into it for no real gain.
//
// Gaps are compared in rating-equivalent units, not raw cap magnitude — a raw-stat floor
// (e.g. Expertise, measured directly in rating) and a pseudo-stat floor (e.g. Crit,
// measured in percentage points) are on completely different scales, so naively comparing
// their cap values would pick whichever happens to use the bigger unit, not whichever is
// actually hardest to reach.
func largestUndroppedHardCap(hardCaps []reforgeHardCap, dropped map[stats.UnitStat]bool) (stats.UnitStat, bool) {
	best := stats.UnitStat(0)
	bestRatingEquivalent := -1.0
	found := false
	for _, hardCap := range hardCaps {
		if dropped[hardCap.unitStat] {
			continue
		}
		// Floor: only a problem if still short (cap > 0). Ceiling: only a problem if
		// baseline is already over it (cap < 0, since cap is target-minus-baseline).
		if hardCap.undershoot {
			if hardCap.cap >= 0 {
				continue
			}
		} else if hardCap.cap <= 0 {
			continue
		}
		ratingEquivalent := hardCap.cap
		if ratingEquivalent < 0 {
			ratingEquivalent = -ratingEquivalent
		}
		if hardCap.unitStat.IsPseudoStat() {
			ratingEquivalent *= ratingPerPseudoStatPercent(proto.PseudoStat(hardCap.unitStat.PseudoStatIdx()))
		}
		if ratingEquivalent > bestRatingEquivalent {
			bestRatingEquivalent = ratingEquivalent
			best = hardCap.unitStat
			found = true
		}
	}
	return best, found
}

// infeasible is true only when pass 1 (the very first solve, before any reactive
// tightening) fails — the specific, narrow signal that the currently-active seeded bounds
// are the problem, not a later, unrelated solver failure.
func trySolveWithHiGHSPass(search *reforgeSearchState, signals simsignals.Signals, droppedHardCaps map[stats.UnitStat]bool) ([]reforgeChoice, float64, bool, error, bool) {
	weights := search.weights
	softCaps := cloneSoftCaps(search.softCaps)
	relativeCaps := slices.Clone(search.relativeCaps)
	statConstraints := make([]mipStatConstraint, 0, len(search.hardCaps)+len(search.softCaps))
	constrainedStats := make(map[stats.UnitStat]bool, len(search.hardCaps)+1)
	maxPasses := max(1, 2*(len(search.hardCaps)+countSoftCapBreakpoints(search.softCaps)+1))
	deadline := time.Now().Add(highsOptimizerTimeout(search))
	debug := reforgeDebug(search)

	// Ceiling (undershoot) caps are known from settings before any solve — seed their LP
	// upper bound immediately rather than waiting to discover the overshoot reactively.
	//
	// Floor caps are deliberately NOT pre-seeded. A floor is enforced reactively, and only
	// once the EP objective naturally overshoots it (see the floor branch in updateHiGHSCapPass),
	// mirroring the JS optimizer: hit/expertise carry a large enough pre-cap EP weight that pass 1
	// overshoots massively and then locks at the cap, whereas a floor whose target sits above the
	// EP-optimal (e.g. an unreachable Mastery cap) is left EP-optimal instead of being stacked up
	// to the cap at the expense of higher-EP choices like matching socket-bonus gems. Pre-seeding
	// floors force-reached them regardless of EP, which is the wrong behavior for such stats.
	for _, hardCap := range search.hardCaps {
		if hardCap.cap == 0 {
			continue
		}
		if droppedHardCaps[hardCap.unitStat] {
			// Given up on this one in an earlier attempt (jointly infeasible with the
			// others) — leave it unconstrained for the rest of this solve.
			constrainedStats[hardCap.unitStat] = true
			continue
		}
		if !hardCap.undershoot {
			continue
		}
		statConstraints = append(statConstraints, mipStatConstraint{unitStat: hardCap.unitStat, lower: math.Inf(-1), upper: hardCap.cap, actualUpper: hardCap.cap, hasActualUpper: true})
		if debug {
			log.Printf("[reforgeOptimize] HiGHS pass=0 pre-seeding hard cap constraint stat=%s capDelta=%.3f undershoot=%v", unitStatName(hardCap.unitStat), hardCap.cap, hardCap.undershoot)
		}
	}

	for passIdx := 0; passIdx < maxPasses; passIdx++ {
		if signals.Abort.IsTriggered() {
			return nil, 0, false, context.Canceled, false
		}
		remainingTimeout := highsOptimizerPassTimeout(deadline)
		if remainingTimeout <= 0 {
			return nil, 0, false, nil, false
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
			return nil, 0, false, context.Canceled, false
		}
		var solveDuration time.Duration
		if debug {
			solveDuration = time.Since(solveStartedAt)
		}
		if err != nil || !ok {
			if debug {
				log.Printf("[reforgeOptimize] HiGHS pass=%d failure vars=%d constraints=%d err=%v", passIdx+1, len(model.variables), len(model.constraints), err)
			}
			return nil, 0, ok, err, passIdx == 0
		}

		var selectStartedAt time.Time
		if debug {
			selectStartedAt = time.Now()
		}
		choices, err := choicesFromMIPSolution(search, model, solution)
		if err != nil {
			return nil, 0, false, err, false
		}
		if !selectedChoicesValid(choices) {
			return nil, 0, false, nil, false
		}
		delta, err := selectedChoicesCapDelta(search, choices)
		if err != nil {
			return nil, 0, false, err, false
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
			return choices, score, ok, nil, false
		}
		weights = nextWeights
		softCaps = nextSoftCaps
		statConstraints = nextStatConstraints
		relativeCaps = nextRelativeCaps
	}

	return nil, 0, false, fmt.Errorf("HiGHS optimizer reached cap refinement pass limit"), false
}

// Relative-stat-cap problems produce harder MIPs (enforcing Crit > Haste > Mastery
// ordering across many reforge choices); they get 120s vs the standard 30s.
func highsOptimizerTimeout(search *reforgeSearchState) time.Duration {
	if len(search.relativeCaps) > 0 {
		return relativeStatCapOptimizerTimeout
	}
	return optimizerTimeout
}

// Returns time remaining to the deadline, floored at 1 second so the last pass still
// gets a chance to run rather than timing out immediately.
func highsOptimizerPassTimeout(deadline time.Time) time.Duration {
	remaining := time.Until(deadline)
	if remaining < time.Second {
		return time.Second
	}
	return remaining
}

// Uses a 0.05% relative MIP gap for relative-cap problems to trade a negligible
// optimality loss for faster convergence on hard MIPs; exact (0) otherwise.
func highsOptimizerMIPRelGap(search *reforgeSearchState) float64 {
	if len(search.relativeCaps) > 0 {
		return relativeStatCapMIPRelGap
	}
	return 0
}

// Maps binary MIP solution values back to reforgeChoice objects. Each slot is initialized
// to its first (no-op) choice, then overridden by any variable set to 1. Returns an error
// if any slot ends up with no selection (should not happen if the model is feasible).
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

// Constructs the full MIP model: one "at-most-one active choice" constraint per slot,
// socket-bonus link constraints, JC/Sha-Touched/unique-gem global limits, relative-cap
// linear constraints, and per-stat LP bounds accumulated from prior cap passes.
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

// Returns true for choices that require a MIP binary variable: non-zero reforges,
// non-empty gem assignments, and socket-bonus activations with bonusSocketIdxs set.
// No-op choices (reforgeID=0, empty gems) are the default and need no variable.
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

// Collects all gem IDs that appear in any choice's uniqueGemIDs list. Each ID gets its
// own "at most 1" MIP constraint to enforce the unique-equipped restriction.
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

// Checks whether the LP-feasible solution violates a relative cap when evaluated with
// exact sim stats. The LP uses a linear approximation that may be slightly off; a
// violation here triggers a constraint-tightening pass.
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

// Adds one LP constraint per relative cap:
// Σ (forcedStatDelta_i − constrainedStatDelta_i) × x_i ≥ minDelta
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

// Returns objectiveDelta if non-zero, falling back to delta. Choices with only a cap
// contribution (no separate EP delta) use delta as their objective approximation.
func choiceObjectiveDelta(choice reforgeChoice) core.UnitStats {
	if !isEmptyUnitStats(choice.objectiveDelta) {
		return choice.objectiveDelta
	}
	return choice.delta
}

// Returns delta if non-zero (dependency-resolved, correct for stat constraint
// coefficients), falling back to objectiveDelta for choices that don't have a separate
// delta computed.
func choiceCoefficientDelta(choice reforgeChoice) core.UnitStats {
	if !isEmptyUnitStats(choice.delta) {
		return choice.delta
	}
	return choiceObjectiveDelta(choice)
}

func choiceRelativeCapDelta(choice reforgeChoice) core.UnitStats {
	return choiceObjectiveDelta(choice)
}

// Links each socket-bonus activation variable to its required matching socket variables:
// bonus_var ≤ Σ matching_socket_var for each bonusSocketIdx. Prevents the solver from
// awarding the bonus without actually matching the sockets.
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

// Evaluates the latest solution against all caps and returns updated solver state for the
// next pass. Processes in priority order: tighten any LP bound that undershot its actual
// target → add the first new hard cap constraint violated → advance past the first
// exceeded soft cap breakpoint (and update its weight) → tighten any violated relative
// cap min delta. Returns false (no update) only when all caps are satisfied.
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

	// Ceiling caps arrive pre-seeded (trySolveWithHiGHS adds their upper bound before pass 1);
	// floor caps are NOT pre-seeded and are enforced entirely by this loop, reactively, once the
	// EP objective overshoots them. Either kind can also reach here unseeded when the full cap set
	// was jointly infeasible and trySolveWithHiGHS retried without seeding, so the loop stands on
	// its own for both.
	for _, hardCap := range search.hardCaps {
		if hardCap.cap == 0 || constrainedStats[hardCap.unitStat] {
			continue
		}
		value := getUnitStat(delta, hardCap.unitStat)
		hasConstraint := hasStatConstraint(statConstraints, hardCap.unitStat)
		if hardCap.undershoot {
			if hasConstraint {
				continue
			}
			if value <= hardCap.cap+1e-9 {
				continue
			}
			statConstraints = append(statConstraints, mipStatConstraint{unitStat: hardCap.unitStat, lower: math.Inf(-1), upper: hardCap.cap, actualUpper: hardCap.cap, hasActualUpper: true})
			if reforgeDebug(search) {
				log.Printf("[reforgeOptimize] HiGHS pass=%d reactively adding max cap stat=%s valueDelta=%.3f capDelta=%.3f", passIdx+1, unitStatName(hardCap.unitStat), value, hardCap.cap)
			}
			return true, weights, softCaps, statConstraints, relativeCaps
		}
		// Floor caps are enforced only once the EP objective naturally OVERSHOOTS them, mirroring
		// the JS optimizer (which pins a floor with greaterEq(cap) + zeroed weight solely when the
		// reforge contribution exceeds the cap). A floor stat that lands at or below its cap is
		// left EP-optimal — we no longer force it up to the cap. Force-reaching stacked stats like
		// Mastery to an unreachable cap, shedding EP-positive socket bonuses and Int; leaving it
		// EP-optimal instead lets the solver keep the higher-EP mixed gems. Hit/expertise still
		// reach their caps because their large pre-cap EP weight overshoots massively in pass 1.
		//
		// On overshoot: lock the floor (so later weight-zeroed passes can't shed below the cap)
		// and zero the pre-cap weight (so the solver trims any excess back down to the cap).
		if hasConstraint {
			continue
		}
		if value <= hardCap.cap+1e-9 {
			continue
		}
		statConstraints = append(statConstraints, mipStatConstraint{unitStat: hardCap.unitStat, lower: hardCap.cap, upper: math.Inf(1), actualLower: hardCap.cap, hasActualLower: true})
		weights = setUnitStat(weights, hardCap.unitStat, 0)
		constrainedStats[hardCap.unitStat] = true
		if reforgeDebug(search) {
			log.Printf("[reforgeOptimize] HiGHS pass=%d floor cap overshot, locking + zeroing weight stat=%s valueDelta=%.3f capDelta=%.3f", passIdx+1, unitStatName(hardCap.unitStat), value, hardCap.cap)
		}
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

		// Decide whether being past this breakpoint is worth locking in with a hard floor.
		// The current weight (set by the previous breakpoint, or the pre-cap weight on the
		// first) is the value of the segment just BELOW this breakpoint. If that below-segment
		// is already worth less than the best uncapped alternative the freed rating could go to
		// (e.g. Mastery for a caster), then forcing the stat up to this breakpoint is a net
		// loss — don't add a floor. Just lower the weight so the solver sheds the stat back to
		// the last beneficial floor, and stop advancing this soft cap. Without this, a stat
		// that momentarily overshoots a breakpoint (e.g. Crit nudged past its top breakpoint by
		// a later Haste refinement pass) gets pinned there at a post-cap rate below Mastery.
		skipFloor := false
		if softCap.capType == proto.StatCapType_TypeSoftCap && softCap.unitStat.IsPseudoStat() {
			pseudo := proto.PseudoStat(softCap.unitStat.PseudoStatIdx())
			// The below-segment value is the stat's current pre-lower weight; Haste (and its
			// speed-multiplier siblings) are amp-boosted in the objective, so put both sides of
			// the comparison on the same amped basis. Crit/Hit are not amped.
			belowPerRating := getUnitStat(weights, softCap.unitStat) / ratingPerPseudoStatPercent(pseudo) * softCapStatAmpFactor(pseudo, search.ampModifier)
			skipFloor = belowPerRating+1e-9 < bestUncappedReforgeAlternative(search, weights, search.ampModifier, softCap.unitStat)
		}

		if !skipFloor {
			statConstraints = append(statConstraints, mipStatConstraint{unitStat: softCap.unitStat, lower: softCap.breakpoints[exceededBreakpointIdx], upper: math.Inf(1), actualLower: softCap.breakpoints[exceededBreakpointIdx], hasActualLower: true})
		}
		if exceededBreakpointIdx < len(softCap.postCapEPs) {
			weights = setUnitStat(weights, softCap.unitStat, softCap.postCapEPs[exceededBreakpointIdx])
		}
		if reforgeDebug(search) {
			log.Printf("[reforgeOptimize] HiGHS pass=%d %s breakpoint stat=%s valueDelta=%.3f breakpointDelta=%.3f newWeight=%.3f", passIdx+1, map[bool]string{true: "shedding past", false: "adding"}[skipFloor], unitStatName(softCap.unitStat), value, softCap.breakpoints[exceededBreakpointIdx], getUnitStat(weights, softCap.unitStat))
		}
		if skipFloor {
			// Terminal: don't push this stat any higher. Drop it from further soft-cap
			// processing; the lowered weight plus the existing lower floor settle it there.
			remainingSoftCaps = append(remainingSoftCaps, softCaps[softCapIdx+1:]...)
			return true, weights, remainingSoftCaps, statConstraints, relativeCaps
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

// reforgeDumpStatCandidates are the secondary stats a reforge can produce — the pool of "dump"
// targets the freed rating from shedding a soft-capped stat could go to. Primary stats
// (Str/Agi/Int/etc.) are excluded because reforging can't create them.
var reforgeDumpStatCandidates = []stats.Stat{
	stats.HitRating, stats.CritRating, stats.HasteRating, stats.MasteryRating,
	stats.Spirit, stats.ExpertiseRating, stats.DodgeRating, stats.ParryRating,
}

// bestUncappedReforgeAlternative returns the highest effective per-rating EP among the uncapped
// secondary stats the freed rating could be reforged into — the real "dump" options for this
// spec, not a hardcoded one. A stat qualifies only if it carries EP weight and has no hard or
// soft cap configured (a capped stat's marginal value is bounded/position-dependent, so it's
// not a stable alternative). Haste/Mastery/Spirit are amp-boosted to match how the objective
// scores them. The stat being evaluated is excluded. Returns 0 when no uncapped alternative
// exists, which disables the floor-skip — so a spec with no uncapped dump behaves as before.
func bestUncappedReforgeAlternative(search *reforgeSearchState, weights core.UnitStats, ampModifier float64, excludeStat stats.UnitStat) float64 {
	best := 0.0
	for _, stat := range reforgeDumpStatCandidates {
		unitStat := stats.UnitStatFromStat(stat)
		if unitStat == excludeStat || statHasConfiguredCap(search, unitStat) {
			continue
		}
		weight := weights.Stats[stat]
		if weight == 0 {
			continue
		}
		if stat == stats.HasteRating || stat == stats.MasteryRating || stat == stats.Spirit {
			weight *= ampModifier
		}
		if weight > best {
			best = weight
		}
	}
	return best
}

// statHasConfiguredCap reports whether a stat has a hard or soft cap — directly, or via one of
// its percent pseudo-stat children (e.g. CritRating capped through SpellCritPercent).
func statHasConfiguredCap(search *reforgeSearchState, unitStat stats.UnitStat) bool {
	if _, ok := search.hardCapsByStat[unitStat]; ok {
		return true
	}
	if _, ok := search.softCapsByStat[unitStat]; ok {
		return true
	}
	if unitStat.IsStat() {
		for _, child := range childPseudoStats(stats.Stat(unitStat.StatIdx())) {
			childUnit := stats.UnitStatFromPseudoStat(child)
			if _, ok := search.hardCapsByStat[childUnit]; ok {
				return true
			}
			if _, ok := search.softCapsByStat[childUnit]; ok {
				return true
			}
		}
	}
	return false
}

// softCapStatAmpFactor returns the Amplification multiplier for a soft-capped pseudo-stat's
// weight, so it can be compared on the same basis as the amp-boosted Mastery alternative.
// Haste (all speed schools) is amplified; Crit and Hit are not.
func softCapStatAmpFactor(pseudo proto.PseudoStat, ampModifier float64) float64 {
	switch pseudo {
	case proto.PseudoStat_PseudoStatMeleeHastePercent, proto.PseudoStat_PseudoStatRangedHastePercent, proto.PseudoStat_PseudoStatSpellHastePercent:
		return ampModifier
	default:
		return 1
	}
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

// Runs a real sim stats computation on the selected gear to get accurate cap deltas.
// Adds the 8 free mastery points to align with how caps are expressed relative to the
// base stats (which include those points).
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

// Generic upper-bound constraint builder: sums coefficient(choice) × x_choice for all
// active choices. Used for JC gem limit (≤2), Sha-Touched limit (≤1), and unique-gem
// limits (≤1 per ID).
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
