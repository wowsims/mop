package mistweaver

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (mw *MistweaverMonk) registerSoothingMist() {
	actionID := core.ActionID{SpellID: 115175}
	chiMetrics := mw.NewChiMetrics(actionID)
	spellCoeff := 0.1792

	surgingMistCastTimeMod := mw.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_CastTime_Pct,
		FloatValue: -1,
		ClassMask:  monk.MonkSpellSurgingMist,
	})

	envelopingMistCastTimeMod := mw.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_CastTime_Pct,
		FloatValue: -1,
		ClassMask:  monk.MonkSpellEnvelopingMist,
	})

	var soothingMist *core.Spell

	soothingMist = mw.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 1,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Millisecond * 1000,
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),
		Hot: core.DotConfig{
			Aura: core.Aura{
				Label: "Soothing Mist",
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					surgingMistCastTimeMod.Deactivate()
					envelopingMistCastTimeMod.Deactivate()
				},
			},
			NumberOfTicks:        9,
			TickLength:           1 * time.Second,
			AffectedByCastSpeed:  true, //Not sure
			HasteReducesDuration: true, //Not sure
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				envelopingActive := mw.enevelopingMist.RelatedDotSpell.Hot(target).IsActive()
				dot.SnapshotBaseDamage = 0 + mw.CalcScalingSpellDmg(spellCoeff)
				multiplier := dot.Spell.CasterHealingMultiplier()
				if envelopingActive {
					multiplier += +0.3
				}

				dot.SnapshotAttackerMultiplier = multiplier
			},

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)

				outcome := sim.Roll(1, 10)
				if outcome > 7 {
					mw.AddChi(sim, soothingMist, 1, chiMetrics)
				}
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			//Currently target mistweaver only, will need to fix this
			hot := spell.Hot(&mw.Unit)
			hot.Apply(sim)
			hot.TickOnce(sim)
			expiresAt := hot.ExpiresAt()
			mw.AutoAttacks.StopMeleeUntil(sim, expiresAt, false)
			surgingMistCastTimeMod.Activate()
			envelopingMistCastTimeMod.Activate()
			fmt.Print(surgingMistCastTimeMod.IsActive)
		},
	})

}
