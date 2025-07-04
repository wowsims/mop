package core

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueDotIsActive struct {
	DefaultAPLValueImpl
	dot *Dot
}

func (rot *APLRotation) newValueDotIsActive(config *proto.APLValueDotIsActive, _ *proto.UUID) APLValue {
	dot := rot.GetAPLDot(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot == nil {
		return nil
	}
	return &APLValueDotIsActive{
		dot: dot,
	}
}
func (value *APLValueDotIsActive) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueDotIsActive) GetBool(sim *Simulation) bool {
	return value.dot.IsActive()
}
func (value *APLValueDotIsActive) String() string {
	return fmt.Sprintf("Dot Is Active(%s)", value.dot.Spell.ActionID)
}

type APLValueDotIsActiveOnAllTargets struct {
	DefaultAPLValueImpl
	dots  []*Dot
	spell *Spell
}

func (rot *APLRotation) newValueDotIsActiveOnAllTargets(config *proto.APLValueDotIsActiveOnAllTargets, _ *proto.UUID) APLValue {
	unit := rot.unit
	spell := rot.GetAPLMultidotSpell(config.SpellId)

	if spell == nil {
		return nil
	}

	units := unit.Env.Encounter.AllTargetUnits
	dots := make([]*Dot, 0, len(units))
	for _, unit := range units {
		dot := rot.GetAPLDot(rot.GetTargetUnit(&proto.UnitReference{
			Type:  proto.UnitReference_Target,
			Index: unit.Index,
		}), config.SpellId)

		if dot != nil {
			dots = append(dots, dot)
		}
	}

	if len(dots) == 0 {
		rot.ValidationMessage(proto.LogLevel_Warning, "Could not find a DoT for %s on Target(s)", ProtoToActionID(config.SpellId))
		return nil
	}

	return &APLValueDotIsActiveOnAllTargets{
		spell: spell,
		dots:  dots,
	}
}
func (value *APLValueDotIsActiveOnAllTargets) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeBool
}
func (value *APLValueDotIsActiveOnAllTargets) GetBool(sim *Simulation) bool {
	for _, dot := range value.dots {
		if !dot.IsActive() && dot.Unit.IsEnabled() {
			return false
		}
	}
	return true
}
func (value *APLValueDotIsActiveOnAllTargets) String() string {
	return fmt.Sprintf("Dot Is Active On All Targets(%s)", value.spell.ActionID)
}

type APLValueDotRemainingTime struct {
	DefaultAPLValueImpl
	dot *Dot
}

func (rot *APLRotation) newValueDotRemainingTime(config *proto.APLValueDotRemainingTime, _ *proto.UUID) APLValue {
	dot := rot.GetAPLDot(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot == nil {
		return nil
	}
	return &APLValueDotRemainingTime{
		dot: dot,
	}
}
func (value *APLValueDotRemainingTime) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotRemainingTime) GetDuration(sim *Simulation) time.Duration {
	return TernaryDuration(value.dot.IsActive(), value.dot.RemainingDuration(sim), 0)
}
func (value *APLValueDotRemainingTime) String() string {
	return fmt.Sprintf("Dot Remaining Time(%s)", value.dot.Spell.ActionID)
}

type APLValueDotLowestRemainingTime struct {
	DefaultAPLValueImpl
	dots  []*Dot
	spell *Spell
}

func (rot *APLRotation) newValueDotLowestRemainingTime(config *proto.APLValueDotLowestRemainingTime, _ *proto.UUID) APLValue {
	unit := rot.unit
	spell := rot.GetAPLMultidotSpell(config.SpellId)

	if spell == nil {
		return nil
	}

	units := unit.Env.Encounter.AllTargetUnits
	dots := make([]*Dot, 0, len(units))

	for _, unit := range units {
		dot := rot.GetAPLDot(rot.GetTargetUnit(&proto.UnitReference{
			Type:  proto.UnitReference_Target,
			Index: unit.Index,
		}), config.SpellId)

		if dot != nil {
			dots = append(dots, dot)
		}
	}

	if len(dots) == 0 {
		rot.ValidationMessage(proto.LogLevel_Warning, "Could not find a DoT for %s on Target(s)", ProtoToActionID(config.SpellId))
		return nil
	}

	return &APLValueDotLowestRemainingTime{
		spell: spell,
		dots:  dots,
	}
}
func (value *APLValueDotLowestRemainingTime) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotLowestRemainingTime) GetDuration(sim *Simulation) time.Duration {
	duration := NeverExpires
	for _, dot := range value.dots {
		if !dot.Unit.IsEnabled() {
			continue
		}
		if dot.IsActive() {
			duration = min(duration, dot.RemainingDuration(sim))
		} else {
			return 0
		}
	}
	return duration
}
func (value *APLValueDotLowestRemainingTime) String() string {
	return fmt.Sprintf("Dot Lowest Remaining Time(%s)", value.spell.ActionID)
}

type APLValueDotTickFrequency struct {
	DefaultAPLValueImpl
	dot *Dot
}

func (rot *APLRotation) newValueDotTickFrequency(config *proto.APLValueDotTickFrequency, _ *proto.UUID) APLValue {
	dot := rot.GetAPLDot(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot == nil {
		return nil
	}
	return &APLValueDotTickFrequency{
		dot: dot,
	}
}

func (value *APLValueDotTickFrequency) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotTickFrequency) GetDuration(_ *Simulation) time.Duration {
	return value.dot.tickPeriod
}
func (value *APLValueDotTickFrequency) String() string {
	return fmt.Sprintf("Dot Tick Frequency(%s)", value.dot.tickPeriod)
}

type APLValueDotPercentIncrease struct {
	DefaultAPLValueImpl
	spell  *Spell
	target *Unit
}

func (rot *APLRotation) newValueDotPercentIncrease(config *proto.APLValueDotPercentIncrease, _ *proto.UUID) APLValue {
	spell := rot.GetAPLSpell(config.SpellId)
	if spell == nil || spell.expectedTickDamageInternal == nil {
		return nil
	}

	target := rot.GetTargetUnit(config.TargetUnit).Get()
	return &APLValueDotPercentIncrease{
		spell:  spell,
		target: target,
	}
}

func (value *APLValueDotPercentIncrease) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeFloat
}

func (value *APLValueDotPercentIncrease) GetFloat(sim *Simulation) float64 {
	expectedDamage := value.spell.ExpectedTickDamageFromCurrentSnapshot(sim, value.target)
	if expectedDamage == 0 {
		return 1
	}

	return value.spell.ExpectedTickDamage(sim, value.target)/expectedDamage - 1
}

func (value *APLValueDotPercentIncrease) String() string {
	return fmt.Sprintf("Dot Percent Increase (%s)", value.spell.ActionID)
}
