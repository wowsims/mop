package arcane

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/mage"
)

func (arcane *ArcaneMage) registerArcaneMissilesSpell() {
	// Values found at https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=exact%253A7268
	arcaneMissilesScaling := 0.22200000286
	arcaneMissilesCoefficient := 0.22200000286
	actionID := core.ActionID{SpellID: 7268}

	// Aura for when proc is successful
	arcaneMissilesProcAura := core.BlockPrepull(arcane.RegisterAura(core.Aura{
		Label:     "Arcane Missiles Proc",
		ActionID:  core.ActionID{SpellID: 79683},
		Duration:  time.Second * 20,
		MaxStacks: 2,
	}))
	arcane.ArcaneMissilesProcAura = arcaneMissilesProcAura

	arcaneMissilesTickSpell := arcane.GetOrRegisterSpell(core.SpellConfig{
		ActionID:       actionID.WithTag(1),
		SpellSchool:    core.SpellSchoolArcane,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: mage.MageSpellArcaneMissilesTick,
		MissileSpeed:   20,

		DamageMultiplier: 1,
		CritMultiplier:   arcane.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: arcaneMissilesCoefficient,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := arcane.CalcScalingSpellDmg(arcaneMissilesScaling)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeTickMagicHitAndCrit)
			spell.SpellMetrics[result.Target.UnitIndex].Casts--
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	})

	arcane.RegisterSpell(core.SpellConfig{
		ActionID:         actionID, // Real SpellID: 5143
		SpellSchool:      core.SpellSchoolArcane,
		ProcMask:         core.ProcMaskSpellDamage,
		Flags:            core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask:   mage.MageSpellArcaneMissilesCast,
		DamageMultiplier: 0,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return arcaneMissilesProcAura.IsActive()
		},

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "ArcaneMissiles",
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					arcane.ArcaneChargesAura.Activate(sim)
					arcane.ArcaneChargesAura.AddStack(sim)
					arcane.ExtendGCDUntil(sim, sim.CurrentTime+arcane.ReactionTime)
				},
				OnReset: func(aura *core.Aura, sim *core.Simulation) {
					arcane.ArcaneChargesAura.Deactivate(sim)
				},
			},
			NumberOfTicks:        5,
			TickLength:           time.Millisecond * 400,
			HasteReducesDuration: true,
			AffectedByCastSpeed:  true,
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				arcaneMissilesTickSpell.Cast(sim, target)
			},
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if arcaneMissilesProcAura.IsActive() {
				arcaneMissilesProcAura.RemoveStack(sim)
			}
			result := spell.CalcAndDealOutcome(sim, target, spell.OutcomeMagicHit)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
				arcaneMissilesTickSpell.SpellMetrics[target.UnitIndex].Hits++
				arcaneMissilesTickSpell.SpellMetrics[target.UnitIndex].Casts++
			}
		},
	})

	// Listener for procs
	arcane.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Arcane Missiles - Activation",
		ActionID:           core.ActionID{SpellID: 79684},
		ClassSpellMask:     mage.MageSpellsAll ^ (mage.MageSpellArcaneMissilesCast | mage.MageSpellArcaneMissilesTick | mage.MageSpellNetherTempestDot | mage.MageSpellLivingBombDot | mage.MageSpellLivingBombExplosion),
		SpellFlagsExclude:  core.SpellFlagHelpful,
		ProcChance:         0.3,
		Callback:           core.CallbackOnSpellHitDealt,
		Outcome:            core.OutcomeLanded,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			arcaneMissilesProcAura.Activate(sim)
			arcaneMissilesProcAura.AddStack(sim)
		},
	})
}
