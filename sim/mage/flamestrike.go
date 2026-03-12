package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (mage *Mage) registerFlamestrikeSpell() {

	flameStrikeVariance := 0.20200000703    // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=exact%253A2120 Field: "Variance"
	flameStrikeScaling := 0.45600000024     // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=exact%253A2120 Field: "Coefficient"
	flameStrikeCoefficient := 0.51800000668 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=exact%253A2120 Field: "BonusCoefficient"
	flameStrikeDotScaling := 0.11900000274
	flameStrikeDotCoefficient := 0.13500000536

	mage.Flamestrike = mage.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2120},
		SpellSchool:    core.SpellSchoolFire,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAoE | core.SpellFlagAPL,
		ClassSpellMask: MageSpellFlamestrike,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 6,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Second * 2,
			},
			CD: core.Cooldown{
				Timer:    mage.NewTimer(),
				Duration: time.Second * 12,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   mage.DefaultCritMultiplier(),
		BonusCoefficient: flameStrikeCoefficient,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.CalcAndDealAoeDamageWithVariance(sim, spell.OutcomeMagicHitAndCrit, func(sim *core.Simulation, _ *core.Spell) float64 {
				return mage.CalcAndRollDamageRange(sim, flameStrikeScaling, flameStrikeVariance)
			})

			spell.RelatedDotSpell.AOEDot().Apply(sim)
		},
	})

	mage.Flamestrike.RelatedDotSpell = mage.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2120}.WithTag(1),
		SpellSchool:    core.SpellSchoolFire,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: MageSpellFlamestrikeDot,
		Flags:          core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   mage.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label: "FlameStrike DOT",
			},
			NumberOfTicks:    4,
			TickLength:       time.Second * 2,
			BonusCoefficient: flameStrikeDotCoefficient,
			OnSnapshot: func(_ *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.Snapshot(target, mage.CalcScalingSpellDmg(flameStrikeDotScaling))
			},
			OnTick: func(sim *core.Simulation, _ *core.Unit, dot *core.Dot) {
				for _, aoeTarget := range sim.Encounter.ActiveTargetUnits {
					dot.CalcAndDealPeriodicSnapshotDamage(sim, aoeTarget, dot.OutcomeSnapshotCrit)
				}
			},
		},
	})
}
