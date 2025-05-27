package survival

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/hunter"
)

func (svHunter *SurvivalHunter) registerBlackArrowSpell(timer *core.Timer) {
	actionID := core.ActionID{SpellID: 3674}

	svHunter.Hunter.BlackArrow = svHunter.Hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskRangedSpecial,
		ClassSpellMask: hunter.HunterSpellBlackArrow,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		FocusCost: core.FocusCostOptions{
			Cost: 35,
		},
		MissileSpeed: 40,
		MinRange:     0,
		MaxRange:     40,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			IgnoreHaste: true, // Hunter GCD is locked at 1.5s
			CD: core.Cooldown{
				Timer:    timer,
				Duration: time.Second * 24, // 24 with trap mastery for survival
			},
		},
		DamageMultiplier: 1.3,
		ThreatMultiplier: 1,
		CritMultiplier:   svHunter.DefaultCritMultiplier(),

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Black Arrow Dot",
			},
			NumberOfTicks:       10,
			TickLength:          time.Second * 2,
			AffectedByCastSpeed: false,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				baseDmg := svHunter.Hunter.GetBaseDamageFromCoeff(0.126) + 0.26*dot.Spell.RangedAttackPower()
				dot.Snapshot(target, baseDmg)
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeTickPhysicalCrit)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeRangedHit)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				if result.Landed() {
					spell.Dot(target).Apply(sim)
				}
			})
		},
	})
}
