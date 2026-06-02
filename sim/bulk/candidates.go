package bulk

import (
	"fmt"
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	googleProto "google.golang.org/protobuf/proto"
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

type bulkSimItemSlot = BulkSimItemSlot

const (
	bulkSimItemSlotHead       = BulkSimItemSlotHead
	bulkSimItemSlotNeck       = BulkSimItemSlotNeck
	bulkSimItemSlotShoulder   = BulkSimItemSlotShoulder
	bulkSimItemSlotBack       = BulkSimItemSlotBack
	bulkSimItemSlotChest      = BulkSimItemSlotChest
	bulkSimItemSlotWrist      = BulkSimItemSlotWrist
	bulkSimItemSlotHands      = BulkSimItemSlotHands
	bulkSimItemSlotWaist      = BulkSimItemSlotWaist
	bulkSimItemSlotLegs       = BulkSimItemSlotLegs
	bulkSimItemSlotFeet       = BulkSimItemSlotFeet
	bulkSimItemSlotFinger     = BulkSimItemSlotFinger
	bulkSimItemSlotTrinket    = BulkSimItemSlotTrinket
	bulkSimItemSlotMainHand   = BulkSimItemSlotMainHand
	bulkSimItemSlotOffHand    = BulkSimItemSlotOffHand
	bulkSimItemSlotHandWeapon = BulkSimItemSlotHandWeapon
)

type bulkSimCandidateOption struct {
	spec *proto.ItemSpec
	item core.Item
}

type itemSpecCacheKey struct {
	id            int32
	randomSuffix  int32
	upgradeStep   proto.ItemLevelState
	challengeMode bool
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
	groupedPairsBySlot   map[bulkSimItemSlot][][2]bulkSimCandidateOption
	comboItemsBySlot     []bulkSimCandidateOption
	comboSlotUsed        []bool
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

var BulkSimItemSlotToSingleItemSlot = bulkSimItemSlotToSingleItemSlot

var bulkSimItemSlotToItemSlotPairs = map[bulkSimItemSlot][2]proto.ItemSlot{
	bulkSimItemSlotFinger:     {proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotFinger2},
	bulkSimItemSlotTrinket:    {proto.ItemSlot_ItemSlotTrinket1, proto.ItemSlot_ItemSlotTrinket2},
	bulkSimItemSlotHandWeapon: {proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand},
}

var BulkSimItemSlotToItemSlotPairs = bulkSimItemSlotToItemSlotPairs

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

func GetBulkSimItemSlotFromSlot(slot proto.ItemSlot, playerCanDualWield bool) BulkSimItemSlot {
	return getBulkItemSlotFromSlot(slot, playerCanDualWield)
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

func EnsureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	if request == nil || request.GetBulkSettings() == nil || len(request.GetCandidates()) > 0 {
		return nil
	}
	if request.GetBaseRequest() == nil || request.GetBaseRequest().GetRaid() == nil {
		return fmt.Errorf("bulk sim request is missing base raid")
	}
	player, playerErr := getPlayer(request)
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

func BulkCombinationCount(request *proto.BulkCombinationCountRequest) *proto.BulkCombinationCountResult {
	if request == nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: "bulk combination count request is missing"}}
	}
	if request.GetBaseRequest() == nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: "bulk combination count request is missing base request"}}
	}
	if request.GetBulkSettings() == nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: "bulk combination count request is missing bulk settings"}}
	}

	bulkRequest := &proto.BulkSimRequest{
		BaseRequest:  request.GetBaseRequest(),
		BulkSettings: request.GetBulkSettings(),
	}
	player, playerErr := getPlayer(bulkRequest)
	if playerErr != nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: playerErr.Error()}}
	}
	if player.GetEquipment() == nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: "bulk combination count request is missing player equipment"}}
	}
	if player.GetDatabase() != nil {
		core.AddToDatabase(player.GetDatabase())
	}

	generator, err := newBulkSimCandidateGenerator(bulkRequest, player)
	if err != nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: err.Error()}}
	}

	rawCombinations := generator.rawCombinationsCount()
	matchingCombinations := rawCombinations
	if matcher := generator.buildRequiredSetBonusMatcher(generator.settings.GetRequiredSetBonuses()); matcher != nil {
		matchingCombinations = 0
		for comboIdx := 0; comboIdx < rawCombinations; comboIdx++ {
			if generator.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher) {
				matchingCombinations++
			}
		}
	}

	return &proto.BulkCombinationCountResult{
		RawCombinations: int32(rawCombinations),
		Combinations:    int32(matchingCombinations),
	}
}

