package bulk

import (
	"fmt"
	"math"
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	googleProto "google.golang.org/protobuf/proto"
)

type bulkSimCandidateGenerator struct {
	settings             *proto.BulkSettings
	baseEquipment        core.Equipment
	playerClass          proto.Class
	playerSpec           proto.Spec
	playerCanDualWield   bool
	playerIsFuryWarrior  bool
	challengeModeEnabled bool
	selectedByBulkSlot   map[BulkSimItemSlot][]bulkSimCandidateOption
	groupedPairsBySlot   map[BulkSimItemSlot][][2]bulkSimCandidateOption
	comboItemsBySlot     []bulkSimCandidateOption
	comboSlotUsed        []bool
	inheritUpgrades      bool
	frozenItems          map[BulkSimItemSlot]*core.Item
	frozenWeaponSlot     proto.ItemSlot
	weaponTypeFilters    map[proto.ItemSlot][]proto.WeaponType
	weaponCombosCached   [][2]*bulkSimCandidateOption
	weaponCombosReady    bool
	weaponCopyCounts     map[itemSpecCacheKey]int
}

func newBulkSimCandidateGenerator(request *proto.BulkSimRequest, player *proto.Player) (*bulkSimCandidateGenerator, error) {
	playerSpec, err := getPlayerSpec(player)
	if err != nil {
		return nil, err
	}
	playerCanDualWield := core.SpecCanDualWieldCapabilities[playerSpec] && player.GetClass() != proto.Class_ClassHunter
	generator := &bulkSimCandidateGenerator{
		settings:             request.GetBulkSettings(),
		baseEquipment:        core.ProtoToEquipment(player.GetEquipment()),
		playerClass:          player.GetClass(),
		playerSpec:           playerSpec,
		playerCanDualWield:   playerCanDualWield,
		playerIsFuryWarrior:  playerSpec == proto.Spec_SpecFuryWarrior,
		challengeModeEnabled: player.GetChallengeMode(),
		selectedByBulkSlot:   make(map[BulkSimItemSlot][]bulkSimCandidateOption),
		groupedPairsBySlot:   make(map[BulkSimItemSlot][][2]bulkSimCandidateOption),
		comboItemsBySlot:     make([]bulkSimCandidateOption, int(core.NumItemSlots)),
		comboSlotUsed:        make([]bool, int(core.NumItemSlots)),
		inheritUpgrades:      request.GetBulkSettings().GetInheritUpgrades(),
		frozenItems:          make(map[BulkSimItemSlot]*core.Item),
		weaponTypeFilters: map[proto.ItemSlot][]proto.WeaponType{
			proto.ItemSlot_ItemSlotMainHand: request.GetBulkSettings().GetFreezeMainhandWeaponSlots(),
			proto.ItemSlot_ItemSlotOffHand:  request.GetBulkSettings().GetFreezeOffhandWeaponSlots(),
		},
	}
	generator.initFrozenSettings()
	if err := generator.initSelectedItems(); err != nil {
		return nil, err
	}
	generator.initGroupedSlotPairs()
	return generator, nil
}

func (generator *bulkSimCandidateGenerator) buildCandidates() ([]*proto.BulkGearCandidate, error) {
	rawCombinations := generator.rawCombinationsCount()
	matcher := generator.buildRequiredSetBonusMatcher(generator.settings.GetRequiredSetBonuses())
	// Never reserve the whole raw space: it can be millions of entries, required-set
	// filtering can drop output cardinality by orders of magnitude, and append grows
	// geometrically from here anyway.
	candidates := make([]*proto.BulkGearCandidate, 0, min(rawCombinations, maxBulkCandidatePreallocation))
	var scratchCounts []int
	if matcher != nil {
		scratchCounts = make([]int, len(matcher.baseCounts))
	}
	for comboIdx := 0; comboIdx < rawCombinations; comboIdx++ {
		if !generator.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher, scratchCounts) {
			continue
		}
		gear, err := generator.buildGearForCombo(comboIdx)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, &proto.BulkGearCandidate{
			Index: int32(len(candidates)),
			Gear:  gear,
		})
	}
	return candidates, nil
}

