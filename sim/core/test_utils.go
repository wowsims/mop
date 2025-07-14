package core

import (
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"google.golang.org/protobuf/encoding/protojson"
)

var DefaultSimTestOptions = &proto.SimOptions{
	Iterations: 20,
	IsTest:     true,
	Debug:      false,
	RandomSeed: 101,
}
var StatWeightsDefaultSimTestOptions = &proto.SimOptions{
	Iterations: 300,
	IsTest:     true,
	Debug:      false,
	RandomSeed: 101,
}
var AverageDefaultSimTestOptions = &proto.SimOptions{
	Iterations: 2000,
	IsTest:     true,
	Debug:      false,
	RandomSeed: 101,
}

const ShortDuration = 60
const LongDuration = 300

func FreshDefaultTargetConfig() *proto.Target {
	return &proto.Target{
		Level: CharacterLevel + 3,
		Stats: stats.Stats{
			stats.Armor:       24835,
			stats.AttackPower: 0,
		}.ToProtoArray(),
		MobType: proto.MobType_MobTypeMechanical,

		SwingSpeed:    2,
		MinBaseDamage: 550000,
		ParryHaste:    false,
		DamageSpread:  0.4,
	}
}

var DefaultTargetProto = FreshDefaultTargetConfig()

var FullRaidBuffs = &proto.RaidBuffs{
	// +10% Attack Power
	TrueshotAura: true, // Hunters

	// +10% Melee & Ranged Attack Speed
	UnholyAura: true, // Frost/Unholy DKs

	// +10% Spell Power
	ArcaneBrilliance: true, // Mages

	// +5% Spell Haste
	ShadowForm: true, // Shadow Priests

	// +5% Critical Strike Chance
	LeaderOfThePack: true, // Feral/Guardian Druids

	// +3000 Mastery Rating
	BlessingOfMight: true, // Paladins

	// +5% Strength, Agility, Intellect
	BlessingOfKings: true, // Paladins

	// +10% Stamina
	PowerWordFortitude: true, // Priests

	// Major Haste
	Bloodlust: true,

	// Major Mana Replenishment
	ManaTideTotemCount: 1, // Shamans

	// Crit Damage %
	SkullBannerCount: 1, // Warrior

	// Additional Nature Damage Proc
	StormlashTotemCount: 1, // Shaman
}

var FullPartyBuffs = &proto.PartyBuffs{}

var FullIndividualBuffs = &proto.IndividualBuffs{}

var FullDebuffs = &proto.Debuffs{
	WeakenedBlows:         true,
	PhysicalVulnerability: true,
	WeakenedArmor:         true,
	MortalWounds:          true,
	FireBreath:            true,
	LightningBreath:       true,
	MasterPoisoner:        true,
	CurseOfElements:       true,
	NecroticStrike:        true,
	LavaBreath:            true,
	SporeCloud:            true,
	Slow:                  true,
	MindNumbingPoison:     true,
	CurseOfEnfeeblement:   true,
}

func NewDefaultTarget() *proto.Target {
	return DefaultTargetProto // seems to be read-only
}

func MakeDefaultEncounterCombos() []EncounterCombo {
	var DefaultTarget = NewDefaultTarget()

	multipleTargets := make([]*proto.Target, 21)
	for i := range multipleTargets {
		if i != 10 {
			multipleTargets[i] = DefaultTarget
		} else {
			disabledTarget := FreshDefaultTargetConfig()
			disabledTarget.DisabledAtStart = true
			multipleTargets[i] = disabledTarget
		}
	}

	return []EncounterCombo{
		{
			Label: "ShortSingleTarget",
			Encounter: &proto.Encounter{
				Duration:             ShortDuration,
				ExecuteProportion_20: 0.2,
				ExecuteProportion_25: 0.25,
				ExecuteProportion_35: 0.35,
				ExecuteProportion_45: 0.45,
				ExecuteProportion_90: 0.90,
				Targets: []*proto.Target{
					DefaultTarget,
				},
			},
		},
		{
			Label: "LongSingleTarget",
			Encounter: &proto.Encounter{
				Duration:             LongDuration,
				ExecuteProportion_20: 0.2,
				ExecuteProportion_25: 0.25,
				ExecuteProportion_35: 0.35,
				ExecuteProportion_45: 0.45,
				ExecuteProportion_90: 0.90,
				Targets: []*proto.Target{
					DefaultTarget,
				},
			},
		},
		{
			Label: "LongMultiTarget",
			Encounter: &proto.Encounter{
				Duration:             LongDuration,
				ExecuteProportion_20: 0.2,
				ExecuteProportion_25: 0.25,
				ExecuteProportion_35: 0.35,
				ExecuteProportion_45: 0.45,
				ExecuteProportion_90: 0.90,
				Targets:              multipleTargets,
			},
		},
	}
}

