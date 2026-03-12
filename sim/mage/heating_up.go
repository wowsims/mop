package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

// https://www.wowhead.com/mop-classic/spell=48107/heating-up#comments:id=1709419 For Information on heating up time specifics (.75s, .25s etc)

func (mage *Mage) registerHeatingUp() {
	mage.HeatingUp = core.BlockPrepull(mage.RegisterAura(core.Aura{
		Label:    "Heating Up",
		ActionID: core.ActionID{SpellID: 48107},
		Duration: time.Second * 10,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			mage.ReactToEvent(sim, false)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			mage.ReactToEvent(sim, false)
		},
	}))

	mage.InstantPyroblastAura = core.BlockPrepull(mage.RegisterAura(core.Aura{
		Label:    "Pyroblast!",
		ActionID: core.ActionID{SpellID: 48108},
		Duration: time.Second * 15,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			mage.ReactToEvent(sim, false)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			mage.ReactToEvent(sim, false)
		},
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		FloatValue: -2.0,
		ClassMask:  MageSpellPyroblast,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_CastTime_Pct,
		FloatValue: -1,
		ClassMask:  MageSpellPyroblast,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: .25,
		// Pyroblast Dot is handled in pyroblast.go because
		// the Dot is applied after it lands and the aura
		// has already been consumed.
		ClassMask: MageSpellPyroblast,
	}))
}

func (mage *Mage) HeatingUpSpellHandler(sim *core.Simulation, spell *core.Spell, result *core.SpellResult, callback func()) {
	spell.RegisterTravelTimeCallback(sim, min(spell.TravelTime(), FireSpellMaxTimeUntilResult), func(sim *core.Simulation) {
		callback()
		mage.HandleHeatingUp(sim, spell, result)
	})
}

func (mage *Mage) HandleHeatingUp(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
	if result.DidCrit() {
		if mage.HeatingUp.IsActive() {
			mage.InstantPyroblastAura.Activate(sim)
			mage.HeatingUp.Deactivate(sim)
		} else {
			mage.HeatingUp.Activate(sim)
		}
	} else {
		pa := sim.GetConsumedPendingActionFromPool()
		pa.NextActionAt = sim.CurrentTime + time.Duration(HeatingUpDeactivateBuffer)

		pa.OnAction = func(sim *core.Simulation) {
			mage.HeatingUp.Deactivate(sim)
		}

		sim.AddPendingAction(pa)
	}
}
