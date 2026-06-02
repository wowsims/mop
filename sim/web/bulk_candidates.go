package main

import (
	"fmt"
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	googleProto "google.golang.org/protobuf/proto"
)

type bulkSimItemSlot int

const (
	bulkSimItemSlotHead bulkSimItemSlot = iota
	bulkSimItemSlotNeck
	bulkSimItemSlotShoulder
	bulkSimItemSlotBack
	bulkSimItemSlotChest
	bulkSimItemSlotWrist
	bulkSimItemSlotHands
	bulkSimItemSlotWaist
	bulkSimItemSlotLegs
	bulkSimItemSlotFeet
	bulkSimItemSlotFinger
	bulkSimItemSlotTrinket
	bulkSimItemSlotMainHand
	bulkSimItemSlotOffHand
	bulkSimItemSlotHandWeapon
)

type bulkSimEligibleWeaponType struct {
	canUseTwoHand bool
}

type bulkSimCandidateOption struct {
	spec *proto.ItemSpec
	item core.Item
}

type bulkSimRequiredSetBonusComboMatcher struct {
	baseCounts     []int
	requiredPieces []int
	dimensions     []bulkSimRequiredSetBonusDimension
}

type bulkSimRequiredSetBonusDimension struct {
	optionDeltas [][]int
}

type bulkSimCandidateGenerator struct {
	request              *proto.BulkSimRequest
	settings             *proto.BulkSettings
	player               *proto.Player
	baseEquipment        core.Equipment
	playerClass          proto.Class
	playerSpec           proto.Spec
	playerCanDualWield   bool
	playerIsFuryWarrior  bool
	challengeModeEnabled bool
	selectedByBulkSlot   map[bulkSimItemSlot][]bulkSimCandidateOption
	selectedOrder        []bulkSimItemSlot
	inheritUpgrades      bool
	frozenItems          map[bulkSimItemSlot]*core.Item
	frozenWeaponSlot     proto.ItemSlot
	weaponTypeFilters    map[proto.ItemSlot][]proto.WeaponType
}

var bulkSimItemSlotToSingleItemSlot = map[bulkSimItemSlot]proto.ItemSlot{
	bulkSimItemSlotHead:     proto.ItemSlot_ItemSlotHead,
	bulkSimItemSlotNeck:     proto.ItemSlot_ItemSlotNeck,
	bulkSimItemSlotShoulder: proto.ItemSlot_ItemSlotShoulder,
	bulkSimItemSlotBack:     proto.ItemSlot_ItemSlotBack,
	bulkSimItemSlotChest:    proto.ItemSlot_ItemSlotChest,
	bulkSimItemSlotWrist:    proto.ItemSlot_ItemSlotWrist,
	bulkSimItemSlotHands:    proto.ItemSlot_ItemSlotHands,
	bulkSimItemSlotWaist:    proto.ItemSlot_ItemSlotWaist,
	bulkSimItemSlotLegs:     proto.ItemSlot_ItemSlotLegs,
	bulkSimItemSlotFeet:     proto.ItemSlot_ItemSlotFeet,
	bulkSimItemSlotMainHand: proto.ItemSlot_ItemSlotMainHand,
	bulkSimItemSlotOffHand:  proto.ItemSlot_ItemSlotOffHand,
}

var bulkSimItemSlotToItemSlotPairs = map[bulkSimItemSlot][2]proto.ItemSlot{
	bulkSimItemSlotFinger:     {proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotFinger2},
	bulkSimItemSlotTrinket:    {proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2},
	bulkSimItemSlotHandWeapon: {proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand},
}

