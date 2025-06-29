package mistweaver

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (mw *MistweaverMonk) registerEnvelopingMist() {
	actionID := core.ActionID{SpellID: 124682}
	chiMetrics := mw.NewChiMetrics(actionID)
	spellCoeff := 0.45

	mw.enevelopingMist = mw.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolNature,
		ProcMask:       core.ProcMaskSpellHealing,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL, // | core.SpellFlagCastWhileChanneling,
		ClassSpellMask: monk.MonkSpellEnvelopingMist,

		ManaCost: core.ManaCostOptions{BaseCostPercent: 0},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 2000,
			},
		},
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return mw.GetChi() >= 3
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {

			fmt.Print("Envelop\n")

			mw.SpendChi(sim, 3, chiMetrics)
			spell.RelatedDotSpell.Cast(sim, &mw.Unit)

		},
	})

	mw.enevelopingMist.RelatedDotSpell = mw.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful,
		//ClassSpellMask: monk.MonkSpellEnvelopingMist,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),
		Hot: core.DotConfig{
			Aura: core.Aura{
				Label: "Enveloping Mist",
			},
			NumberOfTicks:        6,
			TickLength:           1 * time.Second,
			AffectedByCastSpeed:  true,
			HasteReducesDuration: true,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.SnapshotBaseDamage = 0 + mw.CalcScalingSpellDmg(spellCoeff)
				dot.SnapshotAttackerMultiplier = dot.Spell.CasterHealingMultiplier()
			},

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)

			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			//Targets only mw currently
			fmt.Print("related mist \n")
			hot := spell.Hot(&mw.Unit)

			hot.Apply(sim)

		},
	})
}
