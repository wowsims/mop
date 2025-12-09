package core

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueRPPMProcChance struct {
	DefaultAPLValueImpl
	aura *Aura
}

func (rot *APLRotation) newValueRPPMProcChance(config *proto.APLValueRPPMProcChance, _ *proto.UUID) APLValue {
	auraRef := rot.GetAPLTriggerAura(rot.GetSourceUnit(&proto.UnitReference{Type: proto.UnitReference_Self}), config.AuraId)
	aura := auraRef.Get()
	return &APLValueRPPMProcChance{
		aura: aura,
	}
}
func (value *APLValueRPPMProcChance) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeFloat
}
func (value *APLValueRPPMProcChance) GetFloat(sim *Simulation) float64 {
	rppm := value.aura.Dpm.procChances[0].(*RPPMProc)
	return rppm.Chance(sim) * 100
}
func (value *APLValueRPPMProcChance) String() string {
	return fmt.Sprintf("Proc Chance(%s)", value.aura.ActionID)
}

type APLValueRPPMLastProc struct {
	DefaultAPLValueImpl
	aura *Aura
}

func (rot *APLRotation) newValueRPPMLastProc(config *proto.APLValueRPPMLastProc, _ *proto.UUID) APLValue {
	auraRef := rot.GetAPLTriggerAura(rot.GetSourceUnit(&proto.UnitReference{Type: proto.UnitReference_Self}), config.AuraId)
	aura := auraRef.Get()
	return &APLValueRPPMLastProc{
		aura: aura,
	}
}
func (value *APLValueRPPMLastProc) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueRPPMLastProc) GetDuration(sim *Simulation) time.Duration {
	rppm := value.aura.Dpm.procChances[0].(*RPPMProc)
	return rppm.GetLastProc(sim)
}
func (value *APLValueRPPMLastProc) String() string {
	return fmt.Sprintf("Last Proc(%s)", value.aura.ActionID)
}

type APLValueRPPMLastAttempt struct {
	DefaultAPLValueImpl
	aura *Aura
}

func (rot *APLRotation) newValueRPPMLastAttempt(config *proto.APLValueRPPMLastAttempt, _ *proto.UUID) APLValue {
	auraRef := rot.GetAPLTriggerAura(rot.GetSourceUnit(&proto.UnitReference{Type: proto.UnitReference_Self}), config.AuraId)
	aura := auraRef.Get()
	return &APLValueRPPMLastAttempt{
		aura: aura,
	}
}
func (value *APLValueRPPMLastAttempt) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueRPPMLastAttempt) GetDuration(sim *Simulation) time.Duration {
	rppm := value.aura.Dpm.procChances[0].(*RPPMProc)
	return rppm.GetLastCheck(sim)
}
func (value *APLValueRPPMLastAttempt) String() string {
	return fmt.Sprintf("Last Attempt(%s)", value.aura.ActionID)
}
