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
		settings:          &proto.ReforgeSettings{IncludeGems: true, IncludeEotbGemSocket: true},
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

// minimizeRegems must never trade one socket bonus for a different one. Hands 99359 have two Red
// sockets worth +120 Int; the legendary cloak 102246 has a single Red socket worth +60 Int. The
// solver put both Orange (Red-matching) gems on the hands to claim the bigger bonus and left the
// non-matching Yellow gem on the cloak. Undoing that cross-slot swap is socket-COLOR-match
// neutral — one Red socket stays matched either way — but it moves the claim from the +120 Int
// item to the +60 Int one, so it must be rejected.
func TestMinimizeRegemsKeepsLargerSocketBonus(t *testing.T) {
	sim.RegisterAll()

	const backSlot, handsSlot = 3, 6
	const quick, reckless = int32(76699), int32(76668) // Yellow (no Red match), Orange (Red match)

	mkSpec := func(backGem int32, handsGems []int32) *proto.EquipmentSpec {
		items := make([]*proto.ItemSpec, 16)
		for i := range items {
			items[i] = &proto.ItemSpec{}
		}
		items[backSlot] = &proto.ItemSpec{Id: 102246, Gems: []int32{backGem}}
		items[handsSlot] = &proto.ItemSpec{Id: 99359, Gems: handsGems}
		return &proto.EquipmentSpec{Items: items}
	}

	original := mkSpec(reckless, []int32{quick, quick})
	solved := mkSpec(quick, []int32{reckless, reckless})
	newGear := equipmentFromProto(solved)

	minimizeRegemsHarness(original).minimizeRegems(newGear)

	back := newGear.GetItemBySlot(proto.ItemSlot(backSlot))
	hands := newGear.GetItemBySlot(proto.ItemSlot(handsSlot))
	if gemIDAt(back, 0) != quick || gemIDAt(hands, 0) != reckless || gemIDAt(hands, 1) != reckless {
		t.Fatalf("socket bonus downgraded: back=[%d] hands=[%d %d], want back=[%d] hands=[%d %d]",
			gemIDAt(back, 0), gemIDAt(hands, 0), gemIDAt(hands, 1), quick, reckless, reckless)
	}
}

// A socket bonus in a stat the player is already capped on is worth nothing, but the optimizer's
// caps live in the LP's constraints, not in its EP weights — so minimizeRegems cannot score the
// two arrangements by EP without happily trading a real Intellect bonus for a dead Hit one.
// Shoulders 82857 (+60 Hit) and the legendary cloak 102246 (+60 Int) each have a single Red
// socket, so the undo is socket-color-match neutral AND pre-cap-EP positive (Hit outweighs
// Intellect), yet it must still be rejected: the bonuses are not the same stat, so the swap is
// not provably free.
func TestMinimizeRegemsKeepsDifferentStatSocketBonus(t *testing.T) {
	sim.RegisterAll()

	const shoulderSlot, backSlot = 2, 3
	const quick, reckless = int32(76699), int32(76668) // Yellow (no Red match), Orange (Red match)

	mkSpec := func(shoulderGem, backGem int32) *proto.EquipmentSpec {
		items := make([]*proto.ItemSpec, 16)
		for i := range items {
			items[i] = &proto.ItemSpec{}
		}
		items[shoulderSlot] = &proto.ItemSpec{Id: 82857, Gems: []int32{shoulderGem}}
		items[backSlot] = &proto.ItemSpec{Id: 102246, Gems: []int32{backGem}}
		return &proto.EquipmentSpec{Items: items}
	}

	original := mkSpec(reckless, quick)
	solved := mkSpec(quick, reckless)
	newGear := equipmentFromProto(solved)

	minimizeRegemsHarness(original).minimizeRegems(newGear)

	shoulders := newGear.GetItemBySlot(proto.ItemSlot(shoulderSlot))
	back := newGear.GetItemBySlot(proto.ItemSlot(backSlot))
	if gemIDAt(shoulders, 0) != quick || gemIDAt(back, 0) != reckless {
		t.Fatalf("Intellect bonus traded for a capped-stat Hit bonus: shoulders=[%d] back=[%d], want shoulders=[%d] back=[%d]",
			gemIDAt(shoulders, 0), gemIDAt(back, 0), quick, reckless)
	}
}
