package affliction

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

func (affliction *AfflictionWarlock) registerMaleficEffect() {
	var procDot *core.Dot
	buildSpell := func(id int32) *core.Spell {
		return affliction.RegisterSpell(core.SpellConfig{
			ActionID:       core.ActionID{SpellID: id}.WithTag(1),
			Flags:          core.SpellFlagPassiveSpell | core.SpellFlagNoOnCastComplete | core.SpellFlagNoSpellMods | core.SpellFlagIgnoreAttackerModifiers,
			SpellSchool:    core.SpellSchoolShadow,
			ProcMask:       core.ProcMaskSpellDamage,
			ClassSpellMask: warlock.WarlockSpellMaleficGrasp,

			ThreatMultiplier: 1,
			DamageMultiplier: 1,
			CritMultiplier:   affliction.DefaultCritMultiplier(),
			BonusSpellPower:  0, // used to transmit base damage
			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				result := spell.CalcDamage(sim, target, spell.BonusSpellPower, procDot.OutcomeTickMagicCritNoHitCounter)
				spell.DealPeriodicDamage(sim, result)

				// Adjust metrics just for Malefic Effects as it is a edgecase and needs to be handled manually
				if result.DidCrit() {
					spell.SpellMetrics[result.Target.UnitIndex].CritTicks++
				} else {
					spell.SpellMetrics[result.Target.UnitIndex].Ticks++
				}
			},
		})
	}

	corruptionProc := buildSpell(172)
	agonyProc := buildSpell(980)
	uaProc := buildSpell(30108)

	procTable := map[*core.Spell]**core.Spell{
		corruptionProc: &affliction.Corruption,
		agonyProc:      &affliction.Agony,
		uaProc:         &affliction.UnstableAffliction,
	}

	// used to iterate over the map in constant order
	procKeys := []*core.Spell{corruptionProc, agonyProc, uaProc}
	affliction.ProcMaleficEffect = func(target *core.Unit, coeff float64, sim *core.Simulation) {
		if affliction.T16_2pc_Snapshot {
			coeff += 0.15
		}

		// I don't like it but if sac is specced the damage replication effect specifically is increased by 20%
		// Nothing we can do really properly with SpellMod's here nicely
		if affliction.Talents.GrimoireOfSacrifice {
			coeff *= 1.2
		}

		if affliction.T15_4pc.IsActive() {
			coeff *= 1.05
		}

		for _, proc := range procKeys {
			source := procTable[proc]
			dot := (*source).Dot(target)
			if !dot.IsActive() {
				continue
			}

			proc.BonusSpellPower = calculateDoTBaseTickDamage(dot, target) * coeff
			procDot = dot
			proc.Cast(sim, target)
		}
	}
}
