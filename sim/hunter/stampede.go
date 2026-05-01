package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (hunter *Hunter) RegisterStampedeSpell() {
	actionID := core.ActionID{SpellID: 121818}
	stampedeSpell := hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: HunterSpellStampede,
		Flags:          core.SpellFlagReadinessTrinket,
		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: time.Minute * 5,
			},
		},
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			varianceRoll := time.Duration(sim.Roll(000, 800))
			summonDuration := time.Second*20 + time.Millisecond*varianceRoll
			for _, pet := range hunter.StampedePet {
				pet.EnableWithTimeout(sim, pet, summonDuration)
			}
		},
	})

	hunter.AddMajorCooldown(core.MajorCooldown{
		Spell: stampedeSpell,
		Type:  core.CooldownTypeDPS,
	})
}
