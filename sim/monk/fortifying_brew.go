package monk

import (
	"time"

	"github.com/wowsims/cata/sim/core"
	"github.com/wowsims/cata/sim/core/proto"
)

func (monk *Monk) registerFortifyingBrew() {
	actionID := core.ActionID{SpellID: 126456}
	healthMetrics := monk.NewHealthMetrics(actionID)

	hasGlyphOfFortifyingBrew := monk.HasMajorGlyph(proto.MonkMajorGlyph_MonkMajorGlyphFortifyingBrew)
	healthModifier := core.TernaryFloat64(hasGlyphOfFortifyingBrew, 0.10, 0.20)
	damageTakenModifier := core.TernaryFloat64(hasGlyphOfFortifyingBrew, 0.75, 0.8)

	var bonusHealth float64
	fortifyingBrewAura := monk.RegisterAura(core.Aura{
		Label:    "Fortifying Brew" + monk.Label,
		ActionID: actionID,
		Duration: time.Second * 20,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			bonusHealth = monk.MaxHealth() * healthModifier
			monk.PseudoStats.DamageTakenMultiplier *= damageTakenModifier
			monk.UpdateMaxHealth(sim, bonusHealth, healthMetrics)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			monk.UpdateMaxHealth(sim, -bonusHealth, healthMetrics)
			monk.PseudoStats.DamageTakenMultiplier /= damageTakenModifier
		},
	})

	monk.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          core.SpellFlagNoOnCastComplete | core.SpellFlagAPL,
		ClassSpellMask: MonkSpellFortifyingBrew,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    monk.NewTimer(),
				Duration: time.Minute * 3,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			fortifyingBrewAura.Activate(sim)
		},
	})
}
