package brewmaster

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (bm *BrewmasterMonk) registerKegSmash() {
	actionID := core.ActionID{SpellID: 121253}
	chiMetrics := bm.NewChiMetrics(actionID)

	bm.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagAoE | core.SpellFlagMeleeMetrics | monk.SpellFlagBuilder | core.SpellFlagAPL,
		ClassSpellMask: monk.MonkSpellKegSmash,
		MaxRange:       core.MaxMeleeRange,
		MissileSpeed:   30,

		EnergyCost: core.EnergyCostOptions{
			Cost:   40,
			Refund: 0.8,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    bm.NewTimer(),
				Duration: time.Second * 8,
			},
		},

		DamageMultiplier: 10.0,
		ThreatMultiplier: 1,
		CritMultiplier:   bm.DefaultCritMultiplier(),

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return bm.StanceMatches(monk.SturdyOx)
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			results := spell.CalcAoeDamageWithVariance(sim, spell.OutcomeMeleeSpecialHitAndCrit, bm.CalculateMonkStrikeDamage)
			missedTargets := 0

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				for _, result := range results {
					spell.DealOutcome(sim, result)
					if result.Landed() {
						bm.DizzyingHazeAuras.Get(result.Target).Activate(sim)
					} else {
						missedTargets++
					}
				}

				if (missedTargets > 0) && (missedTargets == len(results)) {
					spell.IssueRefund(sim)
				} else {
					bm.AddChi(sim, spell, 2, chiMetrics)
				}
			})
		},
	})
}
