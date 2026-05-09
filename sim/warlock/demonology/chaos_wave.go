package demonology

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

const chaosWaveScale = 1
const chaosWaveCoeff = 1.167

func (demonology *DemonologyWarlock) registerChaosWave() {
	newChaosWaveApplyEffects := func(consumesHandOfGuldanCharge bool, spendsDemonicFury bool) core.ApplySpellResults {
		return func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			if consumesHandOfGuldanCharge {
				// keep stacks in sync as they're shared
				demonology.HandOfGuldan.ConsumeCharge(sim)
			}
			if spendsDemonicFury {
				demonology.SpendDemonicFury(sim, 80, spell.ActionID)
			}

			pa := sim.GetConsumedPendingActionFromPool()
			pa.NextActionAt = sim.CurrentTime + time.Millisecond*1300 // Fixed delay of 1.3 seconds
			pa.Priority = core.ActionPriorityAuto

			pa.OnAction = func(sim *core.Simulation) {
				spell.CalcAndDealAoeDamage(sim, demonology.CalcScalingSpellDmg(chaosWaveScale), spell.OutcomeMagicHitAndCrit)
			}

			sim.AddPendingAction(pa)
		}
	}

	newChaosWaveSpellConfig := func(config core.SpellConfig) core.SpellConfig {
		spellConfig := core.SpellConfig{
			ActionID:       config.ActionID,
			ClassSpellMask: config.ClassSpellMask,
			SpellSchool:    core.SpellSchoolChaos,
			ProcMask:       core.ProcMaskSpellDamage,
			Flags:          core.SpellFlagAoE | core.SpellFlagAPL,
			Charges:        config.Charges,
			RechargeTime:   config.RechargeTime,
			Cast:           config.Cast,

			DamageMultiplier: 1,
			CritMultiplier:   demonology.DefaultCritMultiplier(),
			ThreatMultiplier: 1,
			BonusCoefficient: chaosWaveCoeff,

			ExtraCastCondition: config.ExtraCastCondition,
			ApplyEffects:       newChaosWaveApplyEffects(false, false),
		}

		if config.ApplyEffects != nil {
			spellConfig.ApplyEffects = config.ApplyEffects
		}

		return spellConfig
	}

	demonology.ChaosWave = demonology.RegisterSpell(newChaosWaveSpellConfig(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 124916},
		ClassSpellMask: warlock.WarlockSpellChaosWave,
		Charges:        2,
		RechargeTime:   time.Second * 15,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return demonology.IsInMeta() && demonology.CanSpendDemonicFury(80)
		},
		ApplyEffects: newChaosWaveApplyEffects(true, true),
	}))

	demonology.T16_4pc_ChaosWave = demonology.RegisterSpell(newChaosWaveSpellConfig(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 124915},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return demonology.IsInMeta()
		},
	}))
}
