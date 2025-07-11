package death_knight

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// Damage Done By Caster setup
const (
	DDBC_MercilessCombat int = 0
	DDBC_RuneOfRazorice      = iota

	DDBC_Total
)

type DeathKnightInputs struct {
	// Option Vars
	IsDps bool

	UnholyFrenzyTarget *proto.UnitReference

	Spec proto.Spec
}

type DeathKnight struct {
	core.Character
	Talents *proto.DeathKnightTalents

	Inputs DeathKnightInputs

	// Pets
	Ghoul           *GhoulPet
	ArmyGhoul       []*GhoulPet
	FallenZandalari []*GhoulPet
	AllGhoulPets    []*GhoulPet
	RuneWeapon      *RuneWeaponPet

	BloodPresenceSpell  *core.Spell
	FrostPresenceSpell  *core.Spell
	UnholyPresenceSpell *core.Spell

	PestilenceSpell *core.Spell

	BoneShieldAura         *core.Aura
	BoneWallAura           *core.Aura
	ConversionAura         *core.Aura
	PillarOfFrostAura      *core.Aura
	RaiseDeadAura          *core.Aura
	ThreatOfThassarianAura *core.Aura

	// Diseases
	FrostFeverSpell  *core.Spell
	BloodPlagueSpell *core.Spell

	// Runic power decay, used during pre pull
	RunicPowerDecayAura *core.Aura

	// Item sets
	T14Dps4pc *core.Aura

	// Modified by T14 Tank 4pc
	deathStrikeHealingMultiplier float64

	// Modified by T15 Dps 4pc
	soulReaper45Percent bool
}

func (dk *DeathKnight) GetCharacter() *core.Character {
	return &dk.Character
}

func (dk *DeathKnight) AddPartyBuffs(partyBuffs *proto.PartyBuffs) {
}

func (dk *DeathKnight) AddRaidBuffs(raidBuffs *proto.RaidBuffs) {
	if dk.Spec != proto.Spec_SpecBloodDeathKnight {
		raidBuffs.UnholyAura = true
	}
}

func (dk *DeathKnight) Initialize() {
	dk.registerAntiMagicShell()
	dk.registerArmyOfTheDead()
	dk.registerBloodBoil()
	dk.registerBloodPlague()
	dk.registerDeathAndDecay()
	dk.registerDeathCoil()
	dk.registerDeathStrike()
	dk.registerEmpowerRuneWeapon()
	dk.registerFrostFever()
	dk.registerGlyphs()
	dk.registerHornOfWinter()
	dk.registerIceboundFortitude()
	dk.registerIcyTouch()
	dk.registerOutbreak()
	dk.registerPestilence()
	dk.registerPlagueStrike()
	dk.registerPresences()
	// If talented as permanent pet skip this spell
	if dk.Inputs.Spec != proto.Spec_SpecUnholyDeathKnight {
		dk.registerRaiseDead()
	}
	dk.registerRunicPowerDecay()
	dk.registerSoulReaper()
}

func (dk *DeathKnight) Reset(sim *core.Simulation) {
}

func (dk *DeathKnight) OnEncounterStart(sim *core.Simulation) {
	dk.ResetRunicPowerBar(sim, 20)
}

func (dk *DeathKnight) HasMajorGlyph(glyph proto.DeathKnightMajorGlyph) bool {
	return dk.HasGlyph(int32(glyph))
}
func (dk *DeathKnight) HasMinorGlyph(glyph proto.DeathKnightMinorGlyph) bool {
	return dk.HasGlyph(int32(glyph))
}

