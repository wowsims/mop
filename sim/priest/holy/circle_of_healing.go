package holy

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/priest"
)

func (holy *HolyPriest) registerCircleOfHealingSpell() {

	circleOfHealingVariance := 0.1
	circleOfHealingScaling := 4.613
	circleOfHealingCoefficient := 0.467

	targets := holy.Env.Raid.GetFirstNPlayersOrPets(5)

	holy.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 34861},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: priest.PriestSpellCircleOfHealing,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 3.2,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    holy.NewTimer(),
				Duration: time.Second * 10,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   holy.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: circleOfHealingCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			for _, aoeTarget := range targets {
				baseHealing := holy.CalcAndRollDamageRange(sim, circleOfHealingScaling, circleOfHealingVariance)
				spell.CalcAndDealHealing(sim, aoeTarget, baseHealing, spell.OutcomeHealingCrit)
			}
		},
	})
}
