package core

import (
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
)

// MoP 5.0 removed the ranged weapon slot. Warriors kept a pre-MoP set here — bows, crossbows, guns
// and thrown — which put ranged weapons into their main-hand item pool, since that is the slot MoP
// resolves ranged weapons to. Nothing caught it because the table is generated data that no test
// read for its own sake.
func TestNoClassCanUseThrownWeapons(t *testing.T) {
	for class, types := range ClassRangedWeaponTypeCapabilities {
		for _, rangedType := range types {
			if rangedType == proto.RangedWeaponType_RangedWeaponTypeThrown {
				t.Errorf("%v lists Thrown, which no class can equip in MoP", class)
			}
		}
	}
}

// Hunters are the only class with a real ranged weapon; the caster classes keep wands.
func TestOnlyHuntersAndCastersHaveRangedWeapons(t *testing.T) {
	wandOnly := map[proto.Class]bool{proto.Class_ClassPriest: true, proto.Class_ClassMage: true, proto.Class_ClassWarlock: true}

	for class, types := range ClassRangedWeaponTypeCapabilities {
		switch {
		case class == proto.Class_ClassHunter:
			if len(types) == 0 {
				t.Error("hunters must keep their ranged weapons")
			}
		case wandOnly[class]:
			for _, rangedType := range types {
				if rangedType != proto.RangedWeaponType_RangedWeaponTypeWand {
					t.Errorf("%v lists %v; casters hold wands only", class, rangedType)
				}
			}
		case len(types) != 0:
			t.Errorf("%v lists %v; every other class lost ranged weapons in MoP", class, types)
		}
	}
}
