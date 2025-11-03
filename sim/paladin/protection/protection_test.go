package protection

import (
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/encounters/toes"
)

func init() {
	RegisterProtectionPaladin()
	common.RegisterAllEffects()
	toes.Register()
}

func TestProtection(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		core.GetTestBuildFromJSON(proto.Class_ClassPaladin, "../../../ui/paladin/protection/builds", "sha_default", ItemFilter, nil, nil),
		{
			Class: proto.Class_ClassPaladin,
			Race:  proto.Race_RaceBloodElf,

			GearSet:     core.GetGearSet("../../../ui/paladin/protection/gear_sets", "p1-balanced"),
			Talents:     StandardTalents,
			Glyphs:      StandardGlyphs,
			Consumables: FullConsumesSpec,
			SpecOptions: core.SpecOptionsCombo{Label: "Seal of Insight", SpecOptions: SealOfInsight},
			OtherSpecOptions: []core.SpecOptionsCombo{
				{Label: "Seal of Righteousness", SpecOptions: SealOfRighteousness},
				{Label: "Seal of Truth", SpecOptions: SealOfTruth},
			},
			Rotation: core.GetAplRotation("../../../ui/paladin/protection/apls", "default"),

			IsTank:          true,
			InFrontOfTarget: true,
			ItemFilter:      ItemFilter,
		},
	}))
}

var StandardTalents = "313213"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.PaladinMajorGlyph_GlyphOfFocusedShield),
	Major2: int32(proto.PaladinMajorGlyph_GlyphOfTheAlabasterShield),
	Major3: int32(proto.PaladinMajorGlyph_GlyphOfDivineProtection),
	Minor1: int32(proto.PaladinMinorGlyph_GlyphOfFocusedWrath),
}

var SealOfInsight = &proto.Player_ProtectionPaladin{
	ProtectionPaladin: &proto.ProtectionPaladin{
		Options: &proto.ProtectionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Insight,
			},
		},
	},
}

var SealOfRighteousness = &proto.Player_ProtectionPaladin{
	ProtectionPaladin: &proto.ProtectionPaladin{
		Options: &proto.ProtectionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Righteousness,
			},
		},
	},
}

var SealOfTruth = &proto.Player_ProtectionPaladin{
	ProtectionPaladin: &proto.ProtectionPaladin{
		Options: &proto.ProtectionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{
				Seal: proto.PaladinSeal_Truth,
			},
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
	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeAxe,
		proto.WeaponType_WeaponTypeSword,
		proto.WeaponType_WeaponTypeMace,
		proto.WeaponType_WeaponTypeShield,
	},
	HandTypes: []proto.HandType{
		proto.HandType_HandTypeMainHand,
		proto.HandType_HandTypeOneHand,
		proto.HandType_HandTypeOffHand,
	},
	ArmorType:         proto.ArmorType_ArmorTypePlate,
	RangedWeaponTypes: []proto.RangedWeaponType{},
}
