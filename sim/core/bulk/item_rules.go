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
	itemSpec.Gems = applyMetaGem(existing, option.item)
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

func applyMetaGem(item core.Item, newItem core.Item) []int32 {
	newGems := make([]int32, len(newItem.GemSockets))

	if item.Type != proto.ItemType_ItemTypeHead || newItem.Type != proto.ItemType_ItemTypeHead {
		return newGems
	}

	metaGemID := int32(0)
	for _, gem := range item.Gems {
		if gem.ID != 0 && gem.Color == proto.GemColor_GemColorMeta {
			metaGemID = gem.ID
			break
		}
	}
	if metaGemID == 0 {
		return newGems
	}

	for socketIdx, socketColor := range newItem.GemSockets {
		if socketColor == proto.GemColor_GemColorMeta {
			newGems[socketIdx] = metaGemID
			break
		}
	}
	return newGems
}

func enchantAppliesToItem(effectID int32, item core.Item) bool {
	if effectID == 0 {
		return false
	}
	enchant := core.GetEnchantByEffectID(effectID)
	if enchant == nil {
		return false
	}
	if !core.CheckSliceOverlap(getEligibleEnchantSlots(*enchant), getEligibleItemSlots(item, false)) {
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
		if typeSlots, ok := itemTypeToSlotsMap[itemType]; ok {
			slots = append(slots, typeSlots...)
			continue
		}
		if itemType == proto.ItemType_ItemTypeWeapon {
			slots = append(slots, proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand)
		}
	}
	return slots
}

func getEligibleItemSlots(item core.Item, isFuryWarrior bool) []proto.ItemSlot {
	if slots, ok := itemTypeToSlotsMap[item.Type]; ok {
		return slots
	}
	if item.Type == proto.ItemType_ItemTypeWeapon {
		if isFuryWarrior {
			return []proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand}
		}
		switch item.HandType {
		case proto.HandType_HandTypeMainHand:
			return []proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand}
		case proto.HandType_HandTypeOffHand:
			return []proto.ItemSlot{proto.ItemSlot_ItemSlotOffHand}
		default:
			return []proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand}
		}
	}
	return nil
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
		if item.HandType == proto.HandType_HandTypeTwoHand && slot == proto.ItemSlot_ItemSlotOffHand && playerSpec != proto.Spec_SpecFuryWarrior {
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
