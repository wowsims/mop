package bulk

import (
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (generator *bulkSimCandidateGenerator) getAllWeaponCombos() [][2]*bulkSimCandidateOption {
	if generator.weaponCombosReady {
		return generator.weaponCombosCached
	}

	allWeaponCombos := make([][2]*bulkSimCandidateOption, 0)
	all2HWeapons := make([]bulkSimCandidateOption, 0)
	for _, bulkSlot := range []BulkSimItemSlot{BulkSimItemSlotMainHand, BulkSimItemSlotHandWeapon} {
		options := generator.selectedByBulkSlot[bulkSlot]
		for _, option := range options {
			if occupiesBothHands(&option.item) || option.item.HandType == proto.HandType_HandTypeTwoHand {
				all2HWeapons = append(all2HWeapons, option)
			}
		}
	}
	if generator.playerIsFuryWarrior {
		for i := range all2HWeapons {
			if optionsContainEquivalent(all2HWeapons[:i], &all2HWeapons[i], generator.inheritUpgrades) {
				continue
			}
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], nil})
			for j := i + 1; j < len(all2HWeapons); j++ {
				if optionsContainEquivalent(all2HWeapons[i+1:j], &all2HWeapons[j], generator.inheritUpgrades) {
					continue
				}
				if occupiesBothHands(&all2HWeapons[i].item) || occupiesBothHands(&all2HWeapons[j].item) {
					continue
				}
				allWeaponCombos = generator.appendWearableOrders(allWeaponCombos, &all2HWeapons[i], &all2HWeapons[j])
			}
		}
	} else {
		for i := range all2HWeapons {
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], nil})
		}
	}
	mhOptions := generator.selectedByBulkSlot[BulkSimItemSlotMainHand]
	ohOptions := generator.selectedByBulkSlot[BulkSimItemSlotOffHand]
	if len(mhOptions) > 0 {
		for i := range mhOptions {
			if optionsContainEquivalent(all2HWeapons, &mhOptions[i], generator.inheritUpgrades) {
				continue
			}
			if len(ohOptions) > 0 {
				for j := range ohOptions {
					allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&mhOptions[i], &ohOptions[j]})
				}
			} else {
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&mhOptions[i], nil})
			}
		}
	} else if len(ohOptions) > 0 {
		for i := range ohOptions {
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{nil, &ohOptions[i]})
		}
	}
	oneHandOptions := generator.selectedByBulkSlot[BulkSimItemSlotHandWeapon]
	if len(oneHandOptions) > 0 {
		// Everything that fills both hands is in all2HWeapons by construction, so dropping the
		// options equivalent to one of those also drops every ranged weapon here.
		filtered := make([]bulkSimCandidateOption, 0, len(oneHandOptions))
		for _, option := range oneHandOptions {
			if optionsContainEquivalent(all2HWeapons, &option, generator.inheritUpgrades) {
				continue
			}
			filtered = append(filtered, option)
		}
		for i := range filtered {
			if optionsContainEquivalent(filtered[:i], &filtered[i], generator.inheritUpgrades) {
				continue
			}
			// Only wield the same 1H weapon in both hands when at least two copies exist.
			copyCount := generator.weaponCopyCounts[buildItemSpecKey(filtered[i].spec, generator.inheritUpgrades)]
			if copyCount >= 2 && itemCanBeDoubled(&filtered[i].item) {
				allWeaponCombos = generator.appendWearablePair(allWeaponCombos, &filtered[i], &filtered[i])
			}
			for j := i + 1; j < len(filtered); j++ {
				if optionsContainEquivalent(filtered[i+1:j], &filtered[j], generator.inheritUpgrades) {
					continue
				}
				if !pairIsEquippable(&filtered[i].item, &filtered[j].item) {
					continue
				}
				allWeaponCombos = generator.appendWearableOrders(allWeaponCombos, &filtered[i], &filtered[j])
			}
		}
	}
	filteredCombos := make([][2]*bulkSimCandidateOption, 0, len(allWeaponCombos))
	for _, combo := range allWeaponCombos {
		if generator.weaponComboMatchesSettings(combo[0], combo[1]) {
			filteredCombos = append(filteredCombos, combo)
		}
	}

	generator.weaponCombosCached = filteredCombos
	generator.weaponCombosReady = true
	return generator.weaponCombosCached
}

// The hand bucket holds anything wieldable in either hand, so a mainhand-only weapon still has to
// be kept out of the offhand and vice versa.
func (generator *bulkSimCandidateGenerator) appendWearablePair(combos [][2]*bulkSimCandidateOption, mhItem *bulkSimCandidateOption, ohItem *bulkSimCandidateOption) [][2]*bulkSimCandidateOption {
	if canWearWeaponInHand(&mhItem.item, generator.playerClass, generator.playerSpec, proto.ItemSlot_ItemSlotMainHand) &&
		canWearWeaponInHand(&ohItem.item, generator.playerClass, generator.playerSpec, proto.ItemSlot_ItemSlotOffHand) {
		combos = append(combos, [2]*bulkSimCandidateOption{mhItem, ohItem})
	}
	return combos
}

// Both hand orders of a pair, minus the mirror image when the two options are the same item.
func (generator *bulkSimCandidateGenerator) appendWearableOrders(combos [][2]*bulkSimCandidateOption, first *bulkSimCandidateOption, second *bulkSimCandidateOption) [][2]*bulkSimCandidateOption {
	combos = generator.appendWearablePair(combos, first, second)
	if candidateOptionsEqual(first, second, generator.inheritUpgrades) {
		return combos
	}
	return generator.appendWearablePair(combos, second, first)
}

func (generator *bulkSimCandidateGenerator) weaponComboMatchesSettings(mhItem *bulkSimCandidateOption, ohItem *bulkSimCandidateOption) bool {
	frozenWeaponItem := generator.getFrozenWeaponItem()
	if generator.frozenWeaponSlot == proto.ItemSlot_ItemSlotMainHand && frozenWeaponItem != nil && !candidateOptionEqualsItemPtr(mhItem, frozenWeaponItem, generator.inheritUpgrades) {
		return false
	}
	if generator.frozenWeaponSlot == proto.ItemSlot_ItemSlotOffHand && frozenWeaponItem != nil && !candidateOptionEqualsItemPtr(ohItem, frozenWeaponItem, generator.inheritUpgrades) {
		return false
	}
	return generator.matchesWeaponTypeFilter(mhItem, proto.ItemSlot_ItemSlotMainHand) && generator.matchesWeaponTypeFilter(ohItem, proto.ItemSlot_ItemSlotOffHand)
}

func (generator *bulkSimCandidateGenerator) matchesWeaponTypeFilter(option *bulkSimCandidateOption, slot proto.ItemSlot) bool {
	filter := generator.weaponTypeFilters[slot]
	if len(filter) == 0 {
		return true
	}
	if option == nil {
		return false
	}
	return option.item.WeaponType > proto.WeaponType_WeaponTypeUnknown && slices.Contains(filter, option.item.WeaponType)
}

func (generator *bulkSimCandidateGenerator) getFrozenWeaponItem() *core.Item {
	if generator.frozenWeaponSlot != proto.ItemSlot_ItemSlotMainHand && generator.frozenWeaponSlot != proto.ItemSlot_ItemSlotOffHand {
		return nil
	}
	item := generator.baseEquipment.GetItemBySlot(generator.frozenWeaponSlot)
	if item == nil || item.ID == 0 {
		return nil
	}
	itemCopy := *item
	return &itemCopy
}
