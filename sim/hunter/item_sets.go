package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

var YaungolSlayersBattlegear = core.NewItemSet(core.ItemSet{
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
			// Your Steady Shot and Cobra Shot have a chance to summon a Thunderhawk to fight for you for the next 10 sec.
			// (Approximately 1.00 procs per minute)
			hunter := agent.(HunterAgent).GetHunter()

			summonThunderhawkSpell := hunter.RegisterSpell(core.SpellConfig{
				ActionID:    core.ActionID{SpellID: 138363},
				SpellSchool: core.SpellSchoolPhysical,
				Flags:       core.SpellFlagPassiveSpell,

				ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
					for _, thunderhawk := range hunter.Thunderhawks {
						if thunderhawk.IsActive() {
							continue
						}

						thunderhawk.EnableWithTimeout(sim, thunderhawk, time.Second*10)

						return
					}

					if sim.Log != nil {
						hunter.Log(sim, "No Thunderhawks available for the T15 2pc to proc, this is unreasonable.")
					}
				},
			})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback:       core.CallbackOnSpellHitDealt,
				ClassSpellMask: HunterSpellCobraShot | HunterSpellSteadyShot,
				DPM: hunter.NewSetBonusRPPMProcManager(138365,
					setBonusAura,
					core.ProcMaskRangedSpecial,
					core.RPPMConfig{
						PPM: 1.0,
					}.WithHasteMod(),
				),
				ICD: time.Millisecond * 250,

				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					summonThunderhawkSpell.Cast(sim, result.Target)
				},
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Your Arcane Shot, Multi-Shot, and Aimed Shot have a chance to trigger a Lightning Arrow at the target, dealing 100% weapon damage as Nature.
			// (Approximately 3.00 procs per minute)
			hunter := agent.(HunterAgent).GetHunter()

			lightningArrowSpell := hunter.RegisterSpell(core.SpellConfig{
				ActionID:     core.ActionID{SpellID: 138366},
				SpellSchool:  core.SpellSchoolNature,
				ProcMask:     core.ProcMaskRangedProc,
				Flags:        core.SpellFlagMeleeMetrics | core.SpellFlagRanged | core.SpellFlagPassiveSpell,
				MissileSpeed: 45,

				DamageMultiplier: 1.0,
				CritMultiplier:   hunter.DefaultCritMultiplier(),
				ThreatMultiplier: 1.0,

				ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
					wepDmg := hunter.AutoAttacks.Ranged().CalculateNormalizedWeaponDamage(sim, spell.RangedAttackPower())
					result := spell.CalcDamage(sim, target, wepDmg, spell.OutcomeRangedHitAndCrit)
					spell.WaitTravelTime(sim, func(sim *core.Simulation) {
						spell.DealDamage(sim, result)
					})
				},
			})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback:       core.CallbackOnSpellHitDealt,
				ClassSpellMask: HunterSpellArcaneShot | HunterSpellMultiShot | HunterSpellAimedShot,
				DPM: hunter.NewSetBonusRPPMProcManager(138367,
					setBonusAura,
					core.ProcMaskRangedSpecial,
					core.RPPMConfig{
						PPM: 3.0,
					}.WithHasteMod(),
				),
				ICD: time.Millisecond * 250,

				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					lightningArrowSpell.Cast(sim, result.Target)
				},
			})
		},
	},
})

