package survival

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/hunter"
)

func (survival *SurvivalHunter) ApplyTalents() {
	survival.applyLNL()
	survival.ApplyMods()
	survival.Hunter.ApplyTalents()
}

func (survival *SurvivalHunter) ApplyMods() {
	survival.AddStaticMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  hunter.HunterSpellSerpentSting,
		FloatValue: 0.5,
	})
}

func (survival *SurvivalHunter) applyLNL() {
	var lnlAura *core.Aura
	lnlAura = core.BlockPrepull(survival.RegisterAura(core.Aura{
		Label:     "Lock and Load",
		ActionID:  core.ActionID{SpellID: 56343},
		Duration:  time.Second * 12,
		MaxStacks: 2,
		Icd: &core.Cooldown{
			Timer:    survival.NewTimer(),
			Duration: time.Second * 10,
		},
	})).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		ClassMask:  hunter.HunterSpellExplosiveShot,
		FloatValue: -100,
	}).AttachProcTrigger(core.ProcTrigger{
		Callback:           core.CallbackOnCastComplete,
		ClassSpellMask:     hunter.HunterSpellExplosiveShot,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			survival.explosiveShot.CD.Reset()

			// T16 4pc: Explosive Shot casts have a 40% chance to not consume a charge of Lock and Load.
			if survival.T16_4pcAura.IsActive() && sim.Proc(0.4, "T16 4pc") {
				return
			}

			lnlAura.RemoveStack(sim)
		},
	})

	survival.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "Lock and Load Trigger",
		Callback:       core.CallbackOnPeriodicDamageDealt,
		ClassSpellMask: hunter.HunterSpellBlackArrow,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if !lnlAura.Icd.IsReady(sim) {
				return
			}

			procChance := core.TernaryFloat64(survival.T14_4pcAura.IsActive(), 0.40, 0.20)
			if !sim.Proc(procChance, "Lock and Load Trigger") {
				return
			}

			lnlAura.Activate(sim)
			lnlAura.SetStacks(sim, 2)

			survival.explosiveShot.CD.Reset()
			lnlAura.Icd.Use(sim)
		},
	})
}
