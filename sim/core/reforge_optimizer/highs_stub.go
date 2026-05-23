//go:build !highs

package reforgeoptimizer

import (
	"fmt"
	"time"
)

func solveMIPWithHiGHS(_ mipModel, _ time.Duration, _ float64) (mipSolution, bool, error) {
	return mipSolution{}, false, fmt.Errorf("HiGHS WebAssembly backend is not available; rebuild with the highs build tag")
}
