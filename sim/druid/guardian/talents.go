package guardian

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

func (bear *GuardianDruid) applySpecTalents() {
	bear.registerIncarnation()
	bear.registerHeartOfTheWild()
	bear.registerDreamOfCenarius()
}

func (bear *GuardianDruid) registerIncarnation() {
	if !bear.Talents.Incarnation {
		return
	}

	actionID := core.ActionID{SpellID: 102558}

	var affectedSpells []*druid.DruidSpell
	var cdReductions []time.Duration

	bear.SonOfUrsocAura = bear.RegisterAura(core.Aura{
		Label:    "Incarnation: Son of Ursoc",
		ActionID: actionID,
		Duration: time.Second * 30,

		OnInit: func(_ *core.Aura, _ *core.Simulation) {
			affectedSpells = []*druid.DruidSpell{bear.SwipeBear, bear.Lacerate, bear.MangleBear, bear.ThrashBear, bear.Maul}
			cdReductions = make([]time.Duration, len(affectedSpells))
		},

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			for idx, spell := range affectedSpells {
				cdReductions[idx] = spell.CD.Duration - core.GCDDefault
				spell.CD.Duration -= cdReductions[idx]
				spell.CD.Reset()
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			for idx, spell := range affectedSpells {
				spell.CD.Duration += cdReductions[idx]
			}
		},
	})

	bear.SonOfUrsoc = bear.RegisterSpell(druid.Any, core.SpellConfig{
		ActionID: actionID,
		Flags:    core.SpellFlagAPL,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},

			CD: core.Cooldown{
				Timer:    bear.NewTimer(),
				Duration: time.Minute * 3,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			if !bear.InForm(druid.Bear) {
				bear.BearFormAura.Activate(sim)
			}

			bear.SonOfUrsocAura.Activate(sim)
		},
	})

	bear.AddMajorCooldown(core.MajorCooldown{
		Spell: bear.SonOfUrsoc.Spell,
		Type:  core.CooldownTypeDPS,

		ShouldActivate: func(sim *core.Simulation, _ *core.Character) bool {
			return !bear.BerserkBearAura.IsActive() && !bear.Berserk.IsReady(sim)
		},
	})
}

func (bear *GuardianDruid) registerHeartOfTheWild() {
	// Passive stat buffs handled in class-level talents code.
	if !bear.Talents.HeartOfTheWild {
		return
	}

	healingMask := druid.DruidSpellTranquility | druid.DruidSpellRejuvenation | druid.DruidSpellHealingTouch | druid.DruidSpellCenarionWard

	healingMod := bear.AddDynamicMod(core.SpellModConfig{
		ClassMask:  healingMask,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 1,
	})

	damageMask := druid.DruidSpellWrath | druid.DruidSpellMoonfire | druid.DruidSpellMoonfireDoT | druid.DruidSpellHurricane

	damageMod := bear.AddDynamicMod(core.SpellModConfig{
		ClassMask:  damageMask,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 3.2,
	})

	costMod := bear.AddDynamicMod(core.SpellModConfig{
		ClassMask:  healingMask | damageMask,
		Kind:       core.SpellMod_PowerCost_Pct,
		FloatValue: -2,
	})

	actionID := core.ActionID{SpellID: 108293}

	bear.HeartOfTheWildAura = bear.RegisterAura(core.Aura{
		Label:    "Heart of the Wild",
		ActionID: actionID,
		Duration: time.Second * 45,

		OnGain: func(_ *core.Aura, sim *core.Simulation) {
			healingMod.Activate()
			damageMod.Activate()
			costMod.Activate()
			bear.Rejuvenation.FormMask |= druid.Bear
			bear.AddStatDynamic(sim, stats.SpellHitPercent, 15)

			// TODO: 2.1x Agi multiplier when in Cat Form
			// TODO: +7.5% Hit + Expertise when in Cat Form
		},

		OnExpire: func(_ *core.Aura, sim *core.Simulation) {
			healingMod.Deactivate()
			damageMod.Deactivate()
			costMod.Deactivate()
			bear.Rejuvenation.FormMask ^= druid.Bear
			bear.AddStatDynamic(sim, stats.SpellHitPercent, -15)
		},
	})

	bear.HeartOfTheWild = bear.RegisterSpell(druid.Any, core.SpellConfig{
		ActionID: actionID,
		Flags:    core.SpellFlagAPL,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    bear.NewTimer(),
				Duration: time.Minute * 3,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			bear.HeartOfTheWildAura.Activate(sim)
		},
	})
}

func (bear *GuardianDruid) registerDreamOfCenarius() {
	if !bear.Talents.DreamOfCenarius {
		return
	}

	bear.AddStaticMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellHealingTouch,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.2,
	})

	bear.AddStaticMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellMangleBear,
		Kind:       core.SpellMod_BonusCrit_Percent,
		FloatValue: 10,
	})

	var oldGetSpellPowerValue func(*core.Spell) float64

	bear.DreamOfCenariusAura = bear.RegisterAura(core.Aura{
		Label:    "Dream of Cenarius",
		ActionID: core.ActionID{SpellID: 145162},
		Duration: time.Second * 20,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			bear.HealingTouch.CastTimeMultiplier -= 1
			bear.HealingTouch.Cost.PercentModifier *= -1
			bear.HealingTouch.FormMask |= druid.Bear

			// https://www.mmo-champion.com/threads/1188383-Guardian-Patch-5-4-Survival-Guide
			// TODO: Verify this
			oldGetSpellPowerValue = bear.GetSpellPowerValue

			bear.GetSpellPowerValue = func(spell *core.Spell) float64 {
				if bear.HealingTouch.IsEqual(spell) {
					return bear.GetStat(stats.AttackPower) / 2
				} else {
					return oldGetSpellPowerValue(spell)
				}
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			bear.HealingTouch.CastTimeMultiplier += 1
			bear.HealingTouch.Cost.PercentModifier /= -1
			bear.HealingTouch.FormMask ^= druid.Bear
			bear.GetSpellPowerValue = oldGetSpellPowerValue
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if bear.HealingTouch.IsEqual(spell) {
				aura.Deactivate(sim)
			}
		},
	})

	core.MakeProcTriggerAura(&bear.Unit, core.ProcTrigger{
		Name:           "Dream of Cenarius Trigger",
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: druid.DruidSpellMangleBear,
		Outcome:        core.OutcomeCrit,
		ProcChance:     0.5,

		Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
			bear.DreamOfCenariusAura.Activate(sim)
		},
	})
}
