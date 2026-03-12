package balance

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

const (
	StarfallBonusCoeff = 0.364
	StarfallCoeff      = 0.58
	StarfallVariance   = 0.15
)

func (moonkin *BalanceDruid) registerStarfallSpell() {
	starfallTickSpell := moonkin.RegisterSpell(druid.Humanoid|druid.Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 50286},
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: druid.DruidSpellStarfall,
		Flags:          core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   moonkin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: StarfallBonusCoeff,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := moonkin.CalcAndRollDamageRange(sim, StarfallCoeff, StarfallVariance)
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
		},
	})

	moonkin.Starfall = moonkin.RegisterSpell(druid.Humanoid|druid.Moonkin, core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 48505},
		SpellSchool: core.SpellSchoolArcane,
		ProcMask:    core.ProcMaskEmpty,
		Flags:       core.SpellFlagAPL,

		RelatedSelfBuff: moonkin.GetOrRegisterAura(core.Aura{
			Label:    "Starfall",
			ActionID: core.ActionID{SpellID: 48505},
			Duration: time.Second * 10,
		}),

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 32.6,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    moonkin.NewTimer(),
				Duration: time.Second * 90,
			},
		},

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Starfall",
			},
			NumberOfTicks: 10,
			TickLength:    time.Second,
			OnTick: func(sim *core.Simulation, target *core.Unit, _ *core.Dot) {
				if sim.CurrentTime > 0 {
					numActiveTargets := sim.Environment.ActiveTargetCount()
					// Starfall hits a random target
					target := int32(sim.RollWithLabel(0, float64(numActiveTargets), "Pick Random Target"))

					starfallTickSpell.Cast(sim, sim.Encounter.ActiveTargetUnits[target])

					// Starfall hits up to 2 random targets
					// This is a dirty way to pick a random second target that's different from the first
					if numActiveTargets > 1 {
						secondTarget := target
						for secondTarget == target {
							secondTarget = int32(sim.RollWithLabel(0, float64(numActiveTargets), "Pick Random Target"))
						}
						starfallTickSpell.Cast(sim, sim.Encounter.ActiveTargetUnits[secondTarget])
					}
				}
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)

			result := spell.CalcAndDealOutcome(sim, target, spell.OutcomeMagicHit)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
			}
		},
	})

	moonkin.AddEclipseCallback(func(eclipse Eclipse, gained bool, _ *core.Simulation) {
		if gained && eclipse == LunarEclipse {
			moonkin.Starfall.CD.Reset()
		}
	})
}
