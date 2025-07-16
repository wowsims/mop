package core

import (
	"slices"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func applyRaceEffects(agent Agent) {
	character := agent.GetCharacter()

	switch character.Race {
	case proto.Race_RaceBloodElf:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexArcane] *= 0.99

		var actionID ActionID

		var resourceMetrics *ResourceMetrics = nil
		if resourceMetrics == nil {
			if character.HasRunicPowerBar() {
				actionID = ActionID{SpellID: 50613}
				resourceMetrics = character.NewRunicPowerMetrics(actionID)
			} else if character.Class == proto.Class_ClassMonk {
				actionID = ActionID{SpellID: 129597}
				resourceMetrics = character.NewChiMetrics(actionID)
			} else if character.HasEnergyBar() {
				actionID = ActionID{SpellID: 25046}
				resourceMetrics = character.NewEnergyMetrics(actionID)
			} else if character.HasManaBar() {
				actionID = ActionID{SpellID: 28730}
				resourceMetrics = character.NewManaMetrics(actionID)
			} else if character.HasRageBar() {
				actionID = ActionID{SpellID: 69179}
				resourceMetrics = character.NewRageMetrics(actionID)
			} else if character.HasFocusBar() {
				actionID = ActionID{SpellID: 80483}
				resourceMetrics = character.NewFocusMetrics(actionID)
			}
		}

		spell := character.RegisterSpell(SpellConfig{
			ActionID: actionID,
			Flags:    SpellFlagNoOnCastComplete,
			Cast: CastConfig{
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 2,
				},
			},
			ApplyEffects: func(sim *Simulation, _ *Unit, spell *Spell) {
				if spell.Unit.HasRunicPowerBar() {
					spell.Unit.AddRunicPower(sim, 15.0, resourceMetrics)
				} else if character.Class == proto.Class_ClassMonk {
					spell.Unit.AddComboPoints(sim, 1, resourceMetrics)
				} else if spell.Unit.HasEnergyBar() {
					spell.Unit.AddEnergy(sim, 15.0, resourceMetrics)
				} else if spell.Unit.HasManaBar() {
					spell.Unit.AddMana(sim, spell.Unit.MaxMana()*0.02, resourceMetrics)
				} else if spell.Unit.HasRageBar() {
					spell.Unit.AddRage(sim, 15.0, resourceMetrics)
				} else if spell.Unit.HasFocusBar() {
					spell.Unit.AddFocus(sim, 15.0, resourceMetrics)
				}
			},
		})

		character.AddMajorCooldown(MajorCooldown{
			Spell:    spell,
			Type:     CooldownTypeDPS,
			Priority: CooldownPriorityLow,
			ShouldActivate: func(sim *Simulation, character *Character) bool {
				if spell.Unit.HasRunicPowerBar() {
					return character.CurrentRunicPower() <= character.maxRunicPower-15
				} else if character.Class == proto.Class_ClassMonk {
					return character.ComboPoints() <= character.maxComboPoints-1
				} else if spell.Unit.HasEnergyBar() {
					return character.CurrentEnergy() <= character.maxEnergy-15
				} else if spell.Unit.HasRageBar() {
					return character.CurrentRage() <= character.maxRage-15
				} else if spell.Unit.HasFocusBar() {
					return character.CurrentFocus() <= character.maxFocus-15
				}
				return true
			},
		})
	case proto.Race_RaceDraenei:
		character.AddStat(stats.HitRating, PhysicalHitRatingPerHitPercent)
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexShadow] *= 0.99

		classSpellIDs := map[proto.Class]ActionID{
			proto.Class_ClassHunter:      {SpellID: 59543},
			proto.Class_ClassMage:        {SpellID: 59548},
			proto.Class_ClassPaladin:     {SpellID: 59542},
			proto.Class_ClassShaman:      {SpellID: 59547},
			proto.Class_ClassWarrior:     {SpellID: 28880},
			proto.Class_ClassDeathKnight: {SpellID: 59545},
			proto.Class_ClassMonk:        {SpellID: 121093},
			proto.Class_ClassPriest:      {SpellID: 121093},
		}

		var actionID ActionID
		if id, ok := classSpellIDs[character.Class]; ok {
			actionID = id
		} else {
			actionID = ActionID{SpellID: 121093}
		}

		character.RegisterSpell(SpellConfig{
			ActionID:    actionID,
			Flags:       SpellFlagAPL | SpellFlagHelpful | SpellFlagIgnoreModifiers,
			ProcMask:    ProcMaskSpellHealing,
			SpellSchool: SpellSchoolHoly,

			MaxRange: 40,

			Cast: CastConfig{
				DefaultCast: Cast{
					NonEmpty: true,
				},
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Second * 15,
				},
			},

			DamageMultiplier: 1.0,
			CritMultiplier:   character.DefaultCritMultiplier(),
			ThreatMultiplier: 1.0,

			Hot: DotConfig{
				Aura: Aura{
					Label: "Gift of the Naaru" + character.Label,
				},
				NumberOfTicks:       5,
				TickLength:          time.Second * 3,
				AffectedByCastSpeed: false,
				OnTick: func(sim *Simulation, target *Unit, dot *Dot) {
					healValue := character.MaxHealth() * 0.04
					dot.Spell.CalcAndDealPeriodicHealing(sim, target, healValue, dot.OutcomeTickHealingCrit)
				},
			},

			ApplyEffects: func(sim *Simulation, target *Unit, spell *Spell) {
				spell.Hot(target).Activate(sim)
			},
		})
	case proto.Race_RaceDwarf:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexFrost] *= 0.99

		// Crack Shot: 1% Expertise with Ranged Weapons
		ranged := character.Ranged()
		if ranged != nil && (ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeBow ||
			ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeGun ||
			ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeCrossbow) {
			character.AddStat(stats.ExpertiseRating, ExpertisePerQuarterPercentReduction*4)
		}

		registerWeaponSpecializationAura(character, &weaponSpecializationConfig{
			label:       "Mace Specialization",
			actionID:    ActionID{SpellID: 59224},
			weaponTypes: []proto.WeaponType{proto.WeaponType_WeaponTypeMace},
		})

		actionID := ActionID{SpellID: 20594}

		stoneFormAura := character.NewTemporaryStatsAuraWrapped("Stoneform", actionID, stats.Stats{}, time.Second*8, func(aura *Aura) {
			aura.ApplyOnGain(func(aura *Aura, sim *Simulation) {
				character.PseudoStats.DamageTakenMultiplier *= 0.90
			})
			aura.ApplyOnExpire(func(aura *Aura, sim *Simulation) {
				character.PseudoStats.DamageTakenMultiplier /= 0.90
			})
		})

		spell := character.RegisterSpell(SpellConfig{
			ActionID: actionID,
			Flags:    SpellFlagNoOnCastComplete,
			Cast: CastConfig{
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 2,
				},
			},
			ApplyEffects: func(sim *Simulation, _ *Unit, _ *Spell) {
				stoneFormAura.Activate(sim)
			},
		})

		character.AddMajorCooldown(MajorCooldown{
			Spell: spell,
			Type:  CooldownTypeDPS,
		})
	case proto.Race_RaceGnome:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexArcane] *= 0.99
		character.MultiplyStat(stats.Mana, 1.05)
		registerWeaponSpecializationAura(character, &weaponSpecializationConfig{
			label:       "Shortblade Specialization",
			actionID:    ActionID{SpellID: 92680},
			weaponTypes: []proto.WeaponType{proto.WeaponType_WeaponTypeSword, proto.WeaponType_WeaponTypeDagger},
			oneHand:     true,
		})
	case proto.Race_RaceHuman:
		character.MultiplyStat(stats.Spirit, 1.03)
		// Combining both into Mace Specialization to avoid having to deal with exclusive effects and build phases
		registerWeaponSpecializationAura(character, &weaponSpecializationConfig{
			label:       "Mace Specialization",
			actionID:    ActionID{SpellID: 20864},
			weaponTypes: []proto.WeaponType{proto.WeaponType_WeaponTypeMace, proto.WeaponType_WeaponTypeSword},
		})
	case proto.Race_RaceNightElf:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexNature] *= 0.99
		character.PseudoStats.BaseDodgeChance += 0.02

		// Shadowmeld
		actionID := ActionID{SpellID: 58984}

		shmeldAura := character.RegisterAura(Aura{
			Label:    "Shadowmeld",
			ActionID: actionID,
			Duration: NeverExpires,
			// Shadowmeld counts as a stealth stance for (most?) spell requirements, but does not enable any additional bonuses/auras tied to stealth.
			// Implementation vaguely mirrors Rogue Vanish
			OnCastComplete: func(aura *Aura, sim *Simulation, spell *Spell) {
				if spell.ActionID != actionID {
					aura.Deactivate(sim)
				}
			},
			OnExpire: func(aura *Aura, sim *Simulation) {
				if character.AutoAttacks.MHConfig() != nil {
					character.AutoAttacks.EnableAutoSwing(sim)
				}
			},
		})

		shmeldSpell := character.RegisterSpell(SpellConfig{
			ActionID: actionID,

			Cast: CastConfig{
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 2,
				},
			},

			ApplyEffects: func(sim *Simulation, target *Unit, spell *Spell) {
				shmeldAura.Activate(sim)
				character.AutoAttacks.CancelAutoSwing(sim)
			},
		})

		character.AddMajorCooldown(MajorCooldown{
			Spell: shmeldSpell,
			Type:  CooldownTypeUnknown,
			ShouldActivate: func(s *Simulation, c *Character) bool {
				// No reason to auto-cast this
				return false
			},
		})

	case proto.Race_RaceOrc:
		// Command (Pet damage +2%)
		for _, pet := range character.Pets {
			pet.PseudoStats.DamageDealtMultiplier *= 1.02
		}

		// Blood Fury
		actionID := ActionID{SpellID: 33697}
		apBonus := 0.0
		spBonus := 0.0

		switch character.Class {
		case proto.Class_ClassMage,
			proto.Class_ClassWarlock:
			spBonus = 2257.0
		case proto.Class_ClassShaman,
			proto.Class_ClassMonk:
			spBonus = 2257.0
			apBonus = 4514.0
		default:
			apBonus = 4514.0
		}

		buffStats := stats.Stats{stats.AttackPower: apBonus, stats.RangedAttackPower: apBonus, stats.SpellPower: spBonus}
		RegisterTemporaryStatsOnUseCD(character, "Blood Fury", buffStats, time.Second*15, SpellConfig{
			ActionID: actionID,

			Cast: CastConfig{
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 2,
				},
			},
		})

		registerWeaponSpecializationAura(character, &weaponSpecializationConfig{
			label:       "Axe Specialization",
			actionID:    ActionID{SpellID: 20574},
			weaponTypes: []proto.WeaponType{proto.WeaponType_WeaponTypeAxe, proto.WeaponType_WeaponTypeFist},
		})
	case proto.Race_RaceTauren:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexNature] *= 0.99
		character.AddStat(stats.Health, character.GetBaseStats()[stats.Health]*0.05)
	case proto.Race_RaceTroll:
		// Dead Eye: 1% Expertise with Guns, Bows or Crossbows.
		ranged := character.Ranged()
		if ranged != nil && (ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeBow ||
			ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeGun ||
			ranged.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeCrossbow) {
			character.AddStat(stats.ExpertiseRating, ExpertisePerQuarterPercentReduction*4)
		}

		// Beast Slaying (+5% damage to beasts)
		if character.CurrentTarget.MobType == proto.MobType_MobTypeBeast {
			character.PseudoStats.DamageDealtMultiplier *= 1.05
		}

		// Berserking
		actionID := ActionID{SpellID: 26297}

		berserkingAura := character.RegisterAura(Aura{
			Label:    "Berserking (Troll)",
			ActionID: actionID,
			Duration: time.Second * 10,
			OnGain: func(aura *Aura, sim *Simulation) {
				character.MultiplyCastSpeed(sim, 1.2)
				character.MultiplyAttackSpeed(sim, 1.2)
			},
			OnExpire: func(aura *Aura, sim *Simulation) {
				character.MultiplyAttackSpeed(sim, 1/1.2)
				character.MultiplyCastSpeed(sim, 1/1.2)
			},
		})

		berserkingSpell := character.RegisterSpell(SpellConfig{
			ActionID: actionID,

			Cast: CastConfig{
				CD: Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 3,
				},
			},

			ApplyEffects: func(sim *Simulation, _ *Unit, _ *Spell) {
				berserkingAura.Activate(sim)
			},
		})

		character.AddMajorCooldown(MajorCooldown{
			Spell: berserkingSpell,
			Type:  CooldownTypeDPS,
		})
	case proto.Race_RaceUndead:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexShadow] *= 0.99

		actionID := ActionID{SpellID: 127802}
		healthMetrics := character.NewHealthMetrics(actionID)
		touchOfTheGraveDamageSpell := character.RegisterSpell(SpellConfig{
			ActionID:    actionID,
			SpellSchool: SpellSchoolShadow,
			ProcMask:    ProcMaskSpellProc,

			CritMultiplier:   character.DefaultCritMultiplier(),
			DamageMultiplier: 1,

			ApplyEffects: func(sim *Simulation, target *Unit, spell *Spell) {
				baseDamage := sim.Roll(CalcScalingSpellEffectVarianceMinMax(proto.Class_ClassUnknown, 8, 0.15000000596))
				result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHit)

				character.GainHealth(sim, result.Damage*spell.Unit.PseudoStats.HealingTakenMultiplier, healthMetrics)
			},
		})

		MakeProcTriggerAura(&character.Unit, ProcTrigger{
			Name:       "Touch of the Grave",
			ActionID:   ActionID{SpellID: 5227},
			Callback:   CallbackOnSpellHitDealt | CallbackOnPeriodicDamageDealt,
			ProcMask:   ProcMaskSpellDamage | ProcMaskMelee,
			Outcome:    OutcomeLanded,
			ProcChance: 0.2,
			ICD:        time.Second * 15,
			Handler: func(sim *Simulation, spell *Spell, result *SpellResult) {
				touchOfTheGraveDamageSpell.Cast(sim, result.Target)
			},
		})
	case proto.Race_RaceWorgen:
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexNature] *= 0.99
		character.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexShadow] *= 0.99
		character.AddStat(stats.PhysicalCritPercent, 1)
		character.AddStat(stats.SpellCritPercent, 1)
	case proto.Race_RaceGoblin:
		character.PseudoStats.MeleeSpeedMultiplier *= 1.01
		character.PseudoStats.RangedSpeedMultiplier *= 1.01
		character.PseudoStats.CastSpeedMultiplier *= 1.01
	case proto.Race_RaceAlliancePandaren:
	case proto.Race_RaceHordePandaren:
		//Epicurean in consumes.go
	}
}

