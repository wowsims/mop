//go:build !(js && wasm)

package reforgeoptimizer

import (
	"testing"
	"time"
)

func TestSolveMIPWithHiGHSWASM(t *testing.T) {
	constraint := newMIPConstraint(1, 1, 2)
	constraint.addCoefficient(0, 1)
	constraint.addCoefficient(1, 1)
	model := mipModel{
		variables: []mipVariable{
			{objective: -1, upper: 1, integer: true},
			{objective: -2, upper: 1, integer: true},
		},
		constraints: []mipConstraint{constraint},
	}

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