var bulkSimItemTypeToSlots = map[proto.ItemType][]proto.ItemSlot{
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

var bulkSimClassMaxArmorType = map[proto.Class]proto.ArmorType{
	proto.Class_ClassWarrior:     proto.ArmorType_ArmorTypePlate,
	proto.Class_ClassPaladin:     proto.ArmorType_ArmorTypePlate,
	proto.Class_ClassDeathKnight: proto.ArmorType_ArmorTypePlate,
	proto.Class_ClassShaman:      proto.ArmorType_ArmorTypeMail,
	proto.Class_ClassHunter:      proto.ArmorType_ArmorTypeMail,
	proto.Class_ClassRogue:       proto.ArmorType_ArmorTypeLeather,
	proto.Class_ClassMonk:        proto.ArmorType_ArmorTypeLeather,
	proto.Class_ClassDruid:       proto.ArmorType_ArmorTypeLeather,
	proto.Class_ClassMage:        proto.ArmorType_ArmorTypeCloth,
	proto.Class_ClassPriest:      proto.ArmorType_ArmorTypeCloth,
	proto.Class_ClassWarlock:     proto.ArmorType_ArmorTypeCloth,
}

var bulkSimClassWeaponTypes = map[proto.Class]map[proto.WeaponType]bulkSimEligibleWeaponType{
	proto.Class_ClassWarrior: {
		proto.WeaponType_WeaponTypeAxe:     {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeFist:    {},
		proto.WeaponType_WeaponTypeMace:    {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypePolearm: {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeShield:  {},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeSword:   {canUseTwoHand: true},
	},
	proto.Class_ClassPaladin: {
		proto.WeaponType_WeaponTypeAxe:     {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeMace:    {canUseTwoHand: true},
		proto.WeaponType_WeaponTypePolearm: {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeShield:  {},
		proto.WeaponType_WeaponTypeSword:   {canUseTwoHand: true},
	},
	proto.Class_ClassDeathKnight: {
		proto.WeaponType_WeaponTypeAxe:     {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeMace:    {canUseTwoHand: true},
		proto.WeaponType_WeaponTypePolearm: {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeSword:   {canUseTwoHand: true},
	},
	proto.Class_ClassRogue: {
		proto.WeaponType_WeaponTypeAxe:     {},
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeFist:    {},
		proto.WeaponType_WeaponTypeMace:    {},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypeSword:   {},
	},
	proto.Class_ClassMonk: {
		proto.WeaponType_WeaponTypeAxe:     {},
		proto.WeaponType_WeaponTypeFist:    {},
		proto.WeaponType_WeaponTypeMace:    {},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypePolearm: {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeSword:   {},
	},
	proto.Class_ClassDruid: {
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeFist:    {},
		proto.WeaponType_WeaponTypeMace:    {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypePolearm: {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
	},
	proto.Class_ClassShaman: {
		proto.WeaponType_WeaponTypeAxe:     {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeFist:    {},
		proto.WeaponType_WeaponTypeMace:    {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypeShield:  {},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
	},
	proto.Class_ClassMage: {
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeSword:   {},
	},
	proto.Class_ClassPriest: {
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeMace:    {},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
	},
	proto.Class_ClassWarlock: {
		proto.WeaponType_WeaponTypeDagger:  {},
		proto.WeaponType_WeaponTypeOffHand: {},
		proto.WeaponType_WeaponTypeStaff:   {canUseTwoHand: true},
		proto.WeaponType_WeaponTypeSword:   {},
	},
	proto.Class_ClassHunter: {},
}

var bulkSimClassRangedWeaponTypes = map[proto.Class][]proto.RangedWeaponType{
	proto.Class_ClassWarrior: {proto.RangedWeaponType_RangedWeaponTypeBow, proto.RangedWeaponType_RangedWeaponTypeCrossbow, proto.RangedWeaponType_RangedWeaponTypeGun, proto.RangedWeaponType_RangedWeaponTypeThrown},
	proto.Class_ClassHunter:  {proto.RangedWeaponType_RangedWeaponTypeBow, proto.RangedWeaponType_RangedWeaponTypeCrossbow, proto.RangedWeaponType_RangedWeaponTypeGun},
	proto.Class_ClassMage:    {proto.RangedWeaponType_RangedWeaponTypeWand},
	proto.Class_ClassPriest:  {proto.RangedWeaponType_RangedWeaponTypeWand},
	proto.Class_ClassWarlock: {proto.RangedWeaponType_RangedWeaponTypeWand},
}

var bulkSimSpecCanDualWield = map[proto.Spec]bool{
	proto.Spec_SpecBloodDeathKnight:   true,
	proto.Spec_SpecFrostDeathKnight:   true,
	proto.Spec_SpecUnholyDeathKnight:  true,
	proto.Spec_SpecBeastMasteryHunter: true,
	proto.Spec_SpecMarksmanshipHunter: true,
	proto.Spec_SpecSurvivalHunter:     true,
	proto.Spec_SpecBrewmasterMonk:     true,
	proto.Spec_SpecWindwalkerMonk:     true,
	proto.Spec_SpecAssassinationRogue: true,
	proto.Spec_SpecCombatRogue:        true,
	proto.Spec_SpecSubtletyRogue:      true,
	proto.Spec_SpecEnhancementShaman:  true,
	proto.Spec_SpecArmsWarrior:        true,
	proto.Spec_SpecFuryWarrior:        true,
	proto.Spec_SpecProtectionWarrior:  true,
}

func ensureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	if request == nil || request.GetBulkSettings() == nil || len(request.GetCandidates()) > 0 {
		return nil
	}
	if request.GetBaseRequest() == nil || request.GetBaseRequest().GetRaid() == nil {
		return fmt.Errorf("bulk sim request is missing base raid")
	}
	player, playerErr := bulkSimRequestPlayer(request)
	if playerErr != nil {
		return playerErr
	}
	if player.GetEquipment() == nil {
		return fmt.Errorf("bulk sim request is missing player equipment")
	}
	if player.GetDatabase() != nil {
		core.AddToDatabase(player.GetDatabase())
	}
	generator, buildErr := newBulkSimCandidateGenerator(request, player)
	if buildErr != nil {
		return buildErr
	}
	candidates, buildErr := generator.buildCandidates()
	if buildErr != nil {
		return buildErr
	}
	request.Candidates = candidates
	return nil
}

func newBulkSimCandidateGenerator(request *proto.BulkSimRequest, player *proto.Player) (*bulkSimCandidateGenerator, error) {
	playerSpec, err := bulkSimPlayerSpec(player)
	if err != nil {
		return nil, err
	}
	playerCanDualWield := bulkSimSpecCanDualWield[playerSpec] && player.GetClass() != proto.Class_ClassHunter
	generator := &bulkSimCandidateGenerator{
		request:              request,
		settings:             request.GetBulkSettings(),
		player:               player,
		baseEquipment:        core.ProtoToEquipment(player.GetEquipment()),
		playerClass:          player.GetClass(),
		playerSpec:           playerSpec,
		playerCanDualWield:   playerCanDualWield,
		playerIsFuryWarrior:  playerSpec == proto.Spec_SpecFuryWarrior,
		challengeModeEnabled: player.GetChallengeMode(),
		selectedByBulkSlot:   make(map[bulkSimItemSlot][]bulkSimCandidateOption),
		selectedOrder: []bulkSimItemSlot{
			bulkSimItemSlotHead,
			bulkSimItemSlotNeck,
			bulkSimItemSlotShoulder,
			bulkSimItemSlotBack,
			bulkSimItemSlotChest,
			bulkSimItemSlotWrist,
			bulkSimItemSlotHands,
			bulkSimItemSlotWaist,
			bulkSimItemSlotLegs,
			bulkSimItemSlotFeet,
			bulkSimItemSlotFinger,
			bulkSimItemSlotTrinket,
			bulkSimItemSlotMainHand,
			bulkSimItemSlotOffHand,
			bulkSimItemSlotHandWeapon,
		},
		inheritUpgrades: request.GetBulkSettings().GetInheritUpgrades(),
		frozenItems:     make(map[bulkSimItemSlot]*core.Item),
		weaponTypeFilters: map[proto.ItemSlot][]proto.WeaponType{
			proto.ItemSlot_ItemSlotMainHand: request.GetBulkSettings().GetFreezeMainhandWeaponSlots(),
			proto.ItemSlot_ItemSlotOffHand:  request.GetBulkSettings().GetFreezeOffhandWeaponSlots(),
		},
	}
	generator.initFrozenSettings()
	if err := generator.initSelectedItems(); err != nil {
		return nil, err
	}
	return generator, nil
}

func (generator *bulkSimCandidateGenerator) buildCandidates() ([]*proto.BulkGearCandidate, error) {
	rawCombinations := generator.rawCombinationsCount()
	matcher := generator.buildRequiredSetBonusMatcher(generator.settings.GetRequiredSetBonuses())
	candidates := make([]*proto.BulkGearCandidate, 0, rawCombinations)
	for comboIdx := 0; comboIdx < rawCombinations; comboIdx++ {
		if !generator.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher) {
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
			generator.frozenItems[bulkSimItemSlotFinger] = &itemCopy
		}
	}
	if slot := generator.settings.GetFreezeTrinketSlot(); slot == int32(proto.ItemSlot_ItemSlotTrinket1) || slot == int32(proto.ItemSlot_ItemSlotTrinket2) {
		item := generator.baseEquipment.GetItemBySlot(proto.ItemSlot(slot))
		if item != nil && item.ID != 0 {
			itemCopy := *item
			generator.frozenItems[bulkSimItemSlotTrinket] = &itemCopy
		}
	}
	if slot := generator.settings.GetFreezeWeaponSlot(); slot == int32(proto.ItemSlot_ItemSlotMainHand) || slot == int32(proto.ItemSlot_ItemSlotOffHand) {
		generator.frozenWeaponSlot = proto.ItemSlot(slot)
	}
}

func (generator *bulkSimCandidateGenerator) initSelectedItems() error {
	equippedItemsBySlot := make(map[proto.ItemSlot]*core.Item)
	equippedIDs := make(map[int32]bool)
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		equippedItem := generator.baseEquipment.GetItemBySlot(slot)
		if equippedItem == nil || equippedItem.ID == 0 {
			continue
		}
		itemCopy := *equippedItem
		equippedItemsBySlot[slot] = &itemCopy
		equippedIDs[equippedItem.ID] = true
	}

	for _, selectedItem := range generator.settings.GetItems() {
		if selectedItem == nil || selectedItem.GetId() == 0 {
			continue
		}
		if equippedIDs[selectedItem.GetId()] {
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
		for _, slot := range bulkSimEligibleItemSlots(option.item, generator.playerIsFuryWarrior) {
			if bulkSimIsSecondaryItemSlot(slot, generator.playerCanDualWield) {
				continue
			}
			if !bulkSimCanEquipItem(option.item, generator.playerClass, generator.playerSpec, slot) {
				continue
			}
			bulkSlot := bulkSimGetItemSlotFromSlot(slot, generator.playerCanDualWield)
			generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], option)
		}
	}
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		equippedItem := equippedItemsBySlot[slot]
		if equippedItem == nil {
			continue
		}
		bulkSlot := bulkSimGetItemSlotFromSlot(slot, generator.playerCanDualWield)
		generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], bulkSimCandidateOption{
			spec: equippedItem.ToItemSpecProto(),
			item: *equippedItem,
		})
	}
	return nil
}

func (generator *bulkSimCandidateGenerator) rawCombinationsCount() int {
	rawCombinations := len(generator.getAllWeaponCombos())
	if rawCombinations == 0 {
		rawCombinations = 1
	}
	for _, bulkSlot := range generator.selectedOrder {
		if bulkSlot == bulkSimItemSlotMainHand || bulkSlot == bulkSimItemSlotOffHand || bulkSlot == bulkSimItemSlotHandWeapon {
			continue
		}
		numOptions := len(generator.selectedByBulkSlot[bulkSlot])
		if numOptions > 1 && (bulkSlot == bulkSimItemSlotFinger || bulkSlot == bulkSimItemSlotTrinket) {
			if generator.frozenItems[bulkSlot] != nil {
				rawCombinations *= numOptions - 1
			} else {
				rawCombinations *= bulkSimBinomialCoefficient(numOptions, 2)
			}
		} else if numOptions > 0 {
			rawCombinations *= numOptions
		}
	}
	return rawCombinations
}

func (generator *bulkSimCandidateGenerator) buildGearForCombo(comboIdx int) (*proto.EquipmentSpec, error) {
	gear := generator.baseEquipment
	itemsForCombo, err := generator.getItemsForCombo(comboIdx)
	if err != nil {
		return nil, err
	}
	for slot, option := range itemsForCombo {
		existingItem := gear.GetItemBySlot(slot)
		if existingItem != nil && existingItem.ID != 0 {
			gear[slot] = bulkSimReplaceItem(*existingItem, option, generator.challengeModeEnabled, generator.inheritUpgrades)
		} else {
			gear[slot] = bulkSimCreateSelectedItem(option, generator.challengeModeEnabled)
		}
	}
	return gear.ToEquipmentSpecProto(), nil
}

func (generator *bulkSimCandidateGenerator) getItemsForCombo(comboIdx int) (map[proto.ItemSlot]bulkSimCandidateOption, error) {
	itemsForCombo := make(map[proto.ItemSlot]bulkSimCandidateOption)
	allWeaponPairs := generator.getAllWeaponCombos()
	if len(allWeaponPairs) > 0 {
		weaponPairIdx := comboIdx % len(allWeaponPairs)
		comboIdx = comboIdx / len(allWeaponPairs)
		weaponPair := allWeaponPairs[weaponPairIdx]
		if weaponPair[0] != nil {
			itemsForCombo[proto.ItemSlot_ItemSlotMainHand] = *weaponPair[0]
		}
		if weaponPair[1] != nil {
			itemsForCombo[proto.ItemSlot_ItemSlotOffHand] = *weaponPair[1]
		}
	}
	for _, bulkSlot := range generator.selectedOrder {
		if bulkSlot == bulkSimItemSlotMainHand || bulkSlot == bulkSimItemSlotOffHand || bulkSlot == bulkSimItemSlotHandWeapon {
			continue
		}
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) == 0 {
			continue
		}
		if bulkSlot == bulkSimItemSlotFinger || bulkSlot == bulkSimItemSlotTrinket {
			if len(options) < 2 {
				return nil, fmt.Errorf("at least 2 items must be selected for grouped bulk slot %d", bulkSlot)
			}
			pairs := bulkSimAllPairs(options)
			if frozenItem := generator.frozenItems[bulkSlot]; frozenItem != nil {
				pairs = make([][2]bulkSimCandidateOption, 0, len(options))
				for _, option := range options {
					if bulkSimCandidateOptionEqualsItem(option, *frozenItem, generator.inheritUpgrades) {
						continue
					}
					pairs = append(pairs, [2]bulkSimCandidateOption{{spec: frozenItem.ToItemSpecProto()}, option})
				}
				for idx := range pairs {
					pairs[idx][0].item = *frozenItem
				}
			}
			pairIdx := comboIdx % len(pairs)
			comboIdx = comboIdx / len(pairs)
			slots := bulkSimItemSlotToItemSlotPairs[bulkSlot]
			itemsForCombo[slots[0]] = pairs[pairIdx][0]
			itemsForCombo[slots[1]] = pairs[pairIdx][1]
			continue
		}
		optionIdx := comboIdx % len(options)
		comboIdx = comboIdx / len(options)
		itemsForCombo[bulkSimItemSlotToSingleItemSlot[bulkSlot]] = options[optionIdx]
	}
	return itemsForCombo, nil
}

func (generator *bulkSimCandidateGenerator) getAllWeaponCombos() [][2]*bulkSimCandidateOption {
	allWeaponCombos := make([][2]*bulkSimCandidateOption, 0)
	all2HWeapons := make([]bulkSimCandidateOption, 0)
	for _, bulkSlot := range []bulkSimItemSlot{bulkSimItemSlotMainHand, bulkSimItemSlotHandWeapon} {
		options := generator.selectedByBulkSlot[bulkSlot]
		for _, option := range options {
			if (option.item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeUnknown && option.item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeWand) || option.item.HandType == proto.HandType_HandTypeTwoHand {
				all2HWeapons = append(all2HWeapons, option)
			}
		}
	}
	if generator.playerIsFuryWarrior {
		for i := range all2HWeapons {
			if bulkSimOptionsContainEquivalent(all2HWeapons[:i], all2HWeapons[i], generator.inheritUpgrades) {
				continue
			}
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], nil})
			for j := i + 1; j < len(all2HWeapons); j++ {
				if bulkSimOptionsContainEquivalent(all2HWeapons[i+1:j], all2HWeapons[j], generator.inheritUpgrades) {
					continue
				}
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], &all2HWeapons[j]})
				if !bulkSimCandidateOptionsEqual(all2HWeapons[i], all2HWeapons[j], generator.inheritUpgrades) {
					allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[j], &all2HWeapons[i]})
				}
			}
		}
	} else {
		for i := range all2HWeapons {
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], nil})
		}
	}
	mhOptions := generator.selectedByBulkSlot[bulkSimItemSlotMainHand]
	ohOptions := generator.selectedByBulkSlot[bulkSimItemSlotOffHand]
	if len(mhOptions) > 0 {
		for i := range mhOptions {
			if bulkSimOptionsContainEquivalent(all2HWeapons, mhOptions[i], generator.inheritUpgrades) {
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
	oneHandOptions := generator.selectedByBulkSlot[bulkSimItemSlotHandWeapon]
	if len(oneHandOptions) > 0 {
		filtered := make([]bulkSimCandidateOption, 0, len(oneHandOptions))
		for _, option := range oneHandOptions {
			if bulkSimOptionsContainEquivalent(all2HWeapons, option, generator.inheritUpgrades) {
				continue
			}
			filtered = append(filtered, option)
		}
		for i := range filtered {
			if bulkSimOptionsContainEquivalent(filtered[:i], filtered[i], generator.inheritUpgrades) {
				continue
			}
			hasDuplicate := bulkSimOptionsContainEquivalent(filtered[i+1:], filtered[i], generator.inheritUpgrades)
			if filtered[i].item.WeaponType != proto.WeaponType_WeaponTypeUnknown && !hasDuplicate {
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&filtered[i], &filtered[i]})
			}
			for j := i + 1; j < len(filtered); j++ {
				if bulkSimOptionsContainEquivalent(filtered[i+1:j], filtered[j], generator.inheritUpgrades) {
					continue
				}
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&filtered[i], &filtered[j]})
				if !bulkSimCandidateOptionsEqual(filtered[i], filtered[j], generator.inheritUpgrades) {
					allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&filtered[j], &filtered[i]})
				}
			}
		}
	}
	filteredCombos := make([][2]*bulkSimCandidateOption, 0, len(allWeaponCombos))
	for _, combo := range allWeaponCombos {
		if generator.weaponComboMatchesSettings(combo[0], combo[1]) {
			filteredCombos = append(filteredCombos, combo)
		}
	}
	return filteredCombos
}

