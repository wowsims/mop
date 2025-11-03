package guardian

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

func init() {
}

// T15 Guardian
var ItemSetArmorOfTheHauntedForest = core.NewItemSet(core.ItemSet{
	ID:                      1156,
	DisabledInChallengeMode: true,
	Name:                    "Armor of the Haunted Forest",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Each attack you dodge while Savage Defense is active increases the healing from your next Frenzied Regeneration within 10 sec by 10%, stacking up to 10 times.
			bear := agent.(*GuardianDruid)
			bear.registerImprovedRegeneration(setBonusAura)
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback: core.CallbackOnSpellHitTaken,
				Outcome:  core.OutcomeDodge,

				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if bear.SavageDefenseAura.IsActive() {
						bear.ImprovedRegenerationAura.Activate(sim)
						bear.ImprovedRegenerationAura.AddStack(sim)
					}
				},
			}).ExposeToAPL(138216)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// You generate 50% more Rage from your attacks while Enrage is active.
			bear := agent.(*GuardianDruid)
			bear.Env.RegisterPreFinalizeEffect(func() {
				bear.EnrageAura.ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
					if setBonusAura.IsActive() {
						bear.MultiplyRageGen(1.5)
					}
				})

				bear.EnrageAura.ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
					if setBonusAura.IsActive() {
						bear.MultiplyRageGen(1.0 / 1.5)
					}
				})
			})
		},
	},
})

func (bear *GuardianDruid) registerImprovedRegeneration(setBonusTracker *core.Aura) {
	improveRegenMod := bear.AddDynamicMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellFrenziedRegeneration,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.1,
	})

	bear.ImprovedRegenerationAura = bear.RegisterAura(core.Aura{
		Label:     "Improved Regeneration 2PT15",
		ActionID:  core.ActionID{SpellID: 138217},
		Duration:  time.Second * 10,
		MaxStacks: 10,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			improveRegenMod.Activate()
		},

		OnStacksChange: func(_ *core.Aura, _ *core.Simulation, _, newStacks int32) {
			improveRegenMod.UpdateFloatValue(0.1 * float64(newStacks))
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(druid.DruidSpellFrenziedRegeneration) {
				aura.Deactivate(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			improveRegenMod.Deactivate()
		},
	})
}