func (generator *bulkSimCandidateGenerator) initFrozenSettings() {
	if slot := generator.settings.GetFreezeRingSlot(); slot == int32(proto.ItemSlot_ItemSlotFinger1) || slot == int32(proto.ItemSlot_ItemSlotFinger2) {
		item := generator.baseEquipment.GetItemBySlot(proto.ItemSlot(slot))
		if item != nil && item.ID != 0 {
			itemCopy := *item
			generator.frozenItems[BulkSimItemSlotFinger] = &itemCopy
		}
	}
	if slot := generator.settings.GetFreezeTrinketSlot(); slot == int32(proto.ItemSlot_ItemSlotTrinket1) || slot == int32(proto.ItemSlot_ItemSlotTrinket2) {
		item := generator.baseEquipment.GetItemBySlot(proto.ItemSlot(slot))
		if item != nil && item.ID != 0 {
			itemCopy := *item
			generator.frozenItems[BulkSimItemSlotTrinket] = &itemCopy
		}
	}
	if slot := generator.settings.GetFreezeWeaponSlot(); slot == int32(proto.ItemSlot_ItemSlotMainHand) || slot == int32(proto.ItemSlot_ItemSlotOffHand) {
		generator.frozenWeaponSlot = proto.ItemSlot(slot)
	}
}

func (generator *bulkSimCandidateGenerator) initSelectedItems() error {
	equippedSpecKeys := make(map[itemSpecFingerprintKey]struct{}, int(core.NumItemSlots))
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		equippedItem := generator.baseEquipment.GetItemBySlot(slot)
		if equippedItem == nil || equippedItem.ID == 0 {
			continue
		}
		equippedSpecKeys[buildItemSpecFingerprintKey(equippedItem.ToItemSpecProto())] = struct{}{}
	}

	for _, selectedItem := range generator.settings.GetItems() {
		if selectedItem == nil || selectedItem.GetId() == 0 {
			continue
		}
		if _, isEquipped := equippedSpecKeys[buildItemSpecFingerprintKey(selectedItem)]; isEquipped {
			continue
		}
		baseItem := core.GetItemByID(selectedItem.GetId())
		if baseItem == nil {
			return fmt.Errorf("selected bulk item %d is missing from the database", selectedItem.GetId())
		}
		option := bulkSimCandidateOption{
			spec: googleProto.Clone(selectedItem).(*proto.ItemSpec),
			item: core.NewItem(core.ItemSpec{
				ID:            selectedItem.GetId(),
				RandomSuffix:  selectedItem.GetRandomSuffix(),
				Enchant:       selectedItem.GetEnchant(),
				Tinker:        selectedItem.GetTinker(),
				Gems:          slices.Clone(selectedItem.GetGems()),
				Reforging:     selectedItem.GetReforging(),
				UpgradeStep:   selectedItem.GetUpgradeStep(),
				ChallengeMode: selectedItem.GetChallengeMode(),
			}),
		}
		// An item is eligible for at most two slots, and when both collapse into one bulk slot
		// (Finger1/2, Trinket1/2, or either hand for a dual wielder) it belongs there once - a
		// second append would fake a second copy in weaponCopyCounts below.
		lastBulkSlot := BulkSimItemSlot(-1)
		for _, slot := range getEligibleItemSlots(option.item, generator.playerIsFuryWarrior) {
			if !canEquipItem(&option.item, generator.playerClass, generator.playerSpec, slot) {
				continue
			}
			bulkSlot := getBulkItemSlotFromSlot(slot, generator.playerCanDualWield)
			if bulkSlot == lastBulkSlot {
				continue
			}
			lastBulkSlot = bulkSlot
			generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], option)
		}
	}

	// Keep backend candidate semantics aligned with the frontend picker behavior:
	// selected items are considered first, but currently equipped items are always
	// available fallback options for each eligible bulk slot.
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		equippedItem := generator.baseEquipment.GetItemBySlot(slot)
		if equippedItem == nil || equippedItem.ID == 0 {
			continue
		}
		if !canEquipItem(equippedItem, generator.playerClass, generator.playerSpec, slot) {
			continue
		}

		bulkSlot := getBulkItemSlotFromSlot(slot, generator.playerCanDualWield)
		generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], bulkSimCandidateOption{
			spec: equippedItem.ToItemSpecProto(),
			item: *equippedItem,
		})
	}

	// Capture how many copies of each 1H weapon are available (selected + equipped)
	// before dedup collapses them. A weapon may only occupy both hands when at least
	// two copies exist.
	generator.weaponCopyCounts = make(map[itemSpecCacheKey]int)
	for _, option := range generator.selectedByBulkSlot[BulkSimItemSlotHandWeapon] {
		generator.weaponCopyCounts[buildItemSpecKey(option.spec, generator.inheritUpgrades)]++
	}

	for bulkSlot, options := range generator.selectedByBulkSlot {
		generator.selectedByBulkSlot[bulkSlot] = dedupeCandidateOptions(options, generator.inheritUpgrades)
	}
	return nil
}

