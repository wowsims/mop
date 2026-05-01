package druid

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// T14 Guardian
var ItemSetArmorOfTheEternalBlossom = core.NewItemSet(core.ItemSet{
	Name:                    "Armor of the Eternal Blossom",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Reduces the cooldown of your Might of Ursoc ability by 60 sec.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_Cooldown_Flat,
				ClassMask: DruidSpellMightOfUrsoc,
				TimeValue: time.Second * -60,
			}).ExposeToAPL(123086)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			druid := agent.(DruidAgent).GetDruid()
			// Increases the dodge granted by your Savage Defense by an additional 5%.
			druid.OnSpellRegistered(func(spell *core.Spell) {
				if !spell.Matches(DruidSpellSavageDefense) {
					return
				}

				hasDodgeBonus := false
				spell.RelatedSelfBuff.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						druid.PseudoStats.BaseDodgeChance += 0.05
						hasDodgeBonus = true
					}
				}).ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					if hasDodgeBonus {
						druid.PseudoStats.BaseDodgeChance -= 0.05
						hasDodgeBonus = false
					}
				})
			})

			// Increases the healing received from your Frenzied Regeneration by 10%
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  DruidSpellFrenziedRegeneration,
				FloatValue: 0.1,
			})

			setBonusAura.ExposeToAPL(123087)
		},
	},
})

// T14 Feral
var ItemSetBattlegearOfTheEternalBlossom = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Eternal Blossom",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Your Shred and Mangle (Cat) abilities deal 5% additional damage.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  DruidSpellMangleCat | DruidSpellShred,
				FloatValue: 0.05,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Increases the duration of your Rip by 4 sec.
			druid := agent.(DruidAgent).GetDruid()

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

// T15 Feral
var ItemSetBattlegearOfTheHauntedForest = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Haunted Forest",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Gives your finishing moves a 15% chance per combo point to add a combo point to your target.
			druid := agent.(DruidAgent).GetDruid()
			actionID := core.ActionID{SpellID: 138352}
			cpMetrics := druid.NewComboPointMetrics(actionID)

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
				if spell.Matches(DruidSpellFinisher) {
					cpSnapshot = aura.Unit.ComboPoints()
				}
			}

			setBonusAura.OnSpellHitDealt = func(_ *core.Aura, _ *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				if spell.Matches(DruidSpellFinisher) && result.Landed() {
					resultLanded = true
				}
			}

			setBonusAura.OnCastComplete = func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
				if spell.Matches(DruidSpellFinisher) {
					proc2pT15(sim, aura.Unit, spell.Matches(DruidSpellSavageRoar))
				}
			}

		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// After using Tiger's Fury, you gain 40% increased critical strike chance on the next 3 uses of Mangle, Shred, Ferocious Bite, Ravage, and Swipe.
			druid := agent.(DruidAgent).GetDruid()

			if druid.Spec != proto.Spec_SpecFeralDruid {
				return
			}

			druid.registerTigersFury4PT15()

			setBonusAura.OnCastComplete = func(_ *core.Aura, sim *core.Simulation, spell *core.Spell) {
				if spell.Matches(DruidSpellTigersFury) {
					druid.TigersFury4PT15Aura.Activate(sim)
				}
			}
		},
	},
})

func (druid *Druid) registerTigersFury4PT15() {
	meleeAbilityMask := DruidSpellMangleCat | DruidSpellShred | DruidSpellRavage | DruidSpellSwipeCat | DruidSpellFerociousBite

	tfMod := druid.AddDynamicMod(core.SpellModConfig{
		ClassMask:  meleeAbilityMask,
		Kind:       core.SpellMod_BonusCrit_Percent,
		FloatValue: 40,
	})

	druid.TigersFury4PT15Aura = druid.RegisterAura(core.Aura{
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

func init() {
}
