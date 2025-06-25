package fire

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/mage"
)

func (fire *FireMage) registerInfernoBlastSpell() {

	infernoBlastVariance := 0.17   // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=108853 Field: "Variance"
	infernoBlastScaling := .60     // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=108853 Field: "Coefficient"
	infernoBlastCoefficient := .60 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.61217&filter%5BSpellID%5D=108853 Field: "BonusCoefficient"

	hasGlyph := fire.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfInfernoBlast)
	extraTargets := core.Ternary(hasGlyph, 4, 3)
	numTargets := len(fire.Env.Encounter.TargetUnits) - 1
	igniteSpellID := int32(12846)

	fire.InfernoBlast = fire.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 108853},
		SpellSchool:    core.SpellSchoolFire,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: mage.MageSpellInfernoBlast,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 2,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    fire.NewTimer(),
				Duration: time.Second * 8,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   fire.DefaultCritMultiplier(),
		BonusCoefficient: infernoBlastCoefficient,
		ThreatMultiplier: 1,
		BonusCritPercent: 100,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			debuffState := map[int32]core.DotState{}
			dotRefs := []**core.Spell{&fire.Pyroblast.RelatedDotSpell, &fire.Combustion.RelatedDotSpell, &fire.Ignite}
			originalTargetIgniteTimeLeft := time.Duration(0)

			for _, spellRef := range dotRefs {
				dot := (*spellRef).Dot(target)
				if dot.IsActive() {
					debuffState[dot.ActionID.SpellID] = dot.SaveState(sim)
					if dot.ActionID.SpellID == igniteSpellID {
						originalTargetIgniteTimeLeft = dot.RemainingDuration(sim)
					}
				}
			}

			baseDamage := fire.CalcAndRollDamageRange(sim, infernoBlastScaling, infernoBlastVariance)
			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			fire.HandleHeatingUp(sim, spell, result)

			currTarget := target

			for range min(extraTargets, numTargets) {
				currTarget = fire.Env.NextTargetUnit(currTarget)
				for _, spellRef := range dotRefs {
					dot := (*spellRef).Dot(currTarget)
					state, ok := debuffState[dot.ActionID.SpellID]
					if !ok {
						// not stored, was not active
						continue
					}
					if dot.ActionID.SpellID == igniteSpellID {

						ignite := (*spellRef)
						dotActive := dot.IsActive() // Storing this here so we can do the common steps without overwriting how it was for the checks.
						ignite.Proc(sim, currTarget)
						dot.RestoreState(state, sim)

						if dotActive { // Target has ignite -> spread 6 second ignite
							ignite.Dot(currTarget).Apply(sim)
							dot.SnapshotBaseDamage *= .66
						} else if originalTargetIgniteTimeLeft <= time.Duration(time.Second*1) { // Target has no ignite and 1s or less on main -> spread 4 second ignite
							dot.SnapshotBaseDamage *= .5
						} else if originalTargetIgniteTimeLeft > time.Duration(time.Second*1) { // Target has no ignite and 1s+ left on main ignite -> spread 6 second ignite
							ignite.Dot(currTarget).Apply(sim)
							dot.SnapshotBaseDamage *= .66
						}
						continue
					}
					(*spellRef).Proc(sim, currTarget)
					dot.RestoreState(state, sim)
				}
			}
		},
	})
}
