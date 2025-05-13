package paladin

import (
	"slices"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (paladin *Paladin) ApplyTalents() {
	if paladin.Level >= 15 {
		// paladin.registerSpeedOfLight()
		// paladin.registerLongArmOfTheLaw()
		paladin.registerPursuitOfJustice()
	}

	// Level 30 talents are just CC

	if paladin.Level >= 45 {
		// paladin.registerSelflessHealer()
		// paladin.registerEternalFlame()
		// paladin.registerSacredShield()
	}

	if paladin.Level >= 60 {
		// paladin.registerHandOfPurity()
		// paladin.registerUnbreakableSpirit()
		// Skipping Clemecy I guess?
	}

	if paladin.Level >= 75 {
		paladin.registerHolyAvenger()
		paladin.registerSanctifiedWrath()
		paladin.registerDivinePurpose()
	}

	if paladin.Level >= 90 {
		paladin.registerHolyPrism()
		paladin.registerLightsHammer()
		paladin.registerExecutionSentence()
	}
}

func (paladin *Paladin) registerPursuitOfJustice() {
	if !paladin.Talents.PursuitOfJustice {
		return
	}

	paladin.NewMovementSpeedAura("Pursuit of Justice", core.ActionID{SpellID: 114695}, 0.15)
}

func (paladin *Paladin) registerSanctifiedWrath() {
	if !paladin.Talents.SanctifiedWrath {
		return
	}

	// paladin.AddStaticMod(core.SpellModConfig{
	// 	ClassMask:  SpellMaskHammerOfWrath,
	// 	Kind:       core.SpellMod_BonusCrit_Percent,
	// 	FloatValue: 2 * float64(paladin.Talents.SanctifiedWrath),
	// })
	// paladin.AddStaticMod(core.SpellModConfig{
	// 	ClassMask: SpellMaskAvengingWrath,
	// 	Kind:      core.SpellMod_Cooldown_Flat,
	// 	TimeValue: -(time.Second * time.Duration(20*paladin.Talents.SanctifiedWrath)),
	// })

	// Hammer of Wrath execute restriction removal is handled in hammer_of_wrath.go
}

func (paladin *Paladin) registerDivinePurpose() {
	if !paladin.Talents.DivinePurpose {
		return
	}

	actionID := core.ActionID{SpellID: 90174}
	duration := time.Second * 8
	var divinePurposeAura *core.Aura
	divinePurposeAura = paladin.RegisterAura(core.Aura{
		Label:    "Divine Purpose" + paladin.Label,
		ActionID: actionID,
		Duration: duration,
	}).AttachProcTrigger(core.ProcTrigger{
		Name:           "Divine Purpose Consume Trigger" + paladin.Label,
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: SpellMaskSpender,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if divinePurposeAura.RemainingDuration(sim) < duration {
				divinePurposeAura.Deactivate(sim)
			}
		},
	})

	procChances := []float64{0, 0.08, 0.166, 0.25}
	paladin.HolyPower.RegisterOnSpend(func(sim *core.Simulation, amount int32, _ core.ActionID) {
		if divinePurposeAura.IsActive() {
			divinePurposeAura.Deactivate(sim)
		}

		core.StartDelayedAction(sim, core.DelayedActionOptions{
			DoAt: sim.CurrentTime + core.SpellBatchWindow,
			OnAction: func(sim *core.Simulation) {
				if divinePurposeAura.IsActive() {
					paladin.HolyPower.Gain(amount, actionID, sim)
				}

				if sim.Proc(procChances[amount], "Divine Purpose"+paladin.Label) {
					divinePurposeAura.Activate(sim)
				}
			},
		})
	})
}

