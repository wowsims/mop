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
// ID), or if the solver's gem newly matches the socket's color where the original didn't
// (a genuine improvement — never undo it), leave it alone. Otherwise, find wherever the
// original gem ended up elsewhere in the gear and swap it back — placing the original gem
// here, and this socket's solver-chosen gem into that other location — unless doing so would
// undo a color-match improvement at that other socket.
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
			if gemMatchesSocket(newGem.Color, socketColor) && !gemMatchesSocket(originalGem.Color, socketColor) {
				continue
			}

			matchedSlot, matchedSocketIdx, matchedSocketColor, ok := editor.findGemElsewhere(originalGemID, finalizedSocketKeys)
			if !ok {
				continue
			}
			if gemMatchesSocket(originalGem.Color, matchedSocketColor) && !gemMatchesSocket(newGem.Color, matchedSocketColor) {
				continue
			}

			finalizedSocketKeys[reforgeSocketKey{slot: matchedSlot, socketIdx: matchedSocketIdx}] = true
			setGemIDAt(newItem, socketIdx, originalGemID)
			setGemIDAt(editor.gear.GetItemBySlot(matchedSlot), matchedSocketIdx, newGemID)
		}
	}
}

// Finds any not-yet-finalized socket currently holding gemID, regardless of what that
// socket's own original gem was — this is the JS-mirrored "chase the gem to wherever it
// moved" search, not a strict 2-cycle-partner check.
func (editor *reforgeGearEditor) findGemElsewhere(gemID int32, finalizedSocketKeys map[reforgeSocketKey]bool) (proto.ItemSlot, int, proto.GemColor, bool) {
	for slotIdx, item := range editor.gear {
		if item.ID == 0 {
			continue
		}
		slot := proto.ItemSlot(slotIdx)
		if editor.frozenSlots[slot] {
			continue
		}
		for socketIdx, socketColor := range currentSocketColors(item, editor.isBlacksmithing, editor.settings) {
			if finalizedSocketKeys[reforgeSocketKey{slot: slot, socketIdx: socketIdx}] {
				continue
			}
			if gemIDAt(&item, socketIdx) == gemID {
				return slot, socketIdx, socketColor, true
			}
		}
	}
	return proto.ItemSlot_ItemSlotHead, 0, proto.GemColor_GemColorUnknown, false
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
