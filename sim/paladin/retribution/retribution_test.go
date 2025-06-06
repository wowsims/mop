package retribution

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterRetributionPaladin()
}

func TestRetribution(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator(core.CharacterSuiteConfig{
		Class: proto.Class_ClassPaladin,
		Race:  proto.Race_RaceBloodElf,

		GearSet:     core.GetGearSet("../../../ui/paladin/retribution/gear_sets", "p1"),
		Talents:     StandardTalents,
		Glyphs:      StandardGlyphs,
		Consumables: FullConsumesSpec,
		SpecOptions: core.SpecOptionsCombo{Label: "Seal of Truth", SpecOptions: SealOfTruth},
		OtherSpecOptions: []core.SpecOptionsCombo{
			{Label: "Seal of Insight", SpecOptions: SealOfInsight},
			{Label: "Seal of Justice", SpecOptions: SealOfJustice},
			{Label: "Seal of Righteousness", SpecOptions: SealOfRighteousness},
		},
		Rotation: core.GetAplRotation("../../../ui/paladin/retribution/apls", "default"),

		ItemFilter: core.ItemFilter{
			WeaponTypes: []proto.WeaponType{
				proto.WeaponType_WeaponTypeAxe,
				proto.WeaponType_WeaponTypeSword,
				proto.WeaponType_WeaponTypePolearm,
				proto.WeaponType_WeaponTypeMace,
			},
			HandTypes: []proto.HandType{
				proto.HandType_HandTypeTwoHand,
			},
			ArmorType:         proto.ArmorType_ArmorTypePlate,
			RangedWeaponTypes: []proto.RangedWeaponType{},
		},
	}))
}

func BenchmarkSimulate(b *testing.B) {
	rsr := &proto.RaidSimRequest{
		Raid: core.SinglePlayerRaidProto(
			&proto.Player{
				Race:           proto.Race_RaceBloodElf,
				Class:          proto.Class_ClassPaladin,
				Equipment:      core.GetGearSet("../../../ui/paladin/retribution/gear_sets", "p1").GearSet,
				Consumables:    FullConsumesSpec,
				Spec:           SealOfTruth,
				Glyphs:         StandardGlyphs,
				TalentsString:  StandardTalents,
				Buffs:          core.FullIndividualBuffs,
				ReactionTimeMs: 100,
				Rotation:       core.GetAplRotation("../../../ui/paladin/retribution/apls", "default").Rotation,
			},
			core.FullPartyBuffs,
			core.FullRaidBuffs,
			core.FullDebuffs),
		Encounter: &proto.Encounter{
			Duration:          300,
			DurationVariation: 30,
			Targets: []*proto.Target{
				core.NewDefaultTarget(),
			},
		},
		SimOptions: core.AverageDefaultSimTestOptions,
	}

	core.RaidBenchmark(b, rsr)
}

var StandardTalents = "221223"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.PaladinMajorGlyph_GlyphOfTemplarsVerdict),
	Major2: int32(proto.PaladinMajorGlyph_GlyphOfDoubleJeopardy),
	Major3: int32(proto.PaladinMajorGlyph_GlyphOfMassExorcism),
}

var SealOfInsight = &proto.Player_RetributionPaladin{
	RetributionPaladin: &proto.RetributionPaladin{
		Options: &proto.RetributionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Insight,
			},
		},
	},
}

var SealOfJustice = &proto.Player_RetributionPaladin{
	RetributionPaladin: &proto.RetributionPaladin{
		Options: &proto.RetributionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Justice,
			},
		},
	},
}

var SealOfRighteousness = &proto.Player_RetributionPaladin{
	RetributionPaladin: &proto.RetributionPaladin{
		Options: &proto.RetributionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Righteousness,
			},
		},
	},
}

var SealOfTruth = &proto.Player_RetributionPaladin{
	RetributionPaladin: &proto.RetributionPaladin{
		Options: &proto.RetributionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Truth,
			},
		},
	},
}

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76088,  // Flask of Winter's Bite
	FoodId:   74646,  // Black Pepper Ribs and Shrimp
	PotId:    76095,  // Potion of Mogu Power
	PrepotId: 76095,  // Potion of Mogu Power
	TinkerId: 126734, // Synapse Springs Mark II
}
