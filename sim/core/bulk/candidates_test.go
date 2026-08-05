package bulk

import (
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func addBulkTestEnchant(effectID int32, itemType proto.ItemType, extraTypes []proto.ItemType, enchantType proto.EnchantType) {
	core.AddToDatabase(&proto.SimDatabase{
		Enchants: []*proto.SimEnchant{
			{
				EffectId:    effectID,
				Type:        itemType,
				ExtraTypes:  extraTypes,
				EnchantType: enchantType,
			},
		},
	})
}

func TestBulkSimEnchantAppliesToItem_UsesTypedWeaponRules(t *testing.T) {
	twoHandEffectID := int32(910001)
	staffEffectID := int32(910002)
	shieldEffectID := int32(910003)
	offHandEffectID := int32(910004)

	addBulkTestEnchant(twoHandEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeTwoHand)
	addBulkTestEnchant(staffEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeStaff)
	addBulkTestEnchant(shieldEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeShield)
	addBulkTestEnchant(offHandEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeOffHand)

	twoHandSword := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeSword,
		HandType:   proto.HandType_HandTypeTwoHand,
	}
	oneHandSword := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeSword,
		HandType:   proto.HandType_HandTypeOneHand,
	}
	staff := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeStaff,
		HandType:   proto.HandType_HandTypeTwoHand,
	}
	shield := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeShield,
		HandType:   proto.HandType_HandTypeOffHand,
	}
	offHand := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeOffHand,
		HandType:   proto.HandType_HandTypeOffHand,
	}

	if !enchantAppliesToItem(twoHandEffectID, twoHandSword) {
		t.Fatalf("expected two-hand enchant to apply to two-handed weapon")
	}
	if enchantAppliesToItem(twoHandEffectID, oneHandSword) {
		t.Fatalf("expected two-hand enchant to not apply to one-handed weapon")
	}

	if !enchantAppliesToItem(staffEffectID, staff) {
		t.Fatalf("expected staff enchant to apply to staff")
	}
	if enchantAppliesToItem(staffEffectID, twoHandSword) {
		t.Fatalf("expected staff enchant to not apply to non-staff weapon")
	}

	if !enchantAppliesToItem(shieldEffectID, shield) {
		t.Fatalf("expected shield enchant to apply to shield")
	}
	if enchantAppliesToItem(shieldEffectID, offHand) {
		t.Fatalf("expected shield enchant to not apply to off-hand frill")
	}

	if !enchantAppliesToItem(offHandEffectID, offHand) {
		t.Fatalf("expected off-hand enchant to apply to off-hand frill")
	}
	if !enchantAppliesToItem(offHandEffectID, shield) {
		t.Fatalf("expected off-hand enchant to apply to shield")
	}
	if enchantAppliesToItem(offHandEffectID, oneHandSword) {
		t.Fatalf("expected off-hand enchant to not apply to one-handed weapon")
	}
}

func TestBulkSimEnchantAppliesToItem_UsesTypedRangedRules(t *testing.T) {
	rangedEffectID := int32(910005)
	weaponEffectID := int32(910006)

	addBulkTestEnchant(rangedEffectID, proto.ItemType_ItemTypeRanged, nil, proto.EnchantType_EnchantTypeNormal)
	addBulkTestEnchant(weaponEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeNormal)

	bow := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeBow,
	}
	wand := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeWand,
	}
	gun := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeGun,
	}

	if !enchantAppliesToItem(rangedEffectID, bow) {
		t.Fatalf("expected ranged enchant to apply to bow")
	}
	if enchantAppliesToItem(rangedEffectID, wand) {
		t.Fatalf("expected ranged enchant to not apply to wand")
	}
	if enchantAppliesToItem(weaponEffectID, gun) {
		t.Fatalf("expected non-ranged enchant to not apply to non-wand ranged weapon")
	}
}

func TestBulkSimEnchantAppliesToItem_SupportsExtraTypes(t *testing.T) {
	extraTypeEffectID := int32(910007)
	addBulkTestEnchant(extraTypeEffectID, proto.ItemType_ItemTypeChest, []proto.ItemType{proto.ItemType_ItemTypeWrist}, proto.EnchantType_EnchantTypeNormal)

	wrist := core.Item{Type: proto.ItemType_ItemTypeWrist}
	legs := core.Item{Type: proto.ItemType_ItemTypeLegs}

	if !enchantAppliesToItem(extraTypeEffectID, wrist) {
		t.Fatalf("expected enchant to apply to item type listed in extra types")
	}
	if enchantAppliesToItem(extraTypeEffectID, legs) {
		t.Fatalf("expected enchant to not apply to unrelated item type")
	}
}

func TestReorganizeGems_PersistsHeadMetaOnly(t *testing.T) {
	existing := core.Item{
		Type:       proto.ItemType_ItemTypeHead,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorMeta, proto.GemColor_GemColorRed},
		Gems: []core.Gem{
			{ID: 1001, Color: proto.GemColor_GemColorMeta},
			{ID: 1002, Color: proto.GemColor_GemColorRed},
		},
	}
	newItem := core.Item{
		Type:       proto.ItemType_ItemTypeHead,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorMeta, proto.GemColor_GemColorBlue},
	}

	gems := applyMetaGem(existing, newItem)
	if len(gems) != 2 {
		t.Fatalf("expected 2 gem slots, got %d", len(gems))
	}
	if gems[0] != 1001 {
		t.Fatalf("expected meta gem to persist in meta socket, got %d", gems[0])
	}
	if gems[1] != 0 {
		t.Fatalf("expected non-meta gem to be cleared, got %d", gems[1])
	}
}

func TestReorganizeGems_DropsNonHeadGems(t *testing.T) {
	existing := core.Item{
		Type:       proto.ItemType_ItemTypeHands,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorRed},
		Gems: []core.Gem{
			{ID: 2001, Color: proto.GemColor_GemColorRed},
		},
	}
	newItem := core.Item{
		Type:       proto.ItemType_ItemTypeHands,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorRed},
	}

	gems := applyMetaGem(existing, newItem)
	if len(gems) != 1 {
		t.Fatalf("expected 1 gem slot, got %d", len(gems))
	}
	if gems[0] != 0 {
		t.Fatalf("expected non-head gems to be cleared, got %d", gems[0])
	}
}
