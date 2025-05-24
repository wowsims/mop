package paladin

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (paladin *Paladin) registerCrusaderStrike() {
	actionID := core.ActionID{SpellID: 35395}
	paladin.CanTriggerHolyAvengerHpGain(actionID)
	bonusDamage := paladin.CalcScalingSpellDmg(0.55400002003)

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskCrusaderStrike,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 10,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    paladin.BuilderCooldown(),
				Duration: time.Millisecond * 4500,
			},
		},

		DamageMultiplier: 1.25,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := paladin.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower()) + bonusDamage

			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if result.Landed() {
				paladin.HolyPower.Gain(1, actionID, sim)
			}

			spell.DealOutcome(sim, result)
		},
	})
}
