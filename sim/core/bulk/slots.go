package bulk

import (
	"github.com/wowsims/mop/sim/core/proto"
)

type BulkSimItemSlot int

const (
	BulkSimItemSlotHead BulkSimItemSlot = iota
	BulkSimItemSlotNeck
	BulkSimItemSlotShoulder
	BulkSimItemSlotBack
	BulkSimItemSlotChest
	BulkSimItemSlotWrist
	BulkSimItemSlotHands
	BulkSimItemSlotWaist
	BulkSimItemSlotLegs
	BulkSimItemSlotFeet
	BulkSimItemSlotFinger
	BulkSimItemSlotTrinket
	BulkSimItemSlotMainHand
	BulkSimItemSlotOffHand
	BulkSimItemSlotHandWeapon
)

var BulkSimItemSlotToSingleItemSlot = map[BulkSimItemSlot]proto.ItemSlot{
	BulkSimItemSlotHead:     proto.ItemSlot_ItemSlotHead,
	BulkSimItemSlotNeck:     proto.ItemSlot_ItemSlotNeck,
	BulkSimItemSlotShoulder: proto.ItemSlot_ItemSlotShoulder,
	BulkSimItemSlotBack:     proto.ItemSlot_ItemSlotBack,
	BulkSimItemSlotChest:    proto.ItemSlot_ItemSlotChest,
	BulkSimItemSlotWrist:    proto.ItemSlot_ItemSlotWrist,
	BulkSimItemSlotHands:    proto.ItemSlot_ItemSlotHands,
	BulkSimItemSlotWaist:    proto.ItemSlot_ItemSlotWaist,
	BulkSimItemSlotLegs:     proto.ItemSlot_ItemSlotLegs,
	BulkSimItemSlotFeet:     proto.ItemSlot_ItemSlotFeet,
	BulkSimItemSlotMainHand: proto.ItemSlot_ItemSlotMainHand,
	BulkSimItemSlotOffHand:  proto.ItemSlot_ItemSlotOffHand,
}

var BulkSimItemSlotToItemSlotPairs = map[BulkSimItemSlot][2]proto.ItemSlot{
	BulkSimItemSlotFinger:     {proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotFinger2},
	BulkSimItemSlotTrinket:    {proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2},
	BulkSimItemSlotHandWeapon: {proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand},
}

var ItemSlotToBulkSimItemSlot = map[proto.ItemSlot]BulkSimItemSlot{
	proto.ItemSlot_ItemSlotHead:     BulkSimItemSlotHead,
	proto.ItemSlot_ItemSlotNeck:     BulkSimItemSlotNeck,
	proto.ItemSlot_ItemSlotShoulder: BulkSimItemSlotShoulder,
	proto.ItemSlot_ItemSlotBack:     BulkSimItemSlotBack,
	proto.ItemSlot_ItemSlotChest:    BulkSimItemSlotChest,
	proto.ItemSlot_ItemSlotWrist:    BulkSimItemSlotWrist,
	proto.ItemSlot_ItemSlotHands:    BulkSimItemSlotHands,
	proto.ItemSlot_ItemSlotWaist:    BulkSimItemSlotWaist,
	proto.ItemSlot_ItemSlotLegs:     BulkSimItemSlotLegs,
	proto.ItemSlot_ItemSlotFeet:     BulkSimItemSlotFeet,
	proto.ItemSlot_ItemSlotFinger1:  BulkSimItemSlotFinger,
	proto.ItemSlot_ItemSlotFinger2:  BulkSimItemSlotFinger,
	proto.ItemSlot_ItemSlotTrinket1: BulkSimItemSlotTrinket,
	proto.ItemSlot_ItemSlotTrinket2: BulkSimItemSlotTrinket,
	proto.ItemSlot_ItemSlotMainHand: BulkSimItemSlotMainHand,
	proto.ItemSlot_ItemSlotOffHand:  BulkSimItemSlotOffHand,
}