type weaponSpecializationConfig struct {
	label       string
	actionID    ActionID
	weaponTypes []proto.WeaponType
	oneHand     bool
}

func registerWeaponSpecializationAura(character *Character, config *weaponSpecializationConfig) {
	getCurrentProcMask := func() ProcMask {
		if config.oneHand {
			return character.GetProcMaskForTypesAndHand(false, config.weaponTypes...)
		} else {
			return character.GetProcMaskForTypes(config.weaponTypes...)
		}
	}

	var mask ProcMask
	expertiseBonus := 4 * ExpertisePerQuarterPercentReduction
	weaponSpecAura := character.RegisterAura(Aura{
		Label:      config.label,
		ActionID:   config.actionID,
		Duration:   NeverExpires,
		BuildPhase: CharacterBuildPhaseBase,

		OnReset: func(aura *Aura, sim *Simulation) {
			if (character.HasMHWeapon() && slices.Contains(config.weaponTypes, character.MainHand().WeaponType)) ||
				(character.HasOHWeapon() && slices.Contains(config.weaponTypes, character.OffHand().WeaponType)) {
				aura.Activate(sim)
			}
		},
		OnGain: func(aura *Aura, sim *Simulation) {
			mask = getCurrentProcMask()
			applyWeaponSpecialization(sim, character, mask, expertiseBonus)
		},
		OnExpire: func(aura *Aura, sim *Simulation) {
			applyWeaponSpecialization(sim, character, mask, -expertiseBonus)
		},
	})

	character.RegisterItemSwapCallback(AllWeaponSlots(), func(sim *Simulation, slot proto.ItemSlot) {
		weaponSpecAura.Deactivate(sim)
		if (character.HasMHWeapon() && slices.Contains(config.weaponTypes, character.MainHand().WeaponType)) ||
			(character.HasOHWeapon() && slices.Contains(config.weaponTypes, character.OffHand().WeaponType)) {
			weaponSpecAura.Activate(sim)
		}
	})
}

func applyWeaponSpecialization(sim *Simulation, character *Character, mask ProcMask, expertiseBonus float64) {
	if mask == ProcMaskMelee || mask == ProcMaskMeleeMH {
		character.AddStatDynamic(sim, stats.ExpertiseRating, expertiseBonus)
		if mask == ProcMaskMeleeMH && character.HasOHWeapon() {
			for _, spell := range character.Spellbook {
				if !spell.ProcMask.Matches(mask) {
					spell.BonusExpertiseRating -= expertiseBonus
				}
			}
		}
	} else if mask == ProcMaskMeleeOH {
		for _, spell := range character.Spellbook {
			if spell.ProcMask.Matches(mask) {
				spell.BonusExpertiseRating += expertiseBonus
			}
		}
	}
}