func BulkCandidates(request *proto.BulkCandidatesRequest) *proto.BulkCandidatesResult {
	if request == nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: "bulk candidates request is missing"}}
	}
	if request.GetBaseRequest() == nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: "bulk candidates request is missing base request"}}
	}
	if request.GetBulkSettings() == nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: "bulk candidates request is missing bulk settings"}}
	}

	bulkRequest := &proto.BulkSimRequest{
		BaseRequest:  request.GetBaseRequest(),
		BulkSettings: request.GetBulkSettings(),
	}
	player, playerErr := getPlayer(bulkRequest)
	if playerErr != nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: playerErr.Error()}}
	}
	if player.GetEquipment() == nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: "bulk candidates request is missing player equipment"}}
	}
	if player.GetDatabase() != nil {
		core.AddToDatabase(player.GetDatabase())
	}

	generator, err := newBulkSimCandidateGenerator(bulkRequest, player)
	if err != nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: err.Error()}}
	}

	rawCombinations := generator.rawCombinationsCount()
	candidates, err := generator.buildCandidates()
	if err != nil {
		return &proto.BulkCandidatesResult{Error: &proto.ErrorOutcome{Message: err.Error()}}
	}

	return &proto.BulkCandidatesResult{
		Candidates:      candidates,
		RawCombinations: int32(rawCombinations),
		Combinations:    int32(len(candidates)),
	}
}

func newBulkSimCandidateGenerator(request *proto.BulkSimRequest, player *proto.Player) (*bulkSimCandidateGenerator, error) {
	playerSpec, err := getPlayerSpec(player)
	if err != nil {
		return nil, err
	}
	playerCanDualWield := core.SpecCanDualWieldCapabilities[playerSpec] && player.GetClass() != proto.Class_ClassHunter
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
		groupedPairsBySlot:   make(map[bulkSimItemSlot][][2]bulkSimCandidateOption),
		comboItemsBySlot:     make([]bulkSimCandidateOption, int(core.NumItemSlots)),
		comboSlotUsed:        make([]bool, int(core.NumItemSlots)),
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
	generator.initGroupedSlotPairs()
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
		for _, slot := range getEligibleItemSlots(option.item, generator.playerIsFuryWarrior) {
			if isSecondaryItemSlot(slot, generator.playerCanDualWield) {
				continue
			}
			if !canEquipItem(option.item, generator.playerClass, generator.playerSpec, slot) {
				continue
			}
			bulkSlot := getBulkItemSlotFromSlot(slot, generator.playerCanDualWield)
			generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], option)
		}
	}
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		equippedItem := equippedItemsBySlot[slot]
		if equippedItem == nil {
			continue
		}
		bulkSlot := getBulkItemSlotFromSlot(slot, generator.playerCanDualWield)
		generator.selectedByBulkSlot[bulkSlot] = append(generator.selectedByBulkSlot[bulkSlot], bulkSimCandidateOption{
			spec: equippedItem.ToItemSpecProto(),
			item: *equippedItem,
		})
	}
	return nil
}

