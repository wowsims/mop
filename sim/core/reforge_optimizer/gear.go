package reforgeoptimizer

import (
	"math"
	"strconv"
	"strings"

	"github.com/wowsims/mop/sim/common/mop"
	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	googleProto "google.golang.org/protobuf/proto"
)

// gear.go holds the gear/gem/reforge sim-facility wrappers — these are not "the algorithm",
// just adapters over sim/core — plus applyLPSolution and minimizeRegems (which turn a solved
// LP back into an equipment spec) and the Amplification-trinket detection/modifier helpers.

type reforgeSocketKey struct {
	slot      proto.ItemSlot
	socketIdx int
}

func cloneEquipmentSpec(equipment *proto.EquipmentSpec) *proto.EquipmentSpec {
	if equipment == nil {
		return &proto.EquipmentSpec{}
	}
	return googleProto.Clone(equipment).(*proto.EquipmentSpec)
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

// gemFromID returns the gem for the given ID, falling back to a stub {ID} if not in the DB so
// the proto round-trip preserves the ID.
func gemFromID(gemID int32) core.Gem {
	if gemID == 0 {
		return core.Gem{}
	}
	if gem, ok := core.GetGemByID(gemID); ok {
		return gem
	}
	return core.Gem{ID: gemID}
}

// clearReforges strips reforge assignments from all unfrozen slots.
func clearReforges(equipment *proto.EquipmentSpec, settings *proto.ReforgeSettings) {
	frozen := frozenItemSlots(settings)
	for slotIdx, item := range equipment.Items {
		if item != nil && !frozen[proto.ItemSlot(slotIdx)] {
			item.Reforging = 0
		}
	}
}

// clearGems removes all non-meta gems from unfrozen slots (the head meta socket is preserved —
// the optimizer never changes meta gems).
func clearGems(equipment *proto.EquipmentSpec, settings *proto.ReforgeSettings) {
	frozen := frozenItemSlots(settings)
	for slotIdx, item := range equipment.Items {
		slot := proto.ItemSlot(slotIdx)
		if item == nil || frozen[slot] {
			continue
		}
		for gemIdx, gemID := range item.Gems {
			if gemID == 0 {
				continue
			}
			if isHeadMetaSocket(item, slot, gemIdx) {
				continue
			}
			if gem, ok := core.GetGemByID(gemID); !ok || gem.Color != proto.GemColor_GemColorMeta {
				item.Gems[gemIdx] = 0
			}
		}
	}
}

func isHeadMetaSocket(item *proto.ItemSpec, slot proto.ItemSlot, gemIdx int) bool {
	if slot != proto.ItemSlot_ItemSlotHead {
		return false
	}
	if dbItem := core.GetItemByID(item.GetId()); dbItem != nil && gemIdx < len(dbItem.GemSockets) {
		return dbItem.GemSockets[gemIdx] == proto.GemColor_GemColorMeta
	}
	return gemIdx == 0
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

// currentSocketColors returns the item's effective socket colors: it drops the end-of-tier
// bonus socket when disabled and appends a prismatic socket for Blacksmithing wrists/hands.
func currentSocketColors(item core.Item, isBlacksmithing bool, settings *proto.ReforgeSettings) []proto.GemColor {
	socketColors := append([]proto.GemColor(nil), item.GemSockets...)
	if !settings.GetIncludeEotbGemSocket() && hasEndOfTierBonusSocket(item) && len(socketColors) > 0 {
		socketColors = socketColors[:len(socketColors)-1]
	}
	if isBlacksmithing && (item.Type == proto.ItemType_ItemTypeWrist || item.Type == proto.ItemType_ItemTypeHands) {
		socketColors = append(socketColors, proto.GemColor_GemColorPrismatic)
	}
	return socketColors
}

// hasEndOfTierBonusSocket detects a Throne of Thunder end-of-tier bonus socket (Sha-Touched
// socket color, or a ", Reborn" name suffix for LFR pieces).
func hasEndOfTierBonusSocket(item core.Item) bool {
	for _, socketColor := range item.GemSockets {
		if socketColor == proto.GemColor_GemColorShaTouched {
			return true
		}
	}
	return strings.HasSuffix(item.Name, ", Reborn")
}

// gemEligibleForSocket reports whether a gem of the given color class may be placed in a socket
// of the given color (meta, cogwheel, and Sha-Touched sockets each take only their own class).
func gemEligibleForSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
	switch socketColor {
	case proto.GemColor_GemColorMeta:
		return gemColor == proto.GemColor_GemColorMeta
	case proto.GemColor_GemColorCogwheel:
		return gemColor == proto.GemColor_GemColorCogwheel
	case proto.GemColor_GemColorShaTouched:
		return gemColor == proto.GemColor_GemColorShaTouched
	default:
		return gemColor != proto.GemColor_GemColorMeta && gemColor != proto.GemColor_GemColorCogwheel && gemColor != proto.GemColor_GemColorShaTouched
	}
}

// gemMatchesSocket reports whether a gem's color counts as a match for the socket's color (for
// the purpose of earning the item's socket bonus).
func gemMatchesSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
	if gemColor == socketColor {
		return true
	}
	switch socketColor {
	case proto.GemColor_GemColorBlue:
		return gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorRed:
		return gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorYellow:
		return gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorPrismatic:
		return gemColor == proto.GemColor_GemColorRed || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorYellow ||
			gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorBlue || gemColor == proto.GemColor_GemColorPurple
	default:
		return false
	}
}

