package reforgeoptimizer

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	googleProto "google.golang.org/protobuf/proto"
)

func cloneEquipmentSpec(equipment *proto.EquipmentSpec) *proto.EquipmentSpec {
	if equipment == nil {
		return &proto.EquipmentSpec{}
	}
	return googleProto.Clone(equipment).(*proto.EquipmentSpec)
}

type reforgeGearEditor struct {
	gear            *core.Equipment
	originalGear    *core.Equipment
	player          *proto.Player
	settings        *proto.ReforgeSettings
	frozenSlots     map[proto.ItemSlot]bool
	isBlacksmithing bool
}

type reforgeSocketKey struct {
	slot      proto.ItemSlot
	socketIdx int
}

func newReforgeGearEditor(gear *proto.EquipmentSpec, originalGear *proto.EquipmentSpec, player *proto.Player, settings *proto.ReforgeSettings) *reforgeGearEditor {
	editor := &reforgeGearEditor{
		gear:         equipmentFromProto(gear),
		originalGear: optionalEquipmentFromProto(originalGear),
		player:       player,
		settings:     settings,
		frozenSlots:  frozenItemSlots(settings),
	}
	if player != nil {
		editor.isBlacksmithing = playerHasProfession(player, proto.Profession_Blacksmithing)
	}
	return editor
}

func (editor *reforgeGearEditor) equipment() *proto.EquipmentSpec {
	if editor == nil || editor.gear == nil {
		return &proto.EquipmentSpec{}
	}
	return editor.gear.ToEquipmentSpecProto()
}

func (editor *reforgeGearEditor) applyChoice(choice reforgeChoice) {
	if editor == nil || editor.gear == nil || int(choice.slot) < 0 || int(choice.slot) >= int(core.NumItemSlots) {
		return
	}
	item := editor.gear.GetItemBySlot(choice.slot)
	if item.ID == 0 {
		return
	}
	if choice.hasReforge {
		if choice.reforgeID == 0 {
			item.Reforging = nil
		} else {
			reforge := core.GetReforgeStatByID(choice.reforgeID)
			item.Reforging = &reforge
		}
	}
	for _, gemChoice := range choice.gems {
		for len(item.Gems) <= gemChoice.socketIdx {
			item.Gems = append(item.Gems, core.Gem{})
		}
		item.Gems[gemChoice.socketIdx] = gemFromID(gemChoice.gemID)
	}
}

func (editor *reforgeGearEditor) applyChoices(choices []reforgeChoice) {
	for _, choice := range choices {
		editor.applyChoice(choice)
	}
}

// Post-processes gem assignments to minimize unnecessary gem purchases.
//
// For each socket, in slot-then-socket-index order: if the solver didn't touch it (same gem
// ID), leave it alone. Otherwise, find wherever the original gem ended up elsewhere in the
// gear and swap it back — placing the original gem here and this socket's solver-chosen gem
// into that other location — UNLESS doing so would reduce the total number of socket-color
// matches across the two sockets involved (a genuine color-match upgrade the solver found,
// which must not be undone). The match count is compared across BOTH sockets, so a swap that
// merely shuffles a matching gem between two same-color sockets (net-neutral) is still undone
// rather than left as a pointless regem.
//
// This chases the original gem to wherever it moved rather than verifying a strict
// reciprocal 2-cycle (A's original is at B, and B's original is A). For cycles longer than
// 2 (A's gem moved to B, B's moved to C, C's moved to A) this "walks" the original gem back
// one step at a time in socket-visitation order rather than fully unwinding the cycle, which
// can leave a gem shifted into a socket it never started in — a known imprecision, not fixed
// here since a full cycle-unwind isn't worth the added complexity for how rarely it matters.
func (editor *reforgeGearEditor) minimizeRegems() {
	if editor == nil || editor.gear == nil || editor.originalGear == nil || editor.player == nil {
		return
	}

	finalizedSocketKeys := map[reforgeSocketKey]bool{}
	for slotIdx := range editor.gear {
		newItem := &editor.gear[slotIdx]
		originalItem := &editor.originalGear[slotIdx]
		if newItem.ID == 0 || originalItem.ID == 0 {
			continue
		}
		slot := proto.ItemSlot(slotIdx)
		if editor.frozenSlots[slot] {
			continue
		}
		for socketIdx, socketColor := range currentSocketColors(*newItem, editor.isBlacksmithing, editor.settings) {
			socketKey := reforgeSocketKey{slot: slot, socketIdx: socketIdx}
			if finalizedSocketKeys[socketKey] {
				continue
			}
			finalizedSocketKeys[socketKey] = true

			newGemID := gemIDAt(newItem, socketIdx)
			originalGemID := gemIDAt(originalItem, socketIdx)
			if newGemID == 0 || originalGemID == 0 || newGemID == originalGemID {
				continue
			}

			newGem, newGemOk := core.GetGemByID(newGemID)
			originalGem, originalGemOk := core.GetGemByID(originalGemID)
			if !newGemOk || !originalGemOk {
				continue
			}
			matchedSlot, matchedSocketIdx, matchedSocketColor, ok := editor.findGemElsewhere(originalGemID, finalizedSocketKeys)
			if !ok {
				continue
			}

			// Restore the original gem here only if it doesn't reduce the total socket-color
			// matches across the two sockets involved. Skipping preserves a genuine color-match
			// upgrade the solver found (the swapped-back arrangement would match fewer sockets);
			// but a match-neutral shuffle is still undone — e.g. two same-color sockets (identical
			// MH/OH weapon sockets) where moving the matching gem between them changes nothing yet
			// forces a pointless regem. Comparing both sockets (not just this one) is what the old
			// per-socket guards missed.
			matchesIfSwapped := boolToInt(gemMatchesSocket(originalGem.Color, socketColor)) + boolToInt(gemMatchesSocket(newGem.Color, matchedSocketColor))
			matchesIfKept := boolToInt(gemMatchesSocket(newGem.Color, socketColor)) + boolToInt(gemMatchesSocket(originalGem.Color, matchedSocketColor))
			if matchesIfSwapped < matchesIfKept {
				continue
			}

			finalizedSocketKeys[reforgeSocketKey{slot: matchedSlot, socketIdx: matchedSocketIdx}] = true
			setGemIDAt(newItem, socketIdx, originalGemID)
			setGemIDAt(editor.gear.GetItemBySlot(matchedSlot), matchedSocketIdx, newGemID)
		}
	}
}

