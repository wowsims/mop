package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerPrayerOfHealingSpell() {

	if priest.Spec == proto.Spec_SpecShadowPriest {
		return
	}

	prayerOfHealingVariance := 0.055
	prayerOfHealingScaling := 8.28
	prayerOfHealingCoefficient := 0.838

	targets := priest.Env.Raid.GetFirstNPlayersOrPets(5)

	priest.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 596},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: PriestSpellPrayerOfHealing,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 4.5,
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
		BonusCoefficient: prayerOfHealingCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			for _, aoeTarget := range targets {
				baseHealing := priest.CalcAndRollDamageRange(sim, prayerOfHealingScaling, prayerOfHealingVariance)
				spell.CalcAndDealHealing(sim, aoeTarget, baseHealing, spell.OutcomeHealingCrit)
			}
		},
	})
}