func MakeSingleTargetEncounter(variation float64) *proto.Encounter {
	return &proto.Encounter{
		Duration:             LongDuration,
		DurationVariation:    variation,
		ExecuteProportion_20: 0.2,
		ExecuteProportion_25: 0.25,
		ExecuteProportion_35: 0.35,
		ExecuteProportion_45: 0.45,
		ExecuteProportion_90: 0.90,
		Targets: []*proto.Target{
			NewDefaultTarget(),
		},
	}
}

func RaidSimTest(label string, t *testing.T, rsr *proto.RaidSimRequest, expectedDps float64) {
	result := RunRaidSim(rsr)
	if result.Error != nil {
		t.Fatalf("Sim failed with error: %s", result.Error.Message)
	}
	tolerance := 0.5
	if result.RaidMetrics.Dps.Avg < expectedDps-tolerance || result.RaidMetrics.Dps.Avg > expectedDps+tolerance {
		// Automatically print output if we had debugging enabled.
		if rsr.SimOptions.Debug {
			log.Printf("LOGS:\n%s\n", result.Logs)
		}
		t.Fatalf("%s failed: expected %0f dps from sim but was %0f", label, expectedDps, result.RaidMetrics.Dps.Avg)
	}
}

func RaidBenchmark(b *testing.B, rsr *proto.RaidSimRequest) {
	rsr.Encounter.Duration = LongDuration
	rsr.SimOptions.Iterations = 1

	// Set to false because IsTest adds a lot of computation.
	rsr.SimOptions.IsTest = false

	for i := 0; i < b.N; i++ {
		result := RunRaidSim(rsr)
		if result.Error != nil {
			b.Fatalf("RaidBenchmark() at iteration %d failed: %v", i, result.Error.Message)
		}
	}
}

func GetAplRotation(dir string, file string) RotationCombo {
	filePath := dir + "/" + file + ".apl.json"
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("failed to load apl json file: %s, %s", filePath, err)
	}

	return RotationCombo{Label: file, Rotation: APLRotationFromJsonString(string(data))}
}

func GetGearSet(dir string, file string) GearSetCombo {
	filePath := dir + "/" + file + ".gear.json"
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("failed to load gear json file: %s, %s", filePath, err)
	}

	return GearSetCombo{Label: file, GearSet: EquipmentSpecFromJsonString(string(data))}
}

func GetItemSwapGearSet(dir string, file string) ItemSwapSetCombo {
	filePath := dir + "/" + file + ".gear.json"
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("failed to load gear json file: %s, %s", filePath, err)
	}

	return ItemSwapSetCombo{Label: file, ItemSwap: ItemSwapFromJsonString(string(data))}
}

func GenerateTalentVariations(baseTalents string, baseGlyphs *proto.Glyphs) []TalentsCombo {
	return GenerateTalentVariationsForRows(baseTalents, baseGlyphs, []int{0, 1, 2, 3, 4, 5})
}

func GenerateTalentVariationsForRows(baseTalents string, baseGlyphs *proto.Glyphs, rowsToVary []int) []TalentsCombo {
	if len(baseTalents) != 6 {
		log.Fatalf("Expected 6-digit talent string, got: %s", baseTalents)
	}

	var combinations []TalentsCombo

	baseRunes := []rune(baseTalents)
	for _, row := range rowsToVary {
		if row < 0 || row >= 6 {
			log.Fatalf("Invalid row index: %d, must be between 0 and 5", row)
		}

		for choice := 1; choice <= 3; choice++ {
			if int(baseRunes[row]-'0') == choice {
				continue
			}

			variation := make([]rune, 6)
			copy(variation, baseRunes)
			variation[row] = rune('0' + choice)

			combinations = append(combinations, TalentsCombo{
				Label:   fmt.Sprintf("Row%d_Talent%d", row+1, choice),
				Talents: string(variation),
				Glyphs:  baseGlyphs,
			})
		}
	}

	return combinations
}

