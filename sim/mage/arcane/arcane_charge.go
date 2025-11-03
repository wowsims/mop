package arcane

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/mage"
)

func (arcane *ArcaneMage) registerArcaneCharges() {
	abDamageMod := arcane.AddDynamicMod(core.SpellModConfig{
		ClassMask:  mage.MageSpellArcaneBlast | mage.MageSpellArcaneBarrage | mage.MageSpellArcaneMissilesTick,
		FloatValue: 0.5,
		Kind:       core.SpellMod_DamageDone_Flat,
	})
	abCostMod := arcane.AddDynamicMod(core.SpellModConfig{
		ClassMask:  mage.MageSpellArcaneBlast,
		FloatValue: 1.5,
		Kind:       core.SpellMod_PowerCost_Pct,
	})

	arcane.ArcaneChargesAura = core.BlockPrepull(arcane.GetOrRegisterAura(core.Aura{
		Label:     "Arcane Charges Aura",
		ActionID:  core.ActionID{SpellID: 36032},
		Duration:  time.Second * 10,
		MaxStacks: 4,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			abDamageMod.Activate()
			abCostMod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			abDamageMod.Deactivate()
			abCostMod.Deactivate()
		},
		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks int32, newStacks int32) {
			stacks := float64(newStacks)
			// Base effect: 0.5 damage per charge, 1.5 cost per charge
			baseDamageTotal := 0.5 * stacks
			baseCostTotal := 1.5 * stacks

			// T15 4PC increases the effect by 5% per charge
			// At 1 charge: +5%, at 2 charges: +10%, at 3 charges: +15%, at 4 charges: +20%
			if arcane.T15_4PC_ArcaneChargesAura != nil && arcane.T15_4PC_ArcaneChargesAura.IsActive() && stacks > 0 {
				t15BonusPercent := 0.05 * stacks
				baseDamageTotal *= (1.0 + t15BonusPercent)
				baseCostTotal *= (1.0 + t15BonusPercent)
			}

			abDamageMod.UpdateFloatValue(baseDamageTotal)
			abCostMod.UpdateFloatValue(baseCostTotal)
		},
		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(mage.MageSpellArcaneBarrage | mage.MageSpellEvocation) {
				aura.Deactivate(sim)
			}
		},
	}))

	lastArcaneExplosionCast := core.NeverExpires
	arcane.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Arcane Charge Arcane Explosion - Trigger",
		ClassSpellMask:     mage.MageSpellArcaneExplosion,
		Callback:           core.CallbackOnSpellHitDealt,
		Outcome:            core.OutcomeLanded,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if lastArcaneExplosionCast == sim.CurrentTime {
				return
			}

			lastArcaneExplosionCast = sim.CurrentTime
			arcane.ArcaneChargesAura.Activate(sim)
			if sim.Proc(.3, "ArcaneChargesProc") {
				arcane.ArcaneChargesAura.AddStack(sim)
			}
		},
	})

}
