package reforgeoptimizer

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// solver.go implements solveModel + checkCaps (the cap-refinement loop) and the thin adapter
// that runs the LP text through the shared HiGHS runtime. The loop is pure LP: caps are checked
// against the summed LP coefficients of the selected variables, so no sim recompute happens
// between passes.

// HiGHS model-status codes, shared by both runtime backends (the native wazero runner and the
// wasm bridge).
const (
	highsModelStatusOptimal    int32 = 7
	highsModelStatusInfeasible int32 = 8
	highsModelStatusTimeLimit  int32 = 13
)

// solveLPModel serializes model to LP text, runs HiGHS, and returns the selected variables
// (column primal >= 0.5), in x-index order.
func solveLPModel(model *lpModel, timeout time.Duration) (lpSolution, error) {
	lpString, reverseNames := modelToLPFormat(model)
	values, modelStatus, err := runHiGHSLP(lpString, len(reverseNames), timeout)
	if err != nil {
		return lpSolution{}, err
	}

	status := "unknown"
	switch modelStatus {
	case highsModelStatusOptimal:
		status = "optimal"
	case highsModelStatusTimeLimit:
		status = "timedout"
	case highsModelStatusInfeasible:
		status = "infeasible"
	}

	var selected []string
	for i := 0; i < len(values) && i < len(reverseNames); i++ {
		if values[i] >= 0.5 {
			selected = append(selected, reverseNames[i])
		}
	}

	result := math.NaN()
	if len(values) > 0 {
		result = 0
		for _, name := range selected {
			if coeffs, ok := model.variables.get(name); ok {
				result += coeffs["score"]
			}
		}
	}

	return lpSolution{
		status:    status,
		result:    result,
		variables: selected,
		bounded:   status == "optimal",
		feasible:  status == "optimal",
	}, nil
}

// solveModel scores the variables, solves, then checks caps and recurses with tightened
// constraints/weights until no cap is exceeded. Returns the selected variable names of the final
// solution and its objective value.
func (o *reforgeOptimizer) solveModel(
	weights core.UnitStats,
	reforgeCaps core.UnitStats,
	reforgeSoftCaps []*reforgeSoftCap,
	variables *lpVariables,
	constraints *lpConstraints,
	maxSeconds float64,
) ([]string, float64, error) {
	if o.signals.Abort.IsTriggered() {
		return nil, 0, context.Canceled
	}

	updatedVariables := o.updateReforgeScores(variables, weights)
	model := &lpModel{
		direction:   "maximize",
		objective:   "score",
		constraints: constraints,
		variables:   updatedVariables,
		binaries:    true,
	}

	startedAt := time.Now()
	solution, err := solveLPModel(model, time.Duration(maxSeconds*float64(time.Second)))
	if err != nil {
		return nil, 0, err
	}

	if math.IsNaN(solution.result) || math.IsInf(solution.result, 1) {
		switch solution.status {
		case "infeasible":
			return nil, 0, errors.New("The specified stat caps are impossible to achieve. Consider changing any upper bound stat caps to lower bounds instead.")
		case "timedout":
			return nil, 0, errors.New("Solver timed out before finding a feasible solution.")
		default:
			return nil, 0, errors.New(solution.status)
		}
	}

	elapsedSeconds := time.Since(startedAt).Seconds()

	anyCapsExceeded, updatedConstraints, updatedWeights, updatedSoftCaps := o.checkCaps(solution, reforgeCaps, reforgeSoftCaps, updatedVariables, constraints, weights)
	if !anyCapsExceeded {
		return solution.variables, solution.result, nil
	}
	return o.solveModel(updatedWeights, reforgeCaps, updatedSoftCaps, updatedVariables, updatedConstraints, maxSeconds-elapsedSeconds)
}

// checkCaps sums the selected variables' stat contributions, then adds a hard-cap constraint for
// the first unconstrained stat that exceeds its cap, or a soft-cap breakpoint constraint
// otherwise. Returns whether any cap was newly enforced along with the tightened
// constraints/weights/soft-caps for the next pass.
func (o *reforgeOptimizer) checkCaps(
	solution lpSolution,
	reforgeCaps core.UnitStats,
	reforgeSoftCaps []*reforgeSoftCap,
	variables *lpVariables,
	constraints *lpConstraints,
	currentWeights core.UnitStats,
) (bool, *lpConstraints, core.UnitStats, []*reforgeSoftCap) {
	reforgeStatContribution := core.NewUnitStats()
	for _, variableKey := range solution.variables {
		coeffs, ok := variables.get(variableKey)
		if !ok {
			continue
		}
		for key, value := range coeffs {
			if unitStat, ok := unitStatFromCoeffKey(key); ok {
				reforgeStatContribution = setUnitStat(reforgeStatContribution, unitStat, getUnitStat(reforgeStatContribution, unitStat)+value)
			}
		}
	}

	anyCapsExceeded := false
	updatedConstraints := constraints.clone()
	updatedWeights := currentWeights

	eachUnitStat(reforgeStatContribution, func(unitStat stats.UnitStat, value float64) {
		cap := getUnitStat(reforgeCaps, unitStat)
		statName := coeffKeyForUnitStat(unitStat)
		if cap != 0 && value > cap && !constraints.has(statName) {
			anyCapsExceeded = true
			if getUnitStat(o.undershootCaps, unitStat) != 0 {
				updatedConstraints.set(statName, lessEq(cap))
			} else {
				updatedConstraints.set(statName, greaterEq(cap))
				updatedWeights = setUnitStat(updatedWeights, unitStat, 0)
			}
		}
	})

	updatedSoftCaps := reforgeSoftCaps
	if !anyCapsExceeded && len(reforgeSoftCaps) > 0 {
		remaining := make([]*reforgeSoftCap, 0, len(reforgeSoftCaps))
		for _, softCap := range reforgeSoftCaps {
			if anyCapsExceeded {
				remaining = append(remaining, softCap)
				continue
			}

			unitStat := softCap.unitStat
			statName := coeffKeyForUnitStat(unitStat)
			currentValue := getUnitStat(reforgeStatContribution, unitStat)

			exceededBreakpointIdx := -1
			for i, breakpoint := range softCap.breakpoints {
				if currentValue > breakpoint {
					exceededBreakpointIdx = i
					break
				}
			}
			if exceededBreakpointIdx == -1 {
				remaining = append(remaining, softCap)
				continue
			}

			updatedConstraints.set(statName, greaterEq(softCap.breakpoints[exceededBreakpointIdx]))
			updatedWeights = setUnitStat(updatedWeights, unitStat, softCap.postCapEPs[exceededBreakpointIdx])
			anyCapsExceeded = true

			// True soft caps (ascending) drop the consumed breakpoints and stay in play;
			// threshold caps (descending) are removed entirely after the first pass.
			if softCap.capType == proto.StatCapType_TypeSoftCap {
				softCap.breakpoints = softCap.breakpoints[exceededBreakpointIdx+1:]
				softCap.postCapEPs = softCap.postCapEPs[exceededBreakpointIdx+1:]
				if len(softCap.breakpoints) > 0 {
					remaining = append(remaining, softCap)
				}
			}
		}
		updatedSoftCaps = remaining
	}

	return anyCapsExceeded, updatedConstraints, updatedWeights, updatedSoftCaps
}
