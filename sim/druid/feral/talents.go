package feral

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

func (cat *FeralDruid) applySpecTalents() {
	cat.registerSoulOfTheForest()
	cat.registerIncarnation()
	cat.registerHeartOfTheWild()
	cat.registerDreamOfCenarius()
}

func (cat *FeralDruid) registerSoulOfTheForest() {
	if !cat.Talents.SoulOfTheForest {
		return
	}

	energyMetrics := cat.NewEnergyMetrics(core.ActionID{SpellID: 114113})

	var cpSnapshot int32

	procSotf := func(sim *core.Simulation) {
		if cpSnapshot > 0 {
			cat.AddEnergy(sim, 4.0*float64(cpSnapshot), energyMetrics)
			cpSnapshot = 0
		}
	}

	cat.RegisterAura(core.Aura{
		Label:    "Soul of the Forest Trigger",
		Duration: core.NeverExpires,

		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			aura.Activate(sim)
		},

		OnApplyEffects: func(aura *core.Aura, _ *core.Simulation, _ *core.Unit, spell *core.Spell) {
			if spell.Matches(druid.DruidSpellFinisher) {
				cpSnapshot = aura.Unit.ComboPoints()
			}
		},

		OnSpellHitDealt: func(_ *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(druid.DruidSpellFinisher) && result.Landed() {
				procSotf(sim)
			}
		},

		OnCastComplete: func(_ *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(druid.DruidSpellSavageRoar) {
				procSotf(sim)
			}
		},
	})
}

func (cat *FeralDruid) registerIncarnation() {
	if !cat.Talents.Incarnation {
		return
	}

	actionID := core.ActionID{SpellID: 102543}

	var oldExtraCastCondition core.CanCastCondition

	cat.IncarnationAura = cat.RegisterAura(core.Aura{
		Label:    "Incarnation: King of the Jungle",
		ActionID: actionID,
		Duration: time.Second * 30,

		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			oldExtraCastCondition = cat.Ravage.ExtraCastCondition
			cat.Ravage.ExtraCastCondition = nil
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			cat.Ravage.ExtraCastCondition = oldExtraCastCondition
		},
	})

	cat.Incarnation = cat.RegisterSpell(druid.Any, core.SpellConfig{
		ActionID:        actionID,
		Flags:           core.SpellFlagAPL,
		RelatedSelfBuff: cat.IncarnationAura,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},

			CD: core.Cooldown{
				Timer:    cat.NewTimer(),
				Duration: time.Minute * 3,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			if !cat.InForm(druid.Cat) {
				cat.CatFormAura.Activate(sim)
			}

			cat.IncarnationAura.Activate(sim)
		},
	})

	cat.AddMajorCooldown(core.MajorCooldown{
		Spell: cat.Incarnation.Spell,
		Type:  core.CooldownTypeDPS,

		ShouldActivate: func(sim *core.Simulation, _ *core.Character) bool {
			return cat.BerserkCatAura.IsActive() && !cat.ClearcastingAura.IsActive() && (cat.CurrentEnergy()+cat.EnergyRegenPerSecond() < 100)
		},
	})
}

