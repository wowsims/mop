package core

import (
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueRemainingCastTime struct {
	DefaultAPLValueImpl
	unit *Unit
}

func (rot *APLRotation) newValueRemainingCastTime(_ *proto.APLValueRemainingCastTime, _ *proto.UUID) APLValue {
	return &APLValueRemainingCastTime{
		unit: rot.unit,
	}
}
func (value *APLValueRemainingCastTime) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueRemainingCastTime) GetDuration(sim *Simulation) time.Duration {
	return max(0, value.unit.Hardcast.Expires-sim.CurrentTime)
}
func (value *APLValueRemainingCastTime) String() string {
	return "Remaining Cast Time"
}