// reforgeRawStats computes the stat change a reforge produces on an item (a fraction of the
// fromStat moved to the toStat). Random-suffix items use their scaled suffix stats as source.
func reforgeRawStats(item core.Item, reforge core.ReforgeStat) stats.Stats {
	itemStats := item.Stats
	if item.RandomSuffix.ID != 0 {
		itemStats = item.ScaledRandomSuffixStats()
	}
	fromStat := stats.Stat(int32(reforge.FromStat))
	reduction := math.Floor(itemStats[fromStat] * reforge.Multiplier)
	delta := stats.Stats{}
	delta[fromStat] -= reduction
	delta[stats.Stat(int32(reforge.ToStat))] += reduction
	return delta
}

// applyLPSolution turns the solver's selected variables into an equipment spec: it rebuilds gear
// from the stripped base gear, applies each selected reforge/gem variable, then runs
// minimizeRegems.
func (o *reforgeOptimizer) applyLPSolution(selectedVars []string) *proto.EquipmentSpec {
	gear := equipmentFromProto(o.baseStrippedGear)

	for _, variableKey := range selectedVars {
		parts := strings.Split(variableKey, "_")
		slotIdx, err := strconv.Atoi(parts[0])
		if err != nil || slotIdx < 0 || slotIdx >= int(core.NumItemSlots) {
			continue
		}
		item := gear.GetItemBySlot(proto.ItemSlot(slotIdx))
		if item.ID == 0 {
			continue
		}
		if len(parts) > 2 {
			socketIdx, err1 := strconv.Atoi(parts[1])
			gemID, err2 := strconv.Atoi(parts[2])
			if err1 != nil || err2 != nil {
				continue
			}
			setGemIDAt(item, socketIdx, int32(gemID))
			continue
		}
		reforgeID, err := strconv.Atoi(parts[1])
		if err != nil {
			continue
		}
		reforge := core.GetReforgeStatByID(int32(reforgeID))
		item.Reforging = &reforge
	}

	if o.includeGems {
		o.minimizeRegems(gear)
	}
	return gear.ToEquipmentSpecProto()
}

// minimizeRegems cuts the number of gems the player must actually buy. For each socket the
// solver changed, it locates where that socket's original gem now lives (via findGem) and swaps
// the two gems back — reusing a gem the player already owns instead of buying a new one — unless
// doing so would drop a socket-color match the solver found.
func (o *reforgeOptimizer) minimizeRegems(newGear *core.Equipment) {
	originalGear := o.originalEquipment
	if originalGear == nil {
		return
	}

	finalizedSocketKeys := map[reforgeSocketKey]bool{}
	for slotIdx := 0; slotIdx < int(core.NumItemSlots); slotIdx++ {
		slot := proto.ItemSlot(slotIdx)
		newItem := newGear.GetItemBySlot(slot)
		originalItem := originalGear.GetItemBySlot(slot)
		if newItem.ID == 0 || originalItem.ID == 0 {
			continue
		}

		for socketIdx, socketColor := range currentSocketColors(*newItem, o.isBlacksmithing, o.settings) {
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
			newGem, newOk := core.GetGemByID(newGemID)
			originalGem, originalOk := core.GetGemByID(originalGemID)
			if !newOk || !originalOk {
				continue
			}
			// The decision to keep or undo this swap is left entirely to the net-match comparison
			// below, which weighs both sockets together. A per-socket short-circuit here — keeping
			// the swap merely because the solver's gem matches this socket — would wrongly leave a
			// match-neutral same-color swap in place (the brm-weapon-gem-desync scenario).

			for _, loc := range o.findGem(newGear, originalGemID) {
				if o.frozenSlots[loc.slot] {
					continue
				}
				matchedKey := reforgeSocketKey{slot: loc.slot, socketIdx: loc.socketIdx}
				if finalizedSocketKeys[matchedKey] {
					continue
				}
				matchedItem := newGear.GetItemBySlot(loc.slot)
				matchedColors := currentSocketColors(*matchedItem, o.isBlacksmithing, o.settings)
				if loc.socketIdx >= len(matchedColors) {
					continue
				}
				matchedSocketColor := matchedColors[loc.socketIdx]
				// Restore the original gem here only if it does not reduce the total socket-color
				// matches across BOTH sockets involved. Weighing both sockets (not just the one the
				// gem moved to) preserves a genuine color-match upgrade the solver found while still
				// undoing a match-neutral shuffle (e.g. two same-color MH/OH weapon sockets) that
				// would otherwise be a pointless regem.
				matchesIfSwapped := boolToInt(gemMatchesSocket(originalGem.Color, socketColor)) + boolToInt(gemMatchesSocket(newGem.Color, matchedSocketColor))
				matchesIfKept := boolToInt(gemMatchesSocket(newGem.Color, socketColor)) + boolToInt(gemMatchesSocket(originalGem.Color, matchedSocketColor))
				if matchesIfSwapped < matchesIfKept {
					continue
				}

				finalizedSocketKeys[matchedKey] = true
				setGemIDAt(newItem, socketIdx, originalGemID)
				setGemIDAt(matchedItem, loc.socketIdx, newGemID)
				break
			}
		}
	}
}

