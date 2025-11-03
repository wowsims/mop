package mop

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func init() {
	// Keep these in order by item ID
	// Agile Primal Diamond
	core.NewItemEffect(76884, core.ApplyMetaGemCriticalDamageEffect)
	// Burning Primal Diamond
	core.NewItemEffect(76885, core.ApplyMetaGemCriticalDamageEffect)
	// Reverberating Primal Diamond
	core.NewItemEffect(76886, core.ApplyMetaGemCriticalDamageEffect)
	// Revitalizing Primal Diamond
	core.NewItemEffect(76888, core.ApplyMetaGemCriticalDamageEffect)

	// Austere Primal Diamond
	core.NewItemEffect(76895, func(agent core.Agent, _ proto.ItemLevelState) {
		character := agent.GetCharacter()
		character.ApplyEquipScaling(stats.Armor, 1.02)
	})

	// Capacitive Primal Diamond
	// Chance on striking with a melee or ranged attack to gain Capacitance.
	// When Capacitance reaches 0 charges, you will deal a Lightning Strike to your current target for 100 Nature damage.
	// (Approximately [19.27 + Haste] procs per minute)
	core.NewItemEffect(95346, func(agent core.Agent, _ proto.ItemLevelState) {
		character := agent.GetCharacter()
		var target *core.Unit

		lightningStrike := character.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{SpellID: 137597},
			SpellSchool: core.SpellSchoolNature,
			// @TODO: TEST ON PTR: See if weapon enchants can/cannot be procced by this spell.
			ProcMask: core.ProcMaskMeleeProc,
			Flags:    core.SpellFlagNoOnCastComplete,

			MaxRange: 45,

			DamageMultiplier: 1,
			CritMultiplier:   character.DefaultCritMultiplier(),
			ThreatMultiplier: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				baseDamage := sim.Roll(core.CalcScalingSpellEffectVarianceMinMax(proto.Class_ClassUnknown, 0.13300000131, 0.15000000596))
				apDamage := 0.75 * core.Ternary(spell.IsRanged(), spell.RangedAttackPower(), spell.MeleeAttackPower())

				outcome := core.Ternary(spell.IsRanged(), spell.OutcomeRangedHitAndCritNoBlock, spell.OutcomeMeleeSpecialNoBlockDodgeParry)
				spell.CalcAndDealDamage(sim, target, baseDamage+apDamage, outcome)
			},
		})

		capacitanceAura := character.RegisterAura(core.Aura{
			Label:     "Capacitance",
			ActionID:  core.ActionID{SpellID: 137596},
			Duration:  time.Minute * 1,
			MaxStacks: 5,
			OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks int32, newStacks int32) {
				if newStacks == aura.MaxStacks {
					lightningStrike.Cast(sim, target)
					aura.SetStacks(sim, 0)
				}
			},
		})

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:               "Lightning Strike Charges Trigger",
			ActionID:           core.ActionID{SpellID: 137595},
			RequireDamageDealt: true,
			Callback:           core.CallbackOnSpellHitDealt,
			Outcome:            core.OutcomeLanded,
			DPM: character.NewRPPMProcManager(95346, false, true, core.ProcMaskMeleeOrRanged, core.RPPMConfig{
				PPM: 19.27000045776,
			}.WithHasteMod().
				// https://wago.tools/db2/SpellProcsPerMinuteMod?build=5.5.0.60548&filter%5BSpellProcsPerMinuteID%5D=51&filter%5BType%5D=4&page=1&sort%5BParam%5D=asc
				WithSpecMod(-0.40000000596, proto.Spec_SpecProtectionPaladin).
				WithSpecMod(0.29499998689, proto.Spec_SpecRetributionPaladin).
				WithSpecMod(0.33899998665, proto.Spec_SpecArmsWarrior).
				WithSpecMod(0.25699999928, proto.Spec_SpecFuryWarrior).
				WithSpecMod(-0.40000000596, proto.Spec_SpecProtectionWarrior).
				WithSpecMod(0.72100001574, proto.Spec_SpecFeralDruid).
				WithSpecMod(-0.40000000596, proto.Spec_SpecGuardianDruid).
				WithSpecMod(-0.40000000596, proto.Spec_SpecBloodDeathKnight).
				WithSpecMod(0.53200000525, proto.Spec_SpecFrostDeathKnight).
				WithSpecMod(-0.16200000048, proto.Spec_SpecUnholyDeathKnight).
				WithSpecMod(-0.05000000075, proto.Spec_SpecBeastMasteryHunter).
				WithSpecMod(0.10700000077, proto.Spec_SpecMarksmanshipHunter).
				WithSpecMod(-0.05000000075, proto.Spec_SpecSurvivalHunter).
				WithSpecMod(0.78899997473, proto.Spec_SpecAssassinationRogue).
				WithSpecMod(0.13600000739, proto.Spec_SpecCombatRogue).
				WithSpecMod(0.11400000006, proto.Spec_SpecSubtletyRogue).
				WithSpecMod(-0.19099999964, proto.Spec_SpecEnhancementShaman).
				WithSpecMod(-0.40000000596, proto.Spec_SpecBrewmasterMonk).
				WithSpecMod(0.0869999975, proto.Spec_SpecWindwalkerMonk),
			),
			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				target = result.Target
				capacitanceAura.Activate(sim)
				capacitanceAura.AddStack(sim)
			},
		})
	})

	// Sinister Primal Diamond
	// Chance on dealing spell damage to gain 30% spell haste for 10 sec.
	// (Approximately 1.35 procs per minute)
	core.NewItemEffect(95347, func(agent core.Agent, _ proto.ItemLevelState) {
		character := agent.GetCharacter()
		hasteMulti := 1.3

		aura := character.GetOrRegisterAura(core.Aura{
			Label:    "Tempus Repit",
			ActionID: core.ActionID{SpellID: 137590},
			Duration: time.Second * 10,
		}).
			AttachMultiplyCastSpeed(hasteMulti)

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:     "Haste Trigger",
			ActionID: core.ActionID{SpellID: 137592},
			Callback: core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
			Outcome:  core.OutcomeLanded,
			ICD:      time.Second * 3,
			DPM: character.NewRPPMProcManager(95347, false, true, core.ProcMaskSpellOrSpellProc, core.RPPMConfig{
				PPM: 1.35000002384,
			}.
				// https://wago.tools/db2/SpellProcsPerMinuteMod?build=5.5.0.60548&filter%5BSpellProcsPerMinuteID%5D=55&filter%5BType%5D=4&page=1&sort%5BParam%5D=asc
				WithSpecMod(-0.23899999261, proto.Spec_SpecArcaneMage).
				WithSpecMod(-0.29499998689, proto.Spec_SpecFireMage).
				WithSpecMod(0.38699999452, proto.Spec_SpecFrostMage).
				WithSpecMod(0.87199997902, proto.Spec_SpecBalanceDruid).
				WithSpecMod(-0.06700000167, proto.Spec_SpecShadowPriest).
				WithSpecMod(0.89099997282, proto.Spec_SpecElementalShaman).
				WithSpecMod(-0.375, proto.Spec_SpecAfflictionWarlock).
				WithSpecMod(-0.40200001001, proto.Spec_SpecDemonologyWarlock).
				WithSpecMod(-0.49099999666, proto.Spec_SpecDestructionWarlock),
			),
			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				aura.Activate(sim)
			},
		})
	})

	// Courageous Primal Diamond
	// @TODO: Healing gem

	// Indomitable Primal Diamond
	// Chance on being hit by a melee attack to gain a 20% reduction to all damage taken for 15 sec.
	// (Approximately 2.57 procs per minute)
	core.NewItemEffect(95344, func(agent core.Agent, _ proto.ItemLevelState) {
		character := agent.GetCharacter()

		aura := character.GetOrRegisterAura(core.Aura{
			Label:    "Fortitude",
			ActionID: core.ActionID{SpellID: 137593},
			Duration: time.Second * 15,
		}).
			AttachMultiplicativePseudoStatBuff(&character.PseudoStats.DamageTakenMultiplier, 0.8)

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:               "Fortitude Trigger",
			ActionID:           core.ActionID{SpellID: 137594},
			RequireDamageDealt: true,
			Callback:           core.CallbackOnSpellHitTaken,
			Outcome:            core.OutcomeLanded,
			ICD:                time.Second * 3,
			DPM: character.NewRPPMProcManager(95344, false, true, core.ProcMaskMeleeOrMeleeProc|core.ProcMaskRangedOrRangedProc, core.RPPMConfig{
				PPM: 2.56999993324,
			}),
			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				aura.Activate(sim)
			},
		})
	})
}