func (paladin *Paladin) registerHolyAvenger() {
	if !paladin.Talents.HolyAvenger {
		return
	}

	var classMask int64
	if paladin.Spec == proto.Spec_SpecProtectionPaladin {
		classMask = SpellMaskBuilderProt
	} else if paladin.Spec == proto.Spec_SpecHolyPaladin {
		classMask = SpellMaskBuilderHoly
	} else {
		classMask = SpellMaskBuilderRet
	}

	actionID := core.ActionID{SpellID: 105809}
	holyAvengerAura := paladin.RegisterAura(core.Aura{
		Label:    "Holy Avenger" + paladin.Label,
		ActionID: actionID,
		Duration: time.Second * 18,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  classMask,
		FloatValue: 0.3,
	})

	paladin.HolyPower.RegisterOnGain(func(sim *core.Simulation, gain int32, actualGain int32, triggeredActionID core.ActionID) {
		if !holyAvengerAura.IsActive() {
			return
		}

		if slices.Contains(paladin.holyAvengerActionIDFilter, &triggeredActionID) {
			core.StartDelayedAction(sim, core.DelayedActionOptions{
				DoAt: sim.CurrentTime + core.SpellBatchWindow,
				OnAction: func(sim *core.Simulation) {
					paladin.HolyPower.Gain(2, actionID, sim)
				},
			})
		}
	})

	paladin.HolyAvenger = paladin.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          core.SpellFlagAPL,
		ProcMask:       core.ProcMaskEmpty,
		ClassSpellMask: SpellMaskHolyAvenger,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    paladin.NewTimer(),
				Duration: 2 * time.Minute,
			},
		},

		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)
		},

		RelatedSelfBuff: holyAvengerAura,
	})
}

func (paladin *Paladin) registerHolyPrism() {
	if !paladin.Talents.HolyPrism {
		return
	}

	numEnemyTargets := min(5, paladin.Env.GetNumTargets())

	damageActionID := core.ActionID{SpellID: 114852}
	healActionID := core.ActionID{SpellID: 114871}

	onUseTimer := paladin.NewTimer()
	onUseCD := time.Second * 20

	targetScalingCoef := 14.13099956512
	targetVariance := 0.20000000298
	targetSpCoef := 1.4279999733

	aoeScalingCoef := 9.52900028229
	aoeVariance := 0.20000000298
	aoeSpCoef := 0.9620000124

	aoeHealSpell := paladin.RegisterSpell(core.SpellConfig{
		ActionID:    damageActionID.WithTag(2),
		Flags:       core.SpellFlagPassiveSpell | core.SpellFlagHelpful,
		ProcMask:    core.ProcMaskSpellHealing,
		SpellSchool: core.SpellSchoolHoly,

		MaxRange:     40,
		MissileSpeed: 100,

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := paladin.CalcAndRollDamageRange(sim, aoeScalingCoef, aoeVariance) +
				aoeSpCoef*spell.SpellPower()
			result := spell.CalcHealing(sim, target, baseHealing, spell.OutcomeHealingCrit)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealOutcome(sim, result)
			})
		},
	})

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:    damageActionID.WithTag(1),
		Flags:       core.SpellFlagAPL,
		ProcMask:    core.ProcMaskSpellDamage,
		SpellSchool: core.SpellSchoolHoly,

		MaxRange:     40,
		MissileSpeed: 100,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5.4,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    onUseTimer,
				Duration: onUseCD,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := paladin.CalcAndRollDamageRange(sim, targetScalingCoef, targetVariance) +
				targetSpCoef*spell.SpellPower()

			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)

			if result.Landed() {
				aoeHealSpell.Cast(sim, &paladin.Unit)
			}

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealOutcome(sim, result)
			})
		},
	})

	aoeDamageSpell := paladin.RegisterSpell(core.SpellConfig{
		ActionID:    healActionID.WithTag(2),
		Flags:       core.SpellFlagPassiveSpell,
		ProcMask:    core.ProcMaskSpellDamage,
		SpellSchool: core.SpellSchoolHoly,

		MaxRange:     40,
		MissileSpeed: 100,

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			results := make([]*core.SpellResult, numEnemyTargets)

			for i := 0; i < len(results); i++ {
				baseDamage := paladin.CalcAndRollDamageRange(sim, aoeScalingCoef, aoeVariance) +
					aoeSpCoef*spell.SpellPower()
				results[i] = spell.CalcDamage(sim, paladin.Env.Raid.AllPlayerUnits[i], baseDamage, spell.OutcomeMagicCrit)
			}

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				for _, result := range results {
					spell.DealOutcome(sim, result)
				}
			})
		},
	})

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:    healActionID.WithTag(1),
		Flags:       core.SpellFlagAPL | core.SpellFlagHelpful,
		ProcMask:    core.ProcMaskSpellHealing,
		SpellSchool: core.SpellSchoolHoly,

		MaxRange:     40,
		MissileSpeed: 100,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5.4,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    onUseTimer,
				Duration: onUseCD,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := paladin.CalcAndRollDamageRange(sim, targetScalingCoef, targetVariance) +
				targetSpCoef*spell.SpellPower()

			result := spell.CalcHealing(sim, &paladin.Unit, baseHealing, spell.OutcomeHealingCrit)

			aoeDamageSpell.Cast(sim, target)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealOutcome(sim, result)
			})
		},
	})
}

