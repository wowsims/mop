package protection

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterProtectionWarrior()
}

func TestProtectionWarrior(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		core.GetTestBuildFromJSON(proto.Class_ClassWarrior, "../../../ui/warrior/protection/builds", "garajal_default", ItemFilter, nil, nil),
		{
			Class:            proto.Class_ClassWarrior,
			Race:             proto.Race_RaceOrc,
			OtherRaces:       []proto.Race{proto.Race_RaceHuman},
			StartingDistance: 15,

			GearSet: core.GetGearSet("../../../ui/warrior/protection/gear_sets", "p1_bis"),
			// OtherGearSets: []core.GearSetCombo{
			// 	core.GetGearSet("../../../ui/warrior/protection/gear_sets", "preraid"),
			// },
			Talents:     DefaultTalents,
			Glyphs:      DefaultGlyphs,
			Consumables: FullConsumesSpec,
			SpecOptions: core.SpecOptionsCombo{Label: "Basic", SpecOptions: PlayerOptionsBasic},
			Rotation:    core.GetAplRotation("../../../ui/warrior/protection/apls", "default"),

			IsTank:          true,
			InFrontOfTarget: true,

			ItemFilter: ItemFilter,
		},
	}))
}

var ItemFilter = core.ItemFilter{
	ArmorType: proto.ArmorType_ArmorTypePlate,

	HandTypes: []proto.HandType{
		proto.HandType_HandTypeMainHand,
		proto.HandType_HandTypeOneHand,
	},

	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeAxe,
		proto.WeaponType_WeaponTypeSword,
		proto.WeaponType_WeaponTypeMace,
		proto.WeaponType_WeaponTypeDagger,
		proto.WeaponType_WeaponTypeFist,
		proto.WeaponType_WeaponTypeShield,
	},
}

var DefaultTalents = "233232"
var DefaultGlyphs = &proto.Glyphs{
	Major1: int32(proto.WarriorMajorGlyph_GlyphOfIncite),
	Major2: int32(proto.WarriorMajorGlyph_GlyphOfHeavyRepercussions),
	Major3: int32(proto.WarriorMajorGlyph_GlyphOfHoldTheLine),
}

var PlayerOptionsBasic = &proto.Player_ProtectionWarrior{
	ProtectionWarrior: &proto.ProtectionWarrior{
		Options: &proto.ProtectionWarrior_Options{
			ClassOptions: &proto.WarriorOptions{},
		},
	},
}

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76087, // Flask of the Earth
	FoodId:   81411, // Peach Pie
	PotId:    76090, // Potion of the Mountains
	PrepotId: 76090, // Potion of the Mountains
}
