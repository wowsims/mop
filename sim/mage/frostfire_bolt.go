package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

const frostfireBoltCoefficient = 1.5        // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=44614 Field "EffetBonusCoefficient"
const frostfireBoltScaling = 1.5            // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=44614 Field "Coefficient"
const frostfireBoltVariance = 0.23999999464 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=44614 Field "Variance"

func (mage *Mage) frostfireBoltConfig(config core.SpellConfig) core.SpellConfig {
	return core.SpellConfig{
		ActionID:       config.ActionID,
		SpellSchool:    core.SpellSchoolFrostfire,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          config.Flags,
		ClassSpellMask: MageSpellFrostfireBolt,
		MissileSpeed:   28,

		ManaCost: config.ManaCost,
		Cast:     config.Cast,

		DamageMultiplier: config.DamageMultiplier,
		CritMultiplier:   mage.DefaultCritMultiplier(),
		BonusCoefficient: frostfireBoltCoefficient,
		ThreatMultiplier: 1,

		ApplyEffects: config.ApplyEffects,
	}
}

func (mage *Mage) registerFrostfireBoltSpell() {
	actionID := core.ActionID{SpellID: 44614}
	hasGlyph := mage.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfIcyVeins)
	mageSpecFrost := mage.Spec == proto.Spec_SpecFrostMage
	mageSpecFire := mage.Spec == proto.Spec_SpecFireMage
	var icyVeinsFrostfireBolt *core.Spell

	mage.RegisterSpell(mage.frostfireBoltConfig(core.SpellConfig{
		ActionID: actionID,
		Flags:    core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 4,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 2750,
			},
		},

		DamageMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if (mage.BrainFreezeAura == nil || !mage.BrainFreezeAura.IsActive()) && mage.PresenceOfMindAura != nil {
				mage.PresenceOfMindAura.Deactivate(sim)
			}
			hasSplitBolts := mage.IcyVeinsAura.IsActive() && hasGlyph
			damageMultiplier := core.TernaryFloat64(hasSplitBolts, 0.4, 1.0)

			spell.DamageMultiplier *= damageMultiplier
			baseDamage := mage.CalcAndRollDamageRange(sim, frostfireBoltScaling, frostfireBoltVariance)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			spell.DamageMultiplier /= damageMultiplier

			if result.Landed() && mageSpecFrost {
				mage.ProcFingersOfFrost(sim, spell)
			}

			if hasSplitBolts {
				icyVeinsFrostfireBolt.Cast(sim, target)
			}

			// Capture whether Brain Freeze was consumed by this cast. Deactivation is deferred
			// to spell impact so that the T16 2pc "Frozen Thoughts" buff (activated via
			// BrainFreezeAura.OnExpire) is not immediately consumed by this same cast.
			consumedBrainFreeze := mage.BrainFreezeAura != nil && mage.BrainFreezeAura.IsActive()

			if mageSpecFire && spell.TravelTime() > time.Duration(FireSpellMaxTimeUntilResult) {
				pa := sim.GetConsumedPendingActionFromPool()
				pa.NextActionAt = sim.CurrentTime + time.Duration(FireSpellMaxTimeUntilResult)

				pa.OnAction = func(sim *core.Simulation) {
					spell.DealDamage(sim, result)
					mage.HandleHeatingUp(sim, spell, result)
				}

				sim.AddPendingAction(pa)
			} else {
				spell.WaitTravelTime(sim, func(sim *core.Simulation) {
					spell.DealDamage(sim, result)
					if result.Landed() && mageSpecFrost {
						mage.GainIcicle(sim, target, result.Damage)
					}
					if mageSpecFire {
						mage.HandleHeatingUp(sim, spell, result)
					}
					if consumedBrainFreeze {
						mage.BrainFreezeAura.Deactivate(sim)
					}
				})
			}
		},
	}))

	icyVeinsFrostfireBolt = mage.RegisterSpell(mage.frostfireBoltConfig(core.SpellConfig{
		ActionID: actionID.WithTag(1), // Real SpellID: 131081
		Flags:    core.SpellFlagPassiveSpell,

		DamageMultiplier: 0.4,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			results := make([]*core.SpellResult, 2)

			for idx := range results {
				baseDamage := mage.CalcAndRollDamageRange(sim, frostfireBoltScaling, frostfireBoltVariance)
				results[idx] = spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
				if results[idx].Landed() {
					mage.ProcFingersOfFrost(sim, spell)
				}
			}

			for _, result := range results {
				spell.WaitTravelTime(sim, func(sim *core.Simulation) {
					spell.DealDamage(sim, result)
					if result.Landed() {
						mage.GainIcicle(sim, target, result.Damage)
					}
				})
			}
		},
	}))
}
