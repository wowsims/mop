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

// tinyHiGHSWasmLP maximizes x0 + 2 x1 subject to x0 + x1 <= 1 (binary), whose optimum is
// x0=0, x1=1.
const tinyHiGHSWasmLP = "Maximize\n obj: 1 x0 + 2 x1\nSubject To\n c0: 1 x0 + 1 x1 <= 1\nBinary\n x0\n x1\nEnd"

func TestRunHiGHSLPWASM(t *testing.T) {
	values, modelStatus, err := runHiGHSLP(tinyHiGHSWasmLP, 2, 5*time.Second, 0)
	if err != nil {
		t.Fatalf("runHiGHSLP returned error: %v", err)
	}
	if modelStatus != highsModelStatusOptimal {
		t.Fatalf("expected optimal model status %d, got %d", highsModelStatusOptimal, modelStatus)
	}
	if len(values) != 2 || values[0] >= 0.5 || values[1] < 0.5 {
		t.Fatalf("expected optimum x0=0, x1=1; got %v", values)
	}
}

// TestHiGHSWasmStackDoesNotGrowAcrossSolves pins the stackAlloc bracketing in runHiGHSLP. The C
// strings each solve passes to the Highs_* entry points are allocated on emscripten's stack and
// never freed, so a runtime coming back out of the pool must have the same stack pointer it went
// in with; otherwise a long-lived pool overflows its stack after enough solves.
func TestHiGHSWasmStackDoesNotGrowAcrossSolves(t *testing.T) {
	// Prime the pool so the loop below reuses one runtime rather than instantiating new ones.
	if _, _, err := runHiGHSLP(tinyHiGHSWasmLP, 2, 5*time.Second, 0); err != nil {
		t.Fatalf("runHiGHSLP warmup returned error: %v", err)
	}

	pooledStackPointer := func() int32 {
		t.Helper()
		runtime := <-highsWasmRuntimePool
		defer func() { highsWasmRuntimePool <- runtime }()
		stackPointer, err := callI32(runtime.ctx, runtime.stackSave)
		if err != nil {
			t.Fatalf("reading HiGHS wasm stack pointer: %v", err)
		}
		return stackPointer
	}

	before := pooledStackPointer()
	for range 20 {
		if _, _, err := runHiGHSLP(tinyHiGHSWasmLP, 2, 5*time.Second, 0); err != nil {
			t.Fatalf("runHiGHSLP returned error: %v", err)
		}
	}
	if after := pooledStackPointer(); after != before {
		t.Errorf("HiGHS wasm stack pointer moved %d bytes over 20 solves (%d -> %d); each solve is leaking its stackAlloc'd strings",
			before-after, before, after)
	}
}

func BenchmarkRunHiGHSLPWASM(b *testing.B) {
	b.ReportAllocs()
	if _, _, err := runHiGHSLP(tinyHiGHSWasmLP, 2, 5*time.Second, 0); err != nil {
		b.Fatalf("runHiGHSLP warmup returned error: %v", err)
	}
	b.ResetTimer()

	for range b.N {
		if _, _, err := runHiGHSLP(tinyHiGHSWasmLP, 2, 5*time.Second, 0); err != nil {
			b.Fatalf("runHiGHSLP returned error: %v", err)
		}
	}
}
