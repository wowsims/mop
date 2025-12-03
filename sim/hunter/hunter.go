package hunter

import (
	"fmt"
	"time"

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
	AimedShot            *core.Spell
	AspectOfTheHawk      *core.Spell
	BlackArrow           *core.Spell
	CobraShot            *core.Spell
	ExplosiveTrap        *core.Spell
	Fervor               *core.Spell
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

	hunter.RegisterRotationTransformation(hunter.autoPrePull)

	return hunter
}

func (hunter *Hunter) autoPrePull(raid *proto.Raid, rotation *proto.APLRotation) {
	if !hasAutoPrePullAction(rotation) {
		return
	}

	actions := `{"prepullActions":[` +
		castSpellAction(hunter.AspectOfTheHawk.SpellID, core.DurationFromSeconds(-10)) + "," +
		castSpellAction(hunter.HuntersMarkSpell.SpellID, core.DurationFromSeconds(-9)) + "," +
		castSpellAction(hunter.ExplosiveTrap.SpellID, core.DurationFromSeconds(-5)) + ","

	switch hunter.Spec {
	case proto.Spec_SpecMarksmanshipHunter:
		actions += hunter.marksmanshipPrepull(raid)
	case proto.Spec_SpecBeastMasteryHunter:
		actions += hunter.beastMasteryPrepull(raid)
	case proto.Spec_SpecSurvivalHunter:
		actions += hunter.survivalPrepull(raid)
	}

	rotation.PrepullActions = core.APLRotationFromJsonString(actions + "]}").PrepullActions
}

func (hunter *Hunter) marksmanshipPrepull(raid *proto.Raid) string {
	if hunter.Talents.DireBeast {
		// For MM with Dire Beast, just pop a prepot
		return usePotionAction(core.DurationFromSeconds(-0.5))
	}

	offset := time.Millisecond * 100
	aimedCastTime := applyHasteBuff(hunter.AimedShot, raid.Buffs)

	// Base Serpent Sting schedule time on it landing at +0.1s
	srsScheduleTime := offset - hunter.SerpentSting.TravelTime()

	// Round the aimed cast time to even 100ms intervals (away from zero), to somehow simulate actual timing of a pull timer
	aimedScheduleTime := srsScheduleTime - aimedCastTime.Round(offset)

	// If the calculated timestamp would result in the Aimed Shot hitting before combat starts, add 100ms
	if aimedScheduleTime+aimedCastTime+hunter.AimedShot.TravelTime() < 0 {
		aimedScheduleTime += offset
	}

	// If the calculated timestamp would overlap with the scheduled Serpent Sting cast, base Serpent Sting on Aimed Shot + 10ms
	if srsScheduleTime <= aimedScheduleTime+aimedCastTime {
		srsScheduleTime = aimedScheduleTime + aimedCastTime + core.SpellBatchWindow
	}

	actions := usePotionAction(aimedScheduleTime) + "," +
		castSpellAction(hunter.AimedShot.SpellID, aimedScheduleTime) + "," +
		castSpellAction(hunter.SerpentSting.SpellID, srsScheduleTime) + ","

	if hunter.Talents.Fervor {
		// Schedule Fervor a reaction time unit after Serpent Sting to be a bit more realistic
		actions += castSpellAction(hunter.Fervor.SpellID, srsScheduleTime+hunter.ReactionTime)
	}

	return actions
}

func (hunter *Hunter) beastMasteryPrepull(raid *proto.Raid) string {
	offset := time.Millisecond * 100
	cobraCastTime := applyHasteBuff(hunter.CobraShot, raid.Buffs)

	// Base Cobra Shot schedule time on it finishing at +0.1s
	cobraScheduleTime := offset - cobraCastTime.Round(offset)

	// If the calculated timestamp would result in the Cobra Shot hitting before combat starts, add 100ms
	if cobraScheduleTime+cobraCastTime+hunter.CobraShot.TravelTime() < 0 {
		cobraScheduleTime += offset
	}

	return usePotionAction(cobraScheduleTime) + "," +
		castSpellAction(hunter.CobraShot.SpellID, cobraScheduleTime)
}

func (hunter *Hunter) survivalPrepull(raid *proto.Raid) string {
	offset := time.Millisecond * 100
	cobraCastTime := applyHasteBuff(hunter.CobraShot, raid.Buffs)

	// Base Black Arrow schedule time on it landing at +0.1s
	blackArrowScheduleTime := offset - hunter.BlackArrow.TravelTime()

	// Round the aimed cast time to even 100ms intervals (away from zero), to somehow simulate actual timing of a pull timer
	cobraScheduleTime := blackArrowScheduleTime - cobraCastTime.Round(offset)

	// If the calculated timestamp would result in the Cobra Shot hitting before combat starts, add 100ms
	if cobraScheduleTime+cobraCastTime+hunter.CobraShot.TravelTime() < 0 {
		cobraScheduleTime += offset
	}

	// If the calculated timestamp would overlap with the scheduled Black Arrow cast, base BA on Cobra Shot + 10ms
	if blackArrowScheduleTime <= cobraScheduleTime+cobraCastTime {
		blackArrowScheduleTime = cobraScheduleTime + cobraCastTime + core.SpellBatchWindow
	}

	return usePotionAction(cobraScheduleTime) + "," +
		castSpellAction(hunter.CobraShot.SpellID, cobraScheduleTime) + "," +
		castSpellAction(hunter.BlackArrow.SpellID, blackArrowScheduleTime)
}

func hasAutoPrePullAction(rotation *proto.APLRotation) bool {
	for _, action := range rotation.PrepullActions {
		if _, ok := action.Action.Action.(*proto.APLAction_HunterPrePull); ok && !action.Hide {
			return true
		}
	}
	return false
}

func applyHasteBuff(spell *core.Spell, raidBuffs *proto.RaidBuffs) time.Duration {
	castTime := spell.CastTime()
	if raidBuffs.UnholyAura || raidBuffs.SerpentsSwiftness || raidBuffs.SwiftbladesCunning || raidBuffs.UnleashedRage || raidBuffs.CacklingHowl {
		return time.Duration(float64(castTime) / 1.1)
	}
	return castTime
}

func usePotionAction(doAt time.Duration) string {
	return fmt.Sprintf(`{"action":{"castSpell":{"spellId":{"otherId":"OtherActionPotion"}}},"doAtValue":{"const":{"val":"%fs"}}}`, doAt.Seconds())
}

func castSpellAction(spellID int32, doAt time.Duration) string {
	return fmt.Sprintf(`{"action":{"castSpell":{"spellId":{"spellId":%d}}},"doAtValue":{"const":{"val":"%fs"}}}`, spellID, doAt.Seconds())
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
)

// Agent is a generic way to access underlying hunter on any of the agents.
type HunterAgent interface {
	GetHunter() *Hunter
}
