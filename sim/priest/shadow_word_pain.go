package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

const SwpScaleCoeff = 0.743 * 0.85
const SwpSpellCoeff = 0.366 * 0.85

func (priest *Priest) registerShadowWordPainSpell() {
	priest.ShadowWordPain = priest.RegisterSpell(core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 589},
		SpellSchool:      core.SpellSchoolShadow,
		ProcMask:         core.ProcMaskSpellDamage,
		Flags:            core.SpellFlagAPL,
		ClassSpellMask:   PriestSpellShadowWordPain,
		BonusCoefficient: SwpSpellCoeff,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 4.4,
			PercentModifier: 100,
		},

		DamageMultiplier:         1,
		DamageMultiplierAdditive: 1,
		CritMultiplier:           priest.DefaultCritMultiplier(),

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "ShadowWordPain",
			},

			NumberOfTicks:       6,
			TickLength:          time.Second * 3,
			AffectedByCastSpeed: true,

			BonusCoefficient: SwpSpellCoeff,

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				dot.Snapshot(target, priest.CalcScalingSpellDmg(SwpScaleCoeff))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)
			},
		},

		ThreatMultiplier: 1,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcPeriodicDamage(sim, target, priest.CalcScalingSpellDmg(SwpScaleCoeff), spell.OutcomeMagicHitAndCrit)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
				spell.DealOutcome(sim, result)
			}
		},

		ExpectedTickDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, useSnapshot bool) *core.SpellResult {
			if useSnapshot {
				dot := spell.Dot(target)
				return dot.CalcSnapshotDamage(sim, target, dot.OutcomeExpectedMagicSnapshotCrit)
			} else {
				return spell.CalcPeriodicDamage(sim, target, priest.CalcScalingSpellDmg(SwpScaleCoeff), spell.OutcomeExpectedMagicCrit)
			}
		},
	})
}