func NewDeathKnight(character *core.Character, inputs DeathKnightInputs, talents string, deathRuneConvertSpellId int32) *DeathKnight {
	dk := &DeathKnight{
		Character: *character,
		Talents:   &proto.DeathKnightTalents{},
		Inputs:    inputs,
	}
	core.FillTalentsProto(dk.Talents.ProtoReflect(), talents)

	dk.EnableRunicPowerBar(
		10*time.Second,
		func(sim *core.Simulation, changeType core.RuneChangeType, runeRegen []int8) {
			if deathRuneConvertSpellId == 0 {
				return
			}
			if changeType.Matches(core.ConvertToDeath) {
				deathConvertSpell := dk.GetOrRegisterSpell(core.SpellConfig{
					ActionID:       core.ActionID{SpellID: deathRuneConvertSpellId},
					Flags:          core.SpellFlagNoLogs | core.SpellFlagNoMetrics,
					ClassSpellMask: DeathKnightSpellConvertToDeathRune,
				})
				deathConvertSpell.Cast(sim, nil)
			}
		},
		func(sim *core.Simulation) {
			if sim.CurrentTime >= 0 || dk.RunicPowerDecayAura.IsActive() {
				return
			}

			dk.RunicPowerDecayAura.Activate(sim)
		},
	)

	dk.AddStatDependency(stats.Strength, stats.AttackPower, 2)
	dk.AddStatDependency(stats.Agility, stats.PhysicalCritPercent, core.CritPerAgiMaxLevel[dk.Class])

	baseStrength := dk.GetBaseStats()[stats.Strength]
	dk.PseudoStats.BaseParryChance += baseStrength * core.StrengthToParryPercent
	dk.AddStat(stats.ParryRating, -baseStrength*core.StrengthToParryRating)
	dk.AddStatDependency(stats.Strength, stats.ParryRating, core.StrengthToParryRating)
	dk.AddStatDependency(stats.Agility, stats.DodgeRating, 0.1/10000.0/100.0)

	dk.AddStatDependency(stats.BonusArmor, stats.Armor, 1)

	dk.PseudoStats.CanParry = true

	// 	// Base dodge unaffected by Diminishing Returns
	dk.PseudoStats.BaseDodgeChance += 0.03
	dk.PseudoStats.BaseParryChance += 0.03

	dk.Ghoul = dk.NewGhoulPet(dk.Inputs.Spec == proto.Spec_SpecUnholyDeathKnight)

	dk.ArmyGhoul = make([]*GhoulPet, 8)
	for i := range 8 {
		dk.ArmyGhoul[i] = dk.NewArmyGhoulPet()
	}

	if dk.CouldHaveSetBonus(ItemSetBattleplateOfTheAllConsumingMaw, 2) {
		dk.FallenZandalari = make([]*GhoulPet, 10)
		for i := range 10 {
			dk.FallenZandalari[i] = dk.NewFallenZandalariPet()
		}
	}

	dk.EnableAutoAttacks(dk, core.AutoAttackOptions{
		MainHand:       dk.WeaponFromMainHand(dk.DefaultCritMultiplier()),
		OffHand:        dk.WeaponFromOffHand(dk.DefaultCritMultiplier()),
		AutoSwingMelee: true,
	})

	dk.deathStrikeHealingMultiplier = 0.2

	return dk
}

func (dk *DeathKnight) GetAllActiveGhoulPets() []*core.Pet {
	activePets := make([]*core.Pet, 0, len(dk.AllGhoulPets))
	for _, pet := range dk.AllGhoulPets {
		if pet.IsActive() {
			activePets = append(activePets, pet.GetPet())
		}
	}
	return activePets
}

func (dk *DeathKnight) GetDeathKnight() *DeathKnight {
	return dk
}

type DeathKnightAgent interface {
	GetDeathKnight() *DeathKnight
}

const (
	DeathKnightSpellFlagNone      int64 = 0
	DeathKnightSpellAntiMagicZone int64 = 1 << iota
	DeathKnightSpellArmyOfTheDead
	DeathKnightSpellBloodBoil
	DeathKnightSpellBloodPlague
	DeathKnightSpellBloodPresence
	DeathKnightSpellBloodStrike
	DeathKnightSpellBloodTap
	DeathKnightSpellBoneShield
	DeathKnightSpellConversion
	DeathKnightSpellDancingRuneWeapon
	DeathKnightSpellDarkCommand
	DeathKnightSpellDarkTransformation
	DeathKnightSpellDeathAndDecay
	DeathKnightSpellDeathCoil
	DeathKnightSpellDeathCoilHeal
	DeathKnightSpellDeathPact
	DeathKnightSpellDeathSiphon
	DeathKnightSpellDeathStrike
	DeathKnightSpellDeathStrikeHeal
	DeathKnightSpellEmpowerRuneWeapon
	DeathKnightSpellFesteringStrike
	DeathKnightSpellFrostFever
	DeathKnightSpellFrostPresence
	DeathKnightSpellFrostStrike
	DeathKnightSpellHeartStrike
	DeathKnightSpellHornOfWinter
	DeathKnightSpellHowlingBlast
	DeathKnightSpellIceboundFortitude
	DeathKnightSpellIcyTouch
	DeathKnightSpellLichborne
	DeathKnightSpellObliterate
	DeathKnightSpellOutbreak
	DeathKnightSpellPestilence
	DeathKnightSpellPillarOfFrost
	DeathKnightSpellPlagueLeech
	DeathKnightSpellPlagueStrike
	DeathKnightSpellRaiseDead
	DeathKnightSpellRuneStrike
	DeathKnightSpellRuneTap
	DeathKnightSpellScourgeStrike
	DeathKnightSpellScourgeStrikeShadow
	DeathKnightSpellSoulReaper
	DeathKnightSpellSummonGargoyle
	DeathKnightSpellUnholyBlight
	DeathKnightSpellUnholyFrenzy
	DeathKnightSpellUnholyPresence
	DeathKnightSpellVampiricBlood

	DeathKnightSpellKillingMachine     // Used to react to km procs
	DeathKnightSpellSuddenDoom         // Used to react to km procs
	DeathKnightSpellConvertToDeathRune // Used to react to death rune gains

	DeathKnightSpellLast
	DeathKnightSpellsAll = DeathKnightSpellLast<<1 - 1

	DeathKnightSpellDisease = DeathKnightSpellFrostFever | DeathKnightSpellBloodPlague
)