func (generator *bulkSimCandidateGenerator) initGroupedSlotPairs() {
	for _, bulkSlot := range []bulkSimItemSlot{bulkSimItemSlotFinger, bulkSimItemSlotTrinket} {
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) < 2 {
			continue
		}
		pairs := allPairs(options)
		if frozenItem := generator.frozenItems[bulkSlot]; frozenItem != nil {
			pairs = make([][2]bulkSimCandidateOption, 0, len(options))
			frozenSpec := frozenItem.ToItemSpecProto()
			for _, option := range options {
				if candidateOptionEqualsItem(option, *frozenItem, generator.inheritUpgrades) {
					continue
				}
				pairs = append(pairs, [2]bulkSimCandidateOption{{spec: frozenSpec, item: *frozenItem}, option})
			}
		}
		generator.groupedPairsBySlot[bulkSlot] = pairs
	}
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
			rawCombinations *= len(generator.groupedPairsBySlot[bulkSlot])
		} else if numOptions > 0 {
			rawCombinations *= numOptions
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
				return fmt.Errorf("at least 2 items must be selected for grouped bulk slot %d", bulkSlot)
			}
			pairs := generator.groupedPairsBySlot[bulkSlot]
			if len(pairs) == 0 {
				return fmt.Errorf("no grouped candidate pairs available for bulk slot %d", bulkSlot)
			}
			pairIdx := comboIdx % len(pairs)
			comboIdx = comboIdx / len(pairs)
			slots := bulkSimItemSlotToItemSlotPairs[bulkSlot]
			generator.comboItemsBySlot[int(slots[0])] = pairs[pairIdx][0]
			generator.comboSlotUsed[int(slots[0])] = true
			generator.comboItemsBySlot[int(slots[1])] = pairs[pairIdx][1]
			generator.comboSlotUsed[int(slots[1])] = true
			continue
		}
		optionIdx := comboIdx % len(options)
		comboIdx = comboIdx / len(options)
		slot := bulkSimItemSlotToSingleItemSlot[bulkSlot]
		generator.comboItemsBySlot[int(slot)] = options[optionIdx]
		generator.comboSlotUsed[int(slot)] = true
	}
	return nil
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
			if optionsContainEquivalent(all2HWeapons[:i], all2HWeapons[i], generator.inheritUpgrades) {
				continue
			}
			allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], nil})
			for j := i + 1; j < len(all2HWeapons); j++ {
				if optionsContainEquivalent(all2HWeapons[i+1:j], all2HWeapons[j], generator.inheritUpgrades) {
					continue
				}
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&all2HWeapons[i], &all2HWeapons[j]})
				if !candidateOptionsEqual(all2HWeapons[i], all2HWeapons[j], generator.inheritUpgrades) {
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
			if optionsContainEquivalent(all2HWeapons, mhOptions[i], generator.inheritUpgrades) {
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
			if optionsContainEquivalent(all2HWeapons, option, generator.inheritUpgrades) {
				continue
			}
			filtered = append(filtered, option)
		}
		for i := range filtered {
			if optionsContainEquivalent(filtered[:i], filtered[i], generator.inheritUpgrades) {
				continue
			}
			hasDuplicate := optionsContainEquivalent(filtered[i+1:], filtered[i], generator.inheritUpgrades)
			if filtered[i].item.WeaponType != proto.WeaponType_WeaponTypeUnknown && !hasDuplicate {
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&filtered[i], &filtered[i]})
			}
			for j := i + 1; j < len(filtered); j++ {
				if optionsContainEquivalent(filtered[i+1:j], filtered[j], generator.inheritUpgrades) {
					continue
				}
				allWeaponCombos = append(allWeaponCombos, [2]*bulkSimCandidateOption{&filtered[i], &filtered[j]})
				if !candidateOptionsEqual(filtered[i], filtered[j], generator.inheritUpgrades) {
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
			pairs := generator.groupedPairsBySlot[bulkSlot]
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
	sharedSlots := sharedSlots(getEligibleEnchantSlots(*enchant), getEligibleItemSlots(item, false))
	if len(sharedSlots) == 0 {
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

func sharedSlots(left []proto.ItemSlot, right []proto.ItemSlot) []proto.ItemSlot {
	shared := make([]proto.ItemSlot, 0, min(len(left), len(right)))
	for _, slot := range left {
		if slices.Contains(right, slot) {
			shared = append(shared, slot)
		}
	}
	return shared
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

func canEquipItem(item core.Item, playerClass proto.Class, playerSpec proto.Spec, slot proto.ItemSlot) bool {
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

func isSecondaryItemSlot(slot proto.ItemSlot, playerCanDualWield bool) bool {
	return slot == proto.ItemSlot_ItemSlotFinger2 || slot == proto.ItemSlot_ItemSlotTrinket2 || (playerCanDualWield && slot == proto.ItemSlot_ItemSlotOffHand)
}

func getBulkItemSlotFromSlot(slot proto.ItemSlot, playerCanDualWield bool) bulkSimItemSlot {
	if playerCanDualWield && (slot == proto.ItemSlot_ItemSlotMainHand || slot == proto.ItemSlot_ItemSlotOffHand) {
		return bulkSimItemSlotHandWeapon
	}
	if bulkSlot, ok := ItemSlotToBulkSimItemSlot[slot]; ok {
		return bulkSlot
	}
	return bulkSimItemSlotHead
}

func allPairs(options []bulkSimCandidateOption) [][2]bulkSimCandidateOption {
	pairs := make([][2]bulkSimCandidateOption, 0, len(options)*(len(options)-1)/2)
	for i := 0; i < len(options); i++ {
		for j := i + 1; j < len(options); j++ {
			pairs = append(pairs, [2]bulkSimCandidateOption{options[i], options[j]})
		}
	}
	return pairs
}

func optionsContainEquivalent(options []bulkSimCandidateOption, target bulkSimCandidateOption, inheritUpgrades bool) bool {
	for _, option := range options {
		if candidateOptionsEqual(option, target, inheritUpgrades) {
			return true
		}
	}
	return false
}

func candidateOptionsEqual(left bulkSimCandidateOption, right bulkSimCandidateOption, inheritUpgrades bool) bool {
	return buildItemSpecKey(left.spec, inheritUpgrades) == buildItemSpecKey(right.spec, inheritUpgrades)
}

func candidateOptionEqualsItem(option bulkSimCandidateOption, item core.Item, inheritUpgrades bool) bool {
	return buildItemSpecKey(option.spec, inheritUpgrades) == buildItemSpecKey(item.ToItemSpecProto(), inheritUpgrades)
}

func candidateOptionEqualsItemPtr(option *bulkSimCandidateOption, item *core.Item, inheritUpgrades bool) bool {
	if option == nil || item == nil {
		return option == nil && item == nil
	}
	return candidateOptionEqualsItem(*option, *item, inheritUpgrades)
}

func buildItemSpecKey(itemSpec *proto.ItemSpec, inheritUpgrades bool) itemSpecCacheKey {
	if itemSpec == nil {
		return itemSpecCacheKey{}
	}
	key := itemSpecCacheKey{
		id:            itemSpec.GetId(),
		randomSuffix:  itemSpec.GetRandomSuffix(),
		challengeMode: itemSpec.GetChallengeMode(),
	}
	if inheritUpgrades {
		return key
	}
	key.upgradeStep = itemSpec.GetUpgradeStep()
	return key
}

func getPlayerSpec(player *proto.Player) (proto.Spec, error) {
	if player == nil {
		return proto.Spec_SpecUnknown, fmt.Errorf("unsupported player spec for backend bulk candidate generation")
	}

	switch player.GetSpec().(type) {
	case *proto.Player_BloodDeathKnight:
		return proto.Spec_SpecBloodDeathKnight, nil
	case *proto.Player_FrostDeathKnight:
		return proto.Spec_SpecFrostDeathKnight, nil
	case *proto.Player_UnholyDeathKnight:
		return proto.Spec_SpecUnholyDeathKnight, nil
	case *proto.Player_BalanceDruid:
		return proto.Spec_SpecBalanceDruid, nil
	case *proto.Player_FeralDruid:
		return proto.Spec_SpecFeralDruid, nil
	case *proto.Player_GuardianDruid:
		return proto.Spec_SpecGuardianDruid, nil
	case *proto.Player_RestorationDruid:
		return proto.Spec_SpecRestorationDruid, nil
	case *proto.Player_BeastMasteryHunter:
		return proto.Spec_SpecBeastMasteryHunter, nil
	case *proto.Player_MarksmanshipHunter:
		return proto.Spec_SpecMarksmanshipHunter, nil
	case *proto.Player_SurvivalHunter:
		return proto.Spec_SpecSurvivalHunter, nil
	case *proto.Player_ArcaneMage:
		return proto.Spec_SpecArcaneMage, nil
	case *proto.Player_FireMage:
		return proto.Spec_SpecFireMage, nil
	case *proto.Player_FrostMage:
		return proto.Spec_SpecFrostMage, nil
	case *proto.Player_BrewmasterMonk:
		return proto.Spec_SpecBrewmasterMonk, nil
	case *proto.Player_MistweaverMonk:
		return proto.Spec_SpecMistweaverMonk, nil
	case *proto.Player_WindwalkerMonk:
		return proto.Spec_SpecWindwalkerMonk, nil
	case *proto.Player_HolyPaladin:
		return proto.Spec_SpecHolyPaladin, nil
	case *proto.Player_ProtectionPaladin:
		return proto.Spec_SpecProtectionPaladin, nil
	case *proto.Player_RetributionPaladin:
		return proto.Spec_SpecRetributionPaladin, nil
	case *proto.Player_DisciplinePriest:
		return proto.Spec_SpecDisciplinePriest, nil
	case *proto.Player_HolyPriest:
		return proto.Spec_SpecHolyPriest, nil
	case *proto.Player_ShadowPriest:
		return proto.Spec_SpecShadowPriest, nil
	case *proto.Player_AssassinationRogue:
		return proto.Spec_SpecAssassinationRogue, nil
	case *proto.Player_CombatRogue:
		return proto.Spec_SpecCombatRogue, nil
	case *proto.Player_SubtletyRogue:
		return proto.Spec_SpecSubtletyRogue, nil
	case *proto.Player_ElementalShaman:
		return proto.Spec_SpecElementalShaman, nil
	case *proto.Player_EnhancementShaman:
		return proto.Spec_SpecEnhancementShaman, nil
	case *proto.Player_RestorationShaman:
		return proto.Spec_SpecRestorationShaman, nil
	case *proto.Player_AfflictionWarlock:
		return proto.Spec_SpecAfflictionWarlock, nil
	case *proto.Player_DemonologyWarlock:
		return proto.Spec_SpecDemonologyWarlock, nil
	case *proto.Player_DestructionWarlock:
		return proto.Spec_SpecDestructionWarlock, nil
	case *proto.Player_ArmsWarrior:
		return proto.Spec_SpecArmsWarrior, nil
	case *proto.Player_FuryWarrior:
		return proto.Spec_SpecFuryWarrior, nil
	case *proto.Player_ProtectionWarrior:
		return proto.Spec_SpecProtectionWarrior, nil
	default:
		return proto.Spec_SpecUnknown, fmt.Errorf("unsupported player spec for backend bulk candidate generation")
	}
}

func getPlayer(request *proto.BulkSimRequest) (*proto.Player, error) {
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
