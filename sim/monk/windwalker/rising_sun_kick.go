package windwalker

import (
	"time"

	"github.com/wowsims/cata/sim/core"
	"github.com/wowsims/cata/sim/monk"
)

/*
Tooltip:
You kick upwards, dealing ${14.4*0.89*$<low>} to ${14.4*0.89*$<high>} damage and applying Mortal Wounds to the target.
Also causes all targets within 8 yards to take an increased 20% damage from your abilities for 15 sec.

-- Mortal Wounds --
Grievously wounds the target, reducing the effectiveness of any healing received for 10 sec.
-- Mortal Wounds --
*/
func (ww *WindwalkerMonk) registerRisingSunKick() {
	actionID := core.ActionID{SpellID: 130320}
	chiMetrics := ww.NewChiMetrics(actionID)

	risingSunKickDebuff := ww.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return target.GetOrRegisterAura(core.Aura{
			Label:    "Rising Sun Kick" + target.Label,
			ActionID: actionID,
			Duration: time.Second * 15,
			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.PseudoStats.DamageTakenMultiplier *= 1.2
			},
			OnExpire: func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.PseudoStats.DamageTakenMultiplier /= 1.2
			},
		})
	})

	ww.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagIncludeTargetBonusDamage | monk.SpellFlagSpender | core.SpellFlagAPL,
		ClassSpellMask: monk.MonkSpellRisingSunKick,
		MaxRange:       core.MaxMeleeRange,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    ww.NewTimer(),
				Duration: time.Second * 8,
			},
		},

		DamageMultiplier: 14.4 * 0.89,
		ThreatMultiplier: 1,
		CritMultiplier:   ww.DefaultMeleeCritMultiplier(),

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return ww.ComboPoints() >= 2
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := ww.CalculateMonkStrikeDamage(sim, spell)

			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if result.Landed() {
				ww.SpendChi(sim, 2, chiMetrics)
				for _, target := range sim.Encounter.TargetUnits {
					risingSunKickDebuff.Get(target).Activate(sim)
				}
			}
		},
	})
}
