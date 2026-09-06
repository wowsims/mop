package hunter

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

type PetAbilityType int

// Pet AI doesn't use abilities immediately, so model this with a 1.2s GCD.
const PetGCD = time.Millisecond * 1200

const (
	Unknown PetAbilityType = iota

	// Beast Master Specific Buffs
	AncientHysteria         // Corehound: Burst Haste
	EmbraceOfTheShaleSpider // Shale Spider: Kings
	QirajiFortitude         // Silithid: Stamina

	// Enemy Debuffs
	Gore                // Boar: Phys Dmg Taken ↑
	Ravage              // Ravager: Phys Dmg Taken ↑
	StampedeDebuff      // Rhino: Phys Dmg Taken ↑
	AcidSpitDebuff      // Worm: Phys Dmg Taken ↑
	DemoralizingRoar    // Bear: Enemy DPS ↓
	DemoralizingScreech // Carrion Bird: Enemy DPS ↓
	FireBreathDebuff    // Dragonhawk: Magic Dmg Taken ↑
	LightningBreath     // Wind Serpent: Magic Dmg Taken ↑
	SporeCloud          // Spore Bat: Reduce Cast Speed
	LavaBreath          // Corehound: Exotic Cast Speed Debuff
	DustCloud           // Tallstrider: Reduce Armor
	TearArmor           // Raptor: Reduce Armor

	// Utility
	FroststormBreathAoE // Chimera: AoE Damage

	MonstrousBite // Devilsaur: Reduce Healing

	// Basic Attacks
	Bite  // FocusDump: Bite
	Claw  // FocusDump: Claw
	Smack // FocusDump: Smack
)

// These IDs are needed for certain talents.
const BiteSpellID = 17253
const ClawSpellID = 16827
const SmackSpellID = 49966

func (hp *HunterPet) NewPetAbility(abilityType PetAbilityType, isPrimary bool) *core.Spell {
	switch abilityType {

	case Gore:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 35290, CD: time.Second * 10, School: core.SpellSchoolPhysical, DebuffAura: core.GoreAura, MaxRange: core.MaxMeleeRange})
	case Ravage:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 50518, CD: time.Second * 10, School: core.SpellSchoolPhysical, DebuffAura: core.RavageAura, MaxRange: core.MaxMeleeRange})
	case StampedeDebuff:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 57386, CD: time.Second * 15, School: core.SpellSchoolPhysical, DebuffAura: core.StampedeAura, MaxRange: core.MaxMeleeRange})
	case AcidSpitDebuff:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 55749, CD: time.Second * 10, School: core.SpellSchoolNature, DebuffAura: core.AcidSpitAura, MaxRange: 30})
	case DemoralizingRoar:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 50256, CD: time.Second * 10, School: core.SpellSchoolNature, DebuffAura: core.DemoralizingRoar, MaxRange: core.MaxMeleeRange})
	case DemoralizingScreech:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 24423, CD: time.Second * 8, School: core.SpellSchoolNature, DebuffAura: core.DemoralizingScreech, MaxRange: core.MaxMeleeRange})
	case FireBreathDebuff:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 34889, CD: time.Second * 30, School: core.SpellSchoolFire, DebuffAura: core.FireBreathDebuff, MaxRange: 40})
	case LightningBreath:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 24844, CD: time.Second * 30, School: core.SpellSchoolFire, DebuffAura: core.LightningBreathDebuff, MaxRange: 40})
	case SporeCloud:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 50274, CD: time.Second * 8, School: core.SpellSchoolFire, DebuffAura: core.SporeCloud, MaxRange: 6})
	case LavaBreath:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 58604, CD: time.Second * 8, School: core.SpellSchoolFire, DebuffAura: core.LavaBreathAura, MaxRange: 30})
	case DustCloud:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 50285, CD: time.Second * 25, School: core.SpellSchoolNature, DebuffAura: core.WeakenedArmorAura, Stacks: 3, MaxRange: core.MaxMeleeRange})
	case TearArmor:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 50498, CD: time.Second * 6, School: core.SpellSchoolNature, DebuffAura: core.WeakenedArmorAura, Stacks: 1, MaxRange: core.MaxMeleeRange})
	case FroststormBreathAoE:
		return hp.newFrostStormBreath()
	case MonstrousBite:
		return hp.newPetDebuff(PetDebuffSpellConfig{SpellID: 54680, CD: time.Second * 8, School: core.SpellSchoolNature, DebuffAura: core.MortalWoundsAura, MaxRange: core.MaxMeleeRange})

	case Bite:
		return hp.newBite()
	case Claw:
		return hp.newClaw()
	case Smack:
		return hp.newSmack()

	case Unknown:
		return nil
	default:
		panic("Invalid pet ability type")
	}
}

