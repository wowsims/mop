package bulk

import (
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func replaceItem(existing core.Item, option bulkSimCandidateOption, inheritUpgrades bool) core.Item {
	itemSpec := existing.ToItemSpecProto()
	itemSpec.Id = option.spec.GetId()
	itemSpec.Reforging = 0
	itemSpec.RandomSuffix = 0
	itemSpec.ChallengeMode = existing.ChallengeMode
	if !enchantAppliesToItem(itemSpec.GetEnchant(), option.item) {
		itemSpec.Enchant = 0
	}
	if !enchantAppliesToItem(itemSpec.GetTinker(), option.item) {
		itemSpec.Tinker = 0
	}
	itemSpec.Gems = mergeGems(existing, option, option.item)
	if option.spec.GetRandomSuffix() != 0 {
		itemSpec.RandomSuffix = option.spec.GetRandomSuffix()
	}
	if !inheritUpgrades {
		itemSpec.UpgradeStep = option.spec.GetUpgradeStep()
	}
	return core.NewItem(core.ItemSpec{
		ID:            itemSpec.GetId(),
		RandomSuffix:  itemSpec.GetRandomSuffix(),
		Enchant:       itemSpec.GetEnchant(),
		Tinker:        itemSpec.GetTinker(),
		Gems:          slices.Clone(itemSpec.GetGems()),
		UpgradeStep:   itemSpec.GetUpgradeStep(),
		ChallengeMode: itemSpec.GetChallengeMode(),
	})
}

func createSelectedItem(option bulkSimCandidateOption, challengeModeEnabled bool) core.Item {
	return core.NewItem(core.ItemSpec{
		ID:            option.spec.GetId(),
		RandomSuffix:  option.spec.GetRandomSuffix(),
		Enchant:       option.spec.GetEnchant(),
		Tinker:        option.spec.GetTinker(),
		Gems:          slices.Clone(option.spec.GetGems()),
		Reforging:     option.spec.GetReforging(),
		UpgradeStep:   option.spec.GetUpgradeStep(),
		ChallengeMode: challengeModeEnabled,
	})
}

// Gems picked for the bulk item win; the replaced item's gems are re-homed into the sockets
// still free, preferring a color match over mere eligibility. Gems with no room are dropped.
func mergeGems(existing core.Item, option bulkSimCandidateOption, newItem core.Item) []int32 {
	newGems := make([]int32, len(newItem.GemSockets))

	for socketIdx, gemID := range option.spec.GetGems() {
		if socketIdx >= len(newGems) {
			break
		}
		newGems[socketIdx] = gemID
	}

	for gemIdx, gem := range existing.Gems {
		if gemIdx >= len(existing.GemSockets) || gem.ID == 0 {
			continue
		}
		socketIdx := firstFreeSocket(newItem.GemSockets, newGems, gem.Color, core.GemMatchesSocket)
		if socketIdx == -1 {
			socketIdx = firstFreeSocket(newItem.GemSockets, newGems, gem.Color, core.GemEligibleForSocket)
		}
		if socketIdx != -1 {
			newGems[socketIdx] = gem.ID
		}
	}
	return newGems
}

func firstFreeSocket(socketColors []proto.GemColor, gems []int32, gemColor proto.GemColor, accepts func(proto.GemColor, proto.GemColor) bool) int {
	for socketIdx, socketColor := range socketColors {
		if gems[socketIdx] == 0 && accepts(gemColor, socketColor) {
			return socketIdx
		}
	}
	return -1
}

func enchantAppliesToItem(effectID int32, item core.Item) bool {
	if effectID == 0 {
		return false
	}
	enchant := core.GetEnchantByEffectID(effectID)
	if enchant == nil {
		return false
	}
	if !core.CheckSliceOverlap(getEligibleEnchantSlots(*enchant), core.EligibleSlotsForItem(&item, false)) {
		return false
	}

	if enchant.EnchantType == proto.EnchantType_EnchantTypeTwoHand && item.HandType != proto.HandType_HandTypeTwoHand {
		return false
	}

	if enchant.EnchantType == proto.EnchantType_EnchantTypeStaff && item.WeaponType != proto.WeaponType_WeaponTypeStaff {
		return false
	}

	if enchant.EnchantType == proto.EnchantType_EnchantTypeShield && item.WeaponType != proto.WeaponType_WeaponTypeShield {
		return false
	}

	itemIsOffHandTarget := item.WeaponType == proto.WeaponType_WeaponTypeOffHand ||
		(item.WeaponType == proto.WeaponType_WeaponTypeShield && enchant.EnchantType != proto.EnchantType_EnchantTypeShield)
	if (enchant.EnchantType == proto.EnchantType_EnchantTypeOffHand) != itemIsOffHandTarget {
		return false
	}

	if enchant.Type == proto.ItemType_ItemTypeRanged {
		return item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeBow || item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeCrossbow || item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeGun
	}
	if item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeUnknown && item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeWand && enchant.Type != proto.ItemType_ItemTypeRanged {
		return false
	}
	return true
}

func getEligibleEnchantSlots(enchant core.Enchant) []proto.ItemSlot {
	types := append([]proto.ItemType{enchant.Type}, enchant.ExtraTypes...)
	slots := make([]proto.ItemSlot, 0, len(types)*2)
	for _, itemType := range types {
		if typeSlots, ok := core.ItemTypeToSlotsMap[itemType]; ok {
			slots = append(slots, typeSlots...)
			continue
		}
		if itemType == proto.ItemType_ItemTypeWeapon {
			slots = append(slots, proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand)
		}
	}
	return slots
}

func canEquipItem(item *core.Item, playerClass proto.Class, playerSpec proto.Spec, slot proto.ItemSlot) bool {
	if item.Type == proto.ItemType_ItemTypeFinger || item.Type == proto.ItemType_ItemTypeTrinket {
		return true
	}
	if item.Type == proto.ItemType_ItemTypeWeapon {
		eligibleWeaponTypes := core.ClassWeaponTypeCapabilities[playerClass]
		eligibleWeaponType, ok := eligibleWeaponTypes[item.WeaponType]
		if !ok {
			return false
		}
		if (item.HandType == proto.HandType_HandTypeOffHand || (item.HandType == proto.HandType_HandTypeOneHand && slot == proto.ItemSlot_ItemSlotOffHand)) && item.WeaponType != proto.WeaponType_WeaponTypeShield && item.WeaponType != proto.WeaponType_WeaponTypeOffHand && !core.SpecCanDualWieldCapabilities[playerSpec] {
			return false
		}
		if item.HandType == proto.HandType_HandTypeTwoHand && !eligibleWeaponType.CanUseTwoHand {
			return false
		}
		if item.HandType == proto.HandType_HandTypeTwoHand && slot == proto.ItemSlot_ItemSlotOffHand && !core.SpecCanDualWield2HCapabilities[playerSpec] {
			return false
		}
		return true
	}
	if item.Type == proto.ItemType_ItemTypeRanged {
		return slices.Contains(core.ClassRangedWeaponTypeCapabilities[playerClass], item.RangedWeaponType)
	}
	classArmorTypes := core.ClassArmorTypeCapabilities[playerClass]
	if len(classArmorTypes) == 0 {
		return false
	}
	maxArmorType := classArmorTypes[0]
	return maxArmorType >= item.ArmorType
}

// A unique item can only be worn once, and two items never share a limit category.
func pairIsEquippable(first *core.Item, second *core.Item) bool {
	if first.Unique && first.ID == second.ID {
		return false
	}
	return first.LimitCategory == 0 || first.LimitCategory != second.LimitCategory
}

func itemCanBeDoubled(item *core.Item) bool {
	return !item.Unique && item.LimitCategory == 0
}

func occupiesBothHands(item *core.Item) bool {
	return item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeUnknown &&
		item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeWand
}

func canWearWeaponInHand(item *core.Item, playerClass proto.Class, playerSpec proto.Spec, slot proto.ItemSlot) bool {
	isMainHand := slot == proto.ItemSlot_ItemSlotMainHand
	isOffHand := slot == proto.ItemSlot_ItemSlotOffHand
	if !isMainHand && !isOffHand {
		return false
	}
	if item.Type == proto.ItemType_ItemTypeRanged {
		// MoP has no ranged slot: bows and wands are worn in the mainhand.
		return isMainHand && canEquipItem(item, playerClass, playerSpec, slot)
	}
	if item.Type != proto.ItemType_ItemTypeWeapon {
		return false
	}
	switch item.HandType {
	case proto.HandType_HandTypeMainHand:
		if !isMainHand {
			return false
		}
	case proto.HandType_HandTypeOffHand:
		if !isOffHand {
			return false
		}
	}
	return canEquipItem(item, playerClass, playerSpec, slot)
}
