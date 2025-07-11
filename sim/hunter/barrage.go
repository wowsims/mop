package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (hunter *Hunter) registerBarrageSpell() {
	if !hunter.Talents.Barrage {
		return
	}
	var mainTarget *core.Unit
	barrageSpell := core.SpellConfig{
		ActionID:                 core.ActionID{SpellID: 120360},
		SpellSchool:              core.SpellSchoolPhysical,
		ProcMask:                 core.ProcMaskRangedSpecial,
		Flags:                    core.SpellFlagRanged | core.SpellFlagChanneled | core.SpellFlagAPL,
		DamageMultiplier:         1,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,
		CritMultiplier:           hunter.DefaultCritMultiplier(),
		ClassSpellMask:           HunterSpellBarrage,
		MaxRange:                 40,
		FocusCost: core.FocusCostOptions{
			Cost: 30,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{GCD: core.GCDDefault},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: 30 * time.Second,
			},
		},
		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Barrage-" + hunter.Label,
				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					hunter.AutoAttacks.DelayRangedUntil(sim, aura.ExpiresAt())
				},
			},
			NumberOfTicks:        15,
			TickLength:           200 * time.Millisecond,
			AffectedByRealHaste:  true,
			HasteReducesDuration: true,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dmg := hunter.calcBarrageTick(sim, dot.Spell.RangedAttackPower())
				if target == mainTarget {
					dmg *= 2
				}

				dot.Spell.CalcAndDealDamage(sim, target, dmg, dot.Spell.OutcomeRangedHitAndCrit)
			},
		},
		ExpectedTickDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, _ bool) *core.SpellResult {
			dmg := hunter.calcBarrageTick(sim, spell.RangedAttackPower())
			if target == mainTarget {
				dmg *= 2
			}
			return spell.CalcDamage(sim, target, dmg, spell.OutcomeRangedHitAndCrit)
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			mainTarget = target
			spell.ApplyAllDots(sim)
			// We tick the dots once to simulate initial hit
			spell.TickAllDotsOnce(sim)
			spell.CalcAndDealOutcome(sim, target, spell.OutcomeAlwaysHitNoHitCounter)
		},
	}

	hunter.RegisterSpell(barrageSpell)
}

func (hunter *Hunter) calcBarrageTick(sim *core.Simulation, rap float64) float64 {
	return hunter.AutoAttacks.Ranged().CalculateNormalizedWeaponDamage(sim, rap) * 0.2
}
