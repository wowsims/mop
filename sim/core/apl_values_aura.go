package core

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueAuraIsKnown struct {
	DefaultAPLValueImpl
	aura AuraReference
}

func (rot *APLRotation) newValueAuraIsKnown(config *proto.APLValueAuraIsKnown, _ *proto.UUID) APLValue {
	aura := rot.GetAPLAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	return &APLValueAuraIsKnown{
		aura: aura,
	}
}
func (value *APLValueAuraIsKnown) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueAuraIsKnown) GetBool(sim *Simulation) bool {
	return value.aura.Get() != nil
}
func (value *APLValueAuraIsKnown) String() string {
	return fmt.Sprintf("Aura Known(%s)", value.aura.String())
}

type APLValueAuraIsActive struct {
	DefaultAPLValueImpl
	aura                AuraReference
	reactionTime        time.Duration
	includeReactionTime bool
}

func (rot *APLRotation) newValueAuraIsActive(config *proto.APLValueAuraIsActive, _ *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}
	return &APLValueAuraIsActive{
		aura:                aura,
		reactionTime:        rot.unit.ReactionTime,
		includeReactionTime: config.IncludeReactionTime,
	}
}
func (value *APLValueAuraIsActive) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueAuraIsActive) GetBool(sim *Simulation) bool {
	aura := value.aura.Get()
	if value.includeReactionTime {
		return aura.IsActive() && aura.TimeActive(sim) >= value.reactionTime
	}
	return aura.IsActive()
}
func (value *APLValueAuraIsActive) String() string {
	return fmt.Sprintf("Aura Active(%s)", value.aura.String())
}

type APLValueAuraIsInactive struct {
	DefaultAPLValueImpl
	aura                AuraReference
	reactionTime        time.Duration
	includeReactionTime bool
}

func (rot *APLRotation) newValueAuraIsInactive(config *proto.APLValueAuraIsInactive, _ *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}

	return &APLValueAuraIsInactive{
		aura:                aura,
		reactionTime:        rot.unit.ReactionTime,
		includeReactionTime: config.IncludeReactionTime,
	}
}
func (value *APLValueAuraIsInactive) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueAuraIsInactive) GetBool(sim *Simulation) bool {
	aura := value.aura.Get()
	if value.includeReactionTime {
		return !aura.IsActive() && aura.TimeInactive(sim) >= value.reactionTime
	}
	return !aura.IsActive()
}
func (value *APLValueAuraIsInactive) String() string {
	return fmt.Sprintf("Aura Inactive(%s)", value.aura.String())
}

type APLValueAuraRemainingTime struct {
	DefaultAPLValueImpl
	aura AuraReference
}

func (rot *APLRotation) newValueAuraRemainingTime(config *proto.APLValueAuraRemainingTime, _ *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}
	return &APLValueAuraRemainingTime{
		aura: aura,
	}
}
func (value *APLValueAuraRemainingTime) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueAuraRemainingTime) GetDuration(sim *Simulation) time.Duration {
	aura := value.aura.Get()
	return TernaryDuration(aura.IsActive(), aura.RemainingDuration(sim), 0)
}
func (value *APLValueAuraRemainingTime) String() string {
	return fmt.Sprintf("Aura Remaining Time(%s)", value.aura.String())
}

type APLValueAuraNumStacks struct {
	DefaultAPLValueImpl
	aura                AuraReference
	reactionTime        time.Duration
	includeReactionTime bool

	stackUpdateTime time.Duration
	stacks          int32
	previousStacks  int32
}

