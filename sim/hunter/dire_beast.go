package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (hunter *Hunter) RegisterDireBeastSpell() {
	if !hunter.Talents.DireBeast {
		return
	}
	actionID := core.ActionID{SpellID: 120679}
	direBeastSpell := hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: HunterSpellDireBeast,
		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: time.Second * 30,
			},
		},
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			// Time in milliseconds of leeway after the tooltip duration
			varianceRoll := time.Duration(sim.Roll(0, 800))
			summonDuration := time.Second*15 + time.Millisecond*varianceRoll
			hunter.DireBeastPet.EnableWithTimeout(sim, hunter.DireBeastPet, summonDuration)
		},
	})

	hunter.AddMajorCooldown(core.MajorCooldown{
		Spell: direBeastSpell,
		Type:  core.CooldownTypeDPS,
	})
}
