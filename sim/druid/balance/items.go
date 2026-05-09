package balance

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

// T14 Balance
var ItemSetRegaliaOfTheEternalBloosom = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of the Eternal Blossom",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Your Starfall deals 20% additional damage.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Pct,
				ClassMask:  druid.DruidSpellStarfallTick,
				FloatValue: 0.2,
			})
		},
		4: func(_ core.Agent, setBonusAura *core.Aura) {
			// Increases the duration of your Moonfire and Sunfire spells by 2 sec.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_DotNumberOfTicks_Flat,
				ClassMask: druid.DruidSpellMoonfireDoT | druid.DruidSpellSunfireDoT,
				IntValue:  1,
			})
		},
	},
})

// T15 Balance
var ItemSetRegaliaOfTheHauntedForest = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of the Haunted Forest",
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			// Increases the critical strike chance of Starsurge by 10%.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_BonusCrit_Percent,
				ClassMask:  druid.DruidSpellStarsurge,
				FloatValue: 10,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Nature's Grace now also grants 1000 critical strike and 1000 mastery for its duration.
			druid := agent.(*BalanceDruid)
			aura := druid.NewTemporaryStatsAura(
				"Druid T15 Balance 4P Bonus",
				core.ActionID{SpellID: 138350},
				stats.Stats{stats.CritRating: 1000, stats.MasteryRating: 1000},
				time.Second*15,
			)

			druid.Env.RegisterPreFinalizeEffect(func() {
				druid.NaturesGrace.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
					if setBonusAura.IsActive() {
						aura.Activate(sim)
					}
				})
			})

			setBonusAura.ExposeToAPL(138350)
		},
	},
})

// T16 Balance
var ItemSetRegaliaOfTheShatteredVale = core.NewItemSet(core.ItemSet{
	Name:                    "Regalia of the Shattered Vale",
	ID:                      1197,
	DisabledInChallengeMode: true,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Arcane spells cast while in Lunar Eclipse will shoot a single Lunar Bolt at the target. Nature spells cast while in a Solar Eclipse will shoot a single Solar Bolt at the target.
			moonkin := agent.(*BalanceDruid)
			solarBolt := moonkin.registerT16BoltSpell(144772, core.SpellSchoolNature, SolarEclipse)
			lunarBolt := moonkin.registerT16BoltSpell(144770, core.SpellSchoolArcane, LunarEclipse)

			bothDuringCA := druid.DruidSpellMoonfire | druid.DruidSpellSunfire | druid.DruidSpellStarsurge

			procTriggerSpellMask := druid.DruidSpellMoonfire |
				druid.DruidSpellSunfire |
				druid.DruidSpellStarfall |
				druid.DruidSpellStarfire |
				druid.DruidSpellWrath |
				druid.DruidSpellStarsurge

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Callback:           core.CallbackOnCastComplete,
				ClassSpellMask:     procTriggerSpellMask,
				TriggerImmediately: true,
				ExtraCondition: func(_ *core.Simulation, spell *core.Spell, _ *core.SpellResult) bool {
					return (moonkin.IsInEclipse() || moonkin.CelestialAlignment.RelatedSelfBuff.IsActive())
				},

				Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
					alignmentActive := moonkin.CelestialAlignment.RelatedSelfBuff.IsActive()

					if spell.SpellSchool.Matches(core.SpellSchoolNature) || (alignmentActive && spell.Matches(bothDuringCA)) {
						solarBolt.Cast(sim, spell.Unit.CurrentTarget)
					}

					if spell.SpellSchool.Matches(core.SpellSchoolArcane) || (alignmentActive && spell.Matches(bothDuringCA)) {
						lunarBolt.Cast(sim, spell.Unit.CurrentTarget)
					}
				},
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Your chance to get Shooting Stars from a critical strike from Moonfire or Sunfire is increased by 8%.
			moonkin := agent.(*BalanceDruid)
			moonkin.ShootingStarsProcChance += 0.08
		},
	},
})

const (
	T16BoltBonusCoeff = 0.10000000149
	T16BoltCoeff      = 0.5
	T16BoltVariance   = 0.25
)

func (moonkin *BalanceDruid) registerT16BoltSpell(spellID int32, spellSchool core.SpellSchool, eclipse Eclipse) *druid.DruidSpell {
	return moonkin.RegisterSpell(druid.Humanoid|druid.Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: spellID},
		SpellSchool:    spellSchool,
		ProcMask:       core.ProcMaskSpellProc,
		ClassSpellMask: druid.DruidSpell2PT16Bolt,
		Flags:          core.SpellFlagAPL,

		MissileSpeed: 30,

		BonusCoefficient: T16BoltBonusCoeff,
		DamageMultiplier: 1,
		CritMultiplier:   moonkin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := moonkin.CalcAndRollDamageRange(sim, T16BoltCoeff, T16BoltVariance)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return (moonkin.IsInEclipse() && moonkin.currentEclipse == eclipse) || moonkin.CelestialAlignment.RelatedSelfBuff.IsActive()
		},
	})
}

func init() {}
