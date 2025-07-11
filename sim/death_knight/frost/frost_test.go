package frost

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterFrostDeathKnight()
}

func TestFrostMasterfrost(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassDeathKnight,
			Race:       proto.Race_RaceTroll,
			OtherRaces: []proto.Race{proto.Race_RaceOrc, proto.Race_RaceWorgen},

			GearSet: core.GetGearSet("../../../ui/death_knight/frost/gear_sets", "p1.masterfrost"),
			OtherGearSets: []core.GearSetCombo{
				core.GetGearSet("../../../ui/death_knight/frost/gear_sets", "prebis"),
			},
			Talents:         DefaultTalents,
			OtherTalentSets: OtherTalentSets,
			Glyphs:          FrostDefaultGlyphs,
			Consumables:     FullConsumesSpec,
			SpecOptions:     core.SpecOptionsCombo{Label: "Basic", SpecOptions: PlayerOptionsFrost},
			Rotation:        core.GetAplRotation("../../../ui/death_knight/frost/apls", "masterfrost"),

			ItemFilter: ItemFilterMasterfrost,
		},
	}))
}

func TestFrostTwoHand(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassDeathKnight,
			Race:       proto.Race_RaceTroll,
			OtherRaces: []proto.Race{proto.Race_RaceOrc, proto.Race_RaceWorgen},

			GearSet:         core.GetGearSet("../../../ui/death_knight/frost/gear_sets", "p1.2h-obliterate"),
			Talents:         DefaultTalents,
			OtherTalentSets: OtherTalentSets,
			Glyphs:          FrostDefaultGlyphs,
			Consumables:     FullConsumesSpec,
			SpecOptions:     core.SpecOptionsCombo{Label: "Basic", SpecOptions: PlayerOptionsFrost},
			Rotation:        core.GetAplRotation("../../../ui/death_knight/frost/apls", "obliterate"),

			ItemFilter: ItemFilterTwoHand,
		},
	}))
}

var DefaultTalents = "200010"
var OtherTalentSets = []core.TalentsCombo{
	{Label: "RoilingBlood", Talents: "100010", Glyphs: FrostDefaultGlyphs},
	{Label: "UnholyBlight", Talents: "300010", Glyphs: FrostDefaultGlyphs},
	{Label: "RunicEmpowerment", Talents: "200020", Glyphs: FrostDefaultGlyphs},
	{Label: "RunicCorruption", Talents: "200030", Glyphs: FrostDefaultGlyphs},
}

var FrostDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfRegenerativeMagic),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfLoudHorn),
}

var PlayerOptionsFrost = &proto.Player_FrostDeathKnight{
	FrostDeathKnight: &proto.FrostDeathKnight{
		Options: &proto.FrostDeathKnight_Options{
			ClassOptions: &proto.DeathKnightOptions{},
		},
	},
}

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76088, // Flask of Winter's Bite
	FoodId:   74646, // Black Pepper Ribs and Shrimp
	PotId:    76095, // Potion of Mogu Power
	PrepotId: 76095, // Potion of Mogu Power
}

var ItemFilterMasterfrost = core.ItemFilter{
	ArmorType: proto.ArmorType_ArmorTypePlate,

	HandTypes: []proto.HandType{
		proto.HandType_HandTypeMainHand,
		proto.HandType_HandTypeOffHand,
		proto.HandType_HandTypeOneHand,
	},
	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeAxe,
		proto.WeaponType_WeaponTypeSword,
		proto.WeaponType_WeaponTypeMace,
	},
	RangedWeaponTypes: []proto.RangedWeaponType{},
}

var ItemFilterTwoHand = core.ItemFilter{
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
