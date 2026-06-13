//go:build !(js && wasm)

package reforgeoptimizer

import (
	"strconv"
	"testing"
	"time"
)

func TestHiGHSWasmRuntimeConcurrencyUsesEnvOverride(t *testing.T) {
	t.Setenv("WOWSIMS_HIGHS_WASM_RUNTIME_CONCURRENCY", "7")

	if got := getHiGHSWasmRuntimeConcurrency(); got != 7 {
		t.Fatalf("runtime concurrency = %d, want env override 7", got)
	}
}

func TestDefaultHiGHSWasmRuntimeConcurrency(t *testing.T) {
	testCases := []struct {
		numCPU int
		want   int
	}{
		{numCPU: 1, want: 1},
		{numCPU: 2, want: 2},
		{numCPU: 4, want: 4},
		{numCPU: 18, want: 18},
	}

	for _, testCase := range testCases {
		t.Run(strconv.Itoa(testCase.numCPU), func(t *testing.T) {
			if got := defaultHiGHSWasmRuntimeConcurrency(testCase.numCPU); got != testCase.want {
				t.Fatalf("default concurrency for %d CPUs = %d, want %d", testCase.numCPU, got, testCase.want)
			}
		})
	}
}

func TestSolveMIPWithHiGHSWASM(t *testing.T) {
	model := tinyHiGHSWasmBenchmarkModel()

	solution, solved, err := solveMIPWithHiGHS(model, 5*time.Second, 0)
	if err != nil {
		t.Fatalf("solveMIPWithHiGHS returned error: %v", err)
	}
	if !solved {
		t.Fatalf("solveMIPWithHiGHS did not solve tiny MIP")
	}
	if solution.values[0] < 0.5 || solution.values[1] >= 0.5 {
		t.Fatalf("expected equality-constrained optimum x0=1, x1=0; got %v", solution.values)
	}
}

func BenchmarkSolveMIPWithHiGHSWASM(b *testing.B) {
	model := tinyHiGHSWasmBenchmarkModel()
	b.ReportAllocs()
	if _, solved, err := solveMIPWithHiGHS(model, 5*time.Second, 0); err != nil {
		b.Fatalf("solveMIPWithHiGHS warmup returned error: %v", err)
	} else if !solved {
		b.Fatalf("solveMIPWithHiGHS warmup did not solve tiny MIP")
	}
	b.ResetTimer()

	for range b.N {
		_, solved, err := solveMIPWithHiGHS(model, 5*time.Second, 0)
		if err != nil {
			b.Fatalf("solveMIPWithHiGHS returned error: %v", err)
		}
		if !solved {
			b.Fatalf("solveMIPWithHiGHS did not solve tiny MIP")
		}
	}
}

func tinyHiGHSWasmBenchmarkModel() mipModel {
	constraint := newMIPConstraint(1, 1, 2)
	constraint.addCoefficient(0, 1)
	constraint.addCoefficient(1, 1)
	return mipModel{
		variables: []mipVariable{
			{objective: -1, upper: 1, integer: true},
			{objective: -2, upper: 1, integer: true},
		},
		constraints: []mipConstraint{constraint},
	}
}
