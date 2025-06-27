package priest

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (priest *Priest) registerRenewSpell() {

	coeff := .207
	// scaling := 2.051

	actionID := core.ActionID{SpellID: 139}

	// if priest.Talents.EmpoweredRenew > 0 {
	// 	priest.EmpoweredRenew = priest.RegisterSpell(core.SpellConfig{
	// 		ActionID:    core.ActionID{SpellID: 63543},
	// 		SpellSchool: core.SpellSchoolHoly,
	// 		ProcMask:    core.ProcMaskSpellHealing,
	// 		Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagHelpful,

	// 		DamageMultiplier: 1 *
	// 			float64(priest.renewTicks()) *
	// 			priest.renewHealingMultiplier() *
	// 			.05 * float64(priest.Talents.EmpoweredRenew) *
	// 			core.TernaryFloat64(priest.CouldHaveSetBonus(ItemSetZabrasRaiment, 4), 1.1, 1),
	// 		CritMultiplier:   priest.DefaultCritMultiplier(),
	// 		ThreatMultiplier: 1 - []float64{0, .07, .14, .20}[priest.Talents.SilentResolve],

	// 		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
	// 			baseHealing := 280 + spellCoeff*spell.HealingPower(target)
	// 			spell.CalcAndDealHealing(sim, target, baseHealing, spell.OutcomeHealingCrit)
	// 		},
	// 	})
	// }

	priest.Renew = priest.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 2.6,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Hot: core.DotConfig{
			Aura: core.Aura{
				Label: "Renew",
			},
			NumberOfTicks: 4,
			TickLength:    time.Second * 3,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.SnapshotBaseDamage = coeff * dot.Spell.HealingPower(target)
				dot.SnapshotAttackerMultiplier = dot.Spell.CasterHealingMultiplier()
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			fmt.Println("zorp")
			fmt.Println(spell.Hot(target))
			spell.Hot(target).Activate(sim)

			// if priest.EmpoweredRenew != nil {
			// 	priest.EmpoweredRenew.Cast(sim, target)
			// }
		},
	})
}

// func (priest *Priest) renewTicks() int32 {
// 	return 5 - core.TernaryInt32(priest.HasMajorGlyph(proto.PriestMajorGlyph_GlyphOfRenew), 1, 0)
// }
