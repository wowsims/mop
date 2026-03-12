package monk

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// T14 - Windwalker
var ItemSetBattlegearOfTheRedCrane = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of the Red Crane",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_Cooldown_Flat,
				ClassMask: MonkSpellFistsOfFury,
				TimeValue: -5 * time.Second,
			}).ExposeToAPL(123149)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_BuffDuration_Flat,
				ClassMask: MonkSpellEnergizingBrew,
				TimeValue: 5 * time.Second,
			}).ExposeToAPL(123150)
		},
	},
})

// T14 - Brewmaster
var ItemSetArmorOfTheRedCrane = core.NewItemSet(core.ItemSet{
	Name:                    "Armor of the Red Crane",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			monk.OnSpellRegistered(func(spell *core.Spell) {
				if !spell.Matches(MonkSpellElusiveBrew) {
					return
				}

				hasDodgeBonus := false
				spell.RelatedSelfBuff.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						monk.PseudoStats.BaseDodgeChance += 0.05
						hasDodgeBonus = true
					}
				}).ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					if hasDodgeBonus {
						monk.PseudoStats.BaseDodgeChance -= 0.05
						hasDodgeBonus = false
					}
				})
			})

			setBonusAura.ExposeToAPL(123157)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Implemented in guard.go
			monk := agent.(MonkAgent).GetMonk()
			monk.T14Brewmaster4P = setBonusAura

			setBonusAura.ExposeToAPL(123159)
		},
	},
})

// T15 - Windwalker
var ItemSetFireCharmBattlegear = core.NewItemSet(core.ItemSet{
	Name:                    "Fire-Charm Battlegear",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			triggerActionId := core.ActionID{SpellID: 138177}
			spellActionId := core.ActionID{SpellID: 138310}
			auraActionId := core.ActionID{SpellID: 138311}
			energyMetrics := monk.NewEnergyMetrics(spellActionId)
			sphereDuration := time.Minute * 2
			energyGain := 10.0

			pendingSpheres := make([]*core.PendingAction, 0)
			monk.T15Windwalker2PSphereAura = monk.RegisterAura(core.Aura{
				Label:     "Energy Sphere" + monk.Label,
				ActionID:  auraActionId,
				Duration:  sphereDuration,
				MaxStacks: math.MaxInt32,
			})

			monk.T15Windwalker2PSphereSpell = monk.RegisterSpell(core.SpellConfig{
				ActionID:    spellActionId,
				SpellSchool: core.SpellSchoolNature,
				Flags:       core.SpellFlagPassiveSpell | core.SpellFlagNoOnCastComplete | core.SpellFlagAPL,
				ProcMask:    core.ProcMaskSpellHealing,

				DamageMultiplier: 1,
				CritMultiplier:   1,
				ThreatMultiplier: 1,

				Cast: core.CastConfig{
					DefaultCast: core.Cast{
						NonEmpty: true,
					},
				},

				ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
					return (monk.CurrentEnergy()+energyGain) < monk.MaximumEnergy() && monk.T15Windwalker2PSphereAura.IsActive() && monk.T15Windwalker2PSphereAura.GetStacks() > 0
				},

				ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
					monk.AddEnergy(sim, 10, energyMetrics)
					monk.T15Windwalker2PSphereAura.RemoveStack(sim)
					pendingSphere := pendingSpheres[0]
					if pendingSphere != nil {
						pendingSphere.Cancel(sim)
					}
				},
				RelatedSelfBuff: monk.T15Windwalker2PSphereAura,
			})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:       "Item - Monk T15 Windwalker 2P Bonus",
				ActionID:   triggerActionId,
				ProcChance: 0.15,
				ICD:        100 * time.Millisecond,
				SpellFlags: SpellFlagBuilder,
				Callback:   core.CallbackOnSpellHitDealt,
				Outcome:    core.OutcomeLanded,
				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					monk.T15Windwalker2PSphereAura.Activate(sim)
					monk.T15Windwalker2PSphereAura.AddStack(sim)

					pa := sim.GetConsumedPendingActionFromPool()
					pa.NextActionAt = sim.CurrentTime + sphereDuration
					pa.Priority = core.ActionPriorityDOT

					pa.OnAction = func(sim *core.Simulation) {
						monk.T15Windwalker2PSphereAura.RemoveStack(sim)
						pendingSpheres = pendingSpheres[:1]
					}
					pa.CleanUp = func(sim *core.Simulation) {
						pendingSpheres = pendingSpheres[:1]
					}

					sim.AddPendingAction(pa)
					pendingSpheres = append(pendingSpheres, pa)
				},
			}).ExposeToAPL(triggerActionId.SpellID)

			monk.RegisterResetEffect(func(s *core.Simulation) {
				pendingSpheres = make([]*core.PendingAction, 0)
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Implemented in windwalker/tigereye_brew.go
			monk := agent.(MonkAgent).GetMonk()
			monk.T15Windwalker4P = setBonusAura

			setBonusAura.ExposeToAPL(138315)
		},
	},
})