// Finds a not-yet-finalized socket into which the SOLVER moved gemID — i.e. a socket now
// holding gemID whose own original gem was something else. Sockets the solver never changed
// (original gem already == gemID) are skipped: they hold their rightful gem and must not be
// disturbed. Matching such an unchanged socket would corrupt a correct socket and leave the
// real cross-slot swap only half-undone — e.g. crit-softcap, where 76658/76659 were shuffled
// between two Red sockets while an unrelated, untouched Red socket also happened to hold 76658;
// the old "chase the gem anywhere" search grabbed that untouched socket as the swap partner.
func (editor *reforgeGearEditor) findGemElsewhere(gemID int32, finalizedSocketKeys map[reforgeSocketKey]bool) (proto.ItemSlot, int, proto.GemColor, bool) {
	for slotIdx, item := range editor.gear {
		if item.ID == 0 {
			continue
		}
		slot := proto.ItemSlot(slotIdx)
		if editor.frozenSlots[slot] {
			continue
		}
		originalItem := &editor.originalGear[slotIdx]
		for socketIdx, socketColor := range currentSocketColors(item, editor.isBlacksmithing, editor.settings) {
			if finalizedSocketKeys[reforgeSocketKey{slot: slot, socketIdx: socketIdx}] {
				continue
			}
			if gemIDAt(&item, socketIdx) != gemID {
				continue
			}
			if gemIDAt(originalItem, socketIdx) == gemID {
				// Unchanged socket already holding this gem — not where it moved to, skip.
				continue
			}
			return slot, socketIdx, socketColor, true
		}
	}
	return proto.ItemSlot_ItemSlotHead, 0, proto.GemColor_GemColorUnknown, false
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func gemIDAt(item *core.Item, socketIdx int) int32 {
	if item == nil || socketIdx >= len(item.Gems) {
		return 0
	}
	return item.Gems[socketIdx].ID
}

func setGemIDAt(item *core.Item, socketIdx int, gemID int32) {
	if item == nil {
		return
	}
	for len(item.Gems) <= socketIdx {
		item.Gems = append(item.Gems, core.Gem{})
	}
	item.Gems[socketIdx] = gemFromID(gemID)
}

func equipmentFromProto(equipment *proto.EquipmentSpec) *core.Equipment {
	if equipment == nil {
		return &core.Equipment{}
	}
	coreEquipment := core.ProtoToEquipment(equipment)
	return &coreEquipment
}

func optionalEquipmentFromProto(equipment *proto.EquipmentSpec) *core.Equipment {
	if equipment == nil {
		return nil
	}
	return equipmentFromProto(equipment)
}

// Returns the gem for the given ID, falling back to a stub {ID: gemID} if not found in
// the database (preserves the ID so the proto round-trip doesn't silently drop it).
func gemFromID(gemID int32) core.Gem {
	if gemID == 0 {
		return core.Gem{}
	}
	if gem, ok := core.GetGemByID(gemID); ok {
		return gem
	}
	return core.Gem{ID: gemID}
}

// Strips reforge assignments from all unfrozen slots so baseline stats are computed
// without any pre-existing reforges.
func clearReforges(equipment *proto.EquipmentSpec, settings *proto.ReforgeSettings) {
	frozenSlots := frozenItemSlots(settings)
	for slotIdx, item := range equipment.Items {
		if item != nil && !frozenSlots[proto.ItemSlot(slotIdx)] {
			item.Reforging = 0
		}
	}
}

func frozenItemSlots(settings *proto.ReforgeSettings) map[proto.ItemSlot]bool {
	frozen := map[proto.ItemSlot]bool{}
	if settings == nil || !settings.GetFreezeItemSlots() {
		return frozen
	}
	for _, item := range settings.GetFrozenItemSlots() {
		frozen[item] = true
	}
	return frozen
}
