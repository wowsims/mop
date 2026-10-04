package core

import (
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

func TestValueConst(t *testing.T) {
	sim := &Simulation{}
	unit := &Unit{}
	rot := &APLRotation{
		unit: unit,
	}

	stringVal := rot.newValueConst(&proto.APLValueConst{Val: "test str"}, &proto.UUID{Value: ""})
	if stringVal.GetString(sim) != "test str" {
		t.Fatalf("Unexpected string value %s", stringVal.GetString(sim))
	}

	intVal := rot.newValueConst(&proto.APLValueConst{Val: "10"}, &proto.UUID{Value: ""})
	if intVal.GetInt(sim) != 10 {
		t.Fatalf("Unexpected int value %d", intVal.GetInt(sim))
	}

	floatVal := rot.newValueConst(&proto.APLValueConst{Val: "10.123"}, &proto.UUID{Value: ""})
	if floatVal.GetFloat(sim) != 10.123 {
		t.Fatalf("Unexpected float value %f", floatVal.GetFloat(sim))
	}

	durVal := rot.newValueConst(&proto.APLValueConst{Val: "10.123s"}, &proto.UUID{Value: ""})
	if durVal.GetDuration(sim) != time.Millisecond*10123 {
		t.Fatalf("Unexpected duration value %s", durVal.GetDuration(sim))
	}

	coercedDurVal := rot.coerceTo(floatVal, proto.APLValueType_ValueTypeDuration)
	if _, ok := coercedDurVal.(*APLValueConst); !ok {
		t.Fatalf("Failed to skip coerce wrapper for duration value")
	}
	if coercedDurVal.GetDuration(sim) != time.Millisecond*10123 {
		t.Fatalf("Unexpected coerced duration value %s", coercedDurVal.GetDuration(sim))
	}
}

// Regression test: when a group reference fills a placeholder used inside a
// comparison, the rebuilt APLValueCompare must carry the concrete lhsType.
// Without it, GetBool falls through its type switch and always returns false.
func TestGroupReferencePlaceholderCompare(t *testing.T) {
	sim := SetupFakeSim()
	unit := &sim.Raid.Parties[0].Players[0].GetCharacter().Unit
	rot := &APLRotation{unit: unit}
	action := &APLActionGroupReference{}

	// Build the compare exactly as the initial parse does when a placeholder is
	// present: coercion is deferred, so lhsType is ValueTypeUnknown.
	placeholder := &APLValueVariablePlaceholder{name: "threshold"}
	rhsConst := rot.newValueConst(&proto.APLValueConst{Val: "1"}, &proto.UUID{Value: ""})
	lhs, rhs := rot.coerceToSameType(placeholder, rhsConst)
	compare := &APLValueCompare{
		op:      proto.APLValueCompare_OpGt,
		lhs:     lhs,
		rhs:     rhs,
		lhsType: lhs.Type(),
	}

	variables := map[string]*proto.APLValue{
		"threshold": {Value: &proto.APLValue_Const{Const: &proto.APLValueConst{Val: "2"}}},
	}

	replaced, ok := action.replacePlaceholders(compare, variables, rot).(*APLValueCompare)
	if !ok {
		t.Fatalf("Placeholder replacement did not rebuild an APLValueCompare")
	}
	if replaced.lhsType == proto.APLValueType_ValueTypeUnknown {
		t.Fatalf("Rebuilt compare has unknown lhsType")
	}
	if !replaced.GetBool(sim) {
		t.Fatalf("Rebuilt compare evaluated 2 > 1 as false")
	}
}

func TestCastSpellWithoutSpellID(t *testing.T) {
	rot := &APLRotation{
		unit: &Unit{},
	}

	if action := rot.newActionCastSpell(&proto.APLActionCastSpell{}); action != nil {
		t.Fatalf("Expected no action for a cast without a spell, got %v", action)
	}
}

func TestValueAuraNumStacksFollowsCurrentTarget(t *testing.T) {
	request := fakeSimRequest()
	request.Encounter.Targets = append(request.Encounter.Targets, &proto.Target{Name: "second target", Level: 90, MobType: proto.MobType_MobTypeDemon})
	sim := setupFakeSimFrom(request)
	unit := &sim.Raid.Parties[0].Players[0].GetCharacter().Unit
	unit.ReactionTime = 100 * time.Millisecond
	rot := &APLRotation{unit: unit}
	first, second := sim.Encounter.AllTargetUnits[0], sim.Encounter.AllTargetUnits[1]
	debuffID := ActionID{SpellID: 910002}

	sim.Environment.State = Constructed
	registerDebuff := func(target *Unit) *Aura {
		return target.RegisterAura(Aura{Label: "Stacking Debuff", ActionID: debuffID, Duration: 30 * time.Second, MaxStacks: 5})
	}
	firstDebuff, secondDebuff := registerDebuff(first), registerDebuff(second)
	sim.Environment.State = Finalized

	config := &proto.APLValueAuraNumStacks{
		SourceUnit: &proto.UnitReference{Type: proto.UnitReference_CurrentTarget},
		AuraId:     debuffID.ToProto(),
	}
	numStacks := rot.newValueAuraNumStacks(config, nil)
	config.IncludeReactionTime = true
	reactedStacks := rot.newValueAuraNumStacks(config, nil)

	sim.CurrentTime = time.Second
	firstDebuff.Activate(sim)
	firstDebuff.SetStacks(sim, 3)
	sim.CurrentTime = 2 * time.Second
	if numStacks.GetInt(sim) != 3 || reactedStacks.GetInt(sim) != 3 {
		t.Errorf("first target: stacks = %d, with reaction time = %d, want 3, 3", numStacks.GetInt(sim), reactedStacks.GetInt(sim))
	}

	unit.CurrentTarget = second
	if numStacks.GetInt(sim) != 0 || reactedStacks.GetInt(sim) != 0 {
		t.Errorf("second target before its debuff: stacks = %d, with reaction time = %d, want 0, 0", numStacks.GetInt(sim), reactedStacks.GetInt(sim))
	}
	secondDebuff.Activate(sim)
	secondDebuff.SetStacks(sim, 2)
	sim.CurrentTime = 2*time.Second + 50*time.Millisecond
	if numStacks.GetInt(sim) != 2 || reactedStacks.GetInt(sim) != 0 {
		t.Errorf("second target inside the reaction time: stacks = %d, with reaction time = %d, want 2, 0", numStacks.GetInt(sim), reactedStacks.GetInt(sim))
	}
	sim.CurrentTime = 2*time.Second + 200*time.Millisecond
	if reactedStacks.GetInt(sim) != 2 {
		t.Errorf("second target past the reaction time: with reaction time = %d, want 2", reactedStacks.GetInt(sim))
	}

	unit.CurrentTarget = first
	if numStacks.GetInt(sim) != 3 || reactedStacks.GetInt(sim) != 3 {
		t.Errorf("back on the first target: stacks = %d, with reaction time = %d, want 3, 3", numStacks.GetInt(sim), reactedStacks.GetInt(sim))
	}
}
