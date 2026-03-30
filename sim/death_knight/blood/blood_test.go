package blood

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/encounters/toes"
)

func init() {
	RegisterBloodDeathKnight()
	common.RegisterAllEffects()
	toes.Register()
}

func TestBlood(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		core.GetTestBuildFromJSON(proto.Class_ClassDeathKnight, "../../../ui/death_knight/blood/builds", "horridon_default", ItemFilter, nil, nil),
		core.GetTestBuildFromJSON(proto.Class_ClassDeathKnight, "../../../ui/death_knight/blood/builds", "sha_default", ItemFilter, nil, nil),
		{
			Class:      proto.Class_ClassDeathKnight,
			Race:       proto.Race_RaceOrc,
			OtherRaces: []proto.Race{proto.Race_RaceWorgen},

			GearSet: core.GetGearSet("../../../ui/death_knight/blood/gear_sets", "p4"),

			Talents: BloodTalents,
			Glyphs:  BloodDefaultGlyphs,
			OtherTalentSets: []core.TalentsCombo{
				{Label: "RC-example-build", Talents: AltTalents, Glyphs: AltGlyphs},
			},

			Consumables: FullConsumesSpec,
			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: PlayerOptionsBlood},
			Rotation:    core.GetAplRotation("../../../ui/death_knight/blood/apls", "sha"),
			Profession1: proto.Profession_Engineering,
			Profession2: proto.Profession_Blacksmithing,

			InFrontOfTarget: true,
			IsTank:          true,

			ItemFilter: ItemFilter,
		},
	}))
}

var BloodTalents = "231111"
var BloodDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfLoudHorn),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfRegenerativeMagic),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfIceboundFortitude),
	Minor1: int32(proto.DeathKnightMinorGlyph_GlyphOfTheLongWinter),
}

var AltTalents = "121131"
var AltGlyphs = &proto.Glyphs{
	Major1: 43826,
	Major2: 43825,
	Major3: 104049,
	Minor1: 43550,
	Minor2: 43672,
	Minor3: 104101,
}

var PlayerOptionsBlood = &proto.Player_BloodDeathKnight{
	BloodDeathKnight: &proto.BloodDeathKnight{
		Options: &proto.BloodDeathKnight_Options{
			ClassOptions: &proto.DeathKnightOptions{},
		},
	},
}

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76087, // Flask of the Earth
	FoodId:   74656, // Chun Tian Spring Rolls
	PotId:    76095, // Potion of Mogu Power
	PrepotId: 76095, // Potion of Mogu Power
}

var ItemFilter = core.ItemFilter{
	ArmorType: proto.ArmorType_ArmorTypePlate,

	HandTypes: []proto.HandType{
		proto.HandType_HandTypeTwoHand,
	},
	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeAxe,
		proto.WeaponType_WeaponTypeSword,
		proto.WeaponType_WeaponTypeMace,
	},
	RangedWeaponTypes: []proto.RangedWeaponType{},
}
