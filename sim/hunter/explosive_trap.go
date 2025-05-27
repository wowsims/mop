package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (hunter *Hunter) registerExplosiveTrapSpell(timer *core.Timer) {
	bonusPeriodicDamageMultiplier := core.TernaryFloat64(hunter.Spec == proto.Spec_SpecSurvivalHunter, 0.30, 0)

	hunter.ExplosiveTrap = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 13812},
		SpellSchool:    core.SpellSchoolFire,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: HunterSpellExplosiveTrap,
		Flags:          core.SpellFlagAPL,

		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			CD: core.Cooldown{
				Timer:    timer,
				Duration: time.Second * 30,
			},
		},

		DamageMultiplierAdditive: 1,
		CritMultiplier:           hunter.CritMultiplier(1, 0),
		ThreatMultiplier:         1,

		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label: "Explosive Trap",
			},
			NumberOfTicks: 10,
			TickLength:    time.Second * 2,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				baseDamage := (27) + (0.03819999844 * dot.Spell.RangedAttackPower())
				dot.Spell.DamageMultiplierAdditive += bonusPeriodicDamageMultiplier
				for _, aoeTarget := range sim.Encounter.TargetUnits {
					dot.Spell.CalcAndDealPeriodicDamage(sim, aoeTarget, baseDamage/10, dot.Spell.OutcomeRangedHitAndCritNoBlock)
				}
				dot.Spell.DamageMultiplierAdditive -= bonusPeriodicDamageMultiplier
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if sim.CurrentTime < 0 {
				// Traps only last 60s.
				if sim.CurrentTime < -time.Second*60 {
					return
				}

				// If using this on prepull, the trap effect will go off when the fight starts
				// instead of immediately.
				core.StartDelayedAction(sim, core.DelayedActionOptions{
					DoAt: 0,
					OnAction: func(sim *core.Simulation) {
						for _, aoeTarget := range sim.Encounter.TargetUnits {
							baseDamage := (109 + sim.RandomFloat("Explosive Trap Initial")*125) + (0.03819999844 * spell.RangedAttackPower())
							baseDamage *= sim.Encounter.AOECapMultiplier()
							baseDamage *= core.TernaryFloat64(hunter.Spec == proto.Spec_SpecSurvivalHunter, 1.3, 1)
							spell.CalcAndDealDamage(sim, aoeTarget, baseDamage, spell.OutcomeRangedHitAndCritNoBlock)
						}
						hunter.ExplosiveTrap.AOEDot().Apply(sim)
					},
				})
			} else {
				for _, aoeTarget := range sim.Encounter.TargetUnits {
					baseDamage := (109 + sim.RandomFloat("Explosive Trap Initial")*125) + (0.03819999844 * spell.RangedAttackPower())
					baseDamage *= sim.Encounter.AOECapMultiplier()
					baseDamage *= core.TernaryFloat64(hunter.Spec == proto.Spec_SpecSurvivalHunter, 1.3, 1)
					spell.CalcAndDealDamage(sim, aoeTarget, baseDamage, spell.OutcomeRangedHitAndCritNoBlock)
				}
				hunter.ExplosiveTrap.AOEDot().Apply(sim)
			}
		},
	})
}
