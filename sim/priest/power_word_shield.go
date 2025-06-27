package priest

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerPowerWordShieldSpell() {
	coeff := 18.515

	var glyphHeal *core.Spell

	priest.PowerWordShield = priest.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 17},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagHelpful | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 6.1,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return !priest.WeakenedSouls.Get(target).IsActive()
		},

		DamageMultiplier: 1,
		CritMultiplier:   priest.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		Shield: core.ShieldConfig{
			Aura: core.Aura{
				Label:    "Power Word Shield",
				Duration: time.Second * 30,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			shieldAmount := 2 + coeff*spell.HealingPower(target)
			shield := spell.Shield(target)
			shield.Apply(sim, shieldAmount)

			weakenedSoul := priest.WeakenedSouls.Get(target)
			weakenedSoul.Duration = time.Second * 15
			weakenedSoul.Activate(sim)

			if glyphHeal != nil {
				glyphHeal.Cast(sim, target)
			}
		},
	})

	priest.WeakenedSouls = priest.NewAllyAuraArray(func(target *core.Unit) *core.Aura {
		return target.GetOrRegisterAura(core.Aura{
			Label:    "Weakened Soul",
			ActionID: core.ActionID{SpellID: 6788},
			Duration: time.Second * 15,
		})
	})

	if priest.HasMajorGlyph(proto.PriestMajorGlyph_GlyphOfPowerWordShield) {
		glyphHeal = priest.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{ItemID: 56160},
			SpellSchool: core.SpellSchoolHoly,
			ProcMask:    core.ProcMaskSpellHealing,
			Flags:       core.SpellFlagHelpful,

			// Talent effects are combined differently in this spell compared to PWS, for some reason.
			DamageMultiplier: 0.2,
			ThreatMultiplier: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				baseHealing := 2 + coeff*spell.HealingPower(target)
				spell.CalcAndDealHealing(sim, target, baseHealing, spell.OutcomeAlwaysHit)
			},
		})
	}
}
