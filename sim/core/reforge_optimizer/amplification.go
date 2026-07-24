package reforgeoptimizer

import (
	"github.com/wowsims/mop/sim/common/mop"
	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

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
