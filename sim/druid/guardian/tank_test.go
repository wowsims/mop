package guardian

import (
	"testing"

	"github.com/wowsims/mop/sim/common"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/encounters/msv"
)

func init() {
	RegisterGuardianDruid()
	common.RegisterAllEffects()
	msv.Register()
}

func TestGuardian(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		core.GetTestBuildFromJSON(proto.Class_ClassDruid, "../../../ui/druid/guardian/builds", "garajal_default", ItemFilter, nil, nil),
		{
			Class: proto.Class_ClassDruid,
			Race:  proto.Race_RaceWorgen,

			GearSet: core.GetGearSet("../../../ui/druid/guardian/gear_sets", "preraid"),

			Talents: StandardTalents,
			Glyphs:  StandardGlyphs,
			OtherTalentSets: []core.TalentsCombo{
				{Label: "FoN-NV", Talents: "010303", Glyphs: StandardGlyphs},
				{Label: "Incarn-DoC", Talents: "010202", Glyphs: StandardGlyphs},
			},

			Consumables: FullConsumesSpec,
			SpecOptions: core.SpecOptionsCombo{Label: "Default", SpecOptions: PlayerOptionsDefault},
			Rotation:    core.GetAplRotation("../../../ui/druid/guardian/apls", "default"),

			IsTank:          true,
			InFrontOfTarget: true,

			ItemFilter: ItemFilter,
		},
	}))
}

// func BenchmarkSimulate(b *testing.B) {
// 	rsr := &proto.RaidSimRequest{
// 		Raid: core.SinglePlayerRaidProto(
// 			&proto.Player{
// 				Race:      proto.Race_RaceTauren,
// 				Class:     proto.Class_ClassDruid,
// 				Equipment: core.GetGearSet("../../../ui/feral_tank_druid/gear_sets", "p1").GearSet,
// 				Consumes:  FullConsumes,
// 				Spec:      PlayerOptionsDefault,
// 				Buffs:     core.FullIndividualBuffs,
//
// 				InFrontOfTarget: true,
// 			},
// 			core.FullPartyBuffs,
// 			core.FullRaidBuffs,
// 			core.FullDebuffs),
// 		Encounter: &proto.Encounter{
// 			Duration: 300,
// 			Targets: []*proto.Target{
// 				core.NewDefaultTarget(),
// 			},
// 		},
// 		SimOptions: core.AverageDefaultSimTestOptions,
// 	}
//
// 	core.RaidBenchmark(b, rsr)
// }

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

var StandardTalents = "010101"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.DruidMajorGlyph_GlyphOfMightOfUrsoc),
	Major2: int32(proto.DruidMajorGlyph_GlyphOfMaul),
}

var PlayerOptionsDefault = &proto.Player_GuardianDruid{
	GuardianDruid: &proto.GuardianDruid{
		Options: &proto.GuardianDruid_Options{},
	},
}
var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:    76087,
	FoodId:     74656,
	PotId:      76090,
	PrepotId:   76090,
	ConjuredId: 5512, // Conjured Healthstone
}