type PetDebuffSpellConfig struct {
	DebuffAura func(*core.Unit) *core.Aura
	Stacks     int32
	SpellID    int32
	School     core.SpellSchool
	GCD        time.Duration
	CD         time.Duration
	MaxRange   float64

	OnSpellHitDealt func(*core.Simulation, *core.Spell, *core.SpellResult)
}

func (hp *HunterPet) RegisterKillCommandSpell() *core.Spell {
	chargeAura := hp.RegisterAura(core.Aura{
		Label:    "Charge",
		Duration: 5 * time.Second,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			hp.MultiplyMovementSpeed(sim, 3.0)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			hp.MultiplyMovementSpeed(sim, 1.0/3.0)
		},
	})

	hp.RegisterMovementCallback(func(sim *core.Simulation, position float64, kind core.MovementUpdateType) {
		if kind == core.MovementEnd && chargeAura.IsActive() {
			chargeAura.Deactivate(sim)
		}
	})

	return hp.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 83381},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: HunterSpellKillCommand,
		MaxRange:       25,

		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second * 0,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   hp.CritMultiplier(1.0, 0.0),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := 0.938*spell.RangedAttackPower() + 935
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeRangedHitAndCrit)

			if hp.DistanceFromTarget > core.MaxMeleeRange {
				chargeAura.Activate(sim)
				hp.MoveTo(core.MaxMeleeRange-1, sim)
			}
		},
	})
}

func (hp *HunterPet) newPetDebuff(config PetDebuffSpellConfig) *core.Spell {
	auraArray := hp.NewEnemyAuraArray(config.DebuffAura)
	return hp.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: config.SpellID},
		SpellSchool: config.School, // Adjust the spell school as needed
		ProcMask:    core.ProcMaskEmpty,
		Flags:       core.SpellFlagAPL,
		//ClassSpellMask: HunterPetSpellDebuff, // Define or adjust the class spell mask appropriately
		MaxRange: config.MaxRange,

		FocusCost: core.FocusCostOptions{
			Cost: 0,
		},
		Cast: core.CastConfig{
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    hp.NewTimer(),
				Duration: config.CD,
			},
		},

		ThreatMultiplier: 1,
		FlatThreatBonus:  156,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHit)
			if result.Landed() {
				aura := auraArray.Get(target)
				aura.Activate(sim)

				if aura.MaxStacks > 0 && config.Stacks > 0 {
					aura.AddStacks(sim, config.Stacks)
				}
			}

			spell.DealOutcome(sim, result)
		},

		RelatedAuraArrays: auraArray.ToMap(),
	})
}

func (hp *HunterPet) newFocusDump(spellID int32) *core.Spell {
	blinkStrikes := hp.registerBlinkStrikes()

	return hp.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: spellID},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: HunterPetFocusDump,
		Flags:          core.SpellFlagMeleeMetrics,

		FocusCost: core.FocusCostOptions{
			Cost: 25,
		},
		Cast: core.CastConfig{
			CD: core.Cooldown{
				Duration: time.Millisecond * 3200,
				Timer:    hp.NewTimer(),
			},
			DefaultCast: core.Cast{
				GCD: PetGCD,
			},
			IgnoreHaste: true,
		},

		DamageMultiplierAdditive: 1,
		DamageMultiplier:         1,
		CritMultiplier:           hp.CritMultiplier(1.0, 0.0),
		ThreatMultiplier:         1,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			if !hp.IsEnabled() {
				return false
			}

			if hp.DistanceFromTarget <= core.MaxMeleeRange {
				return true
			}

			return blinkStrikes.CanCast(sim, target)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if hp.DistanceFromTarget > core.MaxMeleeRange && blinkStrikes.CanCast(sim, target) {
				blinkStrikes.Cast(sim, target)
			}

			baseDamage := hp.hunterOwner.CalcAndRollDamageRange(sim, 0.11400000006, 0.34999999404) + (spell.RangedAttackPower() * 0.168)

			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)
		},
	})
}

func (hp *HunterPet) newBite() *core.Spell {
	return hp.newFocusDump(BiteSpellID)
}
func (hp *HunterPet) newClaw() *core.Spell {
	return hp.newFocusDump(ClawSpellID)
}
func (hp *HunterPet) newSmack() *core.Spell {
	return hp.newFocusDump(SmackSpellID)
}

func (hp *HunterPet) getFrostStormTickSpell() *core.Spell {
	config := core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 92380},
		SpellSchool: core.SpellSchoolNature | core.SpellSchoolFrost,
		ProcMask:    core.ProcMaskSpellDamage,
		FocusCost: core.FocusCostOptions{
			Cost: 20,
		},
		BonusCoefficient:         0.288,
		DamageMultiplier:         1,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,
		CritMultiplier:           hp.DefaultCritMultiplier(),
	}
	config.ApplyEffects = func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		damage := 206 + (spell.MeleeAttackPower() * 0.40)
		spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMagicHitAndCrit)
	}
	return hp.RegisterSpell(config)
}

