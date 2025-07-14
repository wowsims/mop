package enhancement

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/shaman"
)

func (enh *EnhancementShaman) registerFireNovaSpell() {

	results := make([]core.SpellResultSlice, enh.Env.TotalTargetCount())
	for i := range enh.Env.TotalTargetCount() {
		results[i] = make(core.SpellResultSlice, enh.Env.TotalTargetCount())
	}

	for range enh.Env.TotalTargetCount() {
		nova := enh.RegisterSpell(core.SpellConfig{
			ActionID:       core.ActionID{SpellID: 1535},
			SpellSchool:    core.SpellSchoolFire,
			ProcMask:       core.ProcMaskSpellDamage,
			Flags:          shaman.SpellFlagShamanSpell | core.SpellFlagAoE,
			ClassSpellMask: shaman.SpellMaskFireNova,

			ApplyEffects: func(sim *core.Simulation, mainTarget *core.Unit, spell *core.Spell) {
				for _, target := range sim.Encounter.ActiveTargetUnits {
					if target != mainTarget {
						spell.DealDamage(sim, results[mainTarget.Index][target.Index])
					}
				}
			},
		})
		enh.FireNovas = append(enh.FireNovas, nova)
	}

	enh.FireNova = enh.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 1535},
		SpellSchool:    core.SpellSchoolFire,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          shaman.SpellFlagShamanSpell | core.SpellFlagAPL | core.SpellFlagAoE,
		ClassSpellMask: shaman.SpellMaskFireNova,
		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 13.7,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    enh.NewTimer(),
				Duration: time.Second * time.Duration(4),
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   enh.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: 0.30000001192,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			for _, mainTarget := range sim.Encounter.ActiveTargetUnits {
				//need to calculate damage even from non flame shocked target in case echo procs from it
				for _, target := range sim.Encounter.ActiveTargetUnits {
					if mainTarget != target {
						baseDamage := enh.CalcAndRollDamageRange(sim, 1.43599998951, 0.15000000596)
						results[mainTarget.Index][target.Index] = spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
					}
				}
			}
			for _, mainTarget := range sim.Encounter.ActiveTargetUnits {
				if enh.FlameShock.Dot(mainTarget).IsActive() {
					enh.FireNovas[mainTarget.Index].Cast(sim, mainTarget)
				}
			}
		},
		ExtraCastCondition: func(sim *core.Simulation, _ *core.Unit) bool {
			return enh.FlameShock.AnyDotsActive(sim)
		},
	})
}
