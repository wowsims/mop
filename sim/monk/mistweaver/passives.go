package mistweaver

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (mw *MistweaverMonk) registerPassives() {
	mw.registerMuscleMemory()
	mw.registerSerpentsZeal()
	mw.registerVitalMists()
}

func (mw *MistweaverMonk) registerVitalMists() {
	vmManaCostMod := mw.AddDynamicMod(core.SpellModConfig{
		ClassMask:  monk.MonkSpellSurgingMist,
		FloatValue: -0.2,
		Kind:       core.SpellMod_PowerCost_Pct,
	})

	vmCastTimeMod := mw.AddDynamicMod(core.SpellModConfig{
		ClassMask:  monk.MonkSpellSurgingMist,
		FloatValue: -0.2,
		Kind:       core.SpellMod_CastTime_Pct,
	})

	mw.VitalMistsAura = mw.RegisterAura(core.Aura{
		Label:     "Vital Mists",
		ActionID:  core.ActionID{SpellID: 118674},
		Duration:  time.Second * 30,
		MaxStacks: 5,
		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks int32, newStacks int32) {
			vmCastTimeMod.UpdateFloatValue(float64(newStacks) * -0.2)
			vmCastTimeMod.Activate()
			vmManaCostMod.UpdateFloatValue(core.TernaryFloat64(newStacks == 5, -2.0, float64(newStacks)*-0.2))
			vmManaCostMod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			vmCastTimeMod.Deactivate()
			vmManaCostMod.Deactivate()
		},
		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if !spell.Matches(monk.MonkSpellSurgingMist) {
				return
			}

			mw.VitalMistsAura.Deactivate(sim)
		},
	})

	core.MakeProcTriggerAura(&mw.Unit, core.ProcTrigger{
		Name:           "Vital Mists: Tiger Palm Trigger",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: monk.MonkSpellTigerPalm,
		Outcome:        core.OutcomeLanded,
		ProcChance:     1,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			mw.VitalMistsAura.Activate(sim)
			mw.VitalMistsAura.AddStack(sim)
		},
	})
}

func (mw *MistweaverMonk) registerSerpentsZeal() {

	dmgDone := 0.0

	serpentZealHeal := mw.RegisterSpell((core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 127722},
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell,

		DamageMultiplier: 0.25,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealHealing(sim, target, dmgDone, spell.OutcomeHealing)
		},
	}))
	mw.SerpentZealAura = mw.RegisterAura(core.Aura{
		Label:    "Serpent's Zeal",
		ActionID: core.ActionID{SpellID: 127722},
		Duration: time.Second * 30,
		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if result == nil || !result.Landed() || result.Damage == 0 || !spell.ProcMask.Matches(core.ProcMaskWhiteHit) {
				return
			}

			dmgDone = result.Damage
			//Should be a smart heal
			serpentZealHeal.Cast(sim, &mw.Unit)

		},
	})

	core.MakeProcTriggerAura(&mw.Unit, core.ProcTrigger{
		Name:           "Serpent Zeal: BlackoutKick Trigger",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: monk.MonkSpellBlackoutKick,
		Outcome:        core.OutcomeLanded,
		ProcChance:     1,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			mw.SerpentZealAura.Activate(sim)
		},
	})

}

func (mw *MistweaverMonk) registerMuscleMemory() {

	mw.MuscleMemoryAura = mw.RegisterAura(core.Aura{
		Label:    fmt.Sprintf("Muscle Memory %s", mw.Label),
		ActionID: core.ActionID{SpellID: 139597},
		Duration: time.Second * 15,

		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if !spell.Matches(monk.MonkSpellBlackoutKick|monk.MonkSpellTigerPalm) || !result.Landed() {
				return
			}
			aura.Deactivate(sim)
		},
	})

	core.MakeProcTriggerAura(&mw.Unit, core.ProcTrigger{
		Name:           fmt.Sprintf("Muscle Memory: Trigger %s", mw.Label),
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: monk.MonkSpellJab,
		Outcome:        core.OutcomeLanded,
		ProcChance:     1,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			mw.MuscleMemoryAura.Activate(sim)
		},
	})

}
