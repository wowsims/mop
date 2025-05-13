package protection

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/paladin"
)

func (prot *ProtectionPaladin) registerHolyWrath() {
	scalingCoef := 7.53200006485
	variance := 0.1099999994

	var numTargets int32
	if prot.HasMinorGlyph(proto.PaladinMinorGlyph_GlyphOfFocusedWrath) {
		numTargets = 1
	} else {
		numTargets = prot.Env.GetNumTargets()
	}

	hasFinalWrath := prot.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfFinalWrath)

	prot.HolyWrath = prot.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 2812},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: paladin.SpellMaskHolyWrath,

		MissileSpeed: 40,
		MaxRange:     10,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 5,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    prot.NewTimer(),
				Duration: 9 * time.Second,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   prot.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			results := make([]*core.SpellResult, numTargets)
			baseDamage := prot.CalcAndRollDamageRange(sim, scalingCoef, variance) + 0.91*spell.MeleeAttackPower()

			// Damage is split between all mobs, each hit rolls for hit/crit separately
			baseDamage /= float64(numTargets)

			for idx := int32(0); idx < numTargets; idx++ {
				currentTarget := sim.Environment.GetTargetUnit(idx)

				multiplier := spell.DamageMultiplier
				if hasFinalWrath && currentTarget.CurrentHealthPercent() < 0.2 {
					spell.DamageMultiplier *= 1.5
				}

				results[idx] = spell.CalcDamage(sim, currentTarget, baseDamage, spell.OutcomeMagicHitAndCrit)

				spell.DamageMultiplier = multiplier
			}

			spell.WaitTravelTime(sim, func(simulation *core.Simulation) {
				for idx := int32(0); idx < numTargets; idx++ {
					spell.DealDamage(sim, results[idx])
				}
			})
		},
	})
}
