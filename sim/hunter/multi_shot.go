package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (hunter *Hunter) registerMultiShotSpell() {

	hunter.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2643},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskRangedSpecial,
		ClassSpellMask: HunterSpellMultiShot,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL | core.SpellFlagRanged,
		MissileSpeed:   40,
		MinRange:       0,
		MaxRange:       40,
		FocusCost: core.FocusCostOptions{
			Cost: 40,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
		},

		BonusCritPercent:         0,
		DamageMultiplierAdditive: 1,
		DamageMultiplier:         0.6,
		CritMultiplier:           hunter.DefaultCritMultiplier(),
		ThreatMultiplier:         1,

		BonusCoefficient: 1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			sharedDmg := hunter.AutoAttacks.Ranged().CalculateNormalizedWeaponDamage(sim, spell.RangedAttackPower())
			results := spell.CalcAoeDamage(sim, sharedDmg, spell.OutcomeRangedHitAndCrit)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				for _, result := range results {
					spell.DealDamage(sim, result)

					//Serpent Spread
					if hunter.Spec == proto.Spec_SpecSurvivalHunter {
						ss := hunter.SerpentSting.Dot(result.Target)
						hunter.ImprovedSerpentSting.Cast(sim, result.Target)
						ss.BaseTickCount = 5
						ss.Apply(sim)
					}
				}
			})

		},
	})
}
