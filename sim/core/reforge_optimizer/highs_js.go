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

// runHiGHSLP runs the given CPLEX LP text through the browser's highs.wasm via the
// __wowsimsSolveHiGHSLP bridge the host page exposes. Solver options: presolve on, a time limit,
// and no relative MIP gap (HiGHS default). Returns per-variable primal values (indexed by x{i}),
// the HiGHS model status, and any error.
func runHiGHSLP(lpString string, numVars int, timeout time.Duration, mipRelGap float64) ([]float64, int32, error) {
	solve := js.Global().Get("__wowsimsSolveHiGHSLP")
	if solve.Type() != js.TypeFunction {
		return nil, 0, fmt.Errorf("HiGHS JavaScript solver bridge is not available")
	}

	// The bridge signature is (lpString, timeoutSeconds, mipRelGap); 0 leaves the gap at the HiGHS
	// default (every non-relative-cap solve).
	result := solve.Invoke(lpString, timeout.Seconds(), mipRelGap)
	if result.Type() != js.TypeString {
		return nil, 0, fmt.Errorf("HiGHS JavaScript solver bridge returned %s, expected string", result.Type().String())
	}

	var highsSolution highsJSSolution
	if err := json.Unmarshal([]byte(result.String()), &highsSolution); err != nil {
		return nil, 0, fmt.Errorf("parsing HiGHS JavaScript solver result: %w", err)
	}
	if highsSolution.Error != "" {
		return nil, 0, fmt.Errorf("HiGHS JavaScript solve failed: %s", highsSolution.Error)
	}

	var modelStatus int32
	switch {
	case highsSolution.Status == "Optimal":
		modelStatus = highsModelStatusOptimal
	case strings.EqualFold(highsSolution.Status, "Time limit reached"):
		modelStatus = highsModelStatusTimeLimit
	case highsSolution.Status == "Infeasible":
		return nil, highsModelStatusInfeasible, nil
	default:
		return nil, 0, nil
	}

	values := make([]float64, numVars)
	for variableIdx := range values {
		value, ok := highsSolution.Values[fmt.Sprintf("x%d", variableIdx)]
		if !ok {
			if modelStatus == highsModelStatusTimeLimit {
				return nil, modelStatus, nil
			}
			return nil, 0, fmt.Errorf("HiGHS JavaScript solution missing variable x%d", variableIdx)
		}
		values[variableIdx] = value
	}
	return values, modelStatus, nil
}

// WarmUp is a no-op on js/wasm: the browser compiles the HiGHS solver lazily, and there is no
// Go server startup to pre-warm. Present so the exported symbol matches the native build (see
// highswasm.go).
func WarmUp() error { return nil }