var BulkSimItemSlotNames = map[BulkSimItemSlot]string{
	BulkSimItemSlotHead:       "ItemSlotHead",
	BulkSimItemSlotNeck:       "ItemSlotNeck",
	BulkSimItemSlotShoulder:   "ItemSlotShoulder",
	BulkSimItemSlotBack:       "ItemSlotBack",
	BulkSimItemSlotChest:      "ItemSlotChest",
	BulkSimItemSlotWrist:      "ItemSlotWrist",
	BulkSimItemSlotHands:      "ItemSlotHands",
	BulkSimItemSlotWaist:      "ItemSlotWaist",
	BulkSimItemSlotLegs:       "ItemSlotLegs",
	BulkSimItemSlotFeet:       "ItemSlotFeet",
	BulkSimItemSlotFinger:     "ItemSlotFinger",
	BulkSimItemSlotTrinket:    "ItemSlotTrinket",
	BulkSimItemSlotMainHand:   "ItemSlotMainHand",
	BulkSimItemSlotOffHand:    "ItemSlotOffHand",
	BulkSimItemSlotHandWeapon: "ItemSlotHandWeapon",
}

var bulkSimSelectedOrder = [...]BulkSimItemSlot{
	BulkSimItemSlotHead,
	BulkSimItemSlotNeck,
	BulkSimItemSlotShoulder,
	BulkSimItemSlotBack,
	BulkSimItemSlotChest,
	BulkSimItemSlotWrist,
	BulkSimItemSlotHands,
	BulkSimItemSlotWaist,
	BulkSimItemSlotLegs,
	BulkSimItemSlotFeet,
	BulkSimItemSlotFinger,
	BulkSimItemSlotTrinket,
	BulkSimItemSlotMainHand,
	BulkSimItemSlotOffHand,
	BulkSimItemSlotHandWeapon,
}

var itemTypeToSlotsMap = map[proto.ItemType][]proto.ItemSlot{
	proto.ItemType_ItemTypeHead:     {proto.ItemSlot_ItemSlotHead},
	proto.ItemType_ItemTypeNeck:     {proto.ItemSlot_ItemSlotNeck},
	proto.ItemType_ItemTypeShoulder: {proto.ItemSlot_ItemSlotShoulder},
	proto.ItemType_ItemTypeBack:     {proto.ItemSlot_ItemSlotBack},
	proto.ItemType_ItemTypeChest:    {proto.ItemSlot_ItemSlotChest},
	proto.ItemType_ItemTypeWrist:    {proto.ItemSlot_ItemSlotWrist},
	proto.ItemType_ItemTypeHands:    {proto.ItemSlot_ItemSlotHands},
	proto.ItemType_ItemTypeWaist:    {proto.ItemSlot_ItemSlotWaist},
	proto.ItemType_ItemTypeLegs:     {proto.ItemSlot_ItemSlotLegs},
	proto.ItemType_ItemTypeFeet:     {proto.ItemSlot_ItemSlotFeet},
	proto.ItemType_ItemTypeFinger:   {proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotFinger2},
	proto.ItemType_ItemTypeTrinket:  {proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2},
	proto.ItemType_ItemTypeRanged:   {proto.ItemSlot_ItemSlotMainHand},
}

func isSecondaryItemSlot(slot proto.ItemSlot, playerCanDualWield bool) bool {
	return slot == proto.ItemSlot_ItemSlotFinger2 || slot == proto.ItemSlot_ItemSlotTrinket2 || (playerCanDualWield && slot == proto.ItemSlot_ItemSlotOffHand)
}

func getBulkItemSlotFromSlot(slot proto.ItemSlot, playerCanDualWield bool) BulkSimItemSlot {
	if playerCanDualWield && (slot == proto.ItemSlot_ItemSlotMainHand || slot == proto.ItemSlot_ItemSlotOffHand) {
		return BulkSimItemSlotHandWeapon
	}
	if bulkSlot, ok := ItemSlotToBulkSimItemSlot[slot]; ok {
		return bulkSlot
	}
	return BulkSimItemSlotHead
}
