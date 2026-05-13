package feral

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

// T14 Feral
var ItemSetBattlegearOfTheEternalBlossom = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Eternal Blossom",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Your Shred and Mangle (Cat) abilities deal 5% additional damage.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  druid.DruidSpellMangleCat | druid.DruidSpellShred,
				FloatValue: 0.05,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Increases the duration of your Rip by 4 sec.
			druid := agent.(druid.DruidAgent).GetDruid()

			setBonusAura.ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
				druid.RipBaseNumTicks += 2
				druid.RipMaxNumTicks += 2
			})

			setBonusAura.ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
				druid.RipBaseNumTicks -= 2
				druid.RipMaxNumTicks -= 2
			})
		},
	},
})

// T15 Feral
var ItemSetBattlegearOfTheHauntedForest = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Haunted Forest",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Gives your finishing moves a 15% chance per combo point to add a combo point to your target.
			anyDruid := agent.(druid.DruidAgent).GetDruid()
			actionID := core.ActionID{SpellID: 138352}
			cpMetrics := anyDruid.NewComboPointMetrics(actionID)

			var cpSnapshot int32
			var resultLanded bool

			proc2pT15 := func(sim *core.Simulation, unit *core.Unit, isRoar bool) {
				procChance := 0.15 * float64(cpSnapshot)

				if sim.Proc(procChance, "2pT15") && (resultLanded || isRoar) {
					unit.AddComboPoints(sim, 1, unit.CurrentComboTarget, cpMetrics)
				}

				cpSnapshot = 0
				resultLanded = false
			}

			setBonusAura.OnApplyEffects = func(aura *core.Aura, _ *core.Simulation, _ *core.Unit, spell *core.Spell) {
				if spell.Matches(druid.DruidSpellFinisher) {
					cpSnapshot = aura.Unit.ComboPoints()
				}
			}

			setBonusAura.OnSpellHitDealt = func(_ *core.Aura, _ *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				if spell.Matches(druid.DruidSpellFinisher) && result.Landed() {
					resultLanded = true
				}
			}

			setBonusAura.OnCastComplete = func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
				if spell.Matches(druid.DruidSpellFinisher) {
					proc2pT15(sim, aura.Unit, spell.Matches(druid.DruidSpellSavageRoar))
				}
			}

		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// After using Tiger's Fury, you gain 40% increased critical strike chance on the next 3 uses of Mangle, Shred, Ferocious Bite, Ravage, and Swipe.
			cat, ok := agent.(*FeralDruid)
			if !ok {
				return
			}

			cat.registerTigersFury4PT15()

			setBonusAura.OnCastComplete = func(_ *core.Aura, sim *core.Simulation, spell *core.Spell) {
				if spell.Matches(druid.DruidSpellTigersFury) {
					cat.TigersFury4PT15Aura.Activate(sim)
				}
			}
		},
	},
})

func (cat *FeralDruid) registerTigersFury4PT15() {
	meleeAbilityMask := druid.DruidSpellMangleCat | druid.DruidSpellShred | druid.DruidSpellRavage | druid.DruidSpellSwipeCat | druid.DruidSpellFerociousBite

	tfMod := cat.AddDynamicMod(core.SpellModConfig{
		ClassMask:  meleeAbilityMask,
		Kind:       core.SpellMod_BonusCrit_Percent,
		FloatValue: 40,
	})

	cat.TigersFury4PT15Aura = cat.RegisterAura(core.Aura{
		Label:     "Tiger's Fury 4PT15",
		ActionID:  core.ActionID{SpellID: 138358},
		Duration:  time.Second * 30,
		MaxStacks: 3,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.SetStacks(sim, 3)
			tfMod.Activate()
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(meleeAbilityMask) {
				aura.RemoveStack(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			tfMod.Deactivate()
		},
	})
}

// T16 Feral
var ItemSetBattlegearOfTheShatteredVale = core.NewItemSet(core.ItemSet{
	ID:                      1197,
	DisabledInChallengeMode: true,
	Name:                    "Battlegear of the Shattered Vale",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Omen of Clarity increases damage of Shred, Mangle, Swipe, and Ravage by 50% for 6 sec.
			cat, ok := agent.(*FeralDruid)
			if !ok {
				return
			}

			cat.registerFeralFury(setBonusAura)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// After using Tiger's Fury, your next finishing move will restore 3 combo points on your current target after being used.
			cat, ok := agent.(*FeralDruid)
			if !ok {
				return
			}

			cat.registerFeralRage()

			setBonusAura.OnCastComplete = func(_ *core.Aura, sim *core.Simulation, spell *core.Spell) {
				if spell.Matches(druid.DruidSpellTigersFury) {
					cat.FeralRageAura.Activate(sim)
				}
			}
		},
	},
})

func (cat *FeralDruid) registerFeralFury(setBonusTracker *core.Aura) {
	cat.FeralFuryBonus = setBonusTracker
	meleeAbilityMask := druid.DruidSpellMangleCat | druid.DruidSpellShred | druid.DruidSpellRavage | druid.DruidSpellSwipeCat

	feralFuryMod := cat.AddDynamicMod(core.SpellModConfig{
		ClassMask:  meleeAbilityMask,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.5,
	})

	cat.FeralFuryAura = cat.RegisterAura(core.Aura{
		Label:    "Feral Fury 2PT16",
		ActionID: core.ActionID{SpellID: 144865},
		Duration: time.Second * 6,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			feralFuryMod.Activate()
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(meleeAbilityMask) {
				aura.Deactivate(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			feralFuryMod.Deactivate()
		},
	})
}

func (cat *FeralDruid) registerFeralRage() {
	actionID := core.ActionID{SpellID: 146874}
	cpMetrics := cat.NewComboPointMetrics(actionID)

	var resultLanded bool

	cat.FeralRageAura = cat.RegisterAura(core.Aura{
		Label:    "Feral Rage 4PT16",
		ActionID: actionID,
		Duration: time.Second * 12,

		OnSpellHitDealt: func(_ *core.Aura, _ *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(druid.DruidSpellFinisher) && result.Landed() {
				resultLanded = true
			}
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if !spell.Matches(druid.DruidSpellFinisher) {
				return
			}

			if spell.Matches(druid.DruidSpellSavageRoar) || resultLanded {
				aura.Unit.AddComboPoints(sim, 3, aura.Unit.CurrentComboTarget, cpMetrics)
				resultLanded = false
				aura.Deactivate(sim)
			}
		},
	})
}

func init() {
}
