package demonology

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

const shadowFlameScale = 0.137
const shadowFlameCoeff = 0.137
const hogScale = 0.575
const hogCoeff = 0.575

func (demonology *DemonologyWarlock) registerHandOfGuldan() {
	shadowFlame := demonology.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 47960},
		SpellSchool:    core.SpellSchoolFire | core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagNoOnCastComplete,
		ClassSpellMask: warlock.WarlockSpellShadowflameDot,

		ThreatMultiplier: 1,
		DamageMultiplier: 1,
		CritMultiplier:   demonology.DefaultCritMultiplier(),
		BonusCoefficient: shadowFlameCoeff,
		Dot: core.DotConfig{
			Aura: core.Aura{
				Label:     "Shadowflame",
				MaxStacks: 2,
			},
			NumberOfTicks:       6,
			TickLength:          time.Second,
			AffectedByCastSpeed: true,
			BonusCoefficient:    shadowFlameCoeff,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				dot.Snapshot(target, 0)
				stacks := math.Min(float64(dot.Aura.GetStacks())+1, 2)
				dot.SnapshotBaseDamage = demonology.CalcScalingSpellDmg(shadowFlameScale) + stacks*dot.BonusCoefficient*dot.Spell.BonusDamage()
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)
				demonology.GainDemonicFury(sim, 2, dot.Spell.ActionID)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Dot(target).Apply(sim)
			spell.Dot(target).Aura.AddStack(sim)
		},
	})

	newHandOfGuldanApplyEffects := func(consumesChaosWaveCharge bool) core.ApplySpellResults {
		return func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			if consumesChaosWaveCharge {
				// keep stacks in sync as they're shared
				demonology.ChaosWave.ConsumeCharge(sim)
			}
			demonology.HandOfGuldanImpactTime = sim.CurrentTime + time.Millisecond*1300
			pa := sim.GetConsumedPendingActionFromPool()
			pa.NextActionAt = demonology.HandOfGuldanImpactTime // Fixed delay of 1.3 seconds
			pa.Priority = core.ActionPriorityAuto

			pa.OnAction = func(sim *core.Simulation) {
				results := spell.CalcAoeDamage(
					sim,
					demonology.CalcScalingSpellDmg(hogScale),
					spell.OutcomeMagicHitAndCrit,
				)

				for _, result := range results {
					if result.Landed() {
						shadowFlame.Cast(sim, result.Target)
					}
				}

				spell.DealBatchedAoeDamage(sim)
			}

			sim.AddPendingAction(pa)
		}
	}

	newHandOfGuldanSpellConfig := func(config core.SpellConfig) core.SpellConfig {
		spellConfig := core.SpellConfig{
			ActionID:       config.ActionID,
			ClassSpellMask: config.ClassSpellMask,
			SpellSchool:    core.SpellSchoolFire | core.SpellSchoolShadow,
			ProcMask:       core.ProcMaskSpellDamage,
			Flags:          core.SpellFlagAoE | core.SpellFlagAPL,

			Cast: config.Cast,

			ManaCost:     config.ManaCost,
			Charges:      config.Charges,
			RechargeTime: config.RechargeTime,

			DamageMultiplier: 1,
			CritMultiplier:   demonology.DefaultCritMultiplier(),
			ThreatMultiplier: 1,
			BonusCoefficient: hogCoeff,
			ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
				return !demonology.IsInMeta()
			},
			ApplyEffects: newHandOfGuldanApplyEffects(false),
		}

		if config.ApplyEffects != nil {
			spellConfig.ApplyEffects = config.ApplyEffects
		}

		return spellConfig
	}

	demonology.HandOfGuldan = demonology.RegisterSpell(newHandOfGuldanSpellConfig(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 105174},
		ClassSpellMask: warlock.WarlockSpellHandOfGuldan,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		ManaCost:     core.ManaCostOptions{BaseCostPercent: 5},
		Charges:      2,
		RechargeTime: time.Second * 15,
		ApplyEffects: newHandOfGuldanApplyEffects(true),
	}))

	demonology.T16_4pc_HandOfGuldan = demonology.RegisterSpell(newHandOfGuldanSpellConfig(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 86040},
	}))
}
