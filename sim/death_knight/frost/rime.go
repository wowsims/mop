package frost

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/death_knight"
)

/*
Your Obliterate has a 45% chance to cause your next Howling Blast or Icy Touch to consume no runes.
(Proc chance: 45%)
*/
func (fdk *FrostDeathKnight) registerRime() {
	var freezingFogAura *core.Aura
	freezingFogAura = core.BlockPrepull(fdk.GetOrRegisterAura(core.Aura{
		Label:    "Freezing Fog" + fdk.Label,
		ActionID: core.ActionID{SpellID: 59052},
		Duration: time.Second * 15,
	})).AttachProcTrigger(core.ProcTrigger{
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: death_knight.DeathKnightSpellIcyTouch | death_knight.DeathKnightSpellHowlingBlast,

		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return spell.CurCast.Cost <= 0
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			freezingFogAura.Deactivate(sim)
		},
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		ClassMask:  death_knight.DeathKnightSpellIcyTouch | death_knight.DeathKnightSpellHowlingBlast,
		FloatValue: -2.0,
	})

	core.MakeProcTriggerAura(&fdk.Unit, core.ProcTrigger{
		Name:           "Rime" + fdk.Label,
		ActionID:       core.ActionID{SpellID: 59057},
		Callback:       core.CallbackOnSpellHitDealt,
		ProcMask:       core.ProcMaskMeleeMH,
		ClassSpellMask: death_knight.DeathKnightSpellObliterate,
		Outcome:        core.OutcomeLanded,
		ProcChance:     0.45,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			freezingFogAura.Activate(sim)
		},
	})
}
