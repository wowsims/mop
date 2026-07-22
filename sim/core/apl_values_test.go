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
