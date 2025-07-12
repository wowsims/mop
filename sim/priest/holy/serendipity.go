package holy

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/priest"
)

func (holy *HolyPriest) registerSerendipity() {

	serendipitySpendSpells := priest.PriestSpellGreaterHeal | priest.PriestSpellPrayerOfHealing
	serendipityBuildSpells := priest.PriestSpellBindingHeal | priest.PriestSpellFlashHeal

	serendipityCastTimemod := holy.AddDynamicMod(core.SpellModConfig{
		ClassMask:  serendipitySpendSpells,
		Kind:       core.SpellMod_CastTime_Pct,
		FloatValue: -0.2,
	})
	serendipityManaCostmod := holy.AddDynamicMod(core.SpellModConfig{
		ClassMask:  serendipitySpendSpells,
		Kind:       core.SpellMod_PowerCost_Pct,
		FloatValue: -0.2,
	})
	holy.SerendipityAura = holy.RegisterAura(core.Aura{
		Label:     "Serendipity",
		ActionID:  core.ActionID{SpellID: 63735},
		Duration:  time.Second * 20,
		MaxStacks: 2,
		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks int32, newStacks int32) {
			serendipityCastTimemod.UpdateFloatValue(float64(newStacks) * -0.2)
			serendipityCastTimemod.Activate()
			serendipityManaCostmod.UpdateFloatValue(float64(newStacks) * -0.2)
			serendipityManaCostmod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			serendipityCastTimemod.Deactivate()
			serendipityManaCostmod.Deactivate()
		},
		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if !spell.Matches(serendipitySpendSpells) {
				return
			}
			holy.SerendipityAura.Deactivate(sim)
		},
	})

	core.MakeProcTriggerAura(&holy.Unit, core.ProcTrigger{
		Name:           "Serendipity - Trigger",
		Callback:       core.CallbackOnHealDealt,
		Outcome:        core.OutcomeLanded,
		ClassSpellMask: serendipityBuildSpells,
		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			holy.SerendipityAura.Activate(sim)
			holy.SerendipityAura.AddStack(sim)
		},
	})
}
