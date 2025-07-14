package feral

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

func (cat *FeralDruid) applyOmenOfClarity() {
	var affectedSpells []*druid.DruidSpell
	cat.ClearcastingAura = core.BlockPrepull(cat.RegisterAura(core.Aura{
		Label:    "Clearcasting",
		ActionID: core.ActionID{SpellID: 135700},
		Duration: time.Second * 15,

		OnInit: func(_ *core.Aura, _ *core.Simulation) {
			affectedSpells = core.FilterSlice([]*druid.DruidSpell{
				cat.SwipeBear,
				cat.Rake,
				cat.Wrath,
				cat.HealingTouch,
				cat.Maul,
				cat.FerociousBite,
				cat.MangleCat,
				cat.SwipeCat,
				cat.ThrashCat,
				cat.Rip,
				cat.Shred,
				cat.Ravage,
			}, func(spell *druid.DruidSpell) bool { return spell != nil })
		},

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			for _, spell := range affectedSpells {
				spell.Cost.PercentModifier *= -1
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			for _, spell := range affectedSpells {
				spell.Cost.PercentModifier /= -1
			}
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			for _, as := range affectedSpells {
				if as.IsEqual(spell) {
					aura.Deactivate(sim)
					break
				}
			}
		},
	}))

	cat.RegisterAura(core.Aura{
		Label:    "Omen of Clarity",
		Duration: core.NeverExpires,

		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			aura.Activate(sim)
		},

		OnSpellHitDealt: func(_ *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if !result.Landed() {
				return
			}

			// https://x.com/Celestalon/status/482329896404799488
			if cat.AutoAttacks.PPMProc(sim, 3.5, core.ProcMaskMeleeWhiteHit, "Omen of Clarity", spell) {
				cat.ClearcastingAura.Activate(sim)
			}
		},
	})
}
