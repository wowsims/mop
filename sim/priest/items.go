package priest

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
)

// T14 - Shadow
var ItemSetRegaliaOfTheGuardianSperpent = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of the Guardian Serpent",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_BonusCrit_Percent,
				ClassMask:  PriestSpellShadowWordPain,
				FloatValue: 10,
			}).ExposeToAPL(123114)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_DotNumberOfTicks_Flat,
				ClassMask: PriestSpellShadowWordPain | PriestSpellVampiricTouch,
				IntValue:  1,
			}).ExposeToAPL(123115)
		},
	},
})

var ItemSetRegaliaOfTheExorcist = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of the Exorcist",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			priest := agent.(PriestAgent).GetPriest()

			setBonusAura.MaxStacks = math.MaxInt32

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:           "Regalia of the Exorcist - 2P",
				SpellFlags:     core.SpellFlagPassiveSpell,
				ProcChance:     0.65,
				ClassSpellMask: PriestSpellShadowyApparation,
				Callback:       core.CallbackOnSpellHitDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					setBonusAura.AddStack(sim)

					if priest.ShadowWordPain != nil && priest.ShadowWordPain.Dot(result.Target).IsActive() {
						dot := priest.ShadowWordPain.Dot(result.Target)
						if priest.T15_2PC_ExtensionTracker[result.Target.Index].Swp <= sim.CurrentTime {
							dot.DurationExtendSnapshot(sim, dot.CalcTickPeriod())
						} else {
							dot.AddTick()
						}
					}

					if priest.VampiricTouch != nil && priest.VampiricTouch.Dot(result.Target).IsActive() {
						dot := priest.VampiricTouch.Dot(result.Target)
						if priest.T15_2PC_ExtensionTracker[result.Target.Index].VT <= sim.CurrentTime {
							dot.DurationExtendSnapshot(sim, dot.CalcTickPeriod())
						} else {
							dot.AddTick()
						}
					}
				},
			}).ExposeToAPL(138156)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			priest := agent.(PriestAgent).GetPriest()
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:           "Regalia of the Exorcist - 4P",
				ProcMask:       core.ProcMaskSpellDamage,
				ProcChance:     0.1,
				ClassSpellMask: PriestSpellVampiricTouch,
				Outcome:        core.OutcomeLanded,
				Callback:       core.CallbackOnPeriodicDamageDealt,
				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					priest.ShadowyApparition.Cast(sim, result.Target)
				},
			}).ExposeToAPL(138158)
		},
	},
})

var ItemSetRegaliaOfTheTernionGlory = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of Ternion Glory",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_CritMultiplier_Flat,
				FloatValue: 0.4,
				ClassMask:  PriestSpellShadowyRecall,
			}).ExposeToAPL(145174)
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			priest := agent.(PriestAgent).GetPriest()
			mod := priest.Unit.AddDynamicMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				FloatValue: 0.2,
				ClassMask:  PriestSpellShadowWordDeath | PriestSpellMindSpike | PriestSpellMindBlast,
			})

			var orbsSpend float64 = 0
			priest.Unit.GetSecondaryResourceBar().RegisterOnSpend(func(_ *core.Simulation, amount float64, _ core.ActionID) {
				orbsSpend = amount
			})

			aura := priest.Unit.RegisterAura(core.Aura{
				Label:    "Regalia of the Ternion Glory - 4P (Proc)",
				ActionID: core.ActionID{SpellID: 145180},
				Duration: time.Second * 12,
				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					mod.UpdateFloatValue(0.2 * float64(orbsSpend))
					mod.Activate()
				},
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					mod.Deactivate()
				},
				OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
					if !spell.Matches(PriestSpellMindBlast | PriestSpellMindSpike | PriestSpellShadowWordDeath) {
						return
					}

					aura.Deactivate(sim)
				},
			})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:           "Regalia of the Ternion Glory - 4P",
				Outcome:        core.OutcomeLanded,
				Callback:       core.CallbackOnSpellHitDealt,
				ClassSpellMask: PriestSpellDevouringPlague,
				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					aura.Activate(sim)
				},
			}).ExposeToAPL(145179)
		},
	},
})

func init() {
}