var BattlegearOfTheUnblinkingVigil = core.NewItemSet(core.ItemSet{
	ID:                      1195,
	Name:                    "Battlegear of the Unblinking Vigil",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Aimed Shot, Arcane Shot and Multi-shot reduce the cooldown of Rapid Fire by [Bestial Wrath: 4] [Aimed Shot: 4 / 8] seconds per cast.
			hunter := agent.(HunterAgent).GetHunter()

			var cdReduction time.Duration
			switch hunter.Spec {
			case proto.Spec_SpecBeastMasteryHunter, proto.Spec_SpecMarksmanshipHunter:
				cdReduction = time.Second * 4
			case proto.Spec_SpecSurvivalHunter:
				cdReduction = time.Second * 8
			}

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback:       core.CallbackOnSpellHitDealt,
				ClassSpellMask: HunterSpellAimedShot | HunterSpellArcaneShot | HunterSpellMultiShot,

				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					if !hunter.RapidFire.CD.IsReady(sim) {
						hunter.RapidFire.CD.Reduce(cdReduction)
					}
				},
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Explosive Shot casts have a 40% chance to not consume a charge of Lock and Load.
			// Instant Aimed shots reduce the cast time of your next Aimed Shot by 50%.
			// Offensive abilities used during Bestial Wrath increase all damage you deal by 4% and all damage dealt by your pet by 2%, stacking up to 5 times.
			hunter := agent.(HunterAgent).GetHunter()

			if hunter.Spec == proto.Spec_SpecSurvivalHunter {
				// Survival bonus is handled in survival/specializations.go
				return
			}

			if hunter.Spec == proto.Spec_SpecMarksmanshipHunter {
				registerMarksmanT16(hunter, setBonusAura)
			} else {
				registerBeastMasteryT16(hunter, setBonusAura)
			}
		},
	},
})

func registerMarksmanT16(hunter *Hunter, setBonusAura *core.Aura) {
	var keenEyeAura *core.Aura
	keenEyeAura = hunter.RegisterAura(core.Aura{
		Label:    "Keen Eye",
		ActionID: core.ActionID{SpellID: 144659},
		Duration: time.Second * 20,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_CastTime_Pct,
		ClassMask:  HunterSpellAimedShot,
		FloatValue: -0.5,
	}).AttachProcTrigger(core.ProcTrigger{
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: HunterSpellAimedShot,
		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return spell.CurCast.Cost > 0
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			keenEyeAura.Deactivate(sim)
		},
	})

	setBonusAura.AttachProcTrigger(core.ProcTrigger{
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: HunterSpellAimedShot,
		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			return spell.CurCast.Cost == 0
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			keenEyeAura.Activate(sim)
		},
	})
}

func registerBeastMasteryT16(hunter *Hunter, _ *core.Aura) {
	hunter.OnSpellRegistered(func(spell *core.Spell) {
		if spell.ClassSpellMask != HunterSpellBestialWrath {
			return
		}

		brutalKinshipPetAura := hunter.Pet.RegisterAura(core.Aura{
			Label:     "Brutal Kinship",
			ActionID:  core.ActionID{SpellID: 145737},
			Duration:  core.NeverExpires,
			MaxStacks: 5,

			OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
				hunter.Pet.PseudoStats.DamageDealtMultiplier *= (1.0 + 0.02*float64(newStacks)) / (1.0 + 0.02*float64(oldStacks))
			},
		})

		hunter.Pet.BestialWrathAura.AttachProcTrigger(core.ProcTrigger{
			Callback:       core.CallbackOnSpellHitDealt,
			ClassSpellMask: HunterPetFocusDump,

			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				brutalKinshipPetAura.Activate(sim)
				brutalKinshipPetAura.AddStack(sim)
			},
		})

		brutalKinshipAura := hunter.RegisterAura(core.Aura{
			Label:     "Brutal Kinship",
			ActionID:  core.ActionID{SpellID: 144670},
			Duration:  core.NeverExpires,
			MaxStacks: 5,

			OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
				hunter.Pet.PseudoStats.DamageDealtMultiplier *= (1.0 + 0.04*float64(newStacks)) / (1.0 + 0.04*float64(oldStacks))
			},
		})

		hunter.BestialWrathAura.ApplyOnExpire(func(aura *core.Aura, sim *core.Simulation) {
			brutalKinshipAura.Deactivate(sim)
			brutalKinshipPetAura.Deactivate(sim)
		}).AttachProcTrigger(core.ProcTrigger{
			Callback:       core.CallbackOnCastComplete,
			ClassSpellMask: HunterSpellsAll | HunterSpellsTalents ^ (HunterSpellFervor | HunterSpellDireBeast | HunterSpellBestialWrath),

			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				brutalKinshipAura.Activate(sim)
				brutalKinshipAura.AddStack(sim)
			},
		})
	})
}

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
