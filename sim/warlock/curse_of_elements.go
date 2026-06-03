package warlock

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (warlock *Warlock) registerCurseOfElements() {
	warlock.CurseOfElementsAuras = warlock.NewEnemyAuraArray(core.CurseOfElementsAura)

	warlock.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 1490},
		SpellSchool:    core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: WarlockSpellCurseOfElements,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 4,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCDMin: time.Millisecond * 500,
				GCD:    core.GCDMin,
			},
			IgnoreHaste: true,
		},

		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHit)
			if result.Landed() {
				warlock.CurseOfElementsAuras.Get(target).Activate(sim)
			}

			spell.DealOutcome(sim, result)
		},

		RelatedAuraArrays: warlock.CurseOfElementsAuras.ToMap(),
	})
}
