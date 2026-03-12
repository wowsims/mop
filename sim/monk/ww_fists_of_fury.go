package monk

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

/*
Tooltip:
Pummel all targets in front of you with rapid hand strikes, stunning them and dealing ${7.5*0.89*$<low>} to ${7.5*0.89*$<high>} damage immediately and every 1 sec for 4 sec.
Damage is spread evenly over all targets.

-- Glyph of Fists of Fury --
Your parry chance is increased by 100% while channeling.
-- Glyph of Fists of Fury --
*/
var fofActionID = core.ActionID{SpellID: 113656}
var fofDebuffActionID = core.ActionID{SpellID: 117418}

func fistsOfFuryTickSpellConfig(monk *Monk, pet *StormEarthAndFirePet, overrides core.SpellConfig) core.SpellConfig {
	config := core.SpellConfig{
		ActionID:       fofDebuffActionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagPassiveSpell | core.SpellFlagReadinessTrinket,
		ClassSpellMask: MonkSpellFistsOfFury,
		MaxRange:       core.MaxMeleeRange,

		DamageMultiplier: 7.5 * 0.89,

		ThreatMultiplier: 1,
		CritMultiplier:   monk.DefaultCritMultiplier(),
		ApplyEffects:     overrides.ApplyEffects,
	}

	if pet != nil {
		config.ActionID = fofDebuffActionID.WithTag(SEFSpellID)
	}

	return config
}

func fistsOfFurySpellConfig(monk *Monk, isSEFClone bool, overrides core.SpellConfig) core.SpellConfig {
	config := core.SpellConfig{
		ActionID:       fofActionID,
		Flags:          core.SpellFlagChanneled | SpellFlagSpender | core.SpellFlagAPL,
		SpellSchool:    core.SpellSchoolPhysical,
		ClassSpellMask: MonkSpellFistsOfFury,

		Cast: overrides.Cast,

		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label:    "Fists of Fury" + monk.Label,
				ActionID: fofDebuffActionID,
			},
			NumberOfTicks:        4,
			TickLength:           time.Second * 1,
			AffectedByCastSpeed:  true,
			HasteReducesDuration: true,

			OnTick: overrides.Dot.OnTick,
		},

		ExtraCastCondition: overrides.ExtraCastCondition,

		ApplyEffects: overrides.ApplyEffects,
	}

	if isSEFClone {
		config.ActionID = config.ActionID.WithTag(SEFSpellID)
		config.Dot.Aura.ActionID = config.Dot.Aura.ActionID.WithTag(SEFSpellID)
		config.Flags &= ^(core.SpellFlagChanneled | SpellFlagSpender | core.SpellFlagAPL)
	}

	return config
}

func (monk *Monk) registerFistsOfFury() {
	chiMetrics := monk.NewChiMetrics(fofActionID)
	snapshotDamage := 0.0

	fistsOfFuryTickSpell := monk.RegisterSpell(fistsOfFuryTickSpellConfig(monk, nil, core.SpellConfig{
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			// Damage is split between all mobs, each hit rolls for hit/crit separately
			damagePerMob := snapshotDamage / float64(sim.Environment.ActiveTargetCount())
			spell.CalcAoeDamage(sim, damagePerMob, spell.OutcomeMeleeSpecialHitAndCrit)
			spell.DealBatchedAoeDamage(sim)
		},
	}))

	monk.RegisterSpell(fistsOfFurySpellConfig(monk, false, core.SpellConfig{
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    monk.NewTimer(),
				Duration: time.Second * 25,
			},
		},

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Fists of Fury" + monk.Label,
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					monk.WaitUntil(sim, sim.CurrentTime+monk.ReactionTime)
					monk.AutoAttacks.UpdateSwingTimers(sim)
				},
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				fistsOfFuryTickSpell.Cast(sim, target)
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return monk.GetChi() >= core.TernaryInt32(monk.T16Windwalker4P != nil && monk.T16Windwalker4P.IsActive(), 2, 3)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			monk.SpendChi(sim, core.TernaryInt32(monk.T16Windwalker4P != nil && monk.T16Windwalker4P.IsActive(), 2, 3), chiMetrics)
			if monk.T16Windwalker4P != nil {
				monk.T16Windwalker4P.Deactivate(sim)
			}

			snapshotDamage = monk.CalculateMonkStrikeDamage(sim, spell)
			dot := spell.AOEDot()
			dot.Apply(sim)
			dot.TickOnce(sim)

			expiresAt := dot.ExpiresAt()
			monk.AutoAttacks.DelayMeleeBy(sim, expiresAt-sim.CurrentTime)
		},
	}))
}

func (pet *StormEarthAndFirePet) registerSEFFistsOfFury() {
	snapshotDamage := 0.0
	fistsOfFuryTickSpell := pet.RegisterSpell(fistsOfFuryTickSpellConfig(pet.owner, pet, core.SpellConfig{
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			// Damage is split between all mobs, each hit rolls for hit/crit separately
			damagePerMob := snapshotDamage / float64(sim.Environment.ActiveTargetCount())
			spell.CalcAoeDamage(sim, damagePerMob, spell.OutcomeMeleeSpecialHitAndCrit)
			spell.DealBatchedAoeDamage(sim)
		},
	}))

	pet.RegisterSpell(fistsOfFurySpellConfig(pet.owner, true, core.SpellConfig{
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			IgnoreHaste: true,
		},

		Dot: core.DotConfig{
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				fistsOfFuryTickSpell.Cast(sim, target)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			snapshotDamage = pet.owner.CalculateMonkStrikeDamage(sim, spell)
			dot := spell.AOEDot()
			dot.Apply(sim)
			dot.TickOnce(sim)
		},
	}))
}
