//go:build js && wasm

package reforgeoptimizer

import (
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"
	"time"
)

type highsJSSolution struct {
	Status string             `json:"status"`
	Values map[string]float64 `json:"values"`
	Error  string             `json:"error"`
}

func solveMIPWithHiGHS(model mipModel, timeout time.Duration, mipRelGap float64) (mipSolution, bool, error) {
	solve := js.Global().Get("__wowsimsSolveHiGHSLP")
	if solve.Type() != js.TypeFunction {
		return mipSolution{}, false, fmt.Errorf("HiGHS JavaScript solver bridge is not available")
	}

	result := solve.Invoke(modelToHiGHSLP(model), timeout.Seconds(), mipRelGap)
	if result.Type() != js.TypeString {
		return mipSolution{}, false, fmt.Errorf("HiGHS JavaScript solver bridge returned %s, expected string", result.Type().String())
	}

	var highsSolution highsJSSolution
	if err := json.Unmarshal([]byte(result.String()), &highsSolution); err != nil {
		return mipSolution{}, false, fmt.Errorf("parsing HiGHS JavaScript solver result: %w", err)
	}
	if highsSolution.Error != "" {
		return mipSolution{}, false, fmt.Errorf("HiGHS JavaScript solve failed: %s", highsSolution.Error)
	}

	solved := highsSolution.Status == "Optimal" || strings.EqualFold(highsSolution.Status, "Time limit reached")
	if !solved {
		return mipSolution{}, false, nil
	}

	solution := mipSolution{values: make([]float64, len(model.variables))}
	for variableIdx := range model.variables {
		value, ok := highsSolution.Values[fmt.Sprintf("x%d", variableIdx)]
		if !ok {
			return mipSolution{}, false, fmt.Errorf("HiGHS JavaScript solution missing variable x%d", variableIdx)
		}
		solution.values[variableIdx] = value
	}
	return solution, true, nil
}
