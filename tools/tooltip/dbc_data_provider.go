package tooltip

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/tools/database/dbc"
)

type EffectMap map[int]dbc.SpellEffect
type DBCTooltipDataProvider struct {
	DBC *dbc.DBC
	// Item level of the item the tooltip is being rendered for. An effect flagged as scaling
	// off item level resolves its value against this; without it the only thing left to read
	// is EffectBasePoints, which on such effects is a stale leftover. Zero for tooltips that
	// have no item context, such as enchants, glyphs and talents.
	ItemLevel int
}

func GetEffectByIndex(effects map[int]dbc.SpellEffect, index int) *dbc.SpellEffect {
	if len(effects) <= index {
		return nil
	}

	// quick check
	effect := effects[index]
	if effect.EffectIndex == index {
		return &effect
	}

	// did not find
	for _, e := range effects {
		if e.EffectIndex == index {
			return &e
		}
	}

	return nil
}

// GetSpellPPM implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellPPM(spellId int64) float64 {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 1
	}

	return float64(spell.SpellProcsPerMinute)
}

// GetSpellProcCooldown implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellProcCooldown(spellId int64) time.Duration {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 1
	}

	return time.Duration(spell.ProcCategoryRecovery) * time.Millisecond
}

func (d DBCTooltipDataProvider) GetSpellMaxTargets(spellId int64) int64 {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 1
	}

	return int64(spell.MaxTargets)
}

func (d DBCTooltipDataProvider) GetEffectAmplitude(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 1
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return effect.EffectAmplitude
}

func (d DBCTooltipDataProvider) GetEffectChainAmplitude(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 1
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return effect.EffectChainAmplitude
}

func (d DBCTooltipDataProvider) GetEffectPointsPerResource(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 1
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return effect.EffectPointsPerResource
}

// GetEffectMaxTargets implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetEffectMaxTargets(spellId int64, effectIdx int64) int64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 1
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return int64(effect.EffectChainTargets)
}

// GetSpellProcChance implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellProcChance(spellId int64) float64 {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 0
	}

	return float64(spellEntry.ProcChance)
}

func (d DBCTooltipDataProvider) GetSpecNum() int64 {
	return 0
}

func (d DBCTooltipDataProvider) GetSpellIcon(spellId int64) string {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return ""
	}

	return spellEntry.IconPath
}

// GetMainHandWeapon implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetMainHandWeapon() *core.Weapon {
	// Item: 103727 as dummy for now
	return &core.Weapon{
		BaseDamageMin: 10257,
		BaseDamageMax: 19050,
		SwingSpeed:    2.6,
	}
}

// GetOffHandWeapon implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetOffHandWeapon() *core.Weapon {
	return &core.Weapon{
		BaseDamageMin: 10257,
		BaseDamageMax: 19050,
		SwingSpeed:    2.6,
	}
}

func (d DBCTooltipDataProvider) GetPlayerLevel() float64 {
	return core.CharacterLevel
}

func (d DBCTooltipDataProvider) GetSpellDescription(spellId int64) string {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return ""
	}

	return spellEntry.Description
}

func (d DBCTooltipDataProvider) GetSpellName(spellId int64) string {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return ""
	}

	return spellEntry.NameLang
}

// GetAttackPower implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetAttackPower() float64 {
	return 1
}

func (d DBCTooltipDataProvider) ShouldUseBaseScaling(spellId int64) bool {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return false
	}

	// need proper scaling entry
	return spellEntry.SpellClassSet > 0
}
func (d DBCTooltipDataProvider) GetClass(spellId int64) proto.Class {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return proto.Class_ClassUnknown
	}

	if class, ok := dbc.ClassBySpellClassSet(spellEntry.SpellClassSet); ok {
		return class.ProtoClass
	}
	return proto.Class_ClassUnknown
}

// Resolves an effect whose amount is stored as a coefficient against the item level the
// tooltip is being rendered for, using the same rule ParseStatEffect applies when it resolves
// the stats that end up in the database. Attribute 11 bit 0x4 marks the spell as scaling off
// item level, and on those effects EffectBasePoints holds a stale value - 1 Intellect on
// Nazgrim's Burnished Insignia, where the proc really grants 11761.
func (d DBCTooltipDataProvider) itemLevelScaledValue(spellId int64, effect *dbc.SpellEffect) (float64, bool) {
	spell := d.DBC.Spells[int(spellId)]
	if d.ItemLevel <= 0 || !spell.ScalesWithItemLevel() {
		return 0, false
	}

	return effect.CurveScaledAmount(true, d.ItemLevel)
}

