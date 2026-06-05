package guardian

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

func init() {
}

// T14 Guardian
var ItemSetArmorOfTheEternalBlossom = core.NewItemSet(core.ItemSet{
	Name:                    "Armor of the Eternal Blossom",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Reduces the cooldown of your Might of Ursoc ability by 60 sec.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_Cooldown_Flat,
				ClassMask: druid.DruidSpellMightOfUrsoc,
				TimeValue: time.Second * -60,
			}).ExposeToAPL(123086)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			bear, ok := agent.(*GuardianDruid)
			if !ok {
				return
			}

			// Increases the dodge granted by your Savage Defense by an additional 5%.
			bear.OnSpellRegistered(func(spell *core.Spell) {
				if !spell.Matches(druid.DruidSpellSavageDefense) {
					return
				}

				hasDodgeBonus := false
				spell.RelatedSelfBuff.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						bear.PseudoStats.BaseDodgeChance += 0.05
						hasDodgeBonus = true
					}
				}).ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					if hasDodgeBonus {
						bear.PseudoStats.BaseDodgeChance -= 0.05
						hasDodgeBonus = false
					}
				})
			})

			// Increases the healing received from your Frenzied Regeneration by 10%
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  druid.DruidSpellFrenziedRegeneration,
				FloatValue: 0.1,
			})

			setBonusAura.ExposeToAPL(123087)
		},
	},
})

// T15 Guardian
var ItemSetArmorOfTheHauntedForest = core.NewItemSet(core.ItemSet{
	ID:                      1156,
	DisabledInChallengeMode: true,
	Name:                    "Armor of the Haunted Forest",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Each attack you dodge while Savage Defense is active increases the healing from your next Frenzied Regeneration within 10 sec by 10%, stacking up to 10 times.
			bear, ok := agent.(*GuardianDruid)
			if !ok {
				return
			}

			bear.registerImprovedRegeneration(setBonusAura)
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback: core.CallbackOnSpellHitTaken,
				Outcome:  core.OutcomeDodge,

				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if bear.SavageDefenseAura.IsActive() {
						bear.ImprovedRegenerationAura.Activate(sim)
						bear.ImprovedRegenerationAura.AddStack(sim)
					}
				},
			}).ExposeToAPL(138216)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// You generate 50% more Rage from your attacks while Enrage is active.
			bear, ok := agent.(*GuardianDruid)
			if !ok {
				return
			}

			bear.Env.RegisterPreFinalizeEffect(func() {
				bear.EnrageAura.ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
					if setBonusAura.IsActive() {
						bear.MultiplyRageGen(1.5)
					}
				})

				bear.EnrageAura.ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
					if setBonusAura.IsActive() {
						bear.MultiplyRageGen(1.0 / 1.5)
					}
				})
			})
		},
	},
})

func (bear *GuardianDruid) registerImprovedRegeneration(_ *core.Aura) {
	improveRegenMod := bear.AddDynamicMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellFrenziedRegeneration,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.1,
	})

	bear.ImprovedRegenerationAura = bear.RegisterAura(core.Aura{
		Label:     "Improved Regeneration 2PT15",
		ActionID:  core.ActionID{SpellID: 138217},
		Duration:  time.Second * 10,
		MaxStacks: 10,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			improveRegenMod.Activate()
		},

		OnStacksChange: func(_ *core.Aura, _ *core.Simulation, _, newStacks int32) {
			improveRegenMod.UpdateFloatValue(0.1 * float64(newStacks))
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(druid.DruidSpellFrenziedRegeneration) {
				aura.Deactivate(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			improveRegenMod.Deactivate()
		},
	})
}