// T15 - Brewmaster
var ItemSetFireCharmArmor = core.NewItemSet(core.ItemSet{
	Name:                    "Fire-Charm Armor",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			monk.T15Brewmaster2P = monk.RegisterAura(core.Aura{
				Label:    "Item - Monk T15 Brewmaster 2P Bonus" + monk.Label,
				ActionID: core.ActionID{SpellID: 138233},
				Duration: 0,
			})

			monk.OnSpellRegistered(func(spell *core.Spell) {
				if !spell.Matches(MonkSpellElusiveBrew) {
					return
				}

				spell.RelatedSelfBuff.ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						monk.T15Brewmaster2P.Duration = time.Duration(monk.ElusiveBrewStacks) * time.Second
						monk.T15Brewmaster2P.Activate(sim)
					}
				})
			})

			setBonusAura.ExposeToAPL(138231)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			monk.T15Brewmaster4PProcEffect = monk.RegisterAura(core.Aura{
				Label:    "Purifier" + monk.Label,
				ActionID: core.ActionID{SpellID: 138237},
				Duration: 15 * time.Second,
			})

			monk.T15Brewmaster4P = setBonusAura

			setBonusAura.ExposeToAPL(138236)
		},
	},
})

// T16 - Windwalker
var ItemSetBattlegearOfSevenSacredSeals = core.NewItemSet(core.ItemSet{
	Name:                    "Battlegear of Seven Sacred Seals",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			if monk.Spec != proto.Spec_SpecWindwalkerMonk {
				return
			}

			registerComboBreakerDamageMod := func(aura *core.Aura, spellMask int64) {
				damageMod := monk.AddDynamicMod(core.SpellModConfig{
					Kind:       core.SpellMod_DamageDone_Pct,
					ClassMask:  spellMask,
					FloatValue: 0.4,
				})

				aura.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						damageMod.Activate()
					}
				}).ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					damageMod.Deactivate()
				})
			}

			setBonusAura.ApplyOnInit(func(aura *core.Aura, sim *core.Simulation) {
				registerComboBreakerDamageMod(monk.ComboBreakerTigerPalmAura, MonkSpellTigerPalm)
				registerComboBreakerDamageMod(monk.ComboBreakerBlackoutKickAura, MonkSpellBlackoutKick)
			})

			setBonusAura.ExposeToAPL(145004)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Implemented in windwalker/tigereye_brew.go
			// Implemented in windwalker/ww_fists_of_fury.go
			// Implemented in windwalker/ww_rising_sun_kick.go
			// Implemented in windwalker/blackout_kick.go
			monk := agent.(MonkAgent).GetMonk()
			monk.T16Windwalker4P = monk.RegisterAura(core.Aura{
				Label:    "Focus of Xuen" + monk.Label,
				ActionID: core.ActionID{SpellID: 145024},
				Duration: 10 * time.Second,
			})

			setBonusAura.ExposeToAPL(145022)
		},
	},
})

// T16 - Brewmaster
var ItemSetArmorOfSevenSacredSeals = core.NewItemSet(core.ItemSet{
	Name:                    "Armor of Seven Sacred Seals",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Not implemented as not having Black Ox statue
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			monk := agent.(MonkAgent).GetMonk()

			monk.T16Brewmaster4P = setBonusAura

			setBonusAura.ExposeToAPL(145056)
		},
	},
})

func init() {
}
