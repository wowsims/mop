package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerGreaterHealSpell() {

	if priest.Spec == proto.Spec_SpecShadowPriest {
		return
	}

	greaterHealVariance := 0.15
	greaterHealScaling := 21.658
	greaterHealCoefficient := 2.19

	priest.GreaterHeal = priest.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 2060},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5.9,
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
		BonusCoefficient: greaterHealCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := priest.CalcAndRollDamageRange(sim, greaterHealScaling, greaterHealVariance)
			spell.CalcAndDealHealing(sim, target, baseHealing, spell.OutcomeHealingCrit)
		},
	})
}