// GetEffectBaseDamage implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetEffectScaledValue(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	class := d.GetClass(spellId)

	if !ok {
		return 1
	}

	// some spells are just fucked..
	if int(effectIdx) >= len(effectEntries) {
		effectIdx = int64(len(effectEntries) - 1)
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 1
	}

	baseDamage := 0.0

	// using item level scaling
	if value, scaled := d.itemLevelScaledValue(spellId, effect); scaled {
		baseDamage += value
	} else if effect.Coefficient > 0 && d.ShouldUseBaseScaling(spellId) {
		// using class scaling
		baseValue := 0.0

		// for now use generic unk13 scaling for level 90
		if class == proto.Class_ClassUnknown {
			baseValue = 1710.000000
		} else {
			baseValue = core.ClassBaseScaling[class]
		}

		baseDamage += baseValue * effect.Coefficient
	} else {
		baseDamage += float64(effect.EffectBasePoints)
		spell := d.DBC.Spells[int(spellId)]
		if spell.MaxScalingLevel > 0 {
			baseDamage += effect.EffectRealPointsPerLevel * math.Min(float64(spell.MaxScalingLevel), core.CharacterLevel)
		}
	}

	shouldScale := false
	switch effect.EffectType {
	case dbc.E_SCHOOL_DAMAGE:
		shouldScale = true

	case dbc.E_APPLY_AURA:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_ENEMY:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_FRIEND:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_PARTY:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_OWNER:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_RAID:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_PARTY_NONRANDOM:
		fallthrough
	case dbc.E_APPLY_AREA_AURA_PET:
		fallthrough
	case dbc.E_APPLY_AURA_ON_PET:
		switch effect.EffectAura {
		case dbc.A_PERIODIC_DAMAGE:
			fallthrough
		case dbc.A_PERIODIC_HEAL:
			shouldScale = true
		}
	}

	if !shouldScale {
		return baseDamage
	}

	if effect.BonusCoefficientFromAP > 0 {
		baseDamage += d.GetAttackPower() * effect.BonusCoefficientFromAP
	}

	if effect.EffectBonusCoefficient > 0 {
		baseDamage += d.GetSpellPower() * effect.EffectBonusCoefficient
	}

	return baseDamage
}

// GetDescriptionVariableString implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetDescriptionVariableString(spellId int64) string {
	spellEntry, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return ""
	}

	return spellEntry.Variables
}

// GetEffectBaseValue implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetEffectBaseValue(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 0
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	// An item level scaled effect has no usable base points, so $m reads the same resolved
	// amount $s does. It differs from the scaled value only in the spell power, attack power
	// and per-level terms, none of which apply to an effect that scales off item level.
	if value, scaled := d.itemLevelScaledValue(spellId, effect); scaled {
		return value
	}

	return float64(effect.EffectBasePoints)
}

// GetEffectPeriod implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetEffectPeriod(spellId int64, effectIdx int64) time.Duration {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 0
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return time.Duration(effect.EffectAuraPeriod) * time.Millisecond
}

// GetEffectRadius implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetEffectRadius(spellId int64, effectIdx int64) float64 {
	effectEntries, ok := d.DBC.SpellEffects[int(spellId)]
	if !ok {
		return 0
	}

	effect := GetEffectByIndex(effectEntries, int(effectIdx))
	if effect == nil {
		return 0
	}

	return effect.GetRadiusMax()
}

// GetSpellDuration implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellDuration(spellId int64) time.Duration {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 0
	}

	if spell.Duration < 0 {
		return 0
	}

	return time.Duration(spell.Duration) * time.Millisecond
}

// GetSpellPower implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellPower() float64 {
	return 15000
}

// GetSpellRange implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellRange(spellId int64) float64 {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 0
	}

	return float64(spell.MaxRange)
}

// GetStacks implements TooltipDataProvider.
func (d DBCTooltipDataProvider) GetSpellStacks(spellId int64) int64 {
	spell, ok := d.DBC.Spells[int(spellId)]
	if !ok {
		return 0
	}

	if spell.ProcCharges > 0 {
		return int64(spell.ProcCharges)
	}

	if spell.MaxCumulativeStacks > 0 {
		return int64(spell.MaxCumulativeStacks)
	}

	return 0
}

// HasAura implements TooltipDataProvider.
func (d DBCTooltipDataProvider) HasAura(auraId int64) bool {
	return true
}

// HasPassive implements TooltipDataProvider.
func (d DBCTooltipDataProvider) HasPassive(auraId int64) bool {
	return true
}

// IsMaleGender implements TooltipDataProvider.
func (d DBCTooltipDataProvider) IsMaleGender() bool {
	return true
}

// KnowsSpell implements TooltipDataProvider.
func (d DBCTooltipDataProvider) KnowsSpell(spellId int64) bool {
	return true
}

func (d DBCTooltipDataProvider) GetEffectEnchantValue(enchantId int64, effectIdx int64) float64 {
	enchantInfo, ok := d.DBC.Enchants[int(enchantId)]
	if !ok {
		return 0
	}

	return float64(enchantInfo.EffectPoints[effectIdx])
}
