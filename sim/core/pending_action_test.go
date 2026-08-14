package core

import "testing"

func TestCancelDoesNotRemoveSentinel(t *testing.T) {
	sim := &Simulation{
		pendingActions: []*PendingAction{sentinelPendingAction},
	}

	sentinelPendingAction.Cancel(sim)

	if len(sim.pendingActions) != 1 || sim.pendingActions[0] != sentinelPendingAction {
		t.Fatalf("Cancel removed the sentinel from pendingActions")
	}
	if sentinelPendingAction.cancelled {
		t.Fatalf("Cancel marked the sentinel cancelled")
	}
}

func TestStepEmptyQueueEndsIteration(t *testing.T) {
	sim := &Simulation{}
	if !sim.Step() {
		t.Fatal("Step on an empty pendingActions queue should end the iteration")
	}
}

func TestAddPendingActionRestoresSentinel(t *testing.T) {
	sim := &Simulation{}
	pa := &PendingAction{OnAction: func(*Simulation) {}}

	sim.AddPendingAction(pa)

	if len(sim.pendingActions) != 2 {
		t.Fatalf("expected [sentinel, pa], got len=%d", len(sim.pendingActions))
	}
	if sim.pendingActions[0] != sentinelPendingAction {
		t.Fatal("AddPendingAction did not restore the sentinel at index 0")
	}
	if sim.pendingActions[1] != pa {
		t.Fatal("AddPendingAction did not append the new action")
	}
}
