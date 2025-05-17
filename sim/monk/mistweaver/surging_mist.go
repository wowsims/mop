package mistweaver

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (mw *MistweaverMonk) registerSurgingMist() {
	actionID := core.ActionID{SpellID: 116694}
	chiMetrics := mw.NewChiMetrics(actionID)
	spellCoeff := 1.8

	mw.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 8.8,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Microsecond * 1500,
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseHealing := 19630 + spellCoeff*spell.HealingPower(target)
			spell.CalcAndDealHealing(sim, &mw.Env.Raid.GetFirstTargetDummy().Unit, baseHealing, spell.OutcomeHealingCrit)
			chiGain := int32(1) //core.TernaryInt32(monk.StanceMatches(FierceTiger), 2, 1)
			mw.AddChi(sim, spell, chiGain, chiMetrics)
		},
	})

}
