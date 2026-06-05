package affliction

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

func (affliction *AfflictionWarlock) registerMaleficEffect() {
	var procDot *core.Dot
	buildSpell := func(id int32, tag int32, additionalApplyEffect core.ApplySpellResults) *core.Spell {
		return affliction.RegisterSpell(core.SpellConfig{
			ActionID:       core.ActionID{SpellID: id}.WithTag(tag),
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

				if additionalApplyEffect != nil {
					additionalApplyEffect(sim, target, spell)
				}

				// Adjust metrics just for Malefic Effects as it is a edgecase and needs to be handled manually
				if result.DidCrit() {
					spell.SpellMetrics[result.Target.UnitIndex].CritTicks++
				} else {
					spell.SpellMetrics[result.Target.UnitIndex].Ticks++
				}
			},
		})
	}

	// Build proc variants for each source spell (Drain Soul, Malefic Grasp)
	type procVariant struct {
		procTable map[*core.Spell]**core.Spell
		procKeys  []*core.Spell
	}

	variants := make(map[*core.Spell]*procVariant)

	// Spell IDs for the proc effects (tag) with their apply effects
	dotSpells := []struct {
		spellID               int32
		dotRef                **core.Spell
		additionalApplyEffect core.ApplySpellResults
	}{
		{spellID: affliction.Corruption.SpellID, dotRef: &affliction.Corruption, additionalApplyEffect: nil},
		{spellID: affliction.Agony.SpellID, dotRef: &affliction.Agony, additionalApplyEffect: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			procDot.AddStack(sim)
		}},
		{spellID: affliction.UnstableAffliction.SpellID, dotRef: &affliction.UnstableAffliction, additionalApplyEffect: nil},
	}

	sourceSpells := []*core.Spell{affliction.DrainSoul, affliction.MaleficGrasp}
	for _, sourceSpell := range sourceSpells {
		sourceSpellID := sourceSpell.ActionID.SpellID
		procTable := make(map[*core.Spell]**core.Spell)
		procKeys := make([]*core.Spell, 0, len(dotSpells))

		for _, dot := range dotSpells {
			proc := buildSpell(sourceSpellID, dot.spellID, dot.additionalApplyEffect)
			procTable[proc] = dot.dotRef
			procKeys = append(procKeys, proc)
		}

		variants[sourceSpell] = &procVariant{
			procTable: procTable,
			procKeys:  procKeys,
		}
	}

	affliction.ProcMaleficEffect = func(sourceSpell *core.Spell, target *core.Unit, coeff float64, sim *core.Simulation) {
		variant := variants[sourceSpell]
		if variant == nil {
			return
		}
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

		for _, proc := range variant.procKeys {
			source := variant.procTable[proc]
			dot := (*source).Dot(target)
			if !dot.IsActive() {
				continue
			}
			proc.BonusSpellPower = calculateDoTBaseTickDamage(dot, target) * dot.PeriodicDamageMultiplier * coeff
			procDot = dot
			proc.Cast(sim, target)
		}
	}
}
