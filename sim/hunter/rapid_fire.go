package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (hunter *Hunter) registerRapidFireCD() {
	actionID := core.ActionID{SpellID: 3045}

	focusMetrics := hunter.NewFocusMetrics(core.ActionID{SpellID: 53232})
	hasteMultiplier := 1.4

	rapidFireAura := hunter.RegisterAura(core.Aura{
		Label:    "Rapid Fire",
		ActionID: actionID,
		Duration: time.Second * 15,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.MultiplyRangedHaste(sim, hasteMultiplier)

			core.StartPeriodicAction(sim, core.PeriodicActionOptions{
				Period:   time.Second * 3,
				NumTicks: 5,
				OnAction: func(sim *core.Simulation) {
					if hunter.Spec == proto.Spec_SpecMarksmanshipHunter {
						hunter.AddFocus(sim, 12, focusMetrics)
					}
				},
			})

		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.MultiplyRangedHaste(sim, 1/hasteMultiplier)
		},
	})

	rapidFire := hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: HunterSpellRapidFire,
		Flags:          core.SpellFlagReadinessTrinket,
		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: time.Minute * 3,
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return hunter.GCD.IsReady(sim)
		},
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			rapidFireAura.Activate(sim)
		},
	})

	hunter.AddMajorCooldown(core.MajorCooldown{
		Spell: rapidFire,
		Type:  core.CooldownTypeDPS,
	})
}