func (generator *bulkSimCandidateGenerator) weaponComboMatchesSettings(mhItem *bulkSimCandidateOption, ohItem *bulkSimCandidateOption) bool {
	frozenWeaponItem := generator.getFrozenWeaponItem()
	if generator.frozenWeaponSlot == proto.ItemSlot_ItemSlotMainHand && frozenWeaponItem != nil && !bulkSimCandidateOptionEqualsItemPtr(mhItem, frozenWeaponItem, generator.inheritUpgrades) {
		return false
	}
	if generator.frozenWeaponSlot == proto.ItemSlot_ItemSlotOffHand && frozenWeaponItem != nil && !bulkSimCandidateOptionEqualsItemPtr(ohItem, frozenWeaponItem, generator.inheritUpgrades) {
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

func (generator *bulkSimCandidateGenerator) buildRequiredSetBonusMatcher(requiredSetBonuses []*proto.BulkRequiredSetBonus) *bulkSimRequiredSetBonusComboMatcher {
	if len(requiredSetBonuses) == 0 {
		return nil
	}
	requiredIndexes := make(map[int32]int, len(requiredSetBonuses))
	for idx, required := range requiredSetBonuses {
		requiredIndexes[required.GetSetId()] = idx
	}
	baseCounts := make([]int, len(requiredSetBonuses))
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		generator.addItemToRequiredSetBonusCounts(baseCounts, requiredIndexes, generator.baseEquipment.GetItemBySlot(slot), 1)
	}
	dimensions := make([]bulkSimRequiredSetBonusDimension, 0)
	weaponPairs := generator.getAllWeaponCombos()
	if len(weaponPairs) > 0 {
		optionDeltas := make([][]int, 0, len(weaponPairs))
		for _, pair := range weaponPairs {
			optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(requiredIndexes, [][2]any{{proto.ItemSlot_ItemSlotMainHand, pair[0]}, {proto.ItemSlot_ItemSlotOffHand, pair[1]}}))
		}
		dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
	}
	for _, bulkSlot := range generator.selectedOrder {
		if bulkSlot == bulkSimItemSlotMainHand || bulkSlot == bulkSimItemSlotOffHand || bulkSlot == bulkSimItemSlotHandWeapon {
			continue
		}
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) == 0 {
			continue
		}
		if bulkSlot == bulkSimItemSlotFinger || bulkSlot == bulkSimItemSlotTrinket {
			pairs := bulkSimAllPairs(options)
			if frozenItem := generator.frozenItems[bulkSlot]; frozenItem != nil {
				pairs = make([][2]bulkSimCandidateOption, 0, len(options))
				for _, option := range options {
					if bulkSimCandidateOptionEqualsItem(option, *frozenItem, generator.inheritUpgrades) {
						continue
					}
					pairs = append(pairs, [2]bulkSimCandidateOption{{spec: frozenItem.ToItemSpecProto(), item: *frozenItem}, option})
				}
			}
			slots := bulkSimItemSlotToItemSlotPairs[bulkSlot]
			optionDeltas := make([][]int, 0, len(pairs))
			for _, pair := range pairs {
				optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(requiredIndexes, [][2]any{{slots[0], &pair[0]}, {slots[1], &pair[1]}}))
			}
			dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
		} else {
			slot := bulkSimItemSlotToSingleItemSlot[bulkSlot]
			optionDeltas := make([][]int, 0, len(options))
			for idx := range options {
				optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(requiredIndexes, [][2]any{{slot, &options[idx]}}))
			}
			dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
		}
	}
	requiredPieces := make([]int, len(requiredSetBonuses))
	for idx, required := range requiredSetBonuses {
		requiredPieces[idx] = int(required.GetPieces())
	}
	return &bulkSimRequiredSetBonusComboMatcher{baseCounts: baseCounts, requiredPieces: requiredPieces, dimensions: dimensions}
}

