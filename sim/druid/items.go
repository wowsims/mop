package druid

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// Feral PvP
var ItemSetGladiatorSanctuary = core.NewItemSet(core.ItemSet{
	Name:                    "Gladiator's Sanctuary",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, _ *core.Aura) {
			// Not implemented
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Once every 30 sec, your next Ravage is free and has no positional or stealth requirement.
			druid := agent.(DruidAgent).GetDruid()

			if druid.Spec != proto.Spec_SpecFeralDruid && druid.Spec != proto.Spec_SpecGuardianDruid {
				return
			}

			druid.registerStampede()
			druid.registerStampedePending()
			setBonusAura.ApplyOnEncounterStart(func(_ *core.Aura, sim *core.Simulation) {
				druid.StampedeAura.Activate(sim)
			})
		},
	},
})

func (druid *Druid) registerStampede() {
	var oldExtraCastCondition core.CanCastCondition

	druid.StampedeAura = druid.RegisterAura(core.Aura{
		Label:    "Stampede",
		ActionID: core.ActionID{SpellID: 81022},
		Duration: core.NeverExpires,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			if druid.Ravage != nil {
				oldExtraCastCondition = druid.Ravage.ExtraCastCondition
				druid.Ravage.ExtraCastCondition = nil
				druid.Ravage.Cost.FlatModifier -= 45
			}
		},

		OnSpellHitDealt: func(_ *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(DruidSpellRavage) {
				druid.StampedeAura.Deactivate(sim)
				druid.StampedePendingAura.Activate(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			if druid.Ravage != nil {
				druid.Ravage.ExtraCastCondition = oldExtraCastCondition
				druid.Ravage.Cost.FlatModifier += 45
			}
		},
	})
}

func (druid *Druid) registerStampedePending() {
	druid.StampedePendingAura = druid.RegisterAura(core.Aura{
		Label:    "Stampede Pending",
		ActionID: core.ActionID{SpellID: 131538},
		Duration: time.Second * 30,

		OnExpire: func(_ *core.Aura, sim *core.Simulation) {
			druid.StampedeAura.Activate(sim)
		},
	})
}

func init() {
}
