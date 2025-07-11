package elemental

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/shaman"
)

func (elemental *ElementalShaman) registerThunderstormSpell() {
	actionID := core.ActionID{SpellID: 51490}
	manaMetrics := elemental.NewManaMetrics(actionID)

	manaRestore := 0.15

	elemental.Thunderstorm = elemental.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          shaman.SpellFlagShamanSpell | core.SpellFlagAoE | core.SpellFlagAPL | shaman.SpellFlagFocusable,
		SpellSchool:    core.SpellSchoolNature,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: shaman.SpellMaskThunderstorm,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 0,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    elemental.NewTimer(),
				Duration: time.Second * 45,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   elemental.DefaultCritMultiplier(),
		BonusCoefficient: 0.57099997997,
		ThreatMultiplier: 1,
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			elemental.AddMana(sim, elemental.MaxMana()*manaRestore, manaMetrics)

			if elemental.Shaman.ThunderstormInRange {
				spell.CalcAoeDamageWithVariance(sim, spell.OutcomeMagicHitAndCrit, func(sim *core.Simulation, _ *core.Spell) float64 {
					return elemental.GetShaman().CalcAndRollDamageRange(sim, 1.62999999523, 0.13300000131)
				})

				spell.DealBatchedAoeDamage(sim)
			}
		},
	})
}
