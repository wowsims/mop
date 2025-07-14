package druid

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (druid *Druid) registerBerserkCD() {
	catCostMod := druid.AddDynamicMod(core.SpellModConfig{
		ClassMask:  DruidSpellMangleCat | DruidSpellFerociousBite | DruidSpellRake | DruidSpellRavage | DruidSpellRip | DruidSpellSavageRoar | DruidSpellSwipeCat | DruidSpellShred | DruidSpellThrashCat,
		Kind:       core.SpellMod_PowerCost_Pct,
		FloatValue: -0.5,
	})

	druid.BerserkCatAura = druid.RegisterAura(core.Aura{
		Label:    "Berserk (Cat)",
		ActionID: core.ActionID{SpellID: 106951},
		Duration: time.Second * 15,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			catCostMod.Activate()
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			catCostMod.Deactivate()
		},
	})

	druid.BerserkBearAura = druid.RegisterAura(core.Aura{
		Label:    "Berserk (Bear)",
		ActionID: core.ActionID{SpellID: 50334},
		Duration: time.Second * 10,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			druid.MangleBear.CD.Reset()
		},
	})

	druid.Berserk = druid.RegisterSpell(Cat|Bear, core.SpellConfig{
		ActionID: core.ActionID{SpellID: 106952},
		Flags:    core.SpellFlagAPL | core.SpellFlagReadinessTrinket,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    druid.NewTimer(),
				Duration: time.Minute * 3,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			if druid.InForm(Cat) {
				druid.BerserkCatAura.Activate(sim)
			} else {
				druid.BerserkBearAura.Activate(sim)
			}
		},
	})

	druid.AddMajorCooldown(core.MajorCooldown{
		Spell: druid.Berserk.Spell,
		Type:  core.CooldownTypeDPS,
	})
}