func (generator *bulkSimCandidateGenerator) initGroupedSlotPairs() {
	for _, bulkSlot := range []BulkSimItemSlot{BulkSimItemSlotFinger, BulkSimItemSlotTrinket} {
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) < 2 {
			continue
		}
		var pairs [][2]bulkSimCandidateOption
		if frozenItem := generator.frozenItems[bulkSlot]; frozenItem != nil {
			pairs = make([][2]bulkSimCandidateOption, 0, len(options))
			frozenSpec := frozenItem.ToItemSpecProto()
			for _, option := range options {
				if candidateOptionEqualsItem(&option, frozenItem, generator.inheritUpgrades) {
					continue
				}
				if !pairIsEquippable(frozenItem, &option.item) {
					continue
				}
				pairs = append(pairs, [2]bulkSimCandidateOption{{spec: frozenSpec, item: *frozenItem}, option})
			}
		} else {
			pairs = make([][2]bulkSimCandidateOption, 0, len(options)*(len(options)-1)/2)
			for i := 0; i < len(options); i++ {
				for j := i + 1; j < len(options); j++ {
					if !pairIsEquippable(&options[i].item, &options[j].item) {
						continue
					}
					pairs = append(pairs, [2]bulkSimCandidateOption{options[i], options[j]})
				}
			}
		}
		generator.groupedPairsBySlot[bulkSlot] = pairs
	}
}

// The raw combination space is a plain product over the bulk slots and nothing bounds it:
// the frontend gates on the *matching* count, and required set bonuses exist precisely so
// a large selection can be filtered down to a runnable set. So the product is clamped only
// to keep it inside the int32 result fields and out of overflow - never to refuse the
// request, which would break exactly that workflow.
const maxBulkRawCombinations = math.MaxInt32
const maxBulkCandidatePreallocation = 1 << 16

func saturatingCombinationsMul(rawCombinations int, factor int) int {
	if factor == 0 {
		return 0
	}
	if rawCombinations > maxBulkRawCombinations/factor {
		return maxBulkRawCombinations
	}
	return rawCombinations * factor
}

func (generator *bulkSimCandidateGenerator) rawCombinationsCount() int {
	rawCombinations := len(generator.getAllWeaponCombos())
	if rawCombinations == 0 {
		rawCombinations = 1
	}
	for _, bulkSlot := range bulkSimSelectedOrder {
		if bulkSlot == BulkSimItemSlotMainHand || bulkSlot == BulkSimItemSlotOffHand || bulkSlot == BulkSimItemSlotHandWeapon {
			continue
		}
		numOptions := len(generator.selectedByBulkSlot[bulkSlot])
		if numOptions > 1 && (bulkSlot == BulkSimItemSlotFinger || bulkSlot == BulkSimItemSlotTrinket) {
			rawCombinations = saturatingCombinationsMul(rawCombinations, len(generator.groupedPairsBySlot[bulkSlot]))
		} else if numOptions > 0 {
			rawCombinations = saturatingCombinationsMul(rawCombinations, numOptions)
		}
	}
	return rawCombinations
}