func (paladin *Paladin) registerLightsHammer() {
	if !paladin.Talents.LightsHammer {
		return
	}

	scalingCoef := 3.17899990082
	variance := 0.20000000298
	spCoef := 0.32100000978

	arcingLightDamage := paladin.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 114919},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label: "Arcing Light (Damage)" + paladin.Label,
			},
			NumberOfTicks: 8,
			TickLength:    time.Second * 2,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				for _, aoeTarget := range sim.Encounter.TargetUnits {
					baseDamage := paladin.CalcAndRollDamageRange(sim, scalingCoef, variance) +
						spCoef*dot.Spell.SpellPower()
					dot.Spell.CalcAndDealPeriodicDamage(sim, aoeTarget, baseDamage, dot.OutcomeTickMagicHitAndCrit)
				}
			},
		},
	})

	arcingLightHealing := paladin.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 119952},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagPassiveSpell | core.SpellFlagHelpful,

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Hot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label: "Arcing Light (Healing)" + paladin.Label,
			},
			NumberOfTicks: 8,
			TickLength:    time.Second * 2,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				for _, aoeTarget := range sim.Raid.AllUnits {
					baseHealing := paladin.CalcAndRollDamageRange(sim, scalingCoef, variance) +
						spCoef*dot.Spell.SpellPower()
					dot.Spell.CalcAndDealPeriodicHealing(sim, aoeTarget, baseHealing, dot.OutcomeTickHealingCrit)
				}
			},
		},
	})

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 114158},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		MaxRange:     30,
		MissileSpeed: 20,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    paladin.NewTimer(),
				Duration: time.Minute,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			aoeDamageDot := arcingLightDamage.AOEDot()
			aoeHealingDot := arcingLightHealing.AOEDot()

			if sim.Proc(0.5, "Arcing Light 9 ticks"+paladin.Label) {
				aoeDamageDot.BaseTickCount = 9
				aoeHealingDot.BaseTickCount = 9
			} else {
				aoeDamageDot.BaseTickCount = 8
				aoeHealingDot.BaseTickCount = 8
			}

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				aoeDamageDot.Apply(sim)
				aoeHealingDot.Apply(sim)
			})
		},
	})
}

func (paladin *Paladin) registerExecutionSentence() {
	if !paladin.Talents.ExecutionSentence {
		return
	}

	baseTickDamage := paladin.CalcScalingSpellDmg(0.42599999905)
	spCoef := 5936 / 1000.0
	totalBonusCoef := 0.0

	tickMultipliers := make([]float64, 11)
	tickMultipliers[0] = 1.0
	for i := 1; i < 10; i++ {
		tickMultipliers[i] = tickMultipliers[i-1] * 1.1
		totalBonusCoef += tickMultipliers[i]
	}
	tickMultipliers[10] = tickMultipliers[9] * 5
	totalBonusCoef += tickMultipliers[10]

	tickSpCoef := spCoef * (1 / totalBonusCoef)

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 114916},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		MaxRange: 40,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    paladin.NewTimer(),
				Duration: time.Minute,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Execution Sentence" + paladin.Label,
			},
			NumberOfTicks: 10,
			TickLength:    time.Second,

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				dot.Snapshot(target, dot.Spell.SpellPower())
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				snapshotSpellPower := dot.SnapshotBaseDamage

				tickMultiplier := tickMultipliers[dot.TickCount()+1]
				dot.SnapshotBaseDamage = tickMultiplier*baseTickDamage +
					tickMultiplier*tickSpCoef*snapshotSpellPower

				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)

				dot.SnapshotBaseDamage = snapshotSpellPower
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHitNoHitCounter)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
			}
			spell.DealOutcome(sim, result)
		},
	})
}
