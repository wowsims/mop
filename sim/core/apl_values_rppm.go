package core

import (
	"fmt"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueRPPMAverageProcChance struct {
	DefaultAPLValueImpl
	aura *Aura
}

func (rot *APLRotation) newValueRPPMAverageProcChance(config *proto.APLValueRPPMAverageProcChance, _ *proto.UUID) APLValue {
	auraRef := rot.GetAPLTriggerAura(rot.GetSourceUnit(&proto.UnitReference{Type: proto.UnitReference_Self}), config.AuraId)
	aura := auraRef.Get()
	return &APLValueRPPMAverageProcChance{
		aura: aura,
	}
}
func (value *APLValueRPPMAverageProcChance) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeFloat
}
func (value *APLValueRPPMAverageProcChance) GetFloat(sim *Simulation) float64 {
	rppm := value.aura.Dpm.procChances[0].(*RPPMProc)
	// (%) rppm * lastProc / 60
	return 100 * rppm.ppm * rppm.GetCoefficient() * rppm.GetLastProc(sim).Seconds() / 60
}
func (value *APLValueRPPMAverageProcChance) String() string {
	return fmt.Sprintf("Proc Chance(%s)", value.aura.ActionID)
}
