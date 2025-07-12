package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (priest *Priest) registerBindingHealSpell() {

	bindingHealVariance := 0.25
	bindingHealScaling := 9.494
	bindingHealCoefficient := .899

	priest.BindingHeal = priest.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 32546},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: PriestSpellBindingHeal,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5.4,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 1500,
			},
		},

		BonusCoefficient: bindingHealCoefficient,
		DamageMultiplier: 1,
		CritMultiplier:   priest.DefaultCritMultiplier(),
		ThreatMultiplier: 0.5,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {

			selfHealing := priest.CalcAndRollDamageRange(sim, bindingHealScaling, bindingHealVariance)
			spell.CalcAndDealHealing(sim, &priest.Unit, selfHealing, spell.OutcomeHealingCrit)

			targetHealing := priest.CalcAndRollDamageRange(sim, bindingHealScaling, bindingHealVariance)
			spell.CalcAndDealHealing(sim, target, targetHealing, spell.OutcomeHealingCrit)
		},
	})
}