func (generator *bulkSimCandidateGenerator) buildGearForCombo(comboIdx int) (*proto.EquipmentSpec, error) {
	gear := generator.baseEquipment
	err := generator.populateItemsForCombo(comboIdx)
	if err != nil {
		return nil, err
	}
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		if !generator.comboSlotUsed[int(slot)] {
			continue
		}
		option := generator.comboItemsBySlot[int(slot)]
		existingItem := gear.GetItemBySlot(slot)
		if existingItem != nil && existingItem.ID != 0 {
			gear[slot] = replaceItem(*existingItem, option, generator.inheritUpgrades)
		} else {
			gear[slot] = createSelectedItem(option, generator.challengeModeEnabled)
		}
	}
	// Non-Fury players cannot dual-wield 2H weapons. When a 2H lands in the mainhand
	// the offhand combo slot is nil, leaving the base gear's 1H offhand in place — clear it.
	if !generator.playerIsFuryWarrior {
		if mh := gear.GetItemBySlot(proto.ItemSlot_ItemSlotMainHand); mh != nil && mh.HandType == proto.HandType_HandTypeTwoHand {
			gear[proto.ItemSlot_ItemSlotOffHand] = core.Item{}
		}
	}
	return gear.ToEquipmentSpecProto(), nil
}

func (generator *bulkSimCandidateGenerator) populateItemsForCombo(comboIdx int) error {
	for idx := range generator.comboSlotUsed {
		generator.comboSlotUsed[idx] = false
	}

	allWeaponPairs := generator.getAllWeaponCombos()
	if len(allWeaponPairs) > 0 {
		weaponPairIdx := comboIdx % len(allWeaponPairs)
		comboIdx = comboIdx / len(allWeaponPairs)
		weaponPair := allWeaponPairs[weaponPairIdx]
		if weaponPair[0] != nil {
			slot := proto.ItemSlot_ItemSlotMainHand
			generator.comboItemsBySlot[int(slot)] = *weaponPair[0]
			generator.comboSlotUsed[int(slot)] = true
		}
		if weaponPair[1] != nil {
			slot := proto.ItemSlot_ItemSlotOffHand
			generator.comboItemsBySlot[int(slot)] = *weaponPair[1]
			generator.comboSlotUsed[int(slot)] = true
		}
	}
	for _, bulkSlot := range bulkSimSelectedOrder {
		if bulkSlot == BulkSimItemSlotMainHand || bulkSlot == BulkSimItemSlotOffHand || bulkSlot == BulkSimItemSlotHandWeapon {
			continue
		}
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) == 0 {
			continue
		}
		if bulkSlot == BulkSimItemSlotFinger || bulkSlot == BulkSimItemSlotTrinket {
			if len(options) < 2 {
				return fmt.Errorf("at least 2 items must be selected for grouped bulk slot %d", bulkSlot)
			}
			pairs := generator.groupedPairsBySlot[bulkSlot]
			if len(pairs) == 0 {
				return fmt.Errorf("no grouped candidate pairs available for bulk slot %d", bulkSlot)
			}
			pairIdx := comboIdx % len(pairs)
			comboIdx = comboIdx / len(pairs)
			slots := BulkSimItemSlotToItemSlotPairs[bulkSlot]
			generator.comboItemsBySlot[int(slots[0])] = pairs[pairIdx][0]
			generator.comboSlotUsed[int(slots[0])] = true
			generator.comboItemsBySlot[int(slots[1])] = pairs[pairIdx][1]
			generator.comboSlotUsed[int(slots[1])] = true
			continue
		}
		optionIdx := comboIdx % len(options)
		comboIdx = comboIdx / len(options)
		slot := BulkSimItemSlotToSingleItemSlot[bulkSlot]
		generator.comboItemsBySlot[int(slot)] = options[optionIdx]
		generator.comboSlotUsed[int(slot)] = true
	}
	return nil
}
