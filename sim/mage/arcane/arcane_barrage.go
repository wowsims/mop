package arcane

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/mage"
)

func (arcane *ArcaneMage) registerArcaneBarrageSpell() {

	arcaneBarrageVariance := 0.20   // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=exact%253A44425 Field: "Variance"
	arcaneBarrageScale := 1.0       // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=exact%253A44425 Field: "Coefficient"
	arcaneBarrageCoefficient := 1.0 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=exact%253A44425 Field: "BonusCoefficient"

	arcane.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 44425},
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: mage.MageSpellArcaneBarrage,
		MissileSpeed:   24,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 4,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    arcane.NewTimer(),
				Duration: time.Second * 3,
			},
		},

		DamageMultiplier: 1 * 1.19, // 2025-07-01 - Arcane Barrage damage increase lowered to 19% (was 30%).
		CritMultiplier:   arcane.DefaultCritMultiplier(),
		BonusCoefficient: float64(arcaneBarrageCoefficient),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := arcane.CalcAndRollDamageRange(sim, arcaneBarrageScale, arcaneBarrageVariance)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})

			spell.DamageMultiplier *= .5
			currTarget := target
			numberOfTargets := arcane.Env.ActiveTargetCount() - 1

			for range min(arcane.ArcaneChargesAura.GetStacks(), numberOfTargets) {
				currTarget = arcane.Env.NextActiveTargetUnit(currTarget)
				baseDamage := arcane.CalcAndRollDamageRange(sim, arcaneBarrageScale, arcaneBarrageVariance)
				result := spell.CalcDamage(sim, currTarget, baseDamage, spell.OutcomeMagicHitAndCrit)
				spell.WaitTravelTime(sim, func(sim *core.Simulation) {
					spell.DealDamage(sim, result)
				})
			}
			spell.DamageMultiplier /= .5

		},
	})
}
