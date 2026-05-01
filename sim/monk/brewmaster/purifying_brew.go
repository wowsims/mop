package brewmaster

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/monk"
)

func (bm *BrewmasterMonk) registerPurifyingBrew() {
	actionID := core.ActionID{SpellID: 119582}
	chiMetrics := bm.NewChiMetrics(actionID)
	t16Brewmaster4PHeal := bm.NewHealthMetrics(core.ActionID{SpellID: 145056})
	chiCost := int32(1)

	bm.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          monk.SpellFlagSpender | core.SpellFlagAPL,
		ClassSpellMask: monk.MonkSpellPurifyingBrew,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    bm.NewTimer(),
				Duration: time.Second * 1,
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return bm.StanceMatches(monk.SturdyOx) && (bm.GetChi() >= 1 || (bm.T15Brewmaster4PProcEffect != nil && bm.T15Brewmaster4PProcEffect.IsActive()))
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			outstandingDamage := bm.Stagger.SelfHot().OutstandingDmg()
			bm.RefreshStagger(sim, &bm.Unit, 0.0)
			if bm.T15Brewmaster4PProcEffect != nil && bm.T15Brewmaster4PProcEffect.IsActive() {
				bm.T15Brewmaster4PProcEffect.Deactivate(sim)
			} else {
				bm.SpendChi(sim, chiCost, chiCost, chiMetrics)
			}
			if bm.T16Brewmaster4P != nil && bm.T16Brewmaster4P.IsActive() {
				bm.GainHealth(sim, outstandingDamage*0.15, t16Brewmaster4PHeal)
			}
		},
	})
}
