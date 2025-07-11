package mistweaver

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (mw *MistweaverMonk) registerSurgingMist() {
	actionID := core.ActionID{SpellID: 116694}
	chiMetrics := mw.NewChiMetrics(actionID)

	mw.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolNature,
		ProcMask:       core.ProcMaskSpellHealing,
		Flags:          core.SpellFlagHelpful | core.SpellFlagAPL,
		ClassSpellMask: monk.MonkSpellSurgingMist,
		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 7.65, //Changed based on patch notes
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 1500,
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),
		BonusCoefficient: 1.8,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealHealing(sim, target, 17242, spell.OutcomeHealingCrit)
			chiGain := int32(1)
			mw.AddChi(sim, spell, chiGain, chiMetrics)
		},
	})

}
