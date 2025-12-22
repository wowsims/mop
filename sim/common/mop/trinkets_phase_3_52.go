package mop

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const UnerringVisionBuffId = 138963

func init() {
	// Renataki's Soul Charm
	// Your attacks  have a chance to grant Blades of Renataki, granting 1592 Agility every 1 sec for 10 sec.  (Approximately 1.21 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95625,
		shared.ItemVersionNormal:              94512,
		shared.ItemVersionHeroic:              96369,
		shared.ItemVersionThunderforged:       95997,
		shared.ItemVersionHeroicThunderforged: 96741,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Renataki's Soul Charm"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			statValue := core.GetItemEffectScaling(itemID, 0.44999998808, state)

			statBuffAura, aura := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				AuraLabel:            fmt.Sprintf("Blades of Renataki (%s)", versionLabel),
				ActionID:             core.ActionID{SpellID: 138756},
				Duration:             time.Second * 10,
				MaxStacks:            10,
				TimePerStack:         time.Second * 1,
				BonusPerStack:        stats.Stats{stats.Agility: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138737},
				StackingAuraLabel:    fmt.Sprintf("Item - Proc Stacking Agility (%s)", versionLabel),
				TickImmediately:      true,
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				ICD:  time.Second * 10,
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 1.21000003815,
				}),
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnSpellHitDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, statBuffAura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Horridon's Last Gasp
	// Your healing spells have a chance to grant 1375 mana per 2 sec over 10 sec.  (Approximately [0.96 + Haste] procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95641,
		shared.ItemVersionNormal:              94514,
		shared.ItemVersionHeroic:              96385,
		shared.ItemVersionThunderforged:       96013,
		shared.ItemVersionHeroicThunderforged: 96757,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Horridon's Last Gasp"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			manaValue := core.GetItemEffectScaling(itemID, 0.55900001526, state)
			manaMetrics := character.NewManaMetrics(core.ActionID{SpellID: 138856})

			stackingAura := character.RegisterAura(core.Aura{
				ActionID:  core.ActionID{SpellID: 138849},
				Label:     fmt.Sprintf("Cloudburst (%s)", versionLabel),
				Duration:  time.Second * 10,
				MaxStacks: 5,
			})

			var pa *core.PendingAction

			aura := character.RegisterAura(core.Aura{
				Label:    fmt.Sprintf("%s (%s)", label, versionLabel),
				ActionID: core.ActionID{SpellID: 138856},
				Duration: time.Second * 10,
				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					pa = core.StartPeriodicAction(sim, core.PeriodicActionOptions{
						Period:   time.Second * 2,
						NumTicks: 5,
						OnAction: func(sim *core.Simulation) {
							if character.HasManaBar() {
								character.AddMana(sim, manaValue*float64(stackingAura.GetStacks()), manaMetrics)
							}
						},
					})
				},
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					pa.Cancel(sim)
				},
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s) - Trigger", label, versionLabel),
				ICD:  time.Second * 3,
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskSpellHealing, core.RPPMConfig{
					PPM: 0.95999997854,
				}.WithHasteMod()),
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					stackingAura.Activate(sim)
					stackingAura.AddStack(sim)
					//deactivate first to cancel the active periodic pa
					aura.Deactivate(sim)
					aura.Activate(sim)
				},
			})

			character.ItemSwap.RegisterProc(itemID, triggerAura)
		})
	})

	// Wushoolay's Final Choice
	// Your harmful spells have a chance to grant Wushoolay's Lightning, granting 1592 Intellect every 1 sec for 10 sec.  (Approximately 1.21 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95669,
		shared.ItemVersionNormal:              94513,
		shared.ItemVersionHeroic:              96413,
		shared.ItemVersionThunderforged:       96041,
		shared.ItemVersionHeroicThunderforged: 96785,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Wushoolay's Final Choice"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			statValue := core.GetItemEffectScaling(itemID, 0.44999998808, state)

			statBuffAura, aura := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				AuraLabel:            fmt.Sprintf("Wushoolay's Lightning (%s)", versionLabel),
				ActionID:             core.ActionID{SpellID: 138790},
				Duration:             time.Second * 10,
				MaxStacks:            10,
				TimePerStack:         time.Second * 1,
				BonusPerStack:        stats.Stats{stats.Intellect: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138786},
				StackingAuraLabel:    fmt.Sprintf("Item - Proc Stacking Intellect (%s)", versionLabel),
				TickImmediately:      true,
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				ICD:  time.Second * 10,
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskSpellOrSpellProc, core.RPPMConfig{
					PPM: 1.21000003815,
				}),
				Outcome:            core.OutcomeLanded,
				Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
				RequireDamageDealt: true,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, statBuffAura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Fabled Feather of Ji-Kun
	// Your attacks have a chance to grant Feathers of Fury, granting 1505 Strength every 1 sec for 10 sec.  (Approximately 1.21 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95726,
		shared.ItemVersionNormal:              94515,
		shared.ItemVersionHeroic:              96470,
		shared.ItemVersionThunderforged:       96098,
		shared.ItemVersionHeroicThunderforged: 96842,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Fabled Feather of Ji-Kun"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			statValue := core.GetItemEffectScaling(itemID, 0.44999998808, state)

			statBuffAura, aura := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				AuraLabel:            fmt.Sprintf("Feathers of Fury (%s)", versionLabel),
				ActionID:             core.ActionID{SpellID: 138758},
				Duration:             time.Second * 10,
				MaxStacks:            10,
				TimePerStack:         time.Second * 1,
				BonusPerStack:        stats.Stats{stats.Strength: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138759},
				StackingAuraLabel:    fmt.Sprintf("Item - Proc Stacking Strength (%s)", versionLabel),
				TickImmediately:      true,
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				ICD:  time.Second * 10,
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 1.21000003815,
				}),
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnSpellHitDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, statBuffAura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Delicate Vial of the Sanguinaire
	// When you dodge, you have a 4% chance to gain 963 mastery for 20s. This effect can stack up to 3 times.
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95779,
		shared.ItemVersionNormal:              94518,
		shared.ItemVersionHeroic:              96523,
		shared.ItemVersionThunderforged:       96151,
		shared.ItemVersionHeroicThunderforged: 96895,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Delicate Vial of the Sanguinaire"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			statValue := core.GetItemEffectScaling(itemID, 2.97000002861, state)

			aura, _ := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				Duration:             time.Second * 20,
				MaxStacks:            3,
				BonusPerStack:        stats.Stats{stats.MasteryRating: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138864},
				StackingAuraLabel:    fmt.Sprintf("Blood of Power (%s)", versionLabel),
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name:       fmt.Sprintf("%s (%s)", label, versionLabel),
				ProcChance: 0.04,
				Outcome:    core.OutcomeDodge,
				Callback:   core.CallbackOnSpellHitTaken,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
					aura.AddStack(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, aura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Primordius' Talisman of Rage
	// Your attacks have a chance to grant you 963 Strength for 10s. This effect can stack up to 5 times. (Approximately
	// 3.50 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95757,
		shared.ItemVersionNormal:              94519,
		shared.ItemVersionHeroic:              96501,
		shared.ItemVersionThunderforged:       96129,
		shared.ItemVersionHeroicThunderforged: 96873,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Primordius' Talisman of Rage"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			statValue := core.GetItemEffectScaling(itemID, 0.5189999938, state)

			aura, _ := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				Duration:             time.Second * 10,
				MaxStacks:            5,
				BonusPerStack:        stats.Stats{stats.Strength: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138870},
				StackingAuraLabel:    fmt.Sprintf("Rampage (%s)", versionLabel),
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 3.5,
				}),
				ICD:      time.Second * 5,
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnSpellHitDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
					aura.AddStack(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, aura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Inscribed Bag of Hydra-Spawn
	// Your heals have a chance to grant the target a shield absorbing 33446 damage, lasting 15 sec. (Approximately [1.64 + Haste] procs per minute, 17 sec cooldown)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95712,
		shared.ItemVersionNormal:              94520,
		shared.ItemVersionHeroic:              96456,
		shared.ItemVersionThunderforged:       96084,
		shared.ItemVersionHeroicThunderforged: 96828,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Inscribed Bag of Hydra-Spawn"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			shieldValue := core.GetItemEffectScaling(itemID, 9.45600032806, state)

			// TODO: For now self-shield as there is no healing Sim
			shield := character.NewDamageAbsorptionAura(core.AbsorptionAuraConfig{
				Aura: core.Aura{
					Label:    fmt.Sprintf("Shield of Hydra Sputum (%s)", versionLabel),
					ActionID: core.ActionID{SpellID: 140380},
					Duration: time.Second * 15,
				},
				ShieldStrengthCalculator: func(_ *core.Unit) float64 {
					return shieldValue
				},
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				ICD:  time.Second * 17,
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskSpellHealing, core.RPPMConfig{
					PPM: 1.63999998569,
				}.WithHasteMod()),
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					shield.Activate(sim)
				},
			})

			character.ItemSwap.RegisterProc(itemID, triggerAura)
		})
	})

	// Ji-Kun's Rising Winds
	// Melee attacks which reduce you below 35% health cause you to instantly heal for 33493.  Cannot occur more than once every 30 sec. (30s cooldown)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95727,
		shared.ItemVersionNormal:              94527,
		shared.ItemVersionHeroic:              96471,
		shared.ItemVersionThunderforged:       96099,
		shared.ItemVersionHeroicThunderforged: 96843,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Ji-Kun's Rising Winds"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			healValue := core.GetItemEffectScaling(itemID, 13.61499977112, state)

			spell := character.RegisterSpell(core.SpellConfig{
				ActionID:    core.ActionID{SpellID: 138973},
				SpellSchool: core.SpellSchoolPhysical,
				ProcMask:    core.ProcMaskEmpty,
				Flags:       core.SpellFlagPassiveSpell,

				CritMultiplier:   character.DefaultCritMultiplier(),
				DamageMultiplier: 1,

				ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
					spell.CalcAndDealHealing(sim, target, healValue, spell.OutcomeMagicHit)
				},
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name:               fmt.Sprintf("%s (%s)", label, versionLabel),
				RequireDamageDealt: true,
				ICD:                time.Second * 30,
				Outcome:            core.OutcomeLanded,
				Callback:           core.CallbackOnSpellHitTaken,
				TriggerImmediately: true,

				ExtraCondition: func(sim *core.Simulation, _ *core.Spell, result *core.SpellResult) bool {
					return character.CurrentHealthPercent() < 0.35 && character.CurrentHealth() > 0
				},

				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					spell.Cast(sim, &character.Unit)
				},
			})

			character.ItemSwap.RegisterProc(itemID, triggerAura)
		})
	})

	// Talisman of Bloodlust
	// Your attacks have a chance to grant you 963 haste for 10s. This effect can stack up to 5 times. (Approximately
	// 3.50 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95748,
		shared.ItemVersionNormal:              94522,
		shared.ItemVersionHeroic:              96492,
		shared.ItemVersionThunderforged:       96120,
		shared.ItemVersionHeroicThunderforged: 96864,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Talisman of Bloodlust"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			statValue := core.GetItemEffectScaling(itemID, 0.5189999938, state)

			aura, _ := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				Duration:             time.Second * 10,
				MaxStacks:            5,
				BonusPerStack:        stats.Stats{stats.HasteRating: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 138895},
				StackingAuraLabel:    fmt.Sprintf("Frenzy (%s)", versionLabel),
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 3.5,
				}),
				ICD:      time.Second * 5,
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnSpellHitDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
					aura.AddStack(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, aura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Gaze of the Twins
	// Your critical attacks have a chance to grant you 963 Critical Strike for 20s. This effect can stack up
	// to 3 times. (Approximately 0.72 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95799,
		shared.ItemVersionNormal:              94529,
		shared.ItemVersionHeroic:              96543,
		shared.ItemVersionThunderforged:       96171,
		shared.ItemVersionHeroicThunderforged: 96915,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Gaze of the Twins"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			statValue := core.GetItemEffectScaling(itemID, 0.96799999475, state)

			aura, _ := character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
				Duration:             time.Second * 20,
				MaxStacks:            3,
				BonusPerStack:        stats.Stats{stats.CritRating: statValue},
				StackingAuraActionID: core.ActionID{SpellID: 139170},
				StackingAuraLabel:    fmt.Sprintf("Eye of Brutality (%s)", versionLabel),
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 0.72000002861,
				}.WithCritMod()),
				ICD:      time.Second * 10,
				Outcome:  core.OutcomeCrit,
				Callback: core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					aura.Activate(sim)
					aura.AddStack(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, aura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Unerring Vision of Lei Shen
	// Your damaging spells have a chance to grant 100% critical strike chance for 4 sec.  (Approximately 0.62 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95814,
		shared.ItemVersionNormal:              94524,
		shared.ItemVersionHeroic:              96558,
		shared.ItemVersionThunderforged:       96186,
		shared.ItemVersionHeroicThunderforged: 96930,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Unerring Vision of Lei Shen"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			// @TODO: Old posts say that only Intellect users can proc this effect
			switch {
			case character.Class == proto.Class_ClassWarlock,
				character.Class == proto.Class_ClassMage,
				character.Class == proto.Class_ClassPriest,
				character.Spec == proto.Spec_SpecBalanceDruid,
				character.Spec == proto.Spec_SpecElementalShaman,
				character.Spec == proto.Spec_SpecMistweaverMonk,
				character.Spec == proto.Spec_SpecHolyPaladin:
				// These are valid
			default:
				return
			}

			statBuffAura := character.NewTemporaryStatsAura(
				fmt.Sprintf("Perfect Aim (%s)", versionLabel),
				core.ActionID{SpellID: UnerringVisionBuffId},
				stats.Stats{stats.PhysicalCritPercent: 100, stats.SpellCritPercent: 100},
				time.Second*4,
			)
			// Manually override Crit % to Crit Rating
			statBuffAura.BuffedStatTypes = []stats.Stat{stats.CritRating}

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskSpellOrSpellProc, core.RPPMConfig{
					PPM: 0.57999998331,
				}.WithApproximateIlvlMod(1.0, 528).
					WithClassMod(-0.40000000596, int(1<<proto.Class_ClassWarlock)).
					WithSpecMod(-0.34999999404, proto.Spec_SpecBalanceDruid),
				),
				ICD:                time.Second * 3,
				Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
				RequireDamageDealt: true,
				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					statBuffAura.Activate(sim)
					character.ReactToEvent(sim, false)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			character.AddStatProcBuff(itemID, statBuffAura, false, eligibleSlots)
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Rune of Re-Origination
	// When your attacks hit you have a chance to trigger Re-Origination.
	// Re-Origination converts the lower two values of your Critical Strike, Haste, and Mastery
	// into twice as much of the highest of those three attributes for 10 sec.
	// (Approximately 1.17 procs per minute, 10 sec cooldown)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95802,
		shared.ItemVersionNormal:              94532,
		shared.ItemVersionHeroic:              96546,
		shared.ItemVersionThunderforged:       96174,
		shared.ItemVersionHeroicThunderforged: 96918,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Rune of Re-Origination"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			// 2025/11/21 - Confirmed
			// The RRPM is not modified at all however it is implemented as the following:
			// Non-melee/non-hunters have a 90% chance to proc and consume the buff and trigger the 10s ICD
			// and resetting the proc chancewithout ever activating the buff
			isCaster := character.Class == proto.Class_ClassMage ||
				character.Class == proto.Class_ClassWarlock ||
				character.Class == proto.Class_ClassPriest ||
				character.Spec == proto.Spec_SpecBalanceDruid ||
				character.Spec == proto.Spec_SpecRestorationDruid ||
				character.Spec == proto.Spec_SpecElementalShaman ||
				character.Spec == proto.Spec_SpecRestorationShaman ||
				character.Spec == proto.Spec_SpecHolyPaladin ||
				character.Spec == proto.Spec_SpecMistweaverMonk

			duration := time.Second * 10
			masteryRaidBuffs := character.GetExclusiveEffectCategory("MasteryRatingBuff")
			var buffStats stats.Stats
			buffedStatTypes := []stats.Stat{stats.CritRating, stats.HasteRating, stats.MasteryRating}

			createStatBuffAura := func(label string, spellID int32) *core.StatBuffAura {
				return &core.StatBuffAura{
					Aura: character.GetOrRegisterAura(core.Aura{
						Label:    fmt.Sprintf("Re-Origination (%s) %s", versionLabel, label),
						ActionID: core.ActionID{SpellID: spellID},
						Duration: duration,
						OnGain: func(aura *core.Aura, sim *core.Simulation) {
							character.AddStatsDynamic(sim, buffStats)

							for i := range character.OnTemporaryStatsChanges {
								character.OnTemporaryStatsChanges[i](sim, aura, buffStats)
							}
						},
						OnExpire: func(aura *core.Aura, sim *core.Simulation) {
							invertedBuffStats := buffStats.Invert()
							character.AddStatsDynamic(sim, invertedBuffStats)

							for i := range character.OnTemporaryStatsChanges {
								character.OnTemporaryStatsChanges[i](sim, aura, invertedBuffStats)
							}
						},
					}),
					BuffedStatTypes: buffedStatTypes,
				}
			}

			buffAuras := make(map[stats.Stat]*core.StatBuffAura, 3)
			buffAuras[stats.CritRating] = createStatBuffAura("Crit", 139117)
			buffAuras[stats.HasteRating] = createStatBuffAura("Haste", 139121)
			buffAuras[stats.MasteryRating] = createStatBuffAura("Mastery", 139120)

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name: fmt.Sprintf("%s (%s)", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 1.10000002384,
				}.WithApproximateIlvlMod(1.0, 528)),
				ICD:      duration,
				Callback: core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if isCaster && sim.RandomFloat("Rune of Re-Origination - Caster") <= 0.9 {
						return
					}
					for _, buffAura := range buffAuras {
						buffAura.Deactivate(sim)
					}

					hasMasteryRaidBuff := masteryRaidBuffs.GetActiveAura().IsActive()
					currentStats := character.GetStats()
					currentStatsWithoutDeps := character.GetStatsWithoutDeps()

					if hasMasteryRaidBuff {
						currentStats[stats.MasteryRating] -= core.MasteryRaidBuffStrength
						currentStatsWithoutDeps[stats.MasteryRating] -= core.MasteryRaidBuffStrength
					}

					highestStat := currentStats.GetHighestStatType(buffedStatTypes)

					var buffStrength float64

					for _, statType := range buffedStatTypes {
						if statType != highestStat {
							buffStrength += currentStatsWithoutDeps[statType] * 2
							buffStats[statType] = -currentStatsWithoutDeps[statType]
						}
					}

					buffStats[highestStat] = buffStrength
					buffAuras[highestStat].Activate(sim)
				},
			})

			eligibleSlots := character.ItemSwap.EligibleSlotsForItem(itemID)
			for _, buffAura := range buffAuras {
				character.AddStatProcBuff(itemID, buffAura, false, eligibleSlots)
			}
			character.ItemSwap.RegisterProcWithSlots(itemID, triggerAura, eligibleSlots)
		})
	})

	// Soul Barrier
	// Use: Absorbs up to 13377 damage every time you take physical damage, up to a maximum of 66885 damage absorbed. (2 Min Cooldown)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95811,
		shared.ItemVersionNormal:              94528,
		shared.ItemVersionHeroic:              96555,
		shared.ItemVersionThunderforged:       96183,
		shared.ItemVersionHeroicThunderforged: 96927,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Soul Barrier"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()
			actionId := core.ActionID{SpellID: 138979, ItemID: itemID}
			absorbPerHitValue := core.GetItemEffectScaling(itemID, 3.78200006485, state)

			damageAbsorptionAura := character.NewDamageAbsorptionAura(core.AbsorptionAuraConfig{
				Aura: core.Aura{
					Label:    fmt.Sprintf("%s (%s)", label, versionLabel),
					ActionID: actionId,
					Duration: time.Second * 20,
				},
				MaxAbsorbPerHit: absorbPerHitValue,
				ShouldApplyToResult: func(_ *core.Simulation, spell *core.Spell, _ *core.SpellResult, _ bool) bool {
					return spell.SpellSchool.Matches(core.SpellSchoolPhysical)
				},
				ShieldStrengthCalculator: func(_ *core.Unit) float64 {
					return absorbPerHitValue * 5
				},
			})

			spell := character.RegisterSpell(core.SpellConfig{
				ActionID:    actionId,
				SpellSchool: core.SpellSchoolPhysical,
				ProcMask:    core.ProcMaskEmpty,

				Cast: core.CastConfig{
					CD: core.Cooldown{
						Timer:    character.NewTimer(),
						Duration: time.Minute * 3,
					},
				},

				CritMultiplier:   character.DefaultCritMultiplier(),
				DamageMultiplier: 1,

				ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
					damageAbsorptionAura.Activate(sim)
				},
			})

			character.AddMajorCooldown(core.MajorCooldown{
				Spell: spell,
				Type:  core.CooldownTypeSurvival,
				BuffAura: &core.StatBuffAura{
					Aura:            damageAbsorptionAura.Aura,
					BuffedStatTypes: []stats.Stat{stats.Health},
				},
				ShouldActivate: func(_ *core.Simulation, character *core.Character) bool {
					return character.CurrentHealthPercent() < 0.4
				},
			})
		})
	})

	// Spark of Zandalar
	// Your attacks have a chance to grant you a Spark of Zandalar.
	// Once you have accumulated 10 Sparks, you will transform into a Zandalari Warrior and gain 700 Strength for 10 sec.
	// (Approximately 11.10 procs per minute)
	shared.ItemVersionMap{
		shared.ItemVersionLFR:                 95654,
		shared.ItemVersionNormal:              94526,
		shared.ItemVersionHeroic:              96398,
		shared.ItemVersionThunderforged:       96026,
		shared.ItemVersionHeroicThunderforged: 96770,
	}.RegisterAll(func(version shared.ItemVersion, itemID int32, versionLabel string) {
		label := "Spark of Zandalar"

		core.NewItemEffect(itemID, func(agent core.Agent, state proto.ItemLevelState) {
			character := agent.GetCharacter()

			strengthValue := core.GetItemEffectScaling(itemID, 2.47499990463, state)

			buffAura := character.NewTemporaryStatsAura(
				fmt.Sprintf("Zandalari Warrior (%s)", versionLabel),
				core.ActionID{SpellID: 138960},
				stats.Stats{stats.Strength: strengthValue},
				time.Second*10,
			)

			stackingAura := character.RegisterAura(core.Aura{
				ActionID:  core.ActionID{SpellID: 138958},
				Label:     fmt.Sprintf("%s (%s)", label, versionLabel),
				Duration:  time.Minute * 1,
				MaxStacks: 10,
				OnStacksChange: func(aura *core.Aura, sim *core.Simulation, _ int32, newStacks int32) {
					if newStacks == aura.MaxStacks {
						buffAura.Activate(sim)
						aura.Deactivate(sim)
					}
				},
			})

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				ActionID: core.ActionID{SpellID: 138957},
				Name:     fmt.Sprintf("%s %s - Trigger", label, versionLabel),
				DPM: character.NewRPPMProcManager(itemID, false, false, core.ProcMaskDirect|core.ProcMaskProc, core.RPPMConfig{
					PPM: 11.10000038147,
				}),
				Outcome:  core.OutcomeLanded,
				Callback: core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					stackingAura.Activate(sim)
					stackingAura.AddStack(sim)
				},
			}).ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
				buffAura.Deactivate(sim)
				stackingAura.Deactivate(sim)
			})

			character.ItemSwap.RegisterProc(itemID, triggerAura)
		})
	})

	// Soothing Talisman of the Shado-Pan Assault
	// Use: Gain 29805 mana. (3 Min Cooldown)
	core.NewItemEffect(94509, func(agent core.Agent, state proto.ItemLevelState) {
		character := agent.GetCharacter()
		actionId := core.ActionID{SpellID: 138724, ItemID: 94509}

		manaValue := core.GetItemEffectScaling(94509, 10.05900001526, state)
		manaMetrics := character.NewManaMetrics(actionId)

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID:    actionId,
			SpellSchool: core.SpellSchoolPhysical,
			ProcMask:    core.ProcMaskEmpty,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 3,
				},
			},

			CritMultiplier:   character.DefaultCritMultiplier(),
			DamageMultiplier: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				if character.HasManaBar() {
					character.AddMana(sim, manaValue, manaMetrics)
				}
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell:    spell,
			Priority: core.CooldownPriorityDefault,
			Type:     core.CooldownTypeMana,
			ShouldActivate: func(sim *core.Simulation, character *core.Character) bool {
				return character.MaxMana()-character.CurrentMana() >= manaValue
			},
		})
	})
}
