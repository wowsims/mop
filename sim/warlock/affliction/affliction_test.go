package affliction

import (
	"testing"

	_ "unsafe"

	"github.com/wowsims/mop/sim/common"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterAfflictionWarlock()
	common.RegisterAllEffects()
}

func TestAffliction(t *testing.T) {

	var defaultAfflictionWarlock = &proto.Player_AfflictionWarlock{
		AfflictionWarlock: &proto.AfflictionWarlock{
			Options: &proto.AfflictionWarlock_Options{
				ClassOptions: &proto.WarlockOptions{
					Summon: proto.WarlockOptions_Felhunter,
				},
			},
		},
	}

	var itemFilter = core.ItemFilter{
		WeaponTypes: []proto.WeaponType{
			proto.WeaponType_WeaponTypeSword,
			proto.WeaponType_WeaponTypeDagger,
			proto.WeaponType_WeaponTypeStaff,
		},
		HandTypes: []proto.HandType{
			proto.HandType_HandTypeOffHand,
		},
		ArmorType: proto.ArmorType_ArmorTypeCloth,
		RangedWeaponTypes: []proto.RangedWeaponType{
			proto.RangedWeaponType_RangedWeaponTypeWand,
		},
	}

	var fullConsumesSpec = &proto.ConsumesSpec{
		FlaskId:  76085, // Flask of the Warm Sun
		FoodId:   74650, // Mogu Fish Stew
		PotId:    76093, //Potion of the Jade Serpent
		PrepotId: 76093, // Potion of the Jade Serpent
	}

	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator(core.CharacterSuiteConfig{
		Class:      proto.Class_ClassWarlock,
		Race:       proto.Race_RaceOrc,
		OtherRaces: []proto.Race{proto.Race_RaceTroll, proto.Race_RaceGoblin, proto.Race_RaceHuman},
		GearSet:    core.GetGearSet("../../../ui/warlock/affliction/gear_sets", "preraid"),
		OtherGearSets: []core.GearSetCombo{
			core.GetGearSet("../../../ui/warlock/affliction/gear_sets", "p1"),
		},
		Talents:          "231211",
		Consumables:      fullConsumesSpec,
		SpecOptions:      core.SpecOptionsCombo{Label: "Affliction Warlock", SpecOptions: defaultAfflictionWarlock},
		OtherSpecOptions: []core.SpecOptionsCombo{},
		Rotation:         core.GetAplRotation("../../../ui/warlock/affliction/apls", "default"),
		OtherRotations:   []core.RotationCombo{},
		ItemFilter:       itemFilter,
		StartingDistance: 25,
	}))
}
