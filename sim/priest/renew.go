package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerRenewSpell() {

	coeff := .207
	scaling := 2.051

	actionID := core.ActionID{SpellID: 139}

	isHolyPriest := priest.Spec == proto.Spec_SpecHolyPriest
	renewGCD := core.Ternary(isHolyPriest, core.GCDDefault, time.Second*1)
	renewHealingMultiplier := core.Ternary(isHolyPriest, 1.15, 1.0)

	priest.Renew = priest.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellHealing,
		ClassSpellMask: PriestSpellRenew,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 2.6,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: renewGCD,
			},
		},
		DamageMultiplier: renewHealingMultiplier,
		ThreatMultiplier: 1,

		Hot: core.DotConfig{
			Aura: core.Aura{
				Label: "Renew",
			},
			NumberOfTicks:    4,
			TickLength:       time.Second * 3,
			BonusCoefficient: coeff,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.Snapshot(target, priest.CalcScalingSpellDmg(scaling))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			// if isHolyPriest {
			// 	// Do 15% of the total healing.
			// }
			spell.Hot(target).Apply(sim)
		},
	})
}
