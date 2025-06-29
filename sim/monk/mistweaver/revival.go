package mistweaver

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (mw *MistweaverMonk) registerRevival() {
	actionID := core.ActionID{SpellID: 115310}

	spellCoeff := 3.5

	mw.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,
		ManaCost:    core.ManaCostOptions{BaseCostPercent: 7.7},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    mw.NewTimer(),
				Duration: time.Minute * 3,
			},
		},
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   mw.DefaultCritMultiplier(),
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			for _, player := range sim.Raid.AllPlayerUnits {
				baseHealing := 0 + spellCoeff*spell.HealingPower(target)
				spell.CalcAndDealHealing(sim, player, baseHealing, spell.OutcomeHealingCrit)
				//Is it worth it to implement the magical, poison and disease dispel? Does that matter?
			}
		},
	})
}
