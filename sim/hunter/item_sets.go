package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

var YaunGolSlayersBattlegear = core.NewItemSet(core.ItemSet{
	Name:                    "Yaungol Slayer Battlegear",
	ID:                      1129,
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  HunterSpellExplosiveShot,
				FloatValue: 0.05,
			})
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:              core.SpellMod_DamageDone_Pct,
				ClassMask:         HunterSpellKillCommand,
				ShouldApplyToPets: true,
				FloatValue:        0.15,
			})

			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  HunterSpellChimeraShot,
				FloatValue: 0.15,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Stub
		},
	},
})

var SaurokStalker = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Saurok Stalker",
	ID:                      1157,
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Summon Thunderhawk
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			//
		},
	},
})

var ItemSetGladiatorsPursuit = core.NewItemSet(core.ItemSet{
	ID:   1108,
	Name: "Gladiator's Pursuit",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
		},
		4: func(_ core.Agent, setBonusAura *core.Aura) {
			// Multiply focus regen 25%
			focusRegenMultiplier := 1.25
			setBonusAura.ApplyOnGain(func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.MultiplyFocusRegenSpeed(sim, focusRegenMultiplier)
			})
			setBonusAura.ApplyOnExpire(func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.MultiplyFocusRegenSpeed(sim, 1/focusRegenMultiplier)
			})
		},
	},
})

func (hunter *Hunter) addBloodthirstyGloves() {
	hunter.RegisterPvPGloveMod(
		[]int32{64991, 64709, 60424, 65544, 70534, 70260, 70441, 72369, 73717, 73583, 93495, 98821, 102737, 84841, 94453, 84409, 91577, 85020, 103220, 91224, 91225, 99848, 100320, 100683, 102934, 103417, 100123},
		core.SpellModConfig{
			ClassMask: HunterSpellExplosiveTrap | HunterSpellBlackArrow,
			Kind:      core.SpellMod_Cooldown_Flat,
			TimeValue: -time.Second * 2,
		})
}
