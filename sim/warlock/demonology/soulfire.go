package demonology

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/warlock"
)

const soulfireScale = 0.854
const soulfireCoeff = 0.854
const soulfireVariance = 0.2

func (demonology *DemonologyWarlock) registerSoulfire() {
	getSoulFireConfig := func(config *core.SpellConfig, extraApplyEffect core.ApplySpellResults) core.SpellConfig {
		return core.SpellConfig{
			ActionID:       config.ActionID,
			SpellSchool:    core.SpellSchoolFire,
			ProcMask:       core.ProcMaskSpellDamage,
			Flags:          core.SpellFlagAPL,
			ClassSpellMask: warlock.WarlockSpellSoulFire,
			MissileSpeed:   24,

			ManaCost: config.ManaCost,

			Cast: core.CastConfig{
				DefaultCast: core.Cast{
					GCD:      core.GCDDefault,
					CastTime: 4 * time.Second,
				},
			},

			DamageMultiplierAdditive: 1,
			CritMultiplier:           demonology.DefaultCritMultiplier(),
			ThreatMultiplier:         1,
			BonusCoefficient:         soulfireCoeff,
			BonusCritPercent:         100,

			ExtraCastCondition: config.ExtraCastCondition,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				baseDamage := demonology.CalcAndRollDamageRange(sim, soulfireScale, soulfireVariance)

				// Damage is increased by crit chance
				spell.DamageMultiplier *= (1 + demonology.GetStat(stats.SpellCritPercent)/100)
				result := spell.CalcAttackerModDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
				spell.DamageMultiplier /= (1 + demonology.GetStat(stats.SpellCritPercent)/100)

				if extraApplyEffect != nil {
					extraApplyEffect(sim, target, spell)
				}

				spell.WaitTravelTime(sim, func(sim *core.Simulation) {
					spell.CalcTargetModDamage(sim, target, result)
					spell.DealDamage(sim, result)
				})
			},
		}
	}

	getSoulFireCost := func() int32 {
		baseCost := core.TernaryInt32(demonology.T15_2pc.IsActive(), 112, 160)
		if demonology.MoltenCore.IsActive() {
			baseCost /= 2
		}
		return baseCost
	}

	demonology.RegisterSpell(getSoulFireConfig(&core.SpellConfig{
		ActionID: core.ActionID{SpellID: 6353},
		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 15,
			PercentModifier: 1,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return !demonology.IsInMeta()
		},
	}, func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		demonology.DemonicFury.Gain(sim, 30, spell.ActionID)
	}))

	demonology.RegisterSpell(getSoulFireConfig(&core.SpellConfig{
		ActionID: core.ActionID{SpellID: 104027},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return demonology.IsInMeta() && demonology.DemonicFury.CanSpend(getSoulFireCost())
		},
	}, func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		demonology.DemonicFury.Spend(sim, getSoulFireCost(), spell.ActionID)
	}))

}
