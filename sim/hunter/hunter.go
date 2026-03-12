package hunter

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const ThoridalTheStarsFuryItemID = 34334

type Hunter struct {
	core.Character

	ClassSpellScaling float64

	Talents *proto.HunterTalents
	Options *proto.HunterOptions

	Pet          *HunterPet
	StampedePet  []*HunterPet
	DireBeastPet *HunterPet
	Thunderhawks []*ThunderhawkPet

	// Hunter spells
	AspectOfTheHawk      *core.Spell
	ExplosiveTrap        *core.Spell
	HuntersMarkSpell     *core.Spell
	ImprovedSerpentSting *core.Spell
	RapidFire            *core.Spell
	SerpentSting         *core.Spell

	BestialWrathAura *core.Aura
}

func (hunter *Hunter) GetCharacter() *core.Character {
	return &hunter.Character
}

func (hunter *Hunter) GetHunter() *Hunter {
	return hunter
}

func NewHunter(character *core.Character, options *proto.Player, hunterOptions *proto.HunterOptions) *Hunter {
	hunter := &Hunter{
		Character:         *character,
		Talents:           &proto.HunterTalents{},
		Options:           hunterOptions,
		ClassSpellScaling: core.GetClassSpellScalingCoefficient(proto.Class_ClassHunter),
	}

	core.FillTalentsProto(hunter.Talents.ProtoReflect(), options.TalentsString)
	focusPerSecond := 4.0

	kindredSpritsBonusFocus := core.TernaryFloat64(hunter.Spec == proto.Spec_SpecBeastMasteryHunter, 20, 0)
	hunter.EnableFocusBar(100+kindredSpritsBonusFocus, focusPerSecond, true, nil, true)

	rangedWeapon := hunter.WeaponFromRanged(0)

	hunter.EnableAutoAttacks(hunter, core.AutoAttackOptions{
		Ranged:          rangedWeapon,
		AutoSwingRanged: true,
		AutoSwingMelee:  false,
	})

	hunter.AutoAttacks.RangedConfig().ApplyEffects = func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		baseDamage := hunter.RangedWeaponDamage(sim, spell.RangedAttackPower())

		result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeRangedHitAndCrit)

		spell.WaitTravelTime(sim, func(sim *core.Simulation) {
			spell.DealDamage(sim, result)
		})
	}

	hunter.AddStatDependencies()

	hunter.Pet = hunter.NewHunterPet()
	hunter.StampedePet = make([]*HunterPet, 4)
	for index := range 4 {
		hunter.StampedePet[index] = hunter.NewStampedePet(index)
	}

	if hunter.Talents.DireBeast {
		hunter.DireBeastPet = hunter.NewDireBeastPet()
	}

	if hunter.CouldHaveSetBonus(SaurokStalker, 2) {
		// Add 10 just to be protected against weird good luck :)
		hunter.Thunderhawks = make([]*ThunderhawkPet, 10)
		for index := range 10 {
			hunter.Thunderhawks[index] = hunter.NewThunderhawkPet(index)
		}
	}

	return hunter
}

func (hunter *Hunter) Initialize() {
	hunter.AutoAttacks.RangedConfig().CritMultiplier = hunter.DefaultCritMultiplier()

	hunter.RegisterSpells()
}

func (hunter *Hunter) GetBaseDamageFromCoeff(coeff float64) float64 {
	return coeff * hunter.ClassSpellScaling
}

func (hunter *Hunter) ApplyTalents() {
	hunter.applyThrillOfTheHunt()
	hunter.ApplyHotfixes()
	hunter.addBloodthirstyGloves()
	hunter.applyAutoShotTriggers()

	if hunter.Pet != nil {
		hunter.Pet.ApplyTalents()
	}

	hunter.ApplyArmorSpecializationEffect(stats.Agility, proto.ArmorType_ArmorTypeMail, 86538)
}

func (hunter *Hunter) RegisterSpells() {
	hunter.registerArcaneShotSpell()
	hunter.registerKillShotSpell()
	hunter.registerHawkSpell()
	hunter.RegisterLynxRushSpell()
	hunter.registerSerpentStingSpell()
	hunter.registerMultiShotSpell()
	hunter.registerExplosiveTrapSpell()
	hunter.registerCobraShotSpell()
	hunter.registerRapidFireCD()
	hunter.registerSilencingShotSpell()
	hunter.registerHuntersMarkSpell()
	hunter.registerAMOCSpell()
	hunter.registerBarrageSpell()
	hunter.registerGlaiveTossSpell()
	hunter.registerFervorSpell()
	hunter.RegisterDireBeastSpell()
	hunter.RegisterStampedeSpell()
	hunter.registerPowerShotSpell()
}

func (hunter *Hunter) AddStatDependencies() {
	hunter.AddStatDependency(stats.Agility, stats.AttackPower, 2)
	hunter.AddStatDependency(stats.Agility, stats.RangedAttackPower, 2)
	hunter.AddStatDependency(stats.Agility, stats.PhysicalCritPercent, core.CritPerAgiMaxLevel[hunter.Class])
}

