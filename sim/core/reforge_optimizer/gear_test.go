//go:build with_db

package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core/proto"
)

// A stat-neutral swap of gems between two identical (Red) weapon sockets must be undone by
// minimizeRegems — the old per-socket color guard mistook it for an upgrade and left a
// pointless regem (see brm-weapon-gem-desync). MH 105430 and OH 105581 both have a single Red
// socket; Crafty (76659, Orange) matches Red, Smooth (76697, Yellow) does not, so either
// arrangement matches exactly one socket and yields identical stats.
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
	base := mkSpec(0, 0)               // gems stripped, as the optimizer sees it

	editor := newReforgeGearEditor(base, original, &proto.Player{}, &proto.ReforgeSettings{IncludeGems: true})
	// Solver emits the swapped (stat-neutral) arrangement: MH=Crafty, OH=Smooth.
	editor.applyChoices([]reforgeChoice{
		{slot: mhSlot, gems: []reforgeGemChoice{{socketIdx: 0, gemID: crafty}}},
		{slot: ohSlot, gems: []reforgeGemChoice{{socketIdx: 0, gemID: smooth}}},
	})
	editor.minimizeRegems()

	eq := editor.equipment()
	gotMH, gotOH := eq.Items[mhSlot].Gems[0], eq.Items[ohSlot].Gems[0]
	if gotMH != smooth || gotOH != crafty {
		t.Fatalf("pointless same-color swap not undone: got MH=%d OH=%d, want MH=%d OH=%d", gotMH, gotOH, smooth, crafty)
	}
}

// When the gem being chased also sits in an UNCHANGED socket, minimizeRegems must ignore that
// decoy and undo the swap against the socket the solver actually changed (see crit-softcap). The
// chest (99419, 3 Red sockets) starts all Deadly; the solver swaps its socket 0 with the hands'
// (105635) Red socket 0 which started Crafty — a stat-neutral cross-slot swap. The chest's other
// two Deadly gems are untouched decoys: the old "chase the gem anywhere" search grabbed one of
// them as the partner, corrupting an untouched socket and leaving the real swap half-undone.
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
	base := mkSpec([]int32{0, 0, 0}, 0)

	editor := newReforgeGearEditor(base, original, &proto.Player{}, &proto.ReforgeSettings{IncludeGems: true})
	// Solver's stat-neutral cross-slot swap: chest sock0 Deadly->Crafty, hands sock0 Crafty->Deadly.
	editor.applyChoices([]reforgeChoice{
		{slot: chestSlot, gems: []reforgeGemChoice{{socketIdx: 0, gemID: crafty}, {socketIdx: 1, gemID: deadly}, {socketIdx: 2, gemID: deadly}}},
		{slot: handsSlot, gems: []reforgeGemChoice{{socketIdx: 0, gemID: deadly}, {socketIdx: 1, gemID: 76697}, {socketIdx: 2, gemID: 76699}}},
	})
	editor.minimizeRegems()

	eq := editor.equipment()
	chest, hands := eq.Items[chestSlot].Gems, eq.Items[handsSlot].Gems
	if chest[0] != deadly || chest[1] != deadly || chest[2] != deadly || hands[0] != crafty {
		t.Fatalf("swap not cleanly undone (matched an unchanged decoy socket): chest=%v hands[0]=%d, want chest=[%d %d %d] hands[0]=%d", chest, hands[0], deadly, deadly, deadly, crafty)
	}
}
