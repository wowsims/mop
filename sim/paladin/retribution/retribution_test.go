package retribution

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterRetributionPaladin()
	common.RegisterAllEffects()
}

func TestRetribution(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class: proto.Class_ClassPaladin,
			Race:  proto.Race_RaceBloodElf,

			GearSet:         core.GetGearSet("../../../ui/paladin/retribution/gear_sets", "p2"),
			Talents:         StandardTalents,
			OtherTalentSets: OtherTalentSets,
			Glyphs:          StandardGlyphs,
			Consumables:     FullConsumesSpec,
			SpecOptions:     core.SpecOptionsCombo{Label: "Seal of Truth", SpecOptions: SealOfTruth},
			OtherSpecOptions: []core.SpecOptionsCombo{
				{Label: "Seal of Insight", SpecOptions: SealOfInsight},
				{Label: "Seal of Justice", SpecOptions: SealOfJustice},
				{Label: "Seal of Righteousness", SpecOptions: SealOfRighteousness},
			},
			Rotation:    core.GetAplRotation("../../../ui/paladin/retribution/apls", "default"),
			Profession1: proto.Profession_Engineering,
			Profession2: proto.Profession_Blacksmithing,

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
		},
	}))
}

var StandardTalents = "000023"
var OtherTalentSets = []core.TalentsCombo{
	{Label: "HolyAvenger_HolyPrism", Talents: "000011", Glyphs: StandardGlyphs},
	{Label: "HolyAvenger_LightsHammer", Talents: "000012", Glyphs: StandardGlyphs},
	{Label: "HolyAvenger_ExecutionSentence", Talents: "000013", Glyphs: StandardGlyphs},
	{Label: "SanctifiedWrath_HolyPrism", Talents: "000021", Glyphs: StandardGlyphs},
	{Label: "SanctifiedWrath_LightsHammer", Talents: "000022", Glyphs: StandardGlyphs},
	// {Label: "SanctifiedWrath_ExecutionSentence", Talents: "000023", Glyphs: StandardGlyphs},
	{Label: "DivinePurpose_HolyPrism", Talents: "000031", Glyphs: StandardGlyphs},
	{Label: "DivinePurpose_LightsHammer", Talents: "000032", Glyphs: StandardGlyphs},
	{Label: "DivinePurpose_ExecutionSentence", Talents: "000033", Glyphs: StandardGlyphs},
}
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
	FlaskId:  76088, // Flask of Winter's Bite
	FoodId:   74646, // Black Pepper Ribs and Shrimp
	PotId:    76095, // Potion of Mogu Power
	PrepotId: 76095, // Potion of Mogu Power
}
