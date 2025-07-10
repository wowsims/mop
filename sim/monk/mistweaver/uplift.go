package mistweaver

import (
	"github.com/wowsims/mop/sim/core"
)

func (mw *MistweaverMonk) registerUplift() {
	actionID := core.ActionID{SpellID: 116670}
	chiMetrics := mw.NewChiMetrics(actionID)

	mw.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),
		BonusCoefficient: 0.68,
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return mw.GetChi() >= 2
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			success := false
			for _, player := range sim.Raid.AllPlayerUnits {
				hot := mw.renewingMist.Hot(player)

				if hot.IsActive() {

					spell.CalcAndDealHealing(sim, player, 0, spell.OutcomeHealingCrit)
					success = true
				}
			}

			if success {
				mw.SpendChi(sim, 2, chiMetrics)
			}
		},
	})
}