func (generator *bulkSimCandidateGenerator) addItemToRequiredSetBonusCounts(counts []int, requiredIndexes map[int32]int, item *core.Item, delta int) {
	if item == nil || item.SetID == 0 {
		return
	}
	idx, ok := requiredIndexes[item.SetID]
	if !ok {
		return
	}
	counts[idx] += delta
}

func (generator *bulkSimCandidateGenerator) getRequiredSetBonusOptionDeltas(requiredIndexes map[int32]int, slotItems [][2]any) []int {
	deltas := make([]int, len(requiredIndexes))
	for _, slotItem := range slotItems {
		slot := slotItem[0].(proto.ItemSlot)
		generator.addItemToRequiredSetBonusCounts(deltas, requiredIndexes, generator.baseEquipment.GetItemBySlot(slot), -1)
		switch option := slotItem[1].(type) {
		case *bulkSimCandidateOption:
			if option != nil {
				generator.addItemToRequiredSetBonusCounts(deltas, requiredIndexes, &option.item, 1)
			}
		}
	}
	return deltas
}

func (generator *bulkSimCandidateGenerator) comboMatchesRequiredSetBonusMatcher(comboIdx int, matcher *bulkSimRequiredSetBonusComboMatcher) bool {
	if matcher == nil {
		return true
	}
	counts := slices.Clone(matcher.baseCounts)
	for _, dimension := range matcher.dimensions {
		if len(dimension.optionDeltas) == 0 {
			return false
		}
		optionIdx := comboIdx % len(dimension.optionDeltas)
		comboIdx = comboIdx / len(dimension.optionDeltas)
		deltas := dimension.optionDeltas[optionIdx]
		for idx, delta := range deltas {
			counts[idx] += delta
		}
	}
	for idx, count := range counts {
		if count < matcher.requiredPieces[idx] {
			return false
		}
	}
	return true
}