func (cat *FeralDruid) registerHeartOfTheWild() {
	// Passive stat buffs handled in class-level talents code.
	if !cat.Talents.HeartOfTheWild {
		return
	}

	actionID := core.ActionID{SpellID: 108292}
	healingMod, damageMod, costMod := cat.RegisterSharedFeralHotwMods()
	bearFormDep := cat.NewDynamicMultiplyStat(stats.Agility, 1.5)
	bearFormStatBuff := stats.Stats{
		stats.HitRating:       7.5 * core.PhysicalHitRatingPerHitPercent,
		stats.ExpertiseRating: 7.5 * 4 * core.ExpertisePerQuarterPercentReduction,
	}

	// TODO: Implement Bear Form armor buff, Crit immunity, and Vengeance

	cat.HeartOfTheWildAura = cat.RegisterAura(core.Aura{
		Label:    "Heart of the Wild",
		ActionID: actionID,
		Duration: time.Second * 45,

		OnGain: func(_ *core.Aura, sim *core.Simulation) {
			healingMod.Activate()
			damageMod.Activate()
			costMod.Activate()
			cat.AddStatDynamic(sim, stats.SpellHitPercent, 15)

			if cat.InForm(druid.Bear) {
				cat.EnableDynamicStatDep(sim, bearFormDep)
				cat.AddStatsDynamic(sim, bearFormStatBuff)
			}
		},

		OnExpire: func(_ *core.Aura, sim *core.Simulation) {
			healingMod.Deactivate()
			damageMod.Deactivate()
			costMod.Deactivate()
			cat.AddStatDynamic(sim, stats.SpellHitPercent, -15)

			if cat.InForm(druid.Bear) {
				cat.DisableDynamicStatDep(sim, bearFormDep)
				cat.AddStatsDynamic(sim, bearFormStatBuff.Invert())
			}
		},
	})

	cat.BearFormAura.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
		if cat.HeartOfTheWildAura.IsActive() {
			cat.EnableDynamicStatDep(sim, bearFormDep)
			cat.AddStatsDynamic(sim, bearFormStatBuff)
		}
	})

	cat.BearFormAura.ApplyOnExpire(func(_ *core.Aura, sim *core.Simulation) {
		if cat.HeartOfTheWildAura.IsActive() {
			cat.DisableDynamicStatDep(sim, bearFormDep)
			cat.AddStatsDynamic(sim, bearFormStatBuff.Invert())
		}
	})

	cat.HeartOfTheWild = cat.RegisterSpell(druid.Any, core.SpellConfig{
		ActionID:        actionID,
		Flags:           core.SpellFlagAPL,
		RelatedSelfBuff: cat.HeartOfTheWildAura,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    cat.NewTimer(),
				Duration: time.Minute * 6,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)
		},
	})

	cat.AddMajorCooldown(core.MajorCooldown{
		Spell: cat.HeartOfTheWild.Spell,
		Type:  core.CooldownTypeDPS,

		ShouldActivate: func(sim *core.Simulation, _ *core.Character) bool {
			return (!cat.BerserkCatAura.IsActive() || (cat.BerserkCatAura.RemainingDuration(sim) < core.GCDMin)) && (cat.Berserk.TimeToReady(sim) > cat.HeartOfTheWildAura.Duration) && !cat.IncarnationAura.IsActive() && !cat.ClearcastingAura.IsActive() && ((cat.ComboPoints() == 5) || (cat.CurrentEnergy()+(cat.Wrath.DefaultCast.CastTime*2+core.GCDDefault).Seconds()*cat.EnergyRegenPerSecond() <= 100))
		},
	})
}

func (cat *FeralDruid) registerDreamOfCenarius() {
	if !cat.Talents.DreamOfCenarius {
		return
	}

	cat.AddStaticMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellHealingTouch,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.2,
	})

	meleeAbilityMask := druid.DruidSpellBuilder | druid.DruidSpellLacerate | druid.DruidSpellThrash | druid.DruidSpellRip | druid.DruidSpellFerociousBite | druid.DruidSpellSwipe | druid.DruidSpellMaul | druid.DruidSpellMangleBear

	docMod := cat.AddDynamicMod(core.SpellModConfig{
		ClassMask:  meleeAbilityMask,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.3,
	})

	cat.DreamOfCenariusAura = cat.RegisterAura(core.Aura{
		Label:     "Dream of Cenarius",
		ActionID:  core.ActionID{SpellID: 145152},
		Duration:  time.Second * 30,
		MaxStacks: 2,

		Icd: &core.Cooldown{
			Timer:    cat.NewTimer(),
			Duration: time.Millisecond * 100,
		},

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.SetStacks(sim, 2)
			docMod.Activate()
		},

		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			if spell.Matches(meleeAbilityMask) && aura.Icd.IsReady(sim) {
				aura.Icd.Use(sim)
				aura.RemoveStack(sim)
			}
		},

		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			docMod.Deactivate()
		},
	})

	cat.MakeProcTriggerAura(core.ProcTrigger{
		Name:           "Dream of Cenarius Trigger",
		Callback:       core.CallbackOnCastComplete,
		ClassSpellMask: druid.DruidSpellHealingTouch,

		Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
			cat.DreamOfCenariusAura.Activate(sim)
		},
	})
}
