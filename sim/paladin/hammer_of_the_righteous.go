package paladin

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (paladin *Paladin) registerHammerOfTheRighteous() {
	numTargets := paladin.Env.GetNumTargets()
	actionID := core.ActionID{SpellID: 53595}
	paladin.CanTriggerHolyAvengerHpGain(actionID)
	auraArray := paladin.NewEnemyAuraArray(core.WeakenedBlowsAura)

	hammerOfTheRighteousAoe := paladin.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 88263},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagPassiveSpell,
		ClassSpellMask: SpellMaskHammerOfTheRighteousAoe,

		MaxRange: 8,

		DamageMultiplier: 0.35,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			results := make([]*core.SpellResult, numTargets)

			for idx := int32(0); idx < numTargets; idx++ {
				currentTarget := sim.Environment.GetTargetUnit(idx)
				baseDamage := spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())
				results[idx] = spell.CalcDamage(sim, currentTarget, baseDamage, spell.OutcomeMagicCrit)
			}

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				for idx := int32(0); idx < numTargets; idx++ {
					spell.DealOutcome(sim, results[idx])
					auraArray.Get(results[idx].Target).Activate(sim)
				}
			})
		},
	})

	paladin.HammerOfTheRighteous = paladin.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskHammerOfTheRighteousMelee,

		MaxRange: core.MaxMeleeRange,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 3,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: paladin.Spec == proto.Spec_SpecHolyPaladin,
			CD: core.Cooldown{
				Timer:    paladin.BuilderCooldown(),
				Duration: paladin.sharedBuilderBaseCD,
			},
		},

		DamageMultiplier: 0.2,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())

			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if result.Landed() {
				paladin.HolyPower.Gain(1, actionID, sim)
				hammerOfTheRighteousAoe.Cast(sim, target)
			}

			spell.DealOutcome(sim, result)
		},
	})
}
