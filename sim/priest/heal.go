package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerHealSpell() {

	if priest.Spec == proto.Spec_SpecShadowPriest {
		return
	}

	healVariance := 0.15
	healScaling := 10.145
	healCoefficient := 1.024

	priest.GreaterHeal = priest.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2050},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: PriestSpellHeal,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 1.9,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 2500,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   priest.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: healCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := priest.CalcAndRollDamageRange(sim, healScaling, healVariance)
			spell.CalcAndDealHealing(sim, target, baseHealing, spell.OutcomeHealingCrit)
		},
	})
}
