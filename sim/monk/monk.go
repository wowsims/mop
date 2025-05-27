package monk

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const (
	SpellFlagBuilder = core.SpellFlagAgentReserved2
	SpellFlagSpender = core.SpellFlagAgentReserved3
)

type OnStanceChanged func(sim *core.Simulation, newStance Stance)
type OnChiSpent func(sim *core.Simulation, chiSpent int32)
type OnNewBrewStacks func(sim *core.Simulation, stacksToAdd int32)

type Monk struct {
	core.Character

	ClassSpellScaling float64

	Talents           *proto.MonkTalents
	Options           *proto.MonkOptions
	BrewmasterOptions *proto.BrewmasterMonk_Options
	MistweaverOptions *proto.MistweaverMonk_Options
	WindwalkerOptions *proto.WindwalkerMonk_Options

	HandType proto.HandType

	Stance Stance

	StanceOfTheSturdyOx    *core.Spell
	StanceOfTheWiseSerpent *core.Spell
	StanceOfTheFierceTiger *core.Spell

	StanceOfTheFierceTigerAura *core.Aura
	StanceOfTheSturdyOxAura    *core.Aura
	StanceOfTheWiseSerpentAura *core.Aura

	ComboBreakerBlackoutKickAura *core.Aura
	ComboBreakerTigerPalmAura    *core.Aura

	ChiSphereAura          *core.Aura
	PowerStrikesAura       *core.Aura
	PowerStrikesChiMetrics *core.ResourceMetrics

	onStanceChanged OnStanceChanged
	onChiSpent      OnChiSpent
	onNewBrewStacks OnNewBrewStacks
	chiBrewRecharge *core.PendingAction
}

func (monk *Monk) ChangeStance(sim *core.Simulation, newStance Stance) {
	switch monk.Stance {
	case SturdyOx:
		monk.StanceOfTheSturdyOx.Cast(sim, &monk.Unit)
	case WiseSerpent:
		monk.StanceOfTheWiseSerpent.Cast(sim, &monk.Unit)
	case FierceTiger:
		if monk.Spec == proto.Spec_SpecWindwalkerMonk {
			monk.StanceOfTheFierceTigerAura.Activate(sim)
		} else {
			monk.StanceOfTheFierceTiger.Cast(sim, &monk.Unit)
		}
	}

	if monk.onStanceChanged != nil {
		monk.onStanceChanged(sim, newStance)
	}
}

func (monk *Monk) RegisterOnStanceChanged(onStanceChanged OnStanceChanged) {
	monk.onStanceChanged = onStanceChanged
}

func (monk *Monk) AddChi(sim *core.Simulation, spell *core.Spell, pointsToAdd int32, metrics *core.ResourceMetrics) {
	monk.AddComboPoints(sim, pointsToAdd, metrics)

	if spell != nil && spell.Flags.Matches(SpellFlagBuilder) {
		// TODO: Verify that RJW can trigger Power Strikes
		monk.TriggerPowerStrikes(sim)
	}
}

func (monk *Monk) SpendChi(sim *core.Simulation, chiToSpend int32, metrics *core.ResourceMetrics) {
	monk.SpendPartialComboPoints(sim, chiToSpend, metrics)
	if monk.onChiSpent != nil {
		monk.onChiSpent(sim, chiToSpend)
	}
}

func (monk *Monk) RegisterOnChiSpent(onChiSpent OnChiSpent) {
	monk.onChiSpent = onChiSpent
}

func (monk *Monk) AddBrewStacks(sim *core.Simulation, stacksToAdd int32) {
	if monk.onNewBrewStacks != nil {
		monk.onNewBrewStacks(sim, stacksToAdd)
	}
}
func (monk *Monk) RegisterOnNewBrewStacks(onNewBrewStacks OnNewBrewStacks) {
	monk.onNewBrewStacks = onNewBrewStacks
}

func (monk *Monk) GetCharacter() *core.Character {
	return &monk.Character
}

func (monk *Monk) GetMonk() *Monk {
	return monk
}

func (monk *Monk) AddRaidBuffs(raidBuffs *proto.RaidBuffs) {
	// raidBuffs.LegacyOfTheEmperor = true
	// raidBuffs.LegacyOfTheWhiteTiger = true
}

func (monk *Monk) AddPartyBuffs(_ *proto.PartyBuffs) {}

