package core

import (
	"fmt"
	"math"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLValueDotIsActive struct {
	DefaultAPLValueImpl
	dot *DotReference
}

func (rot *APLRotation) newValueDotIsActive(config *proto.APLValueDotIsActive, _ *proto.UUID) APLValue {
	dot := rot.NewDotReference(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot.Get() == nil {
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
	resolvedDot := value.dot.Get()
	return resolvedDot != nil && resolvedDot.IsActive()
}
func (value *APLValueDotIsActive) String() string {
	return fmt.Sprintf("Dot Is Active(%s)", value.dot.Get().Spell.ActionID)
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
	dot *DotReference
}

func (rot *APLRotation) newValueDotRemainingTime(config *proto.APLValueDotRemainingTime, _ *proto.UUID) APLValue {
	dot := rot.NewDotReference(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot.Get() == nil {
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
	resolvedDot := value.dot.Get()
	return TernaryDuration(resolvedDot.IsActive(), resolvedDot.RemainingDuration(sim), 0)
}
func (value *APLValueDotRemainingTime) String() string {
	return fmt.Sprintf("Dot Remaining Time(%s)", value.dot.Get().Spell.ActionID)
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
	dot *DotReference
}

func (rot *APLRotation) newValueDotTickFrequency(config *proto.APLValueDotTickFrequency, _ *proto.UUID) APLValue {
	dot := rot.NewDotReference(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot.Get() == nil {
		return nil
	}
	return &APLValueDotTickFrequency{
		dot: dot,
	}
}

func (value *APLValueDotTickFrequency) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotTickFrequency) GetDuration(sim *Simulation) time.Duration {
	dot := value.dot.Get()
	return TernaryDuration(dot.IsActive(), dot.tickPeriod, dot.CalcTickPeriod())
}
func (value *APLValueDotTickFrequency) String() string {
	return fmt.Sprintf("Dot Tick Frequency(%s)", value.dot.Get().Spell.ActionID)
}

type APLValueDotTimeToNextTick struct {
	DefaultAPLValueImpl
	dot *DotReference
}

func (rot *APLRotation) newValueDotTimeToNextTick(config *proto.APLValueDotTimeToNextTick, _ *proto.UUID) APLValue {
	dot := rot.NewDotReference(rot.GetTargetUnit(config.TargetUnit), config.SpellId)
	if dot.Get() == nil {
		return nil
	}
	return &APLValueDotTimeToNextTick{
		dot: dot,
	}
}

func (value *APLValueDotTimeToNextTick) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotTimeToNextTick) GetDuration(sim *Simulation) time.Duration {
	return value.dot.Get().TimeUntilNextTick(sim)
}
func (value *APLValueDotTimeToNextTick) String() string {
	return fmt.Sprintf("Time To Next Tick(%s)", value.dot.Get().Spell.ActionID)
}

type APLValueDotBaseDuration struct {
	DefaultAPLValueImpl
	baseDuration time.Duration
	spell        *Spell
}

func (rot *APLRotation) newValueDotBaseDuration(config *proto.APLValueDotBaseDuration, _ *proto.UUID) APLValue {
	dot := rot.GetAPLDot(rot.GetTargetUnit(&proto.UnitReference{
		Type:  proto.UnitReference_Target,
		Index: rot.unit.Index,
	}), config.SpellId)

	if dot == nil {
		return nil
	}
	return &APLValueDotBaseDuration{
		baseDuration: dot.BaseDuration(),
		spell:        dot.Spell,
	}
}

func (value *APLValueDotBaseDuration) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeDuration
}
func (value *APLValueDotBaseDuration) GetDuration(_ *Simulation) time.Duration {
	return value.baseDuration
}
func (value *APLValueDotBaseDuration) String() string {
	return fmt.Sprintf("Dot Base Duration(%s)", value.spell.ActionID)
}

type APLValueDotIncreaseCheck struct {
	DefaultAPLValueImpl
	rot                *APLRotation
	spell              *Spell
	targetRef          UnitReference
	baseName           string
	useBaseValue       bool // if true, use the base value before any increases
	baseValue          float64
	baseValueDummyAura *Aura // Used to get the base value at encounter start

	// evalGeneration cache: avoids re-computing when the same value node is
	// evaluated multiple times in a single getNextAction scan.
	cachedGen   uint32
	cachedValue float64
}

func (rot *APLRotation) newDotIncreaseValue(baseName string, config *proto.APLValueDotPercentIncrease) *APLValueDotIncreaseCheck {
	spell := rot.GetAPLSpell(config.SpellId)
	if spell == nil || spell.expectedTickDamageInternal == nil {
		return nil
	}
	targetRef := rot.GetTargetUnit(config.TargetUnit)

	var baseValueDummyAura *Aura
	if config.UseBaseValue {
		baseValueDummyAura = MakePermanent(rot.unit.GetOrRegisterAura(Aura{
			Label:    "Dummy Aura - APL Dot Increase Base Value",
			Duration: NeverExpires,
		}))
	}

	return &APLValueDotIncreaseCheck{
		rot:                rot,
		spell:              spell,
		targetRef:          targetRef,
		baseName:           baseName,
		useBaseValue:       config.UseBaseValue,
		baseValueDummyAura: baseValueDummyAura,
	}
}

func (value *APLValueDotIncreaseCheck) Type() proto.APLValueType {
	return proto.APLValueType_ValueTypeFloat
}

func (value *APLValueDotIncreaseCheck) String() string {
	return fmt.Sprintf("%s (%s)", value.baseName, value.spell.ActionID)
}

type APLValueDotPercentIncrease struct {
	*APLValueDotIncreaseCheck
}

func (rot *APLRotation) newValueDotPercentIncrease(config *proto.APLValueDotPercentIncrease, _ *proto.UUID) APLValue {
	parentImpl := rot.newDotIncreaseValue("Dot Percent Increase", config)
	if parentImpl == nil {
		return nil
	}

	return &APLValueDotPercentIncrease{APLValueDotIncreaseCheck: parentImpl}
}

func (value *APLValueDotPercentIncrease) Finalize(rot *APLRotation) {
	if value.useBaseValue && value.baseValueDummyAura != nil {
		value.baseValueDummyAura.ApplyOnEncounterStart(func(aura *Aura, sim *Simulation) {
			value.baseValue = value.spell.ExpectedTickDamage(sim, value.targetRef.Get())
		})
	}
}

func (value *APLValueDotPercentIncrease) GetFloat(sim *Simulation) float64 {
	if gen := value.rot.evalGeneration; value.cachedGen == gen {
		return value.cachedValue
	} else {
		value.cachedGen = gen
	}

	target := value.targetRef.Get()
	expectedDamage := TernaryFloat64(value.useBaseValue, value.baseValue, value.spell.ExpectedTickDamageFromCurrentSnapshot(sim, target))

	var result float64
	if expectedDamage == 0 {
		result = 1
	} else {
		// Rounding to effectively 3 decimal places as a percentage to avoid floating point errors
		result = math.Round((value.spell.ExpectedTickDamage(sim, target)/expectedDamage)*100000)/100000 - 1
	}

	value.cachedValue = result
	return result
}

type APLValueDotCritPercentIncrease struct {
	*APLValueDotIncreaseCheck
}

func (rot *APLRotation) newValueDotCritPercentIncrease(config *proto.APLValueDotPercentIncrease, _ *proto.UUID) APLValue {
	parentImpl := rot.newDotIncreaseValue("Dot Crit Chance Percent Increase", config)
	if parentImpl == nil {
		return nil
	}

	return &APLValueDotCritPercentIncrease{APLValueDotIncreaseCheck: parentImpl}
}

func (value *APLValueDotCritPercentIncrease) Finalize(rot *APLRotation) {
	if value.useBaseValue && value.baseValueDummyAura != nil {
		value.baseValueDummyAura.ApplyOnEncounterStart(func(aura *Aura, sim *Simulation) {
			value.baseValue = value.getCritChance(false)
		})
	}
}

func (value *APLValueDotCritPercentIncrease) GetFloat(sim *Simulation) float64 {
	if gen := value.rot.evalGeneration; value.cachedGen == gen {
		return value.cachedValue
	} else {
		value.cachedGen = gen
	}

	currentCritChance := value.getCritChance(true)
	var result float64
	if currentCritChance == 0 {
		result = 1
	} else {
		result = value.getCritChance(false)/currentCritChance - 1
	}
	value.cachedValue = result
	return result
}

func (value *APLValueDotCritPercentIncrease) getCritChance(useSnapshot bool) float64 {
	target := value.targetRef.Get()
	dot := value.spell.Dot(target)
	if useSnapshot {
		return TernaryFloat64(value.useBaseValue, value.baseValue, dot.SnapshotCritChance)
	}

	return dot.Spell.SpellCritChance(target)
}

type APLValueDotTickRatePercentIncrease struct {
	*APLValueDotIncreaseCheck
}

func (rot *APLRotation) newValueDotTickRatePercentIncrease(config *proto.APLValueDotPercentIncrease, _ *proto.UUID) APLValue {
	parentImpl := rot.newDotIncreaseValue("Dot Tick Rate Percent Increase", config)
	if parentImpl == nil {
		return nil
	}

	return &APLValueDotTickRatePercentIncrease{APLValueDotIncreaseCheck: parentImpl}
}

func (value *APLValueDotTickRatePercentIncrease) Finalize(rot *APLRotation) {
	if value.useBaseValue && value.baseValueDummyAura != nil {
		value.baseValueDummyAura.ApplyOnEncounterStart(func(aura *Aura, sim *Simulation) {
			value.baseValue = value.getTickRate(false)
		})
	}
}

func (value *APLValueDotTickRatePercentIncrease) GetFloat(sim *Simulation) float64 {
	if gen := value.rot.evalGeneration; value.cachedGen == gen {
		return value.cachedValue
	} else {
		value.cachedGen = gen
	}

	currentTickrate := value.getTickRate(true)
	var result float64
	if currentTickrate == 0 {
		result = 1
	} else {
		result = currentTickrate/value.getTickRate(false) - 1
	}
	value.cachedValue = result
	return result
}

func (value *APLValueDotTickRatePercentIncrease) getTickRate(useSnapshot bool) float64 {
	target := value.targetRef.Get()
	dot := value.spell.Dot(target)
	if useSnapshot {
		return TernaryFloat64(value.useBaseValue, value.baseValue, TernaryFloat64(dot.IsActive(), dot.TickPeriod().Seconds(), 0))
	}
	return dot.CalcTickPeriod().Round(time.Millisecond).Seconds()
}