func (hp *HunterPet) newFrostStormBreath() *core.Spell {
	frostStormTickSpell := hp.getFrostStormTickSpell()
	hp.frostStormBreath = hp.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 92380},
		SpellSchool: core.SpellSchoolNature | core.SpellSchoolFrost,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagChanneled | core.SpellFlagNoMetrics,
		FocusCost: core.FocusCostOptions{
			Cost: 20,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: PetGCD,
			},
		},

		DamageMultiplier:         1,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,
		CritMultiplier:           hp.DefaultCritMultiplier(),
		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "FrostStormBreath-" + hp.Label,
			},
			NumberOfTicks:       4,
			TickLength:          time.Second * 2,
			AffectedByCastSpeed: true,
			OnTick: func(sim *core.Simulation, _ *core.Unit, _ *core.Dot) {
				for _, aoeTarget := range sim.Encounter.ActiveTargetUnits {
					frostStormTickSpell.Cast(sim, aoeTarget)
				}
			},
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcAndDealOutcome(sim, target, spell.OutcomeMeleeSpecialHit)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
				frostStormTickSpell.SpellMetrics[target.UnitIndex].Casts += 1
			}
		},
		ExpectedTickDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, _ bool) *core.SpellResult {
			baseDamage := 206 + (spell.MeleeAttackPower() * 0.40)
			return spell.CalcPeriodicDamage(sim, target, baseDamage, spell.OutcomeExpectedMagicCrit)
		},
	})
	return hp.frostStormBreath
}

func (hp *HunterPet) registerRabidCD() {
	hunter := hp.hunterOwner
	if hunter.Options.PetSpec != proto.PetSpec_Ferocity {
		return
	}

	actionID := core.ActionID{SpellID: 53401}

	buffAura := hp.RegisterAura(core.Aura{
		Label:    "Rabid",
		ActionID: actionID,
		Duration: time.Second * 20,
	}).AttachMultiplyMeleeSpeed(1.7)

	rabidSpell := hunter.RegisterSpell(core.SpellConfig{
		ActionID: actionID,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: time.Second * 90,
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return hp.IsEnabled()
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			buffAura.Activate(sim)
		},
	})

	hunter.AddMajorCooldown(core.MajorCooldown{
		Spell: rabidSpell,
		Type:  core.CooldownTypeDPS,
	})
}

func (hp *HunterPet) RegisterDash() *core.Spell {
	if hp.hunterOwner.Options.PetSpec == proto.PetSpec_Tenacity {
		return nil
	}

	actionID := core.ActionID{SpellID: 61684}

	dashAura := hp.RegisterAura(core.Aura{
		Label:    "Dash",
		ActionID: actionID,
		Duration: time.Second * 16,

		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			hp.BoarsSpeedAura.Activate(sim)
		},
	})
	dashAura.NewActiveMovementSpeedEffect(0.8)

	return hp.RegisterSpell(core.SpellConfig{
		ActionID: actionID,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    hp.NewTimer(),
				Duration: time.Second * 32,
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return hp.IsEnabled()
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			dashAura.Activate(sim)
		},
	})
}

func (hp *HunterPet) registerBlinkStrikes() *core.Spell {
	if !hp.hunterOwner.Talents.BlinkStrikes {
		return nil
	}

	core.MakePermanent(hp.RegisterAura(core.Aura{
		Label:    "Blink Strikes",
		ActionID: core.ActionID{SpellID: 130392},
	})).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  HunterPetFocusDump,
		FloatValue: 0.5,
	})

	return hp.RegisterSpell(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 130393},
		MaxRange: 30,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    hp.NewTimer(),
				Duration: time.Second * 20,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			hp.DistanceFromTarget = core.MaxMeleeRange + 1
			hp.MoveTo(hp.DistanceFromTarget-1, sim)
		},
	})
}

func (tp *ThunderhawkPet) RegisterLightningBlast() *core.Spell {
	return tp.RegisterSpell(core.SpellConfig{
		ActionID:     core.ActionID{SpellID: 138374},
		SpellSchool:  core.SpellSchoolNature,
		ProcMask:     core.ProcMaskEmpty,
		MissileSpeed: 35,
		MaxRange:     40,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 1500,
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 1,
		CritMultiplier:   tp.CritMultiplier(1.0, 0.0),
		ThreatMultiplier: 1,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return tp.IsEnabled()
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := sim.RollWithLabel(16000, 24000, "Lightning Blast")
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeRangedHitAndCrit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	})
}
