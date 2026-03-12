package feral

import (
	"testing"

	"github.com/wowsims/mop/sim/common"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterFeralDruid()
	common.RegisterAllEffects()
}

var FeralItemFilter = core.ItemFilter{
	WeaponTypes: []proto.WeaponType{
		proto.WeaponType_WeaponTypeStaff,
		proto.WeaponType_WeaponTypePolearm,
	},
	ArmorType:         proto.ArmorType_ArmorTypeLeather,
	RangedWeaponTypes: []proto.RangedWeaponType{},
}

func TestFeral(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{{
		Class:      proto.Class_ClassDruid,
		Race:       proto.Race_RaceWorgen,
		OtherRaces: []proto.Race{proto.Race_RaceTroll},

		GearSet:     core.GetGearSet("../../../ui/druid/feral/gear_sets", "p3"),
		ItemSwapSet: core.GetItemSwapGearSet("../../../ui/druid/feral/gear_sets", "p3_item_swap"),
		OtherGearSets: []core.GearSetCombo{
			core.GetGearSet("../../../ui/druid/feral/gear_sets", "preraid"),
			core.GetGearSet("../../../ui/druid/feral/gear_sets", "p2"),
		},

		Talents: StandardTalents,
		Glyphs:  StandardGlyphs,
		OtherTalentSets: []core.TalentsCombo{
			{Label: "WC-SotF-HotW", Talents: "300101", Glyphs: StandardGlyphs},
			{Label: "DB-Incarn-NV", Talents: "200203", Glyphs: StandardGlyphs},
		},

		Rotation: core.GetAplRotation("../../../ui/druid/feral/apls", "default"),
		OtherRotations: []core.RotationCombo{
			core.GetAplRotation("../../../ui/druid/feral/apls", "aoe"),
		},

		Consumables:      FullConsumesSpec,
		SpecOptions:      core.SpecOptionsCombo{Label: "ExternalBleed", SpecOptions: PlayerOptionsMonoCat},
		StartingDistance: 24,
		ItemFilter:       FeralItemFilter,
	}}))
}

// func TestFeralApl(t *testing.T) {
// 	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
// 		Class: proto.Class_ClassDruid,
// 		Race:  proto.Race_RaceTauren,

// 		GearSet:     core.GetGearSet("../../../ui/feral_druid/gear_sets", "p3"),
// 		Talents:     StandardTalents,
// 		Glyphs:      StandardGlyphs,
// 		Consumes:    FullConsumes,
// 		SpecOptions: core.SpecOptionsCombo{Label: "Default", SpecOptions: PlayerOptionsMonoCat},
// 		Rotation:    core.GetAplRotation("../../../ui/feral_druid/apls", "default"),
// 		ItemFilter:  FeralItemFilter,
// 	}))
// }

// func BenchmarkSimulate(b *testing.B) {
// 	rsr := &proto.RaidSimRequest{
// 		Raid: core.SinglePlayerRaidProto(
// 			&proto.Player{
// 				Race:      proto.Race_RaceTauren,
// 				Class:     proto.Class_ClassDruid,
// 				Equipment: core.GetGearSet("../../../ui/feral_druid/gear_sets", "p1").GearSet,
// 				Consumes:  FullConsumes,
// 				Spec:      PlayerOptionsMonoCat,
// 				Buffs:     core.FullIndividualBuffs,
// 				Glyphs:    StandardGlyphs,

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

// 	core.RaidBenchmark(b, rsr)
// }

var StandardTalents = "100302"
var StandardGlyphs = &proto.Glyphs{
	Major1: 40923,
	Major2: 40914,
	Major3: 40897,
}

var PlayerOptionsMonoCat = &proto.Player_FeralDruid{
	FeralDruid: &proto.FeralDruid{
		Options: &proto.FeralDruid_Options{
			AssumeBleedActive: true,
		},
	},
}

var PlayerOptionsMonoCatNoBleed = &proto.Player_FeralDruid{
	FeralDruid: &proto.FeralDruid{
		Options: &proto.FeralDruid_Options{
			AssumeBleedActive: false,
		},
	},
}

// var PlayerOptionsFlowerCatAoe = &proto.Player_FeralDruid{
// 	FeralDruid: &proto.FeralDruid{
// 		Options: &proto.FeralDruid_Options{
// 			InnervateTarget:   &proto.UnitReference{}, // no Innervate
// 			AssumeBleedActive: false,
// 		},
// 		Rotation: &proto.FeralDruid_Rotation{
// 			RotationType:       proto.FeralDruid_Rotation_Aoe,
// 			BearWeaveType:      proto.FeralDruid_Rotation_None,
// 			UseRake:            true,
// 			UseBite:            true,
// 			MinCombosForRip:    5,
// 			MinCombosForBite:   5,
// 			BiteTime:           4.0,
// 			MaintainFaerieFire: true,
// 			BerserkBiteThresh:  25.0,
// 			BerserkFfThresh:    15.0,
// 			MaxFfDelay:         0.7,
// 			MinRoarOffset:      24.0,
// 			RipLeeway:          3,
// 			SnekWeave:          false,
// 			FlowerWeave:        true,
// 			RaidTargets:        30,
// 			PrePopOoc:          true,
// 		},
// 	},
// }

var FullConsumesSpec = &proto.ConsumesSpec{
	FlaskId:  76084, // Flask of Spring Blossoms
	FoodId:   74648, // Sea Mist Rice Noodles
	PotId:    76089, // Virmen's Bite
	PrepotId: 76089, // Virmen's Bite
}
