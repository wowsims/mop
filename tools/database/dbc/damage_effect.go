package dbc

import "slices"

// Describes a direct-damage effect reached from an item or enchant effect chain. Damage procs
// carry no stats, so the stat-based resolution in ParseStatEffect returns nothing for them and
// the effect is dropped before it is ever reported.
type DamageEffect struct {
	SpellID          int   // spell that deals the damage
	SchoolMask       int32 // DBC school mask of the damage spell
	MinDamage        float64
	MaxDamage        float64
	BonusCoefficient float64 // spell power coefficient
	IsLeech          bool    // E_HEALTH_LEECH also heals the caster, which is not modelled here
}

// The effect types whose value is flat damage. E_WEAPON_PERCENT_DAMAGE is deliberately
// absent: it is a percentage of weapon damage rather than an amount, so it needs different
// wiring than a flat min/max roll.
var directDamageEffectTypes = []SpellEffectType{E_SCHOOL_DAMAGE, E_HEALTH_LEECH}

// Resolves the effect's damage to a min and max amount.
func (effect *SpellEffect) DamageRange() (float64, float64) {
	// An explicit die roll is the amount the client displays, so it wins over the scaling
	// coefficient. Both agree on the mean, but the coefficient's variance is wider: Iron
	// Shield Spike scales to 7.5-12.5 while the enchantment is labelled "Iron Spike (8-12)".
	// The die sides reproduce every shield spike label exactly.
	if effect.EffectDieSides > 0 {
		return float64(effect.EffectBasePoints + 1), float64(effect.EffectBasePoints + effect.EffectDieSides)
	}

	if effect.Coefficient != 0 {
		return effect.Min(BASE_LEVEL, BASE_LEVEL), effect.Max(BASE_LEVEL, BASE_LEVEL)
	}

	return float64(effect.EffectBasePoints), float64(effect.EffectBasePoints)
}

// Walks the trigger chain below spellID and returns the first direct damage effect it
// reaches, or nil if the chain deals no flat damage.
func ResolveDamageEffect(spellID int) *DamageEffect {
	return newChainWalker().resolveDamageEffect(spellID)
}

func (w *chainWalker) resolveDamageEffect(spellID int) *DamageEffect {
	effects := w.effects(spellID)

	for _, se := range effects {
		// A_PROC_TRIGGER_DAMAGE carries its amount on the aura itself rather than on a
		// separate triggered spell, which is how the shield spikes are described.
		if !slices.Contains(directDamageEffectTypes, se.EffectType) && se.EffectAura != A_PROC_TRIGGER_DAMAGE {
			continue
		}

		minDamage, maxDamage := se.DamageRange()
		if minDamage == 0 && maxDamage == 0 {
			continue
		}

		return &DamageEffect{
			SpellID:          spellID,
			SchoolMask:       GetDBC().Spells[spellID].SchoolMask,
			MinDamage:        minDamage,
			MaxDamage:        maxDamage,
			BonusCoefficient: se.EffectBonusCoefficient,
			IsLeech:          se.EffectType == E_HEALTH_LEECH,
		}
	}

	for _, se := range effects {
		if se.EffectTriggerSpell == 0 {
			continue
		}
		if damage := w.resolveDamageEffect(se.EffectTriggerSpell); damage != nil {
			return damage
		}
	}

	return nil
}
