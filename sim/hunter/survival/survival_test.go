package survival

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterSurvivalHunter()
	common.RegisterAllEffects()
}

func TestSurvival(t *testing.T) {
	var talentSets []core.TalentsCombo
	talentSets = core.GenerateTalentVariationsForRows(SurvivalTalents, SurvivalDefaultGlyphs, []int{3, 4, 5})

	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class: proto.Class_ClassHunter,
			Race:  proto.Race_RaceOrc,

			GearSet: core.GetGearSet("../../../ui/hunter/survival/gear_sets", "p3"),

			Talents:         SurvivalTalents,
			OtherTalentSets: talentSets,

			Glyphs: SurvivalDefaultGlyphs,

			Consumables: &proto.ConsumesSpec{
				FlaskId:  76084, // Flask of Spring Blossoms
				FoodId:   74648, // Sea Mist Rice Noodles
				PotId:    76089, // Virmen's Bite
				PrepotId: 76089, // Virmen's Bite
			},

			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: &proto.Player_SurvivalHunter{
				SurvivalHunter: &proto.SurvivalHunter{
					Options: &proto.SurvivalHunter_Options{
						ClassOptions: &proto.HunterOptions{
							PetType:           proto.HunterOptions_Tallstrider,
							PetUptime:         1,
							UseHuntersMark:    true,
							GlaiveTossSuccess: 0.8,
						},
					},
				},
			}},

			Rotation: core.GetAplRotation("../../../ui/hunter/survival/apls", "sv"),

			Profession1: proto.Profession_Engineering,
			Profession2: proto.Profession_Tailoring,

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

var SurvivalTalents = "312213"
var SurvivalDefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.HunterMajorGlyph_GlyphOfLiberation),
	Major2: int32(proto.HunterMajorGlyph_GlyphOfAnimalBond),
	Major3: int32(proto.HunterMajorGlyph_GlyphOfDeterrence),
}
