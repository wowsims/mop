//go:build with_db

package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core/proto"
)

// minimizeRegemsHarness builds a reforgeOptimizer wired for the minimizeRegems gem-swap tests:
// the original (pre-optimize) gems on originalEquipment, gems enabled, nothing frozen.
func minimizeRegemsHarness(original *proto.EquipmentSpec) *reforgeOptimizer {
	return &reforgeOptimizer{
		settings:          &proto.ReforgeSettings{IncludeGems: true},
		frozenSlots:       map[proto.ItemSlot]bool{},
		originalEquipment: equipmentFromProto(original),
	}
}

// A stat-neutral swap of gems between two identical (Red) weapon sockets must be undone by
// minimizeRegems, since it is a pointless regem (the brm-weapon-gem-desync scenario). MH 105430
// and OH 105581 both have a single Red socket; Crafty (76659, Orange) matches Red, Smooth
// (76697, Yellow) does not, so either arrangement matches exactly one socket and yields
// identical stats — undoing the swap must be preferred.
func TestMinimizeRegemsUndoesSameColorWeaponSwap(t *testing.T) {
	sim.RegisterAll()

	const mhSlot, ohSlot = 14, 15
	const smooth, crafty = int32(76697), int32(76659)

	mkSpec := func(mhGem, ohGem int32) *proto.EquipmentSpec {
		items := make([]*proto.ItemSpec, 16)
		for i := range items {
			items[i] = &proto.ItemSpec{}
		}
		items[mhSlot] = &proto.ItemSpec{Id: 105430, Gems: []int32{mhGem}}
		items[ohSlot] = &proto.ItemSpec{Id: 105581, Gems: []int32{ohGem}}
		return &proto.EquipmentSpec{Items: items}
	}

	original := mkSpec(smooth, crafty) // original placement: MH=Smooth, OH=Crafty
	solved := mkSpec(crafty, smooth)   // solver's stat-neutral swap: MH=Crafty, OH=Smooth
	newGear := equipmentFromProto(solved)

	minimizeRegemsHarness(original).minimizeRegems(newGear)

	gotMH := gemIDAt(newGear.GetItemBySlot(proto.ItemSlot(mhSlot)), 0)
	gotOH := gemIDAt(newGear.GetItemBySlot(proto.ItemSlot(ohSlot)), 0)
	if gotMH != smooth || gotOH != crafty {
		t.Fatalf("pointless same-color swap not undone: got MH=%d OH=%d, want MH=%d OH=%d", gotMH, gotOH, smooth, crafty)
	}
}

// When the gem being chased also sits in an UNCHANGED socket, minimizeRegems must ignore that
// decoy and undo the swap against the socket the solver actually changed (the crit-softcap
// scenario). The chest (99419, 3 Red sockets) starts all Deadly; the solver swaps its socket 0
// with the hands' (105635) Red socket 0 which started Crafty — a stat-neutral cross-slot swap.
// The chest's other two Deadly gems are untouched decoys: matching one of them as the partner
// would corrupt an untouched socket and leave the real swap half-undone.
func TestMinimizeRegemsIgnoresUnchangedSocketDecoy(t *testing.T) {
	sim.RegisterAll()

	const chestSlot, handsSlot = 4, 7
	const deadly, crafty = int32(76658), int32(76659) // both Red gems, match the Red sockets

	mkSpec := func(chestGems []int32, handsSock0 int32) *proto.EquipmentSpec {
		items := make([]*proto.ItemSpec, 16)
		for i := range items {
			items[i] = &proto.ItemSpec{}
		}
		items[chestSlot] = &proto.ItemSpec{Id: 99419, Gems: chestGems}
		items[handsSlot] = &proto.ItemSpec{Id: 105635, Gems: []int32{handsSock0, 76697, 76699}}
		return &proto.EquipmentSpec{Items: items}
	}

	original := mkSpec([]int32{deadly, deadly, deadly}, crafty) // decoys: chest sockets 1,2 stay Deadly
	solved := mkSpec([]int32{crafty, deadly, deadly}, deadly)   // solver swapped chest sock0 <-> hands sock0
	newGear := equipmentFromProto(solved)

	minimizeRegemsHarness(original).minimizeRegems(newGear)

	chest := newGear.GetItemBySlot(proto.ItemSlot(chestSlot))
	hands := newGear.GetItemBySlot(proto.ItemSlot(handsSlot))
	if gemIDAt(chest, 0) != deadly || gemIDAt(chest, 1) != deadly || gemIDAt(chest, 2) != deadly || gemIDAt(hands, 0) != crafty {
		t.Fatalf("swap not cleanly undone (matched an unchanged decoy socket): chest=[%d %d %d] hands[0]=%d, want chest=[%d %d %d] hands[0]=%d",
			gemIDAt(chest, 0), gemIDAt(chest, 1), gemIDAt(chest, 2), gemIDAt(hands, 0), deadly, deadly, deadly, crafty)
	}
}
