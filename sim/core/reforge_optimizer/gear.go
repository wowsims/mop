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
// Meta gems are restored first (they are never touched by the optimizer).
// If the LP output contains the same non-meta gem multiset as the original gear, all
// non-meta gems are copied back from originalGear — this correctly resolves 2-cycles,
// 3-cycles, and any longer permutation without tracking individual cycles.
// When the optimizer genuinely changed which gems are present (different multiset), only
// true 2-cycle swaps are resolved: the candidate socket must currently hold originalGemID
// AND its original gem must be newGemID, ensuring each swap is a clean reversal.
func (editor *reforgeGearEditor) minimizeRegems() {
	if editor == nil || editor.gear == nil || editor.originalGear == nil || editor.player == nil {
		return
	}

	// First pass: restore meta gems.
	for slotIdx := range editor.gear {
		newItem := &editor.gear[slotIdx]
		originalItem := &editor.originalGear[slotIdx]
		if newItem.ID == 0 || originalItem.ID == 0 {
			continue
		}
		if editor.frozenSlots[proto.ItemSlot(slotIdx)] {
			continue
		}
		for socketIdx, socketColor := range currentSocketColors(*newItem, editor.isBlacksmithing, editor.settings) {
			if socketColor == proto.GemColor_GemColorMeta {
				restoreMetaSocketGem(newItem, originalItem, socketIdx)
			}
		}
	}

	// Same non-meta multiset: full restore handles all permutation cycle lengths.
	if editor.nonMetaGemMultisetUnchanged() {
		for slotIdx := range editor.gear {
			newItem := &editor.gear[slotIdx]
			originalItem := &editor.originalGear[slotIdx]
			if newItem.ID == 0 || originalItem.ID == 0 {
				continue
			}
			if editor.frozenSlots[proto.ItemSlot(slotIdx)] {
				continue
			}
			for socketIdx, socketColor := range currentSocketColors(*newItem, editor.isBlacksmithing, editor.settings) {
				if socketColor != proto.GemColor_GemColorMeta {
					setGemIDAt(newItem, socketIdx, gemIDAt(originalItem, socketIdx))
				}
			}
		}
		return
	}

	// Different multiset: resolve true 2-cycle swaps only.
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
			if finalizedSocketKeys[socketKey] || socketColor == proto.GemColor_GemColorMeta {
				finalizedSocketKeys[socketKey] = true
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

			matchedSlot, matchedSocketIdx, matchedSocketColor, ok := editor.find2CyclePartner(originalGemID, newGemID, finalizedSocketKeys)
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

// Restores the original meta gem; meta sockets are never modified by the optimizer so the
// original gem is always correct.
func restoreMetaSocketGem(newItem *core.Item, originalItem *core.Item, socketIdx int) {
	originalGemID := gemIDAt(originalItem, socketIdx)
	if originalGemID != 0 || socketIdx < len(newItem.Gems) {
		setGemIDAt(newItem, socketIdx, originalGemID)
	}
}

// Returns true if the non-meta gem multiset across all unfrozen slots is identical between
// the LP output (editor.gear, after meta restore) and the original gear.
func (editor *reforgeGearEditor) nonMetaGemMultisetUnchanged() bool {
	newGems := map[int32]int{}
	originalGems := map[int32]int{}
	for slotIdx := range editor.gear {
		newItem := &editor.gear[slotIdx]
		originalItem := &editor.originalGear[slotIdx]
		if newItem.ID == 0 || originalItem.ID == 0 {
			continue
		}
		if editor.frozenSlots[proto.ItemSlot(slotIdx)] {
			continue
		}
		for socketIdx, socketColor := range currentSocketColors(*newItem, editor.isBlacksmithing, editor.settings) {
			if socketColor == proto.GemColor_GemColorMeta {
				continue
			}
			if id := gemIDAt(newItem, socketIdx); id != 0 {
				newGems[id]++
			}
			if id := gemIDAt(originalItem, socketIdx); id != 0 {
				originalGems[id]++
			}
		}
	}
	if len(newGems) != len(originalGems) {
		return false
	}
	for id, count := range newGems {
		if originalGems[id] != count {
			return false
		}
	}
	return true
}

// Finds a socket that forms a true 2-cycle: currently holds originalGemID and whose
// original gem is newGemID. This prevents broken resolutions of longer permutation cycles.
func (editor *reforgeGearEditor) find2CyclePartner(originalGemID int32, newGemID int32, finalizedSocketKeys map[reforgeSocketKey]bool) (proto.ItemSlot, int, proto.GemColor, bool) {
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
			if socketColor == proto.GemColor_GemColorMeta {
				continue
			}
			if finalizedSocketKeys[reforgeSocketKey{slot: slot, socketIdx: socketIdx}] {
				continue
			}
			if gemIDAt(&item, socketIdx) == originalGemID && gemIDAt(originalItem, socketIdx) == newGemID {
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
