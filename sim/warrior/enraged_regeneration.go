package warrior

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (war *Warrior) registerEnragedRegeneration() {
	actionID := core.ActionID{SpellID: 55694}
	healthMetrics := war.NewHealthMetrics(actionID)

	var bonusHealth float64
	aura := war.RegisterAura(core.Aura{
		Label:    "Enraged Regeneration",
		ActionID: actionID,
		Duration: time.Second * 10,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			isEnraged := war.EnrageAura != nil && war.EnrageAura.IsActive()
			bonusHealth = war.MaxHealth() * 0.1 * core.TernaryFloat64(isEnraged, 2, 1)
			war.GainHealth(sim, bonusHealth, healthMetrics)
			core.StartPeriodicAction(sim, core.PeriodicActionOptions{
				NumTicks: 5,
				Period:   time.Second,
				OnAction: func(sim *core.Simulation) {
					war.GainHealth(sim, bonusHealth/5, healthMetrics)
				},
				CleanUp: func(sim *core.Simulation) {
					aura.Deactivate(sim)
				},
			})
		},
	})

	spell := war.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: SpellMaskEnragedRegeneration,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    war.NewTimer(),
				Duration: time.Minute * 1,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			aura.Activate(sim)
		},
	})

	war.AddMajorCooldown(core.MajorCooldown{
		Spell:    spell,
		Type:     core.CooldownTypeSurvival,
		Priority: core.CooldownPriorityLow,
		ShouldActivate: func(s *core.Simulation, c *core.Character) bool {
			return war.CurrentHealthPercent() < 0.8
		},
	})
}