func GetTestBuildFromJSON(class proto.Class, dir string, file string, itemFilter ItemFilter, epReferenceStat *proto.Stat, statsToWeigh *[]proto.Stat) CharacterSuiteConfig {
	filePath := dir + "/" + file + ".build.json"
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("failed to load gear json file: %s, %s", filePath, err)
	}

	simSettings := &proto.IndividualSimSettings{}
	if err := protojson.Unmarshal(data, simSettings); err != nil {
		panic(err)
	}

	config := CharacterSuiteConfig{
		Class:       class,
		Race:        simSettings.Player.Race,
		Profession1: simSettings.Player.Profession1,
		Profession2: simSettings.Player.Profession2,
		GearSet: GearSetCombo{
			Label:   file,
			GearSet: simSettings.Player.Equipment,
		},
		SpecOptions: SpecOptionsCombo{
			Label:       file,
			SpecOptions: getPlayerSpecOptions(simSettings.Player),
		},
		Talents: simSettings.Player.TalentsString,
		Glyphs:  simSettings.Player.Glyphs,
		Rotation: RotationCombo{
			Label:    file,
			Rotation: simSettings.Player.Rotation,
		},
		Encounter: EncounterCombo{
			Label:     file,
			Encounter: simSettings.Encounter,
		},
		ItemSwapSet: ItemSwapSetCombo{
			Label:    file,
			ItemSwap: simSettings.Player.ItemSwap,
		},
		StartingDistance: simSettings.Player.DistanceFromTarget,

		Consumables:     simSettings.Player.Consumables,
		IndividualBuffs: simSettings.Player.Buffs,
		PartyBuffs:      simSettings.PartyBuffs,
		RaidBuffs:       simSettings.RaidBuffs,
		Debuffs:         simSettings.Debuffs,
		Cooldowns:       simSettings.Player.Cooldowns,

		InFrontOfTarget: simSettings.Player.InFrontOfTarget,
		TargetDummies:   simSettings.TargetDummies,
		HealingModel:    simSettings.Player.HealingModel,

		ItemFilter: itemFilter,
	}

	if simSettings.Tanks != nil {
		config.Tanks = simSettings.Tanks

		// Check if any of the tanks is the player.
		for _, tank := range simSettings.Tanks {
			if tank.Type == proto.UnitReference_Player {
				config.IsTank = true
				break
			}
		}
	}

	if epReferenceStat != nil {
		config.EPReferenceStat = *epReferenceStat
	}
	if statsToWeigh != nil {
		config.StatsToWeigh = *statsToWeigh
	}

	return config
}

func getPlayerSpecOptions(player *proto.Player) interface{} {
	if playerSpec, ok := player.Spec.(*proto.Player_BloodDeathKnight); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_FrostDeathKnight); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_UnholyDeathKnight); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_BalanceDruid); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_FeralDruid); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_GuardianDruid); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_RestorationDruid); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_BeastMasteryHunter); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_MarksmanshipHunter); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_SurvivalHunter); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ArcaneMage); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_FireMage); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_FrostMage); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_BrewmasterMonk); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_MistweaverMonk); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_WindwalkerMonk); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_HolyPaladin); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ProtectionPaladin); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_RetributionPaladin); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_DisciplinePriest); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_HolyPriest); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ShadowPriest); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_AssassinationRogue); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_CombatRogue); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_SubtletyRogue); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ElementalShaman); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_EnhancementShaman); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_RestorationShaman); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_AfflictionWarlock); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_DemonologyWarlock); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_DestructionWarlock); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ArmsWarrior); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_FuryWarrior); ok {
		return playerSpec
	}
	if playerSpec, ok := player.Spec.(*proto.Player_ProtectionWarrior); ok {
		return playerSpec
	}

	panic("Unsupported spec provided to getPlayerSpecOptions. Please add a case for the spec.")
}