func (monk *Monk) HasMajorGlyph(glyph proto.MonkMajorGlyph) bool {
	return monk.HasGlyph(int32(glyph))
}
func (monk *Monk) HasMinorGlyph(glyph proto.MonkMinorGlyph) bool {
	return monk.HasGlyph(int32(glyph))
}

func (monk *Monk) Initialize() {
	monk.AutoAttacks.MHConfig().CritMultiplier = monk.DefaultCritMultiplier()
	monk.AutoAttacks.OHConfig().CritMultiplier = monk.DefaultCritMultiplier()

	monk.registerStances()
	monk.applyGlyphs()
	monk.registerSpells()
	monk.registerWayOfTheMonk()
	monk.registerSwiftReflexes()
}

func (monk *Monk) registerSpells() {
	monk.registerBlackoutKick()
	monk.registerExpelHarm()
	monk.registerJab()
	monk.registerSpinningCraneKick()
	monk.registerTigerPalm()
	monk.registerCracklingJadeLightning()
	monk.registerFortifyingBrew()
}

func (monk *Monk) Reset(sim *core.Simulation) {
	monk.ChangeStance(sim, monk.Stance)
}

func (monk *Monk) GetHandType() proto.HandType {
	mh := monk.GetMHWeapon()

	if mh != nil && (mh.WeaponType == proto.WeaponType_WeaponTypeStaff || mh.WeaponType == proto.WeaponType_WeaponTypePolearm) {
		return proto.HandType_HandTypeTwoHand

	}
	return proto.HandType_HandTypeOneHand
}

func (monk *Monk) GetAttackPowerPerDPS() float64 {
	if monk.Spec == proto.Spec_SpecBrewmasterMonk {
		return 1.0 / 11.0
	}
	return 1.0 / core.DefaultAttackPowerPerDPS
}

func NewMonk(character *core.Character, options *proto.MonkOptions, talents string) *Monk {
	monk := &Monk{
		Character:         *character,
		Talents:           &proto.MonkTalents{},
		Options:           options,
		ClassSpellScaling: core.GetClassSpellScalingCoefficient(proto.Class_ClassMonk),
	}

	core.FillTalentsProto(monk.Talents.ProtoReflect(), talents)

	monk.PseudoStats.CanParry = true

	monk.EnableEnergyBar(core.EnergyBarOptions{
		MaxComboPoints: 4,
		MaxEnergy:      100.0,
		UnitClass:      proto.Class_ClassMonk,
	})

	monk.EnableAutoAttacks(monk, core.AutoAttackOptions{
		MainHand:       monk.WeaponFromMainHand(0),
		OffHand:        monk.WeaponFromOffHand(0),
		AutoSwingMelee: true,
	})

	monk.AddStatDependency(stats.Agility, stats.PhysicalCritPercent, core.CritPerAgiMaxLevel[character.Class])

	monk.HandType = monk.GetHandType()

	monk.RegisterItemSwapCallback(core.MeleeWeaponSlots(), func(sim *core.Simulation, slot proto.ItemSlot) {
		monk.HandType = monk.GetHandType()
	})

	return monk
}

type MonkAgent interface {
	GetMonk() *Monk
}

const (
	MonkSpellFlagNone     int64 = 0
	MonkSpellBlackoutKick int64 = 1 << iota
	MonkSpellExpelHarm
	MonkSpellJab
	MonkSpellSpinningCraneKick
	MonkSpellTigerPalm
	MonkSpellCracklingJadeLightning
	MonkSpellFortifyingBrew

	// -- Talents
	// Level 15
	MonkSpellCelerity
	MonkSpellTigersLust
	MonkSpellMomentum

	// Level 30
	MonkSpellChiWave
	MonkSpellZenSphere
	MonkSpellChiBurst

	// Level 45
	MonkSpellChiSphere
	MonkSpellChiBrew

	// Level 75
	MonkSpellHealingElixirs
	MonkSpellDampenHarm
	MonkSpellDiffuseMagic

	//Level 90
	MonkSpellRushingJadeWind
	MonkSpellInvokeXuenTheWhiteTiger
	MonkSpellChiTorpedo
	// -- Talents

	// Windwalker
	MonkSpellEnergizingBrew
	MonkSpellFistsOfFury
	MonkSpellRisingSunKick
	MonkSpellTigereyeBrew
	MonkSpellTigerStrikes
	MonkSpellSpinningFireBlossom

	// Brewmaster
	MonkSpellGuard

	//Mistweaver
	MonkSpellRenewingMist

	MonkSpellLast
	MonkSpellsAll = MonkSpellLast<<1 - 1
)