func bulkSimReplaceItem(existing core.Item, option bulkSimCandidateOption, challengeModeEnabled bool, inheritUpgrades bool) core.Item {
	itemSpec := existing.ToItemSpecProto()
	itemSpec.Id = option.spec.GetId()
	itemSpec.Reforging = 0
	itemSpec.RandomSuffix = 0
	itemSpec.ChallengeMode = existing.ChallengeMode
	if !bulkSimEnchantAppliesToItem(itemSpec.GetEnchant(), option.item) {
		itemSpec.Enchant = 0
	}
	if !bulkSimEnchantAppliesToItem(itemSpec.GetTinker(), option.item) {
		itemSpec.Tinker = 0
	}
	itemSpec.Gems = bulkSimReorganizeGems(existing, option.item)
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

func bulkSimCreateSelectedItem(option bulkSimCandidateOption, challengeModeEnabled bool) core.Item {
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

func bulkSimReorganizeGems(existing core.Item, newItem core.Item) []int32 {
	newGems := make([]int32, len(newItem.GemSockets))
	for _, gem := range existing.Gems {
		if gem.ID == 0 {
			continue
		}
		firstMatching := -1
		firstEligible := -1
		for socketIdx, socketColor := range newItem.GemSockets {
			if newGems[socketIdx] != 0 {
				continue
			}
			if firstMatching == -1 && bulkSimGemMatchesSocket(gem.Color, socketColor) {
				firstMatching = socketIdx
			}
			if firstEligible == -1 && bulkSimGemEligibleForSocket(gem.Color, socketColor) {
				firstEligible = socketIdx
			}
		}
		if firstMatching != -1 {
			newGems[firstMatching] = gem.ID
		} else if firstEligible != -1 {
			newGems[firstEligible] = gem.ID
		}
	}
	if bulkSimCouldHaveExtraSocket(existing.Type) && len(existing.Gems) > len(existing.GemSockets) {
		newGems = append(newGems, existing.Gems[len(existing.Gems)-1].ID)
	}
	return newGems
}

func bulkSimEnchantAppliesToItem(effectID int32, item core.Item) bool {
	if effectID == 0 {
		return false
	}
	enchant := core.GetEnchantByEffectID(effectID)
	if enchant == nil {
		return false
	}
	sharedSlots := bulkSimSharedSlots(bulkSimEligibleEnchantSlots(*enchant), bulkSimEligibleItemSlots(item, false))
	if len(sharedSlots) == 0 {
		return false
	}
	if enchant.Type == proto.ItemType_ItemTypeRanged {
		return item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeBow || item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeCrossbow || item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeGun
	}
	if item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeUnknown && item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeWand && enchant.Type != proto.ItemType_ItemTypeRanged {
		return false
	}
	if enchant.Type == proto.ItemType_ItemTypeWeapon {
		if enchant.Name == "Enchant 2H Weapon - Mighty Spellpower" || enchant.Name == "Enchant 2H Weapon - Jade Spirit" || enchant.Name == "Enchant 2H Weapon - Windsong" || enchant.Name == "Enchant 2H Weapon - Colossus" || enchant.Name == "Enchant 2H Weapon - Dancing Steel" {
			return item.HandType == proto.HandType_HandTypeTwoHand
		}
		if item.WeaponType == proto.WeaponType_WeaponTypeStaff {
			return true
		}
	}
	return true
}

func bulkSimEligibleEnchantSlots(enchant core.Enchant) []proto.ItemSlot {
	if slots, ok := bulkSimItemTypeToSlots[enchant.Type]; ok {
		return slots
	}
	if enchant.Type == proto.ItemType_ItemTypeWeapon {
		return []proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand}
	}
	return nil
}

func bulkSimSharedSlots(left []proto.ItemSlot, right []proto.ItemSlot) []proto.ItemSlot {
	shared := make([]proto.ItemSlot, 0, min(len(left), len(right)))
	for _, slot := range left {
		if slices.Contains(right, slot) {
			shared = append(shared, slot)
		}
	}
	return shared
}

func bulkSimCouldHaveExtraSocket(itemType proto.ItemType) bool {
	return itemType == proto.ItemType_ItemTypeWrist || itemType == proto.ItemType_ItemTypeHands
}

func bulkSimGemMatchesSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
	if gemColor == socketColor {
		return true
	}
	switch socketColor {
	case proto.GemColor_GemColorMeta:
		return gemColor == proto.GemColor_GemColorMeta
	case proto.GemColor_GemColorBlue:
		return gemColor == proto.GemColor_GemColorBlue || gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorRed:
		return gemColor == proto.GemColor_GemColorRed || gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorYellow:
		return gemColor == proto.GemColor_GemColorYellow || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorPrismatic:
		return gemColor != proto.GemColor_GemColorMeta && gemColor != proto.GemColor_GemColorCogwheel && gemColor != proto.GemColor_GemColorShaTouched
	case proto.GemColor_GemColorCogwheel:
		return gemColor == proto.GemColor_GemColorCogwheel
	case proto.GemColor_GemColorShaTouched:
		return gemColor == proto.GemColor_GemColorShaTouched
	default:
		return false
	}
}

func bulkSimGemEligibleForSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
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

func bulkSimEligibleItemSlots(item core.Item, isFuryWarrior bool) []proto.ItemSlot {
	if slots, ok := bulkSimItemTypeToSlots[item.Type]; ok {
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

func bulkSimCanEquipItem(item core.Item, playerClass proto.Class, playerSpec proto.Spec, slot proto.ItemSlot) bool {
	if item.Type == proto.ItemType_ItemTypeFinger || item.Type == proto.ItemType_ItemTypeTrinket {
		return true
	}
	if item.Type == proto.ItemType_ItemTypeWeapon {
		eligibleWeaponTypes := bulkSimClassWeaponTypes[playerClass]
		eligibleWeaponType, ok := eligibleWeaponTypes[item.WeaponType]
		if !ok {
			return false
		}
		if (item.HandType == proto.HandType_HandTypeOffHand || (item.HandType == proto.HandType_HandTypeOneHand && slot == proto.ItemSlot_ItemSlotOffHand)) && item.WeaponType != proto.WeaponType_WeaponTypeShield && item.WeaponType != proto.WeaponType_WeaponTypeOffHand && !bulkSimSpecCanDualWield[playerSpec] {
			return false
		}
		if item.HandType == proto.HandType_HandTypeTwoHand && !eligibleWeaponType.canUseTwoHand {
			return false
		}
		if item.HandType == proto.HandType_HandTypeTwoHand && slot == proto.ItemSlot_ItemSlotOffHand && playerSpec != proto.Spec_SpecFuryWarrior {
			return false
		}
		return true
	}
	if item.Type == proto.ItemType_ItemTypeRanged {
		return slices.Contains(bulkSimClassRangedWeaponTypes[playerClass], item.RangedWeaponType)
	}
	maxArmorType, ok := bulkSimClassMaxArmorType[playerClass]
	if !ok {
		return false
	}
	return maxArmorType >= item.ArmorType
}

func bulkSimIsSecondaryItemSlot(slot proto.ItemSlot, playerCanDualWield bool) bool {
	return slot == proto.ItemSlot_ItemSlotFinger2 || slot == proto.ItemSlot_ItemSlotTrinket2 || (playerCanDualWield && slot == proto.ItemSlot_ItemSlotOffHand)
}

func bulkSimGetItemSlotFromSlot(slot proto.ItemSlot, playerCanDualWield bool) bulkSimItemSlot {
	if playerCanDualWield && (slot == proto.ItemSlot_ItemSlotMainHand || slot == proto.ItemSlot_ItemSlotOffHand) {
		return bulkSimItemSlotHandWeapon
	}
	switch slot {
	case proto.ItemSlot_ItemSlotHead:
		return bulkSimItemSlotHead
	case proto.ItemSlot_ItemSlotNeck:
		return bulkSimItemSlotNeck
	case proto.ItemSlot_ItemSlotShoulder:
		return bulkSimItemSlotShoulder
	case proto.ItemSlot_ItemSlotBack:
		return bulkSimItemSlotBack
	case proto.ItemSlot_ItemSlotChest:
		return bulkSimItemSlotChest
	case proto.ItemSlot_ItemSlotWrist:
		return bulkSimItemSlotWrist
	case proto.ItemSlot_ItemSlotHands:
		return bulkSimItemSlotHands
	case proto.ItemSlot_ItemSlotWaist:
		return bulkSimItemSlotWaist
	case proto.ItemSlot_ItemSlotLegs:
		return bulkSimItemSlotLegs
	case proto.ItemSlot_ItemSlotFeet:
		return bulkSimItemSlotFeet
	case proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotFinger2:
		return bulkSimItemSlotFinger
	case proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2:
		return bulkSimItemSlotTrinket
	case proto.ItemSlot_ItemSlotMainHand:
		return bulkSimItemSlotMainHand
	case proto.ItemSlot_ItemSlotOffHand:
		return bulkSimItemSlotOffHand
	default:
		return bulkSimItemSlotHead
	}
}

func bulkSimBinomialCoefficient(n int, k int) int {
	if k < 0 || k > n {
		return 0
	}
	if k == 0 || k == n {
		return 1
	}
	if k == 1 || k == n-1 {
		return n
	}
	if n-k < k {
		k = n - k
	}
	result := n
	for j := 2; j <= k; j++ {
		result = result * (n - j + 1) / j
	}
	return result
}

func bulkSimAllPairs(options []bulkSimCandidateOption) [][2]bulkSimCandidateOption {
	pairs := make([][2]bulkSimCandidateOption, 0, len(options)*(len(options)-1)/2)
	for i := 0; i < len(options); i++ {
		for j := i + 1; j < len(options); j++ {
			pairs = append(pairs, [2]bulkSimCandidateOption{options[i], options[j]})
		}
	}
	return pairs
}

func bulkSimOptionsContainEquivalent(options []bulkSimCandidateOption, target bulkSimCandidateOption, inheritUpgrades bool) bool {
	for _, option := range options {
		if bulkSimCandidateOptionsEqual(option, target, inheritUpgrades) {
			return true
		}
	}
	return false
}

func bulkSimCandidateOptionsEqual(left bulkSimCandidateOption, right bulkSimCandidateOption, inheritUpgrades bool) bool {
	return bulkSimItemSpecKey(left.spec, inheritUpgrades) == bulkSimItemSpecKey(right.spec, inheritUpgrades)
}

func bulkSimCandidateOptionEqualsItem(option bulkSimCandidateOption, item core.Item, inheritUpgrades bool) bool {
	return bulkSimItemSpecKey(option.spec, inheritUpgrades) == bulkSimItemSpecKey(item.ToItemSpecProto(), inheritUpgrades)
}

func bulkSimCandidateOptionEqualsItemPtr(option *bulkSimCandidateOption, item *core.Item, inheritUpgrades bool) bool {
	if option == nil || item == nil {
		return option == nil && item == nil
	}
	return bulkSimCandidateOptionEqualsItem(*option, *item, inheritUpgrades)
}

func bulkSimItemSpecKey(itemSpec *proto.ItemSpec, inheritUpgrades bool) string {
	if itemSpec == nil {
		return ""
	}
	if inheritUpgrades {
		return fmt.Sprintf("%d:%d:%t", itemSpec.GetId(), itemSpec.GetRandomSuffix(), itemSpec.GetChallengeMode())
	}
	return fmt.Sprintf("%d:%d:%d:%t", itemSpec.GetId(), itemSpec.GetRandomSuffix(), itemSpec.GetUpgradeStep(), itemSpec.GetChallengeMode())
}

func bulkSimPlayerSpec(player *proto.Player) (proto.Spec, error) {
	switch {
	case player.GetBloodDeathKnight() != nil:
		return proto.Spec_SpecBloodDeathKnight, nil
	case player.GetFrostDeathKnight() != nil:
		return proto.Spec_SpecFrostDeathKnight, nil
	case player.GetUnholyDeathKnight() != nil:
		return proto.Spec_SpecUnholyDeathKnight, nil
	case player.GetBalanceDruid() != nil:
		return proto.Spec_SpecBalanceDruid, nil
	case player.GetFeralDruid() != nil:
		return proto.Spec_SpecFeralDruid, nil
	case player.GetGuardianDruid() != nil:
		return proto.Spec_SpecGuardianDruid, nil
	case player.GetRestorationDruid() != nil:
		return proto.Spec_SpecRestorationDruid, nil
	case player.GetBeastMasteryHunter() != nil:
		return proto.Spec_SpecBeastMasteryHunter, nil
	case player.GetMarksmanshipHunter() != nil:
		return proto.Spec_SpecMarksmanshipHunter, nil
	case player.GetSurvivalHunter() != nil:
		return proto.Spec_SpecSurvivalHunter, nil
	case player.GetArcaneMage() != nil:
		return proto.Spec_SpecArcaneMage, nil
	case player.GetFireMage() != nil:
		return proto.Spec_SpecFireMage, nil
	case player.GetFrostMage() != nil:
		return proto.Spec_SpecFrostMage, nil
	case player.GetBrewmasterMonk() != nil:
		return proto.Spec_SpecBrewmasterMonk, nil
	case player.GetMistweaverMonk() != nil:
		return proto.Spec_SpecMistweaverMonk, nil
	case player.GetWindwalkerMonk() != nil:
		return proto.Spec_SpecWindwalkerMonk, nil
	case player.GetHolyPaladin() != nil:
		return proto.Spec_SpecHolyPaladin, nil
	case player.GetProtectionPaladin() != nil:
		return proto.Spec_SpecProtectionPaladin, nil
	case player.GetRetributionPaladin() != nil:
		return proto.Spec_SpecRetributionPaladin, nil
	case player.GetDisciplinePriest() != nil:
		return proto.Spec_SpecDisciplinePriest, nil
	case player.GetHolyPriest() != nil:
		return proto.Spec_SpecHolyPriest, nil
	case player.GetShadowPriest() != nil:
		return proto.Spec_SpecShadowPriest, nil
	case player.GetAssassinationRogue() != nil:
		return proto.Spec_SpecAssassinationRogue, nil
	case player.GetCombatRogue() != nil:
		return proto.Spec_SpecCombatRogue, nil
	case player.GetSubtletyRogue() != nil:
		return proto.Spec_SpecSubtletyRogue, nil
	case player.GetElementalShaman() != nil:
		return proto.Spec_SpecElementalShaman, nil
	case player.GetEnhancementShaman() != nil:
		return proto.Spec_SpecEnhancementShaman, nil
	case player.GetRestorationShaman() != nil:
		return proto.Spec_SpecRestorationShaman, nil
	case player.GetAfflictionWarlock() != nil:
		return proto.Spec_SpecAfflictionWarlock, nil
	case player.GetDemonologyWarlock() != nil:
		return proto.Spec_SpecDemonologyWarlock, nil
	case player.GetDestructionWarlock() != nil:
		return proto.Spec_SpecDestructionWarlock, nil
	case player.GetArmsWarrior() != nil:
		return proto.Spec_SpecArmsWarrior, nil
	case player.GetFuryWarrior() != nil:
		return proto.Spec_SpecFuryWarrior, nil
	case player.GetProtectionWarrior() != nil:
		return proto.Spec_SpecProtectionWarrior, nil
	default:
		return proto.Spec_SpecUnknown, fmt.Errorf("unsupported player spec for backend bulk candidate generation")
	}
}

func bulkSimRequestPlayer(request *proto.BulkSimRequest) (*proto.Player, error) {
	if request == nil || request.GetBaseRequest() == nil || request.GetBaseRequest().GetRaid() == nil {
		return nil, fmt.Errorf("bulk sim request is missing base raid")
	}
	parties := request.GetBaseRequest().GetRaid().GetParties()
	if len(parties) == 0 || parties[0] == nil {
		return nil, fmt.Errorf("bulk sim request raid is missing parties")
	}
	players := parties[0].GetPlayers()
	if len(players) == 0 || players[0] == nil {
		return nil, fmt.Errorf("bulk sim request raid is missing player")
	}
	return players[0], nil
}
