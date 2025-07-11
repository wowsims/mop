package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (mage *Mage) registerNetherTempest() {
	if !mage.Talents.NetherTempest {
		return
	}
	netherTempestCoefficient := 0.24 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=114923 Field "EffetBonusCoefficient"
	netherTempestScaling := .31      // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=114923 Field "Coefficient"

	ntCleaveSpell := mage.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 114954},
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: MageSpellNetherTempestDot,
		MissileSpeed:   .85,

		DamageMultiplier: 1,
		CritMultiplier:   mage.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			nextTarget := mage.Env.NextActiveTargetUnit(target)
			spell.DamageMultiplier /= 2
			result := spell.CalcDamage(sim, nextTarget, mage.NetherTempest.Dot(target).SnapshotBaseDamage, spell.OutcomeMagicHitAndCrit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
			spell.DamageMultiplier *= 2
		},
	})

	mage.NetherTempest = mage.GetOrRegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 114923},
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: MageSpellNetherTempest,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 1.5,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		CritMultiplier:   mage.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHitNoHitCounter)
			if result.Landed() {
				spell.RelatedDotSpell.Cast(sim, target)
			}
			spell.DealOutcome(sim, result)
		},
	})

	mage.NetherTempest.RelatedDotSpell = mage.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 114923}.WithTag(1),
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: MageSpellNetherTempestDot,

		DamageMultiplier: 1,
		CritMultiplier:   mage.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Nether Tempest",
			},
			NumberOfTicks:       12,
			TickLength:          time.Second * 1,
			AffectedByCastSpeed: true,
			BonusCoefficient:    netherTempestCoefficient,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				dot.Snapshot(target, mage.CalcScalingSpellDmg(netherTempestScaling))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)
				if mage.Env.ActiveTargetCount() > 1 {
					ntCleaveSpell.Cast(sim, target)
				}
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Dot(target).Apply(sim)
		},
	})
}
