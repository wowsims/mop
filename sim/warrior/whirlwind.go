package warrior

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (war *Warrior) registerWhirlwind() {
	if war.Spec == proto.Spec_SpecProtectionWarrior {
		return
	}

	actionID := core.ActionID{SpellID: 1680}

	var whirlwindOH *core.Spell
	if war.Spec == proto.Spec_SpecFuryWarrior {
		whirlwindOH = war.RegisterSpell(core.SpellConfig{
			ActionID:       actionID.WithTag(2),
			SpellSchool:    core.SpellSchoolPhysical,
			ProcMask:       core.ProcMaskMeleeOHSpecial,
			ClassSpellMask: SpellMaskWhirlwindOh,
			Flags:          core.SpellFlagAoE | core.SpellFlagMeleeMetrics | core.SpellFlagNoOnCastComplete,

			DamageMultiplier: 0.85,
			ThreatMultiplier: 1,
			CritMultiplier:   war.DefaultCritMultiplier(),

			BonusCoefficient: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.CalcAoeDamageWithVariance(sim, spell.OutcomeMeleeWeaponSpecialHitAndCrit, func(sim *core.Simulation, spell *core.Spell) float64 {
					return spell.Unit.OHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())
				})

				spell.DealBatchedAoeDamage(sim)
			},
		})
	}

	war.RegisterSpell(core.SpellConfig{
		ActionID:       actionID.WithTag(1),
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagAoE | core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskWhirlwind,

		RageCost: core.RageCostOptions{
			Cost: core.TernaryInt32(war.Spec == proto.Spec_SpecFuryWarrior, 30, 20),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 0.85,
		ThreatMultiplier: 1,
		CritMultiplier:   war.DefaultCritMultiplier(),

		BonusCoefficient: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			results := spell.CalcAoeDamageWithVariance(sim, spell.OutcomeMeleeWeaponSpecialHitAndCrit, func(sim *core.Simulation, spell *core.Spell) float64 {
				return spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())
			})

			war.CastNormalizedSweepingStrikesAttack(results, sim)
			spell.DealBatchedAoeDamage(sim)

			if whirlwindOH != nil && war.OffHand() != nil && war.OffHand().WeaponType != proto.WeaponType_WeaponTypeUnknown {
				whirlwindOH.Cast(sim, target)
			}
		},
	})
}
