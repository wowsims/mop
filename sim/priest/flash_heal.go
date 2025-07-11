package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (priest *Priest) registerFlashHealSpell() {
	flashHealVariance := 0.15
	flashHealScaling := 13.0
	flashHealCoefficient := 1.314

	priest.FlashHeal = priest.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2061},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: PriestSpellFlashHeal,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5.9,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 1500,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   priest.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: flashHealCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := priest.CalcAndRollDamageRange(sim, flashHealScaling, flashHealVariance)
			spell.CalcAndDealHealing(sim, target, baseHealing, spell.OutcomeHealingCrit)
		},
	})
}
