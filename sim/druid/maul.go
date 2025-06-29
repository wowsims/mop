package druid

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (druid *Druid) registerMaulSpell() {
	maxHits := core.TernaryInt32(druid.HasMajorGlyph(proto.DruidMajorGlyph_GlyphOfMaul), 2, 1)

	druid.Maul = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 6807},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: DruidSpellMaul,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,

		RageCost: core.RageCostOptions{
			Cost:   30,
			Refund: 0.8,
		},
		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    druid.NewTimer(),
				Duration: time.Second * 3,
			},
		},

		DamageMultiplier: 1.1 * core.TernaryFloat64(druid.AssumeBleedActive, RendAndTearDamageMultiplier, 1),
		CritMultiplier:   druid.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		FlatThreatBonus:  30,
		BonusCoefficient: 1,
		MaxRange:         core.MaxMeleeRange,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			numHits := 0

			results := spell.CalcAndDealCleaveDamageWithVariance(sim, target, maxHits, spell.OutcomeMeleeWeaponSpecialHitAndCrit, func(sim *core.Simulation, spell *core.Spell) float64 {
				baseDamage := spell.Unit.MHWeaponDamage(sim, spell.MeleeAttackPower())

				if numHits > 0 {
					baseDamage *= 0.5
				}

				numHits++
				return baseDamage
			})

			if !results.AnyLanded() {
				spell.IssueRefund(sim)
			}
		},
	})
}
