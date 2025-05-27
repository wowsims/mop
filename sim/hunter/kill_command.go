package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
)

func (hunter *Hunter) registerKillCommandSpell() {
	if hunter.Pet == nil {
		return
	}

	actionID := core.ActionID{SpellID: 34026}

	hunter.KillCommand = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMelee,
		ClassSpellMask: HunterSpellKillCommand,
		Flags:          core.SpellFlagAPL,

		FocusCost: core.FocusCostOptions{
			Cost: 40,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: time.Second * 6,
			},
		},
		DamageMultiplierAdditive: 1,
		CritMultiplier:           hunter.DefaultCritMultiplier(),
		ThreatMultiplier:         1,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if hunter.Pet != nil && hunter.Pet.KillCommand != nil {
				hunter.Pet.KillCommand.Cast(sim, target)
			}
		},
	})
}
