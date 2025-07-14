package balance

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get caster sets included. (we use spellfire here)
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterBalanceDruid()
}

func TestBalance(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassDruid,
			Race:       proto.Race_RaceTroll,
			OtherRaces: []proto.Race{proto.Race_RaceWorgen, proto.Race_RaceNightElf, proto.Race_RaceTauren},

			GearSet: core.GetGearSet("../../../ui/druid/balance/gear_sets", "preraid"),
			OtherGearSets: []core.GearSetCombo{
				core.GetGearSet("../../../ui/druid/balance/gear_sets", "t14"),
			},
			Talents: BalanceIncarnationDocTalents,
			OtherTalentSets: []core.TalentsCombo{
				{Label: "FoN + HotW", Talents: BalanceFoNHotWTalents, Glyphs: BalanceStandardGlyphs},
				{Label: "Incarnation + NV", Talents: BalanceIncarnationNVTalents, Glyphs: BalanceStandardGlyphs},
			},
			Glyphs:         BalanceIncarnationDocGlyphs,
			Consumables:    FullConsumesSpec,
			SpecOptions:    core.SpecOptionsCombo{Label: "Default", SpecOptions: PlayerOptionsBalance},
			Rotation:       core.GetAplRotation("../../../ui/druid/balance/apls", "standard"),
			OtherRotations: []core.RotationCombo{},
			ItemFilter:     ItemFilter,
		},
	}))
}

var BalanceIncarnationDocTalents = "113222"
var BalanceIncarnationNVTalents = "113223"
var BalanceFoNHotWTalents = "113321"

var BalanceIncarnationDocGlyphs = &proto.Glyphs{
	Major1: int32(proto.DruidMajorGlyph_GlyphOfHealingTouch),
	Major2: int32(proto.DruidMajorGlyph_GlyphOfRebirth),
	Major3: int32(proto.DruidMajorGlyph_GlyphOfStampede),
}

var BalanceStandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.DruidMajorGlyph_GlyphOfStampedingRoar),
	Major2: int32(proto.DruidMajorGlyph_GlyphOfRebirth),
	Major3: int32(proto.DruidMajorGlyph_GlyphOfStampede),
}

var PlayerOptionsBalance = &proto.Player_BalanceDruid{
	BalanceDruid: &proto.BalanceDruid{
		Options: &proto.BalanceDruid_Options{
			ClassOptions: &proto.DruidOptions{},
		},
	},
}

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76085, // Flask of the Warm Sun
	FoodId:   74650, // Mogu Fish Stew
	PotId:    76093, // Potion of the Jade Serpent
	PrepotId: 76093, // Potion of the Jade Serpent
}

var ItemFilter = core.ItemFilter{
	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeDagger,
		proto.WeaponType_WeaponTypeMace,
		proto.WeaponType_WeaponTypeOffHand,
		proto.WeaponType_WeaponTypeStaff,
		proto.WeaponType_WeaponTypePolearm,
	},
	ArmorType:         proto.ArmorType_ArmorTypeLeather,
	RangedWeaponTypes: []proto.RangedWeaponType{},
}
