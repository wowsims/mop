package beast_mastery

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/hunter"
)

func (bmHunter *BeastMasteryHunter) ApplyTalents() {
	bmHunter.applyFrenzy()
	bmHunter.applyGoForTheThroat()
	bmHunter.applyCobraStrikes()
	bmHunter.applyInvigoration()
	bmHunter.applyBeastCleave()
	bmHunter.Hunter.ApplyTalents()
}

func (bmHunter *BeastMasteryHunter) applyFrenzy() {
	if bmHunter.Pet == nil {
		return
	}

	bmHunter.Pet.FrenzyAura = core.BlockPrepull(bmHunter.Pet.RegisterAura(core.Aura{
		ActionID:  core.ActionID{SpellID: 19623},
		Label:     "Frenzy",
		Duration:  time.Second * 30,
		MaxStacks: 5,

		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
			aura.Unit.MultiplyMeleeSpeed(sim, 1/(1+0.04*float64(oldStacks)))
			aura.Unit.MultiplyMeleeSpeed(sim, 1+0.04*float64(newStacks))
		},
	}))

	bmHunter.Pet.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "FrenzyHandler",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: hunter.HunterPetFocusDump,
		ProcChance:     0.4,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			bmHunter.Pet.FrenzyAura.Activate(sim)
			bmHunter.Pet.FrenzyAura.AddStack(sim)
		},
	})
}

func (bmHunter *BeastMasteryHunter) applyGoForTheThroat() {
	if bmHunter.Pet == nil {
		return
	}

	focusMetrics := bmHunter.Pet.NewFocusMetrics(core.ActionID{SpellID: 34953})

	bmHunter.MakeProcTriggerAura(core.ProcTrigger{
		Name:     "Go for the Throat",
		Callback: core.CallbackOnSpellHitDealt,
		ProcMask: core.ProcMaskRangedAuto,
		Outcome:  core.OutcomeCrit,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			bmHunter.Pet.AddFocus(sim, 15, focusMetrics)
		},
	})
}

func (bmHunter *BeastMasteryHunter) applyCobraStrikes() {
	if bmHunter.Pet == nil {
		return
	}

	var csAura *core.Aura
	csAura = bmHunter.Pet.RegisterAura(core.Aura{
		Label:     "Cobra Strikes",
		ActionID:  core.ActionID{SpellID: 53260},
		Duration:  time.Second * 15,
		MaxStacks: 6,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_BonusCrit_Percent,
		ProcMask:   core.ProcMaskMeleeMHSpecial,
		FloatValue: 100,
	}).AttachProcTrigger(core.ProcTrigger{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHSpecial,
		Outcome:            core.OutcomeCrit,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			csAura.RemoveStack(sim)
		},
	})

	bmHunter.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "Cobra Strikes",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: hunter.HunterSpellArcaneShot,
		Outcome:        core.OutcomeLanded,
		ProcChance:     0.15,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			csAura.Activate(sim)
			csAura.AddStacks(sim, 2)
		},
	})
}

func (bmHunter *BeastMasteryHunter) applyInvigoration() {
	if bmHunter.Pet == nil {
		return
	}

	focusMetrics := bmHunter.NewFocusMetrics(core.ActionID{SpellID: 53253})

	bmHunter.Pet.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "Invigoration",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: hunter.HunterPetFocusDump,
		Outcome:        core.OutcomeLanded,
		ProcChance:     0.15,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			bmHunter.AddFocus(sim, 20, focusMetrics)
		},
	})
}

func (bmHunter *BeastMasteryHunter) applyBeastCleave() {
	if bmHunter.Pet == nil {
		return
	}

	var copyDamage float64
	hitSpell := bmHunter.Pet.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 118459},
		ClassSpellMask: hunter.HunterPetBeastCleaveHit,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagIgnoreModifiers | core.SpellFlagNoSpellMods | core.SpellFlagPassiveSpell | core.SpellFlagNoOnCastComplete,

		DamageMultiplier: 0.75,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealDamage(sim, target, copyDamage, spell.OutcomeAlwaysHit)
		},
	})

	beastCleaveAura := bmHunter.Pet.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Beast Cleave",
		MetricsActionID:    core.ActionID{SpellID: 118455},
		Duration:           time.Second * 4,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMelee,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
		TriggerImmediately: true,

		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return bmHunter.Env.ActiveTargetCount() > 1 && !spell.Matches(hunter.HunterPetBeastCleaveHit)
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			copyDamage = result.Damage / result.ArmorMultiplier / result.Target.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexPhysical]

			nextTarget := bmHunter.Env.NextActiveTargetUnit(result.Target)
			for nextTarget != nil && nextTarget.Index != result.Target.Index {
				hitSpell.Cast(sim, nextTarget)
				nextTarget = bmHunter.Env.NextActiveTargetUnit(nextTarget)
			}
		},
	})

	bmHunter.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "Beast Cleave",
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: hunter.HunterSpellMultiShot,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			beastCleaveAura.Activate(sim)
		},
	})
}
