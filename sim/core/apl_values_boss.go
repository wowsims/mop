package core

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

// bossHardcastRemaining returns how much longer the given spell's unit will
// continue hardcasting that specific spell, or 0 if it isn't currently doing so.
func bossHardcastRemaining(spell *Spell, sim *Simulation) time.Duration {
	hardcast := spell.Unit.Hardcast
	if hardcast.ActionID != spell.ActionID || hardcast.Expires <= sim.CurrentTime {
		return 0
	}
	return hardcast.Expires - sim.CurrentTime
}

type APLValueBossSpellIsCasting struct {
	DefaultAPLValueImpl
	spell *Spell
}

func (rot *APLRotation) newValueBossSpellIsCasting(config *proto.APLValueBossSpellIsCasting, _ *proto.UUID) APLValue {
	spell := rot.GetTargetAPLSpell(config.SpellId, rot.GetTargetUnit(config.TargetUnit))
	if spell == nil {
		return nil
	}
	return &APLValueBossSpellIsCasting{
		spell: spell,
	}
}
func (value *APLValueBossSpellIsCasting) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueBossSpellIsCasting) GetBool(sim *Simulation) bool {
	return bossHardcastRemaining(value.spell, sim) > 0
}
func (value *APLValueBossSpellIsCasting) String() string {
	return fmt.Sprintf("Boss is Casting(%s)", value.spell.ActionID)
}

type APLValueBossSpellTimeToReady struct {
	DefaultAPLValueImpl
	spell *Spell
}

func (rot *APLRotation) newValueBossSpellTimeToReady(config *proto.APLValueBossSpellTimeToReady, _ *proto.UUID) APLValue {
	spell := rot.GetTargetAPLSpell(config.SpellId, rot.GetTargetUnit(config.TargetUnit))
	if spell == nil {
		return nil
	}
	return &APLValueBossSpellTimeToReady{
		spell: spell,
	}
}
func (value *APLValueBossSpellTimeToReady) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueBossSpellTimeToReady) GetDuration(sim *Simulation) time.Duration {
	return value.spell.TimeToReady(sim)
}
func (value *APLValueBossSpellTimeToReady) String() string {
	return fmt.Sprintf("Boss Spell Time to Ready(%s)", value.spell.ActionID)
}

func (rot *APLRotation) newValueBossSpellIsKnown(config *proto.APLValueBossSpellIsKnown, uuid *proto.UUID) APLValue {
	spell := rot.GetTargetAPLSpell(config.SpellId, rot.GetTargetUnit(config.TargetUnit))
	return rot.newValueConst(&proto.APLValueConst{
		Val: Ternary(spell != nil, "true", "false"),
	}, uuid)
}

type APLValueBossSpellCastTimeRemaining struct {
	DefaultAPLValueImpl
	spell *Spell
}

func (rot *APLRotation) newValueBossSpellCastTimeRemaining(config *proto.APLValueBossSpellCastTimeRemaining, uuid *proto.UUID) APLValue {
	spell := rot.GetTargetAPLSpell(config.SpellId, rot.GetTargetUnit(config.TargetUnit))
	if spell == nil {
		return nil
	}
	if spell.DefaultCast.CastTime <= 0 {
		rot.ValidationMessageByUUID(uuid, proto.LogLevel_Warning, "%s has no cast time, so Boss Spell Cast Time Remaining would never be non-zero", spell.ActionID)
		return nil
	}
	return &APLValueBossSpellCastTimeRemaining{
		spell: spell,
	}
}
func (value *APLValueBossSpellCastTimeRemaining) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueBossSpellCastTimeRemaining) GetDuration(sim *Simulation) time.Duration {
	return bossHardcastRemaining(value.spell, sim)
}
func (value *APLValueBossSpellCastTimeRemaining) String() string {
	return fmt.Sprintf("Boss Spell Cast Time Remaining(%s)", value.spell.ActionID)
}

type APLValueBossCurrentTarget struct {
	DefaultAPLValueImpl
	player *Unit
	target UnitReference
}

func (rot *APLRotation) newValueBossCurrentTarget(config *proto.APLValueBossCurrentTarget, _ *proto.UUID) APLValue {
	unit := rot.GetSourceUnit(config.TargetUnit)
	if unit.Get() == nil {
		return nil
	}
	return &APLValueBossCurrentTarget{
		player: rot.unit,
		target: unit,
	}
}
func (value *APLValueBossCurrentTarget) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueBossCurrentTarget) GetBool(sim *Simulation) bool {
	return value.target.Get().CurrentTarget == value.player
}
func (value *APLValueBossCurrentTarget) String() string {
	return fmt.Sprintf("IsTanking(%s)", value.target.Get().Label)
}
