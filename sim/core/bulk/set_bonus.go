package bulk

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

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
	for _, bulkSlot := range bulkSimSelectedOrder {
		if bulkSlot == BulkSimItemSlotMainHand || bulkSlot == BulkSimItemSlotOffHand || bulkSlot == BulkSimItemSlotHandWeapon {
			continue
		}
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) == 0 {
			continue
		}
		if bulkSlot == BulkSimItemSlotFinger || bulkSlot == BulkSimItemSlotTrinket {
			pairs := generator.groupedPairsBySlot[bulkSlot]
			slots := BulkSimItemSlotToItemSlotPairs[bulkSlot]
			optionDeltas := make([][]int, 0, len(pairs))
			for _, pair := range pairs {
				optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(requiredIndexes, [][2]any{{slots[0], &pair[0]}, {slots[1], &pair[1]}}))
			}
			dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
		} else {
			slot := BulkSimItemSlotToSingleItemSlot[bulkSlot]
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

func (generator *bulkSimCandidateGenerator) comboMatchesRequiredSetBonusMatcher(comboIdx int, matcher *bulkSimRequiredSetBonusComboMatcher, scratchCounts []int) bool {
	if matcher == nil {
		return true
	}
	counts := scratchCounts
	if len(counts) != len(matcher.baseCounts) {
		counts = make([]int, len(matcher.baseCounts))
	}
	copy(counts, matcher.baseCounts)
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

type bulkSimRequiredSetBonusComboMatcher struct {
	baseCounts     []int
	requiredPieces []int
	dimensions     []bulkSimRequiredSetBonusDimension
}

type bulkSimRequiredSetBonusDimension struct {
	optionDeltas [][]int
}
