package unholy

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/death_knight"
)

/*
Reduces the cost of Death Coil by 20%.

While in Unholy Presence, grants your main-hand autoattacks a chance to make your next Death Coil cost no Runic Power.
*/
func (uhdk *UnholyDeathKnight) registerSuddenDoom() {
	var suddenDoomAura *core.Aura
	suddenDoomAura = core.BlockPrepull(uhdk.RegisterAura(core.Aura{
		Label:    "Sudden Doom" + uhdk.Label,
		ActionID: core.ActionID{SpellID: 81340},
		Duration: time.Second * 10,
	})).AttachProcTrigger(core.ProcTrigger{
		Name:           "Sudden Doom Consume Trigger" + uhdk.Label,
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: death_knight.DeathKnightSpellDeathCoil | death_knight.DeathKnightSpellDeathCoilHeal,

		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return spell.CurCast.Cost <= 0
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			suddenDoomAura.Deactivate(sim)
		},
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		ClassMask:  death_knight.DeathKnightSpellDeathCoil | death_knight.DeathKnightSpellDeathCoilHeal,
		FloatValue: -2.0,
	})

	// Dummy spell to react with triggers
	sdProcSpell := uhdk.GetOrRegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 81340},
		Flags:          core.SpellFlagNoLogs | core.SpellFlagNoMetrics,
		ClassSpellMask: death_knight.DeathKnightSpellSuddenDoom,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)
		},

		RelatedSelfBuff: suddenDoomAura,
	})

	core.MakeProcTriggerAura(&uhdk.Unit, core.ProcTrigger{
		Name:     "Sudden Doom Trigger" + uhdk.Label,
		ActionID: core.ActionID{SpellID: 49530},
		Callback: core.CallbackOnSpellHitDealt,
		ProcMask: core.ProcMaskMeleeMHAuto,
		Outcome:  core.OutcomeLanded,
		DPM:      uhdk.NewStaticLegacyPPMManager(3.0, core.ProcMaskMeleeMHAuto),

		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return uhdk.UnholyPresenceSpell.RelatedSelfBuff.IsActive()
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			sdProcSpell.Cast(sim, &uhdk.Unit)
		},
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		ClassMask:  death_knight.DeathKnightSpellDeathCoil | death_knight.DeathKnightSpellDeathCoilHeal,
		FloatValue: -0.2,
	})
}
