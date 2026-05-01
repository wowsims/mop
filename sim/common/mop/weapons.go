package mop

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {

	// Yaungol Fire Carrier
	core.NewItemEffect(86518, func(agent core.Agent, state proto.ItemLevelState) {
		character := agent.GetCharacter()

		statValue := core.GetItemEffectScalingStatValue(86518, 0.58200001717, state)

		dot := character.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{SpellID: 126211},
			SpellSchool: core.SpellSchoolFire,
			ProcMask:    core.ProcMaskEmpty,
			Flags:       core.SpellFlagIgnoreArmor | core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell,

			DamageMultiplier: 1,
			CritMultiplier:   character.DefaultCritMultiplier(),
			ThreatMultiplier: 1,

			Dot: core.DotConfig{
				Aura: core.Aura{
					Label: "Yaungol Fire",
				},
				NumberOfTicks: 5,
				TickLength:    time.Second * 2,

				OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
					dot.SnapshotPhysical(target, statValue)
				},
				OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
					dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeSnapshotCrit)
				},
			},

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.Dot(target).Apply(sim)
			},
		})

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:               "Yaungol Fire Carrier",
			ActionID:           core.ActionID{SpellID: 126212},
			RequireDamageDealt: true,
			ProcMask:           core.ProcMaskMeleeOrMeleeProc,
			ProcChance:         0.1,
			Outcome:            core.OutcomeLanded,
			Callback:           core.CallbackOnSpellHitDealt,
			TriggerImmediately: true,

			Handler: func(sim *core.Simulation, _ *core.Spell, result *core.SpellResult) {
				dot.Cast(sim, result.Target)
			},
		})
	})
}
