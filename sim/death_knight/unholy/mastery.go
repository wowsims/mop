package unholy

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
)

// Increases all Shadow damage done by (20 + (<Mastery Rating>/600)*2.5)%.
func (uhdk *UnholyDeathKnight) registerMastery() {
	// This needs to be a spell mod since the shadow part of SS ignores all multipliers except for SpellMods.
	// Also, due to how we handle multi schools (or rather, don't), Death Siphon needs a special case here
	masteryMod := uhdk.AddDynamicMod(core.SpellModConfig{
		Kind:              core.SpellMod_DamageDone_Pct,
		School:            core.SpellSchoolShadow,
		ShouldApplyToPets: true,
	})

	uhdk.AddOnMasteryStatChanged(func(sim *core.Simulation, oldMastery float64, newMastery float64) {
		masteryMod.UpdateFloatValue(uhdk.getMasteryPercent(newMastery))
	})

	core.MakePermanent(uhdk.RegisterAura(core.Aura{
		Label:    "Dreadblade" + uhdk.Label,
		ActionID: core.ActionID{SpellID: 77515},

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			masteryMod.UpdateFloatValue(uhdk.getMasteryPercent(uhdk.GetStat(stats.MasteryRating)))
			masteryMod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			masteryMod.Deactivate()
		},
	}))
}

func (uhdk *UnholyDeathKnight) getMasteryPercent(masteryRating float64) float64 {
	return 0.2 + 0.025*core.MasteryRatingToMasteryPoints(masteryRating)
}
