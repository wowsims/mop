package core

import (
	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueUnitIsMoving struct {
	DefaultAPLValueImpl
	unit UnitReference
}

func (rot *APLRotation) newValueUnitIsMoving(config *proto.APLValueUnitIsMoving, _ *proto.UUID) APLValue {
	unit := rot.GetSourceUnit(config.SourceUnit)
	if unit.Get() == nil {
		return nil
	}
	return &APLValueUnitIsMoving{
		unit: unit,
	}
}
func (value *APLValueUnitIsMoving) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueUnitIsMoving) GetBool(sim *Simulation) bool {
	return value.unit.Get().Moving
}
func (value *APLValueUnitIsMoving) String() string {
	return "Is Moving"
}

type APLValueUnitDistance struct {
	DefaultAPLValueImpl
	unit *Unit
}

func (rot *APLRotation) newValueUnitDistance(config *proto.APLValueUnitDistance, _ *proto.UUID) APLValue {
	return &APLValueUnitDistance{
		unit: rot.unit,
	}
}
func (value *APLValueUnitDistance) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeFloat
}
func (value *APLValueUnitDistance) GetFloat(sim *Simulation) float64 {
	return value.unit.DistanceFromTarget
}
func (value *APLValueUnitDistance) String() string {
	return "Unit Distance From Target"
}