// T16 Guardian
var ItemSetArmorOfTheShatteredVale = core.NewItemSet(core.ItemSet{
	ID:                      1196,
	DisabledInChallengeMode: true,
	Name:                    "Armor of the Shattered Vale",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// When Barkskin fades, Savage Defense is automatically activated,
			// and a 20 Rage Frenzied Regeneration is automatically cast.
			bear, ok := agent.(*GuardianDruid)
			if !ok {
				return
			}

			bear.registerT162PFreeFrenziedRegen(setBonusAura)

			bear.Env.RegisterPreFinalizeEffect(func() {
				bear.BarkskinAura.ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
					if !setBonusAura.IsActive() {
						return
					}
					// Savage Defense: activate for 3s, or extend by 3s if already active.
					const triggeredDuration = 3 * time.Second
					if bear.SavageDefenseAura.IsActive() {
						bear.SavageDefenseAura.UpdateExpires(bear.SavageDefenseAura.ExpiresAt() + triggeredDuration)
					} else {
						bear.SavageDefenseAura.Activate(sim)
						bear.SavageDefenseAura.UpdateExpires(sim.CurrentTime + triggeredDuration)
					}
					bear.T16FreeFrenziedRegen.Cast(sim, &bear.Unit)
				})
			})

			setBonusAura.ExposeToAPL(144879)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Activating Frenzied Regeneration and Savage Defense will cause a
			// heal over time on yourself based on 30% of your Attack Power over
			// 8 sec.
			bear, ok := agent.(*GuardianDruid)
			if !ok {
				return
			}

			bear.registerT164PHot(setBonusAura)
			setBonusAura.ExposeToAPL(144887)
		},
	},
})

// 2PT16 : Free Frenzied Regeneration cast by the T16 2P bonus when Barkskin fades. 
// Always uses the unglyphed heal formula with a fixed 20-rage cost, regardless of glyph.
func (bear *GuardianDruid) registerT162PFreeFrenziedRegen(_ *core.Aura) {
	const triggeredRageCost = 20.0
	const maxRageCost = 60.0
	const rageFraction = triggeredRageCost / maxRageCost

	bear.T16FreeFrenziedRegen = bear.RegisterSpell(druid.Bear, core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 22842}.WithTag(1),
		SpellSchool:      core.SpellSchoolPhysical,
		ProcMask:         core.ProcMaskSpellHealing,
		Flags:            core.SpellFlagNoOnCastComplete,
		DamageMultiplier: 1,
		CritMultiplier:   bear.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		ClassSpellMask:   druid.DruidSpellFrenziedRegeneration,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			healthGained := max(
				(bear.GetStat(stats.AttackPower)-2*bear.GetStat(stats.Agility))*2.2,
				bear.GetStat(stats.Stamina)*2.5,
			) * rageFraction
			spell.CalcAndDealHealing(sim, spell.Unit, healthGained, spell.OutcomeHealing)
			if bear.OnFrenziedRegenCast != nil {
				bear.OnFrenziedRegenCast(rageFraction)
			}
		},
	})
}

// 4PT16 : 30% AP healing over 8s, triggered by Frenzied Regeneration or
// Savage Defense. FR scales by rage spent / max rage cost unless glyphed;
// Savage Defense fires at full strength.
func (bear *GuardianDruid) registerT164PHot(setBonusAura *core.Aura) {
	const apCoeff = 0.30
	const numTicks = 8

	// Set by the proc handler before each Cast(); read by OnSnapshot.
	nextHealMultiplier := 1.0
	// Most recent FR cast's rage / 60 ratio, used to scale the HoT for FR triggers.
	lastFRRageFraction := 1.0

	bear.OnFrenziedRegenCast = func(rageFraction float64) {
		lastFRRageFraction = rageFraction
	}

	hotSpell := bear.RegisterSpell(druid.Any, core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 144888},
		SpellSchool:      core.SpellSchoolNature,
		ProcMask:         core.ProcMaskSpellHealing,
		Flags:            core.SpellFlagHelpful | core.SpellFlagNoOnCastComplete,
		DamageMultiplier: 1,
		CritMultiplier:   bear.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Hot: core.DotConfig{
			Aura: core.Aura{
				Label:    "Ursoc's Vigor",
				ActionID: core.ActionID{SpellID: 144888},
			},

			NumberOfTicks: numTicks,
			TickLength:    time.Second,

			OnSnapshot: func(_ *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				totalHeal := apCoeff * bear.GetStat(stats.AttackPower) * nextHealMultiplier
				dot.SnapshotHeal(target, totalHeal/float64(numTicks))
			},

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Hot(target).Apply(sim)
		},
	})

	setBonusAura.AttachProcTrigger(core.ProcTrigger{
		Name:           "4PT16 HoT Trigger",
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: druid.DruidSpellFrenziedRegeneration | druid.DruidSpellSavageDefense,
		Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
			if spell.Matches(druid.DruidSpellFrenziedRegeneration) {
				nextHealMultiplier = lastFRRageFraction
			} else {
				nextHealMultiplier = 1.0
			}
			hotSpell.Cast(sim, &bear.Unit)
		},
	})
}
