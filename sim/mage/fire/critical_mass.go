package fire

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/mage"
)

func (fire *FireMage) registerCriticalMass() {

	getCritPercent := func(isPyroblast bool) float64 {
		pyroblastCritChance := core.TernaryFloat64(isPyroblast && fire.T15_4pc != nil && fire.T15_4pc.IsActive(), 5, 0)
		return pyroblastCritChance + ((fire.GetStat(stats.SpellCritPercent) + pyroblastCritChance) * fire.criticalMassMultiplier)
	}

	criticalMassCritBuffMod := fire.AddDynamicMod(core.SpellModConfig{
		FloatValue: getCritPercent(false),
		ClassMask:  mage.MageSpellFireball | mage.MageSpellFrostfireBolt | mage.MageSpellScorch,
		Kind:       core.SpellMod_BonusCrit_Percent,
	})

	// Separate mod for Pyroblast since it has a different crit bonus from T15 4-piece
	// which is additive and Critical Mass is multiplicative.
	criticalMassPyroCritBuffMod := fire.AddDynamicMod(core.SpellModConfig{
		FloatValue: getCritPercent(true),
		ClassMask:  mage.MageSpellPyroblast | mage.MageSpellPyroblastDot,
		Kind:       core.SpellMod_BonusCrit_Percent,
	})

	core.MakePermanent(fire.RegisterAura(core.Aura{
		Label: "Critical Mass",
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			criticalMassCritBuffMod.Activate()
			criticalMassPyroCritBuffMod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			criticalMassCritBuffMod.Deactivate()
			criticalMassPyroCritBuffMod.Deactivate()
		},
	}))

	fire.AddOnTemporaryStatsChange(func(sim *core.Simulation, buffAura *core.Aura, statsChangeWithoutDeps stats.Stats) {
		criticalMassCritBuffMod.UpdateFloatValue(getCritPercent(false))
		criticalMassPyroCritBuffMod.UpdateFloatValue(getCritPercent(true))
	})

	fire.RegisterResetEffect(func(sim *core.Simulation) {
		criticalMassCritBuffMod.UpdateFloatValue(getCritPercent(false))
		criticalMassPyroCritBuffMod.UpdateFloatValue(getCritPercent(true))
	})
}
