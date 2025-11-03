package balance

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

const (
	SunfireBonusCoeff = 0.24

	SunfireDotCoeff = 0.24

	SunfireImpactCoeff    = 0.571
	SunfireImpactVariance = 0.2
)

func (moonkin *BalanceDruid) registerSunfireSpell() {
	moonkin.registerSunfireImpactSpell()
	moonkin.registerSunfireDoTSpell()
}

func (moonkin *BalanceDruid) registerSunfireDoTSpell() {
	moonkin.Sunfire.RelatedDotSpell = moonkin.Unit.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 93402}.WithTag(1),
		SpellSchool:    core.SpellSchoolNature,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: druid.DruidSpellSunfireDoT,
		Flags:          core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   moonkin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Sunfire",
				OnSpellHitTaken: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					if result.Landed() && result.DidCrit() && spell.Matches(druid.DruidSpellWrath|druid.DruidSpellStarsurge) {
						dot := moonkin.Sunfire.Dot(aura.Unit)
						oldDuration := dot.RemainingDuration(sim)
						oldTickrate := dot.TickPeriod()
						dot.DurationExtend(sim, dot.CalcTickPeriod())

						if sim.Log != nil {
							moonkin.Log(sim, "[DEBUG]: %s extended %s. Old Duration: %0.2f, new duration: %0.2f. Old Tickrate: %0.2f, new Tickrate: %0.2f", spell.ActionID, moonkin.Sunfire.ActionID, oldDuration.Seconds(), dot.RemainingDuration(sim).Seconds(), oldTickrate.Seconds(), dot.TickPeriod().Seconds())
						}
					}
				},
			},
			NumberOfTicks:       7,
			TickLength:          time.Second * 2,
			AffectedByCastSpeed: true,
			BonusCoefficient:    SunfireBonusCoeff,

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				dot.Snapshot(target, moonkin.CalcScalingSpellDmg(SunfireDotCoeff))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeAlwaysHitNoHitCounter)

			spell.Dot(target).Apply(sim)
			spell.DealOutcome(sim, result)
		},

		ExpectedTickDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, useSnapshot bool) *core.SpellResult {
			dot := spell.Dot(target)
			if useSnapshot {
				result := dot.CalcSnapshotDamage(sim, target, dot.OutcomeExpectedSnapshotCrit)
				result.Damage /= dot.TickPeriod().Seconds()
				return result
			} else {
				result := spell.CalcPeriodicDamage(sim, target, moonkin.CalcScalingSpellDmg(SunfireDotCoeff), spell.OutcomeExpectedMagicCrit)
				result.Damage /= dot.CalcTickPeriod().Round(time.Millisecond).Seconds()
				return result
			}
		},
	})
}

func (moonkin *BalanceDruid) registerSunfireImpactSpell() {

	moonkin.Sunfire = moonkin.RegisterSpell(druid.Humanoid|druid.Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 93402},
		SpellSchool:    core.SpellSchoolNature,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: druid.DruidSpellSunfire,
		Flags:          core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 9,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		DamageMultiplier: 1,

		CritMultiplier:   moonkin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: SunfireBonusCoeff,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := moonkin.CalcAndRollDamageRange(sim, SunfireImpactCoeff, SunfireImpactVariance)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)

			if result.Landed() {
				moonkin.Sunfire.RelatedDotSpell.Cast(sim, target)
			}

			spell.DealDamage(sim, result)
		},
	})
}
