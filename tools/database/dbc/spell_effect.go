package dbc

import (
	"math"
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const MAX_SCALING_LEVEL = 100
const BASE_LEVEL = 90

type SpellEffect struct {
	ID                             int
	DifficultyID                   int
	EffectIndex                    int
	EffectType                     SpellEffectType
	EffectAmplitude                float64
	EffectAttributes               int
	EffectAura                     EffectAuraType
	EffectAuraPeriod               int
	EffectBasePoints               int
	EffectBonusCoefficient         float64
	EffectChainAmplitude           float64
	EffectChainTargets             int
	EffectDieSides                 int
	EffectItemType                 int
	EffectMechanic                 int
	EffectPointsPerResource        float64
	EffectPosFacing                float64
	EffectRealPointsPerLevel       float64
	EffectTriggerSpell             int
	BonusCoefficientFromAP         float64
	PvpMultiplier                  float64
	Coefficient                    float64
	Variance                       float64
	ResourceCoefficient            float64
	GroupSizeBasePointsCoefficient float64
	// Grouped properties parsed from JSON strings:
	EffectMiscValues      []int     // from EffectMiscValue_0, EffectMiscValue_1
	EffectMinRange        []float64 // from EffectRadiusIndex_0, EffectRadiusIndex_1
	EffectMaxRange        []float64
	EffectSpellClassMasks []int // from EffectSpellClassMask_0, EffectSpellClassMask_1, EffectSpellClassMask_2, EffectSpellClassMask_3
	ImplicitTargets       []int // from ImplicitTarget_0, ImplicitTarget_1
	SpellID               int
	ScalingType           int
}

func (se *SpellEffect) ToProto() *proto.SpellEffect {
	spellEffect := &proto.SpellEffect{
		Id:            int32(se.ID),
		SpellId:       int32(se.SpellID),
		Index:         int32(se.EffectIndex),
		Type:          proto.EffectType(se.EffectType),
		EffectSpread:  math.Round(se.Delta(BASE_LEVEL, BASE_LEVEL)),
		MinEffectSize: math.Round(se.Min(BASE_LEVEL, BASE_LEVEL)),
	}
	if spellEffect.EffectSpread == 0 {
		spellEffect.EffectSpread = float64(se.EffectDieSides)
	}
	switch se.EffectType {
	case E_ENERGIZE:
		spellEffect.MiscValue0 = &proto.SpellEffect_ResourceType{ResourceType: MapPowerTypeEnumToResourceType[int32(se.EffectMiscValues[0])]}
	case E_HEAL:
		spellEffect.MiscValue0 = &proto.SpellEffect_ResourceType{ResourceType: proto.ResourceType_ResourceTypeHealth}
	}

	return spellEffect
}

func (s *SpellEffect) GetRadiusMax() float64 {
	return math.Max(s.EffectMaxRange[0], s.EffectMaxRange[1])
}

func (s *SpellEffect) GetRadiusMin() float64 {
	return math.Min(s.EffectMinRange[0], s.EffectMinRange[1])
}

// The scaling curve the effect's coefficient resolves against. A positive ScalingType is a
// ChrClasses ID; a negative one addresses one of the generic curves.
func (s *SpellEffect) ScalingClass() proto.Class {
	if class, ok := ClassByID(s.ScalingType); ok {
		return class.ProtoClass
	}
	if extra, ok := ScalingExtraClass(s.ScalingType); ok {
		return extra
	}
	return proto.Class_ClassUnknown
}
func (s *SpellEffect) Delta(pLevel int, level int) float64 {
	if level > 90 {
		level = 90
	}

	var mScale float64
	spell := dbcInstance.Spells[s.SpellID]
	if s.Variance != 0 && s.ScalingClass() != 0 {
		scalingLevel := level
		if scalingLevel == 0 {
			scalingLevel = pLevel
		}
		if spell.MaxScalingLevel > 0 {
			scalingLevel = min(scalingLevel, spell.MaxScalingLevel)
		}
		mScale = dbcInstance.SpellScaling(s.ScalingClass(), scalingLevel)
	}

	return s.scaledDelta(mScale)
}

func (s *SpellEffect) Average(pLevel int, level int) float64 {
	if level == 0 {
		level = pLevel
	}

	scale := s.ScalingClass()
	spell := dbcInstance.Spells[s.SpellID]

	if s.Coefficient != 0 && scale != proto.Class_ClassUnknown {
		if spell.MaxScalingLevel > 0 {
			level = min(level, spell.MaxScalingLevel)
		}
		scaler := dbcInstance.SpellScaling(scale, level)
		value := s.Coefficient * scaler
		return value
	} else if s.EffectRealPointsPerLevel != 0 {
		if spell.MaxLevel > 0 {
			return float64(s.EffectBasePoints) + float64(min(level, spell.MaxLevel)-spell.SpellLevel)*s.EffectRealPointsPerLevel
		}
		return float64(s.EffectBasePoints) + float64(level-spell.SpellLevel)*s.EffectRealPointsPerLevel
	}
	return float64(s.EffectBasePoints)
}

// Minimum value calculation for player
func (s *SpellEffect) Min(pLevel int, level int) float64 {
	return s.scaledMin(s.Average(pLevel, level), s.Delta(pLevel, level))
}

// Maximum value calculation for player
func (s *SpellEffect) Max(pLevel int, level int) float64 {
	return s.scaledMax(s.Average(pLevel, level), s.Delta(pLevel, level))
}

func (s *SpellEffect) scaledDelta(budget float64) float64 {
	if s.Variance != 0 && budget > 0 {
		return s.Coefficient * float64(s.Variance) * budget
	}
	return 0
}

// Scaled minimum calculation
func (s *SpellEffect) scaledMin(avg, delta float64) float64 {
	result := avg - delta/2
	if s.EffectType == E_WEAPON_PERCENT_DAMAGE {
		result *= 0.01
	}
	return result
}

// Scaled maximum calculation
func (s *SpellEffect) scaledMax(avg, delta float64) float64 {
	result := avg + delta/2
	if s.EffectType == E_WEAPON_PERCENT_DAMAGE {
		result *= 0.01
	}
	return result
}

func (effect *SpellEffect) IsDirectDamageEffect() bool {
	types := []SpellEffectType{
		E_HEAL, E_SCHOOL_DAMAGE, E_HEALTH_LEECH,
		E_NORMALIZED_WEAPON_DMG, E_WEAPON_DAMAGE, E_WEAPON_PERCENT_DAMAGE,
	}
	return slices.Contains(types, effect.EffectType)
}

func (effect *SpellEffect) IsPeriodicDamageEffect() bool {
	subtypes := []EffectAuraType{
		A_PERIODIC_DAMAGE, A_PERIODIC_LEECH, A_PERIODIC_HEAL,
	}
	if effect.EffectType == E_APPLY_AURA {
		return slices.Contains(subtypes, effect.EffectAura)
	}
	return false
}

func (data *SpellEffect) ClassFlag(index uint) uint32 {
	return uint32(data.EffectSpellClassMasks[index/32]) & (1 << (index % 32))
}
func (effect *SpellEffect) CalcCoefficientStatValue(ilvl int) float64 {
	propPoints := effect.GetScalingValue(ilvl)
	return math.Round(float64(propPoints) * effect.Coefficient)
}
func (effect *SpellEffect) GetScalingValue(ilvl int) float64 {
	if ilvl > 0 {
		// If item we get rand prop points
		return float64(dbcInstance.RandomPropertiesByIlvl[ilvl][proto.ItemQuality_ItemQualityEpic][0])
	}
	spell := dbcInstance.Spells[effect.SpellID]
	if spell.ScalesFromItemLevel > 0 {
		// If item scales from a fixed ilvl we get rand prop points
		return float64(dbcInstance.RandomPropertiesByIlvl[int(spell.ScalesFromItemLevel)][proto.ItemQuality_ItemQualityEpic][0])
	}

	// if not we get class scaling based on the spell.
	// MaxScalingLevel 0 means uncapped, which is how Average() reads it. Clamping to it
	// would look up SpellScalings[0] and resolve every coefficient on such a spell to zero.
	scalingLevel := BASE_LEVEL
	if spell.MaxScalingLevel > 0 {
		scalingLevel = min(spell.MaxScalingLevel, BASE_LEVEL)
	}

	scale := effect.ScalingClass()
	return dbcInstance.SpellScalings[scalingLevel].Values[scale]
}

// Reports whether the effect's amount comes from its scaling coefficient rather than
// EffectBasePoints, and if so the resolved amount.
//
// For auras whose coefficient is only meaningful against an item level. With no item context
// there is nothing to resolve against, so they fall back to EffectBasePoints.
func (effect *SpellEffect) itemLevelScaledAmount(scalesWithIlvl bool, ilvl int) (float64, bool) {
	if effect.Coefficient == 0 || !scalesWithIlvl {
		return 0, false
	}
	return effect.CalcCoefficientStatValue(ilvl), true
}

// As itemLevelScaledAmount, but for auras that may scale off a class curve as well as off item
// level - GetScalingValue reads item level 0 as "use the class curve". Gating these on
// scalesWithIlvl instead would fall back to EffectBasePoints, which is 0 on such an effect:
// Phase Fingers' dodge is stored only as coefficient 18.0.
func (effect *SpellEffect) curveScaledAmount(scalesWithIlvl bool, ilvl int) (float64, bool) {
	if effect.Coefficient == 0 || effect.ScalingType == 0 {
		return 0, false
	}
	return effect.CalcCoefficientStatValue(core.TernaryInt(scalesWithIlvl, ilvl, 0)), true
}

// Collapses one of the lookups above to the amount the effect actually grants.
func (effect *SpellEffect) resolvedAmount(amount float64, scaled bool) float64 {
	if scaled {
		return amount
	}
	return float64(effect.EffectBasePoints)
}

func (effect *SpellEffect) ParseStatEffect(scalesWithIlvl bool, ilvl int) *stats.Stats {
	effectStats := &stats.Stats{}

	stat, _ := MapMainStatToStat(effect.EffectMiscValues[0])

	switch {
	case effect.EffectAura == A_MOD_RANGED_ATTACK_POWER:
		effectStats[proto.Stat_StatRangedAttackPower] = effect.resolvedAmount(effect.itemLevelScaledAmount(scalesWithIlvl, ilvl))
	case effect.EffectAura == A_MOD_ATTACK_POWER:
		effectStats[proto.Stat_StatAttackPower] = effect.resolvedAmount(effect.itemLevelScaledAmount(scalesWithIlvl, ilvl))
	case effect.EffectMiscValues[0] == -1 && effect.EffectAura == A_MOD_STAT && effect.EffectType == E_APPLY_AURA:
		// -1 represents ALL STATS if present in MiscValue 0
		amount := effect.resolvedAmount(effect.curveScaledAmount(scalesWithIlvl, ilvl))
		for _, s := range []proto.Stat{
			proto.Stat_StatAgility, proto.Stat_StatIntellect, proto.Stat_StatSpirit,
			proto.Stat_StatStamina, proto.Stat_StatStrength,
		} {
			effectStats[s] = amount
		}
	case effect.EffectAura == A_MOD_STAT && effect.EffectType == E_APPLY_AURA:
		effectStats[stat] = effect.resolvedAmount(effect.curveScaledAmount(scalesWithIlvl, ilvl))
	case effect.EffectAura == A_MOD_DAMAGE_DONE && effect.EffectType == E_APPLY_AURA:
		// Apply spell power, A_MOD_HEALING_DONE is also a possibility for healing power
		effectStats[proto.Stat_StatSpellPower] = effect.resolvedAmount(effect.curveScaledAmount(scalesWithIlvl, ilvl))
	case effect.EffectAura == A_MOD_RESISTANCE:
		school := SpellSchool(effect.EffectMiscValues[0])
		scaledValue, scaled := effect.itemLevelScaledAmount(scalesWithIlvl, ilvl)
		for schoolType, stat := range SpellSchoolToStat {
			if !school.Has(schoolType) {
				continue
			}
			// Every school in the mask contributes. Stopping after the first one
			// silently dropped the rest of a multi-school effect.
			if scaled {
				effectStats[stat] = scaledValue
			} else {
				effectStats[stat] += float64(effect.EffectBasePoints)
			}
		}

	case effect.EffectAura == A_MOD_RATING:
		scaledValue, scaled := effect.curveScaledAmount(scalesWithIlvl, ilvl)

		for _, rating := range getMatchingRatingMods(effect.EffectMiscValues[0]) {
			statMod, mapped := RatingModToStat[rating]
			if !mapped {
				continue
			}
			// Assigned rather than accumulated: several rating bits (melee/ranged/spell
			// hit for example) map onto the same stat and must not stack. Masks that do
			// span different stats need every one of them set, so no early exit here.
			if scaled {
				effectStats[statMod] = scaledValue
			} else {
				effectStats[statMod] = float64(effect.EffectBasePoints)
			}
		}
	case effect.EffectAura == A_MOD_INCREASE_ENERGY:
		// MiscValue 0 is the power type. Only mana has a matching stat; rage, focus,
		// energy and the rest are resources the sim tracks per spec, not stats, so
		// treating every power type as mana just invents mana out of nothing.
		if effect.EffectMiscValues[0] == POWER_TYPE_MANA {
			effectStats[proto.Stat_StatMana] = float64(effect.EffectBasePoints)
		}
	case effect.EffectAura == A_MOD_INCREASE_HEALTH_2:
		effectStats[proto.Stat_StatHealth] = effect.resolvedAmount(effect.curveScaledAmount(scalesWithIlvl, ilvl))
	case effect.EffectAura == A_PERIODIC_TRIGGER_SPELL && effect.EffectAuraPeriod == 10000:
		for _, sub := range dbcInstance.SpellEffectsInOrder(effect.EffectTriggerSpell) {
			effectStats.AddInplace(sub.ParseStatEffect(false, 0))
		}
	}

	return effectStats
}
