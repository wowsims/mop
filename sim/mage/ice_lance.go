package mage

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (mage *Mage) registerIceLanceSpell() {
	// Values found at https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=30455
	iceLanceScaling := 0.335
	iceLanceCoefficient := 0.335
	iceLanceVariance := 0.25
	hasGlyphIcyVeins := mage.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfIcyVeins)
	hasGlyphSplittingIce := mage.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfSplittingIce)

	getIceLanceSpellBaseConfig := func(config core.SpellConfig) core.SpellConfig {
		return core.SpellConfig{
			ActionID:       config.ActionID,
			SpellSchool:    core.SpellSchoolFrost,
			ProcMask:       core.ProcMaskSpellDamage,
			Flags:          core.SpellFlagAPL,
			ClassSpellMask: MageSpellIceLance,
			MissileSpeed:   38,

			ManaCost: config.ManaCost,
			Cast:     config.Cast,

			DamageMultiplier: config.DamageMultiplier,
			CritMultiplier:   mage.DefaultCritMultiplier(),
			BonusCoefficient: iceLanceCoefficient,
			ThreatMultiplier: 1,

			ApplyEffects: config.ApplyEffects,
		}
	}

	splittingIceSpell := mage.RegisterSpell(getIceLanceSpellBaseConfig(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 30455}.WithTag(1), // Real SpellID: 131080

		DamageMultiplier: 0.4,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := mage.CalcAndRollDamageRange(sim, iceLanceScaling, iceLanceVariance)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	}))

	castIceLance := func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		baseDamage := mage.CalcAndRollDamageRange(sim, iceLanceScaling, iceLanceVariance)
		result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
		spell.WaitTravelTime(sim, func(sim *core.Simulation) {
			spell.DealDamage(sim, result)
		})
	}

	mage.RegisterSpell(getIceLanceSpellBaseConfig(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 30455},

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 1,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		DamageMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			randomTarget := mage.Env.NextActiveTargetUnit(target)
			hasSplittingIce := hasGlyphSplittingIce && mage.Env.ActiveTargetCount() > 1
			hasSplitBolts := mage.IcyVeinsAura.IsActive() && hasGlyphIcyVeins
			numberOfSplitBolts := core.TernaryInt32(hasSplitBolts, 2, 0)
			icyVeinsDamageMultiplier := core.TernaryFloat64(hasSplitBolts, 0.4, 1.0)

			// Secondary Target hit
			spell.DamageMultiplier *= icyVeinsDamageMultiplier
			if hasSplittingIce {
				spell.DamageMultiplier /= 2
				splittingIceSpell.DamageMultiplier /= 2

				castIceLance(sim, randomTarget, spell)

				for range numberOfSplitBolts {
					splittingIceSpell.Cast(sim, randomTarget)
				}
				spell.DamageMultiplier *= 2
				splittingIceSpell.DamageMultiplier *= 2
			}

			// Main Target hit
			castIceLance(sim, target, spell)
			for range numberOfSplitBolts {
				splittingIceSpell.Cast(sim, target)
			}

			if mage.FingersOfFrostAura.IsActive() {
				mage.FingersOfFrostAura.RemoveStack(sim)
			}

			spell.DamageMultiplier /= icyVeinsDamageMultiplier

			if mage.Spec == proto.Spec_SpecFrostMage {
				// Confirmed in game Icicles launch even if ice lance misses.
				for _, icicle := range mage.Icicles {
					if hasSplittingIce {
						mage.SpendIcicle(sim, randomTarget, icicle/2)
					}
					mage.SpendIcicle(sim, target, icicle)
				}
				mage.Icicles = make([]float64, 0)
			}

		},
	}))
}
