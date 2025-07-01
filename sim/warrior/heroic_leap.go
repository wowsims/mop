package warrior

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (war *Warrior) registerHeroicLeap() {
	war.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 6544},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagAoE | core.SpellFlagMeleeMetrics | core.SpellFlagAPL | core.SpellFlagReadinessTrinket,
		ClassSpellMask: SpellMaskHeroicLeap,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{},
			CD: core.Cooldown{
				Timer:    war.NewTimer(),
				Duration: time.Second * 45,
			},
			ModifyCast: func(sim *core.Simulation, spell *core.Spell, cast *core.Cast) {
				war.AutoAttacks.StopMeleeUntil(sim, sim.CurrentTime+cast.CastTime)
			},
			IgnoreHaste: true,
		},
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   war.DefaultCritMultiplier(),

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			baseDamage := 1 + 0.5*spell.MeleeAttackPower()
			results := spell.CalcAoeDamage(sim, baseDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)
			war.CastNormalizedSweepingStrikesAttack(results, sim)
			spell.DealBatchedAoeDamage(sim)
		},
	})
}
