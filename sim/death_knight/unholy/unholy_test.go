package unholy

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterUnholyDeathKnight()
	common.RegisterAllEffects()
}

func TestUnholy(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class: proto.Class_ClassDeathKnight,
			Race:  proto.Race_RaceTroll,

			GearSet: core.GetGearSet("../../../ui/death_knight/unholy/gear_sets", "p3"),

			Talents: "300010",
			OtherTalentSets: []core.TalentsCombo{
				{Label: "RoilingBlood", Talents: "100010", Glyphs: UnholyDefaultGlyphs},
				{Label: "PlagueLeech", Talents: "200010", Glyphs: UnholyDefaultGlyphs},
				{Label: "RunicEmpowerment", Talents: "300020", Glyphs: UnholyDefaultGlyphs},
				{Label: "RunicCorruption", Talents: "300030", Glyphs: UnholyDefaultGlyphs},
				{Label: "GlyphOfOutbreak", Talents: "300010", Glyphs: GlyphOfOutbreak},
			},

			Glyphs: UnholyDefaultGlyphs,

			Consumables: &proto.ConsumesSpec{
				FlaskId:  76088, // Flask of Winter's Bite
				FoodId:   74646, // Black Pepper Ribs and Shrimp
				PotId:    76095, // Potion of Mogu Power
				PrepotId: 76095, // Potion of Mogu Power
			},

			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: &proto.Player_UnholyDeathKnight{
				UnholyDeathKnight: &proto.UnholyDeathKnight{
					Options: &proto.UnholyDeathKnight_Options{
						ClassOptions: &proto.DeathKnightOptions{},
					},
				},
			}},

			Rotation: core.GetAplRotation("../../../ui/death_knight/unholy/apls", "default"),

			Profession1: proto.Profession_Engineering,
			Profession2: proto.Profession_Herbalism,

			ItemFilter: core.ItemFilter{
				ArmorType: proto.ArmorType_ArmorTypePlate,

				HandTypes: []proto.HandType{
					proto.HandType_HandTypeTwoHand,
				},

				WeaponTypes: []proto.WeaponType{
					proto.WeaponType_WeaponTypeAxe,
					proto.WeaponType_WeaponTypeMace,
					proto.WeaponType_WeaponTypePolearm,
					proto.WeaponType_WeaponTypeSword,
				},
				RangedWeaponTypes: []proto.RangedWeaponType{},
			},
		},
	}))
}

var UnholyDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfPestilence),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfFesteringBlood),
}

var GlyphOfOutbreak = &proto.Glyphs{
	Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell),
	Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfPestilence),
	Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfOutbreak),
}
