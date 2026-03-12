package marksmanship

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterMarksmanshipHunter()
	common.RegisterAllEffects()
}

func TestMarksmanship(t *testing.T) {
	var talentSets []core.TalentsCombo
	talentSets = core.GenerateTalentVariationsForRows(MarksmanshipTalents, MarksmanshipDefaultGlyphs, []int{3, 4, 5})

	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class: proto.Class_ClassHunter,
			Race:  proto.Race_RaceOrc,

			GearSet: core.GetGearSet("../../../ui/hunter/marksmanship/gear_sets", "p3"),

			Talents:         MarksmanshipTalents,
			OtherTalentSets: talentSets,

			Glyphs: MarksmanshipDefaultGlyphs,

			Consumables: &proto.ConsumesSpec{
				FlaskId:  76084, // Flask of Spring Blossoms
				FoodId:   74648, // Sea Mist Rice Noodles
				PotId:    76089, // Virmen's Bite
				PrepotId: 76089, // Virmen's Bite
			},

			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: &proto.Player_MarksmanshipHunter{
				MarksmanshipHunter: &proto.MarksmanshipHunter{
					Options: &proto.MarksmanshipHunter_Options{
						ClassOptions: &proto.HunterOptions{
							PetType:           proto.HunterOptions_Tallstrider,
							PetUptime:         1,
							UseHuntersMark:    true,
							GlaiveTossSuccess: 0.8,
						},
					},
				},
			}},

			Rotation: core.GetAplRotation("../../../ui/hunter/marksmanship/apls", "mm"),

			Profession1: proto.Profession_Engineering,
			Profession2: proto.Profession_Herbalism,

			ItemFilter: core.ItemFilter{
				ArmorType: proto.ArmorType_ArmorTypeMail,

				RangedWeaponTypes: []proto.RangedWeaponType{
					proto.RangedWeaponType_RangedWeaponTypeBow,
					proto.RangedWeaponType_RangedWeaponTypeCrossbow,
					proto.RangedWeaponType_RangedWeaponTypeGun,
				},
			},

			StartingDistance: 24,
		},
	}))
}

var MarksmanshipTalents = "312213"
var MarksmanshipDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.HunterMajorGlyph_GlyphOfAimedShot),
	Major2: int32(proto.HunterMajorGlyph_GlyphOfAnimalBond),
	Major3: int32(proto.HunterMajorGlyph_GlyphOfDeterrence),
}