func (hunter *Hunter) AddRaidBuffs(raidBuffs *proto.RaidBuffs) {
	raidBuffs.TrueshotAura = true

	switch hunter.Options.PetType {
	case proto.HunterOptions_CoreHound:
		raidBuffs.Bloodlust = true
	case proto.HunterOptions_ShaleSpider:
		raidBuffs.EmbraceOfTheShaleSpider = true
	case proto.HunterOptions_Wolf:
		raidBuffs.FuriousHowl = true
	case proto.HunterOptions_Devilsaur:
		raidBuffs.TerrifyingRoar = true
	case proto.HunterOptions_WaterStrider:
		raidBuffs.StillWater = true
	case proto.HunterOptions_Hyena:
		raidBuffs.CacklingHowl = true
	case proto.HunterOptions_Serpent:
		raidBuffs.SerpentsSwiftness = true
	case proto.HunterOptions_SporeBat:
		raidBuffs.MindQuickening = true
	case proto.HunterOptions_Cat:
		raidBuffs.RoarOfCourage = true
	case proto.HunterOptions_SpiritBeast:
		raidBuffs.SpiritBeastBlessing = true
	}
}

func (hunter *Hunter) AddPartyBuffs(_ *proto.PartyBuffs) {
}

func (hunter *Hunter) HasMajorGlyph(glyph proto.HunterMajorGlyph) bool {
	return hunter.HasGlyph(int32(glyph))
}
func (hunter *Hunter) HasMinorGlyph(glyph proto.HunterMinorGlyph) bool {
	return hunter.HasGlyph(int32(glyph))
}

func (hunter *Hunter) Reset(_ *core.Simulation) {
}

func (hunter *Hunter) OnEncounterStart(sim *core.Simulation) {
}

func (hunter *Hunter) applyAutoShotTriggers() {
	prepullCheck := func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) bool {
		return sim.CurrentTime < 0 && !hunter.SpellInFlight(hunter.AutoAttacks.RangedAuto())
	}

	enableAutoShot := func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
		hunter.AutoAttacks.EnableRangedSwing(sim, true)
	}

	hunter.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Initiate auto shot on spell cast complete",
		Callback:           core.CallbackOnCastComplete,
		ClassSpellMask:     HunterSpellsAutoOnCastComplete,
		TriggerImmediately: true,

		ExtraCondition: prepullCheck,
		Handler:        enableAutoShot,
	})

	hunter.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Initiate auto shot on spell cast",
		Callback:           core.CallbackOnApplyEffects,
		ClassSpellMask:     HunterSpellsAutoOnCast,
		TriggerImmediately: true,

		ExtraCondition: prepullCheck,
		Handler:        enableAutoShot,
	})
}

const (
	HunterSpellFlagsNone int64 = 0
	SpellMaskSpellRanged int64 = 1 << iota
	HunterSpellAutoShot
	HunterSpellSteadyShot
	HunterSpellCobraShot
	HunterSpellArcaneShot
	HunterSpellKillCommand
	HunterSpellChimeraShot
	HunterSpellExplosiveShot
	HunterSpellExplosiveTrap
	HunterSpellBlackArrow
	HunterSpellMultiShot
	HunterSpellAimedShot
	HunterSpellSerpentSting
	HunterSpellKillShot
	HunterSpellRapidFire
	HunterSpellBestialWrath
	HunterPetFocusDump
	HunterPetDamage
	HunterPetBeastCleaveHit
	HunterSpellFervor
	HunterSpellDireBeast
	HunterSpellAMurderOfCrows
	HunterSpellLynxRush
	HunterSpellGlaiveToss
	HunterSpellBarrage
	HunterSpellPowershot
	HunterSpellsAll = HunterSpellSteadyShot | HunterSpellCobraShot |
		HunterSpellArcaneShot | HunterSpellKillCommand | HunterSpellChimeraShot | HunterSpellExplosiveShot |
		HunterSpellExplosiveTrap | HunterSpellBlackArrow | HunterSpellMultiShot | HunterSpellAimedShot |
		HunterSpellSerpentSting | HunterSpellKillShot | HunterSpellRapidFire | HunterSpellBestialWrath
	HunterSpellsTalents = HunterSpellFervor | HunterSpellDireBeast | HunterSpellAMurderOfCrows | HunterSpellLynxRush | HunterSpellGlaiveToss | HunterSpellPowershot | HunterSpellBarrage

	// These spells trigger auto shot when their cast time finishes
	HunterSpellsAutoOnCastComplete = HunterSpellCobraShot | HunterSpellAimedShot

	// These spells trigger auto shot when they are cast
	HunterSpellsAutoOnCast = HunterSpellSteadyShot | HunterSpellArcaneShot | HunterSpellChimeraShot |
		HunterSpellExplosiveShot | HunterSpellBlackArrow | HunterSpellMultiShot | HunterSpellSerpentSting | HunterSpellKillShot
)

// Agent is a generic way to access underlying hunter on any of the agents.
type HunterAgent interface {
	GetHunter() *Hunter
}