type gemLocation struct {
	slot      proto.ItemSlot
	socketIdx int
}

// findGem returns every socket into which the SOLVER moved gemID — i.e. a socket now holding
// gemID whose own original gem was something else. Sockets the solver never changed (original
// gem already == gemID) are skipped: they hold their rightful gem and must not be disturbed.
// Skipping them keeps minimizeRegems from grabbing an untouched socket as the swap partner (the
// crit-softcap decoy scenario, where an unchanged socket happens to hold the same gem).
func (o *reforgeOptimizer) findGem(equipment *core.Equipment, gemID int32) []gemLocation {
	var locations []gemLocation
	for slotIdx := 0; slotIdx < int(core.NumItemSlots); slotIdx++ {
		slot := proto.ItemSlot(slotIdx)
		item := equipment.GetItemBySlot(slot)
		if item.ID == 0 {
			continue
		}
		var originalItem *core.Item
		if o.originalEquipment != nil {
			originalItem = o.originalEquipment.GetItemBySlot(slot)
		}
		for socketIdx := range currentSocketColors(*item, o.isBlacksmithing, o.settings) {
			if gemIDAt(item, socketIdx) != gemID {
				continue
			}
			if originalItem != nil && gemIDAt(originalItem, socketIdx) == gemID {
				continue
			}
			locations = append(locations, gemLocation{slot: slot, socketIdx: socketIdx})
		}
	}
	return locations
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

var amplificationTrinketItemIDs = buildAmplificationTrinketItemIDSet()

// Returns the combined Haste/Mastery/Spirit multiplier granted by any Amplification Trinkets
// in the player's trinket slots (e.g. Purified Bindings of Immerseus). The two slots
// compound, so wearing two amp trinkets multiplies their modifiers together. Returns 1.0
// (a no-op) when none are equipped.
func amplificationStatModifier(equipment *proto.EquipmentSpec) float64 {
	modifier := 1.0
	for _, slot := range core.TrinketSlots() {
		if int(slot) >= len(equipment.Items) || equipment.Items[slot] == nil {
			continue
		}
		itemSpec := equipment.Items[slot]
		itemID := itemSpec.GetId()
		if !isAmplificationTrinket(itemID) {
			continue
		}
		// Amp trinket percentages read the float scaling curve, matching the sim's own stat
		// multiplier (see NewDynamicMultiplyStat in sim/common/mop/trinkets_phase_4_54.go) —
		// NOT the integer RandPropPoints table GetItemEffectScaling uses.
		modifier *= 1 + core.GetItemEffectAmpScaling(itemID, 0.00176999997, itemSpec.GetUpgradeStep())/100
	}
	return modifier
}

func isAmplificationTrinket(itemID int32) bool {
	_, ok := amplificationTrinketItemIDs[itemID]
	return ok
}

// Merges the melee, caster, and healer Amplification Trinket item ID maps into a single set
// for O(1) membership testing at runtime.
func buildAmplificationTrinketItemIDSet() map[int32]struct{} {
	itemIDs := map[int32]struct{}{}
	for _, itemVersionMap := range []shared.ItemVersionMap{
		mop.MeleeAmplificationTrinketItemIDs,
		mop.CasterAmplificationTrinketItemIDs,
		mop.HealerAmplificationTrinketItemIDs,
	} {
		for _, itemID := range itemVersionMap {
			itemIDs[itemID] = struct{}{}
		}
	}
	return itemIDs
}
