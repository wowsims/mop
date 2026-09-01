package warrior

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (war *Warrior) registerPummel() {
	war.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 6552},
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskPummel,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		SpellSchool:    core.SpellSchoolPhysical,
		MaxRange:       core.MaxMeleeRange,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    war.NewTimer(),
				Duration: time.Second * 15,
			},
		},

		CritMultiplier: war.DefaultCritMultiplier(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealOutcome(sim, target, spell.OutcomeMeleeSpecialHit)
		},
	})
}
