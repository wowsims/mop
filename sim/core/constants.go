package core

import (
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

const CharacterLevel = 90
const MinIlvl = 100
const MaxIlvl = 600
const MinUpgradeIlvl = 458
const MaxChallengeModeIlvl = 463

const GCDMin = time.Second * 1
const GCDDefault = time.Millisecond * 1500
const BossGCD = time.Millisecond * 1620
const MaxSpellQueueWindow = time.Millisecond * 400
const SpellBatchWindow = time.Millisecond * 10
const PetUpdateInterval = time.Millisecond * 5250
const MaxMeleeRange = 5.0 // in yards

const DefaultAttackPowerPerDPS = 14.0

// Updated based on formulas supplied by InDebt on WoWSims Discord
const EnemyAutoAttackAPCoefficient = 1.0 / (14.0 * 177.0)

// Used by Protection Warriors, Protection Paladins and Blood Death Knights
const StrengthToParryPercent = 1 / 95115.8596
const StrengthToParryRating = StrengthToParryPercent * 100 * ParryRatingPerParryPercent

// Used by Monks and Druids
const AgilityToDodgePercent = 1 / 95115.8596
const AgilityToDodgeRating = AgilityToDodgePercent * 100 * DodgeRatingPerDodgePercent

// IDs for items used in core
// const ()

type Hand bool

const MainHand Hand = true
const OffHand Hand = false

const CombatTableCoverageCap = 1.024 // 102.4% chance to avoid an attack

const NumItemSlots = proto.ItemSlot_ItemSlotOffHand + 1

func TrinketSlots() []proto.ItemSlot {
	return []proto.ItemSlot{proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2}
}

func AllWeaponSlots() []proto.ItemSlot {
	return []proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand}
}

func ArmorSpecializationSlots() []proto.ItemSlot {
	return []proto.ItemSlot{
		proto.ItemSlot_ItemSlotHead,
		proto.ItemSlot_ItemSlotShoulder,
		proto.ItemSlot_ItemSlotChest,
		proto.ItemSlot_ItemSlotWrist,
		proto.ItemSlot_ItemSlotHands,
		proto.ItemSlot_ItemSlotWaist,
		proto.ItemSlot_ItemSlotLegs,
		proto.ItemSlot_ItemSlotFeet,
	}
}
