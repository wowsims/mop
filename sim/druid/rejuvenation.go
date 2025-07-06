package druid

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

const (
	RejuvenationBonusCoeff = 0.39199998975
	RejuvenationCoeff = 3.86800003052
)

func (druid *Druid) registerRejuvenationSpell() {
	baseTickDamage := RejuvenationCoeff * druid.ClassSpellScaling

	druid.Rejuvenation = druid.RegisterSpell(Humanoid | Moonkin, core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 774},
		SpellSchool:      core.SpellSchoolNature,
		ProcMask:         core.ProcMaskSpellHealing,
		ClassSpellMask:   DruidSpellRejuvenation,
		Flags:            core.SpellFlagHelpful | core.SpellFlagAPL,
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   druid.DefaultCritMultiplier(),

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 14.5,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		Hot: core.DotConfig{
			Aura: core.Aura{
				Label: "Rejuvenation",
			},

			NumberOfTicks:        4,
			TickLength:           time.Second * 3,
			AffectedByCastSpeed:  true,
			HasteReducesDuration: false,

			OnSnapshot: func(_ *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.SnapshotBaseDamage = baseTickDamage + RejuvenationBonusCoeff * dot.Spell.HealingPower(target)
				dot.SnapshotAttackerMultiplier = dot.CasterPeriodicHealingMultiplier()
				dot.SnapshotCritChance = dot.Spell.HealingCritChance()
			},

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeSnapshotCrit)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Hot(target).Apply(sim)
		},
	})
}