func (rot *APLRotation) newValueAuraNumStacks(config *proto.APLValueAuraNumStacks, uuid *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	resolvedAura := aura.Get()
	if resolvedAura == nil {
		return nil
	}
	if resolvedAura.MaxStacks == 0 {
		rot.ValidationMessageByUUID(uuid, proto.LogLevel_Warning, "%s is not a stackable aura", ProtoToActionID(config.AuraId))
		return nil
	}

	value := &APLValueAuraNumStacks{
		aura:                aura,
		reactionTime:        rot.unit.ReactionTime,
		includeReactionTime: config.IncludeReactionTime,
	}

	resolvedAura.ApplyOnStacksChange(func(aura *Aura, sim *Simulation, oldStacks int32, newStacks int32) {
		if sim.CurrentTime-value.stackUpdateTime >= value.reactionTime {
			value.previousStacks = oldStacks
		}
		value.stackUpdateTime = sim.CurrentTime
		value.stacks = newStacks
	}).ApplyOnReset(func(aura *Aura, sim *Simulation) {
		value.stackUpdateTime = NeverExpires
		value.previousStacks = aura.GetStacks()
		value.stacks = aura.GetStacks()
	})

	return value
}
func (value *APLValueAuraNumStacks) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeInt
}
func (value *APLValueAuraNumStacks) GetInt(sim *Simulation) int32 {
	if value.includeReactionTime {
		return TernaryInt32(sim.CurrentTime-value.stackUpdateTime >= value.reactionTime, value.stacks, value.previousStacks)
	}
	return value.stacks
}
func (value *APLValueAuraNumStacks) String() string {
	return fmt.Sprintf("Aura Num Stacks(%s)", value.aura.String())
}

type APLValueAuraInternalCooldown struct {
	DefaultAPLValueImpl
	aura AuraReference
}

func (rot *APLRotation) newValueAuraInternalCooldown(config *proto.APLValueAuraInternalCooldown, _ *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLICDAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}
	return &APLValueAuraInternalCooldown{
		aura: aura,
	}
}
func (value *APLValueAuraInternalCooldown) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueAuraInternalCooldown) GetDuration(sim *Simulation) time.Duration {
	return value.aura.Get().Icd.TimeToReady(sim)
}
func (value *APLValueAuraInternalCooldown) String() string {
	return fmt.Sprintf("Aura Remaining ICD(%s)", value.aura.String())
}

type APLValueAuraICDIsReady struct {
	DefaultAPLValueImpl
	aura                AuraReference
	reactionTime        time.Duration
	includeReactionTime bool
}

func (rot *APLRotation) newValueAuraICDIsReady(config *proto.APLValueAuraICDIsReady, _ *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLICDAura(rot.GetSourceUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}
	return &APLValueAuraICDIsReady{
		aura:                aura,
		reactionTime:        rot.unit.ReactionTime,
		includeReactionTime: config.IncludeReactionTime,
	}
}
func (value *APLValueAuraICDIsReady) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueAuraICDIsReady) GetBool(sim *Simulation) bool {
	aura := value.aura.Get()
	if value.includeReactionTime {
		return aura.Icd.IsReady(sim) || (aura.IsActive() && aura.TimeActive(sim) < value.reactionTime)
	}
	return aura.Icd.IsReady(sim)
}
func (value *APLValueAuraICDIsReady) String() string {
	return fmt.Sprintf("Aura ICD Is Ready(%s)", value.aura.String())
}

type APLValueAuraShouldRefresh struct {
	DefaultAPLValueImpl
	aura       AuraReference
	maxOverlap APLValue
}

func (rot *APLRotation) newValueAuraShouldRefresh(config *proto.APLValueAuraShouldRefresh, uuid *proto.UUID) APLValue {
	if config.AuraId == nil {
		return nil
	}
	aura := rot.GetAPLAura(rot.GetTargetUnit(config.SourceUnit), config.AuraId)
	if aura.Get() == nil {
		return nil
	}

	maxOverlap := rot.coerceTo(rot.newAPLValue(config.MaxOverlap), proto.APLValueType_ValueTypeDuration)
	if maxOverlap == nil {
		maxOverlap = rot.newValueConst(&proto.APLValueConst{Val: "0ms"}, uuid)
	}

	return &APLValueAuraShouldRefresh{
		aura:       aura,
		maxOverlap: maxOverlap,
	}
}
func (value *APLValueAuraShouldRefresh) GetInnerValues() []APLValue {
	return []APLValue{value.maxOverlap}
}
func (value *APLValueAuraShouldRefresh) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueAuraShouldRefresh) GetBool(sim *Simulation) bool {
	return value.aura.Get().ShouldRefreshExclusiveEffects(sim, value.maxOverlap.GetDuration(sim))
}
func (value *APLValueAuraShouldRefresh) String() string {
	return fmt.Sprintf("Should Refresh Aura(%s)", value.aura.String())
}
