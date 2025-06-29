package blood

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/death_knight"
)

var HeartStrikeActionID = core.ActionID{SpellID: 55050}

/*
Instantly strike the target and up to two additional nearby enemies, causing 105% weapon damage plus 545 on the primary target, with each additional enemy struck taking 50% less damage than the previous target.
Damage dealt to each target is increased by an additional 15% for each of your diseases present.
*/
func (bdk *BloodDeathKnight) registerHeartStrike() {
	maxHits := min(3, bdk.Env.TotalTargetCount())
	results := make(core.SpellResultSlice, maxHits)

	bdk.GetOrRegisterSpell(core.SpellConfig{
		ActionID:       HeartStrikeActionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: death_knight.DeathKnightSpellHeartStrike,

		MaxRange: core.MaxMeleeRange,

		RuneCost: core.RuneCostOptions{
			BloodRuneCost:  1,
			RunicPowerGain: 10,
			Refundable:     true,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDMin,
			},
		},

		DamageMultiplier: 1.05,
		CritMultiplier:   bdk.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := bdk.CalcScalingSpellDmg(0.43700000644) +
				spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())

			defaultMultiplier := spell.DamageMultiplier
			currentTarget := target
			numHits := min(maxHits, bdk.Env.ActiveTargetCount())

			for idx := range numHits {
				targetDamage := baseDamage * bdk.GetDiseaseMulti(currentTarget, 1.0, 0.15)

				results[idx] = spell.CalcDamage(sim, currentTarget, targetDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)
				if idx == 0 {
					spell.SpendRefundableCost(sim, results[idx])
				}

				spell.DamageMultiplier *= 0.5
				currentTarget = bdk.Env.NextActiveTargetUnit(currentTarget)
			}

			spell.DamageMultiplier = defaultMultiplier

			for idx := range numHits {
				spell.DealDamage(sim, results[idx])
			}
		},
	})
}

func (bdk *BloodDeathKnight) registerDrwHeartStrike() *core.Spell {
	maxHits := min(3, bdk.Env.TotalTargetCount())
	results := make([]*core.SpellResult, maxHits)

	return bdk.RuneWeapon.RegisterSpell(core.SpellConfig{
		ActionID:    HeartStrikeActionID,
		SpellSchool: core.SpellSchoolPhysical,
		ProcMask:    core.ProcMaskMeleeMHSpecial,
		Flags:       core.SpellFlagMeleeMetrics,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := bdk.CalcScalingSpellDmg(0.43700000644) +
				spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())

			defaultMultiplier := spell.DamageMultiplier
			currentTarget := target
			numHits := min(maxHits, bdk.Env.ActiveTargetCount())

			for idx := range numHits {
				targetDamage := baseDamage * bdk.RuneWeapon.GetDiseaseMulti(currentTarget, 1.0, 0.15)

				results[idx] = spell.CalcDamage(sim, currentTarget, targetDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

				spell.DamageMultiplier *= 0.5
				currentTarget = bdk.Env.NextActiveTargetUnit(currentTarget)
			}

			spell.DamageMultiplier = defaultMultiplier

			for idx := range numHits {
				spell.DealDamage(sim, results[idx])
				spell.DamageMultiplier /= 0.5
			}
		},
	})
}
