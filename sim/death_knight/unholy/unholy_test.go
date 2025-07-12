package unholy

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterUnholyDeathKnight()
}

func TestUnholy(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassDeathKnight,
			Race:       proto.Race_RaceOrc,
			OtherRaces: []proto.Race{proto.Race_RaceTroll, proto.Race_RaceWorgen},

			GearSet: core.GetGearSet("../../../ui/death_knight/unholy/gear_sets", "p1"),
			Talents: "200010",
			OtherTalentSets: []core.TalentsCombo{
				{Label: "RoilingBlood", Talents: "100010", Glyphs: UnholyDefaultGlyphs},
				{Label: "UnholyBlight", Talents: "300010", Glyphs: UnholyDefaultGlyphs},
				{Label: "RunicEmpowerment", Talents: "200020", Glyphs: UnholyDefaultGlyphs},
				{Label: "RunicCorruption", Talents: "200030", Glyphs: UnholyDefaultGlyphs},
				{Label: "GlyphOfOutbreak", Talents: "200010", Glyphs: GlyphOfOutbreak},
			},
			Glyphs:      UnholyDefaultGlyphs,
			Consumables: FullConsumesSpec,
			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: PlayerOptionsUnholy},
			Rotation:    core.GetAplRotation("../../../ui/death_knight/unholy/apls", "default"),

			ItemFilter: ItemFilter,
		},
	}))
}

var UnholyDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfPestilence),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfLoudHorn),
}

var GlyphOfOutbreak = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfPestilence),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfOutbreak),
}

var PlayerOptionsUnholy = &proto.Player_UnholyDeathKnight{
	UnholyDeathKnight: &proto.UnholyDeathKnight{
		Options: &proto.UnholyDeathKnight_Options{
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
