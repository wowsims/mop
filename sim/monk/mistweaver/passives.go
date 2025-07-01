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
			if (!spell.Matches(100787) && !spell.Matches(100784)) || !result.Landed() {
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
