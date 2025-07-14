package retribution

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/paladin"
)

/*
An area attack that consumes 3 charges of Holy Power to cause 100% weapon damage as Holy damage to all enemies within 8 yards.

-- Glyph of Divine Storm --
Using Divine Storm will also heal you for 5% of your maximum health.
-- /Glyph of Divine Storm --
*/
func (ret *RetributionPaladin) registerDivineStorm() {
	actionID := core.ActionID{SpellID: 53385}

	ret.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL | core.SpellFlagAoE,
		ClassSpellMask: paladin.SpellMaskDivineStorm,

		MaxRange: 8,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			IgnoreHaste: true,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return ret.DivineCrusaderAura.IsActive() || ret.HolyPower.CanSpend(3)
		},

		DamageMultiplier: 1,
		CritMultiplier:   ret.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.CalcAoeDamageWithVariance(sim, spell.OutcomeMeleeSpecialHitAndCrit, func(sim *core.Simulation, spell *core.Spell) float64 {
				return ret.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower())
			})

			if !ret.DivineCrusaderAura.IsActive() {
				ret.HolyPower.Spend(sim, 3, actionID)
			}

			spell.DealBatchedAoeDamage(sim)
		},
	})
}
