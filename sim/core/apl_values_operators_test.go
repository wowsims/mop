//go:build benchapl
// +build benchapl

package core

import (
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

func BenchmarkAPLValueMath_GetFloat(b *testing.B) {
	sim := &Simulation{}

	currentResource := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeFloat,
		floatVal:            36.0, // currentGenericResource
	}

	cooldownTime := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeDuration,
		durationVal:         time.Second * 10, // cooldown
	}

	multiplier := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeFloat,
		floatVal:            0.8, // multiplier
	}

	// Create the nested math operation: cooldown * 0.8
	innerMath := &APLValueMath{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		op:                  proto.APLValueMath_OpMul,
		lhs:                 cooldownTime,
		rhs:                 multiplier,
		lhsType:             proto.APLValueType_ValueTypeDuration,
		rhsType:             proto.APLValueType_ValueTypeFloat,
	}

	// Create the outer math operation: currentResource + (cooldown * 0.8)
	mathOp := &APLValueMath{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		op:                  proto.APLValueMath_OpAdd,
		lhs:                 currentResource,
		rhs:                 innerMath,
		lhsType:             proto.APLValueType_ValueTypeFloat,
		rhsType:             proto.APLValueType_ValueTypeDuration, // This is the problematic type mismatch!
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = mathOp.GetFloat(sim)
	}
}

func BenchmarkAPLValueCompare_GetBool(b *testing.B) {
	sim := &Simulation{}

	lhsConst := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeFloat,
		floatVal:            36.0,
	}

	rhsConst := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeFloat,
		floatVal:            30.0,
	}

	compare := &APLValueCompare{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		op:                  proto.APLValueCompare_OpGt,
		lhs:                 lhsConst,
		rhs:                 rhsConst,
		lhsType:             proto.APLValueType_ValueTypeFloat,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = compare.GetBool(sim)
	}
}

// Additional benchmark for type coercion overhead
func BenchmarkAPLTypeCoercion(b *testing.B) {
	rot := &APLRotation{}

	intVal := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeInt,
		intVal:              36,
	}

	durationVal := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeDuration,
		durationVal:         time.Second * 10,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = rot.coerceToSameType(intVal, durationVal)
	}
}

// Benchmark specifically for the warlock APL problematic case: int + duration
func BenchmarkAPLWarlockCoercionCase(b *testing.B) {
	rot := &APLRotation{}
	sim := &Simulation{}

	// Simulate the warlock APL case: resource (int) + cooldown (duration)
	resourceVal := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeInt,
		intVal:              36, // current resource
		floatVal:            36.0,
		durationVal:         time.Second * 36,
	}

	cooldownVal := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeDuration,
		durationVal:         time.Second * 10, // cooldown time
	}

	// This creates the problematic coercion and math operation
	lhs, rhs := rot.coerceToSameType(resourceVal, cooldownVal)
	mathOp := &APLValueMath{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		op:                  proto.APLValueMath_OpAdd,
		lhs:                 lhs,
		rhs:                 rhs,
		lhsType:             lhs.Type(),
		rhsType:             rhs.Type(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = mathOp.GetDuration(sim)
	}
}

func BenchmarkAPLDurationMath(b *testing.B) {
	sim := &Simulation{}

	duration1 := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeDuration,
		durationVal:         time.Second * 5,
	}

	duration2 := &APLValueConst{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		valType:             proto.APLValueType_ValueTypeDuration,
		durationVal:         time.Second * 3,
	}

	mathOp := &APLValueMath{
		DefaultAPLValueImpl: DefaultAPLValueImpl{},
		op:                  proto.APLValueMath_OpAdd,
		lhs:                 duration1,
		rhs:                 duration2,
		lhsType:             proto.APLValueType_ValueTypeDuration,
		rhsType:             proto.APLValueType_ValueTypeDuration,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = mathOp.GetDuration(sim)
	}
}
