package bulk

import (
	"slices"
	"strconv"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (generator *bulkSimCandidateGenerator) buildRequiredSetBonusMatcher(requiredSetBonuses []*proto.BulkRequiredSetBonus) *bulkSimRequiredSetBonusComboMatcher {
	if len(requiredSetBonuses) == 0 {
		return nil
	}
	// A set may appear more than once (e.g. a 2pc and a 4pc requirement for the same set),
	// so one set ID maps to every requirement index that tracks it.
	requiredIndexes := make(map[int32][]int, len(requiredSetBonuses))
	for idx, required := range requiredSetBonuses {
		setID := required.GetSetId()
		requiredIndexes[setID] = append(requiredIndexes[setID], idx)
	}
	numRequired := len(requiredSetBonuses)
	baseCounts := make([]int, numRequired)
	for slot := proto.ItemSlot_ItemSlotHead; slot < core.NumItemSlots; slot++ {
		generator.addItemToRequiredSetBonusCounts(baseCounts, requiredIndexes, generator.baseEquipment.GetItemBySlot(slot), 1)
	}
	dimensions := make([]bulkSimRequiredSetBonusDimension, 0)
	weaponPairs := generator.getAllWeaponCombos()
	if len(weaponPairs) > 0 {
		optionDeltas := make([][]int, 0, len(weaponPairs))
		for _, pair := range weaponPairs {
			optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(numRequired, requiredIndexes, []slotOption{{proto.ItemSlot_ItemSlotMainHand, pair[0]}, {proto.ItemSlot_ItemSlotOffHand, pair[1]}}))
		}
		dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
	}
	for _, bulkSlot := range bulkSimNonWeaponOrder {
		options := generator.selectedByBulkSlot[bulkSlot]
		if len(options) == 0 {
			continue
		}
		if bulkSlot == BulkSimItemSlotFinger || bulkSlot == BulkSimItemSlotTrinket {
			pairs := generator.groupedPairsBySlot[bulkSlot]
			slots := BulkSimItemSlotToItemSlotPairs[bulkSlot]
			optionDeltas := make([][]int, 0, len(pairs))
			for _, pair := range pairs {
				optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(numRequired, requiredIndexes, []slotOption{{slots[0], &pair[0]}, {slots[1], &pair[1]}}))
			}
			dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
		} else {
			slot := BulkSimItemSlotToSingleItemSlot[bulkSlot]
			optionDeltas := make([][]int, 0, len(options))
			for idx := range options {
				optionDeltas = append(optionDeltas, generator.getRequiredSetBonusOptionDeltas(numRequired, requiredIndexes, []slotOption{{slot, &options[idx]}}))
			}
			dimensions = append(dimensions, bulkSimRequiredSetBonusDimension{optionDeltas: optionDeltas})
		}
	}
	requiredPieces := make([]int, numRequired)
	for idx, required := range requiredSetBonuses {
		requiredPieces[idx] = int(required.GetPieces())
	}
	return &bulkSimRequiredSetBonusComboMatcher{baseCounts: baseCounts, requiredPieces: requiredPieces, dimensions: dimensions}
}

func (generator *bulkSimCandidateGenerator) addItemToRequiredSetBonusCounts(counts []int, requiredIndexes map[int32][]int, item *core.Item, delta int) {
	if item == nil || item.SetID == 0 {
		return
	}
	for _, idx := range requiredIndexes[item.SetID] {
		counts[idx] += delta
	}
}

// slotOption pairs a slot with the candidate option replacing its base item; a nil option means
// the slot is emptied (e.g. the off-hand under a two-hander).
type slotOption struct {
	slot   proto.ItemSlot
	option *bulkSimCandidateOption
}

// numRequired is the requirement count, not len(requiredIndexes): duplicate set IDs
// collapse in the map, and every counts slice is indexed by requirement.
func (generator *bulkSimCandidateGenerator) getRequiredSetBonusOptionDeltas(numRequired int, requiredIndexes map[int32][]int, slotItems []slotOption) []int {
	deltas := make([]int, numRequired)
	for _, slotItem := range slotItems {
		generator.addItemToRequiredSetBonusCounts(deltas, requiredIndexes, generator.baseEquipment.GetItemBySlot(slotItem.slot), -1)
		if slotItem.option != nil {
			generator.addItemToRequiredSetBonusCounts(deltas, requiredIndexes, &slotItem.option.item, 1)
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

const maxRequiredSetBonusStates = 1 << 12

// Walks the dimensions once carrying a distribution over piece-count vectors, rather than
// testing each combination: the raw space is bounded only by MaxInt32. Counts stay unclamped
// because swapping a base-gear piece out produces negative deltas. ok=false means the state
// space was too large to pay off.
func (matcher *bulkSimRequiredSetBonusComboMatcher) countMatchingCombos() (int, bool) {
	numRequired := len(matcher.requiredPieces)

	// Envelope of counts reachable at any point of the walk, including before it starts.
	lo := make([]int, numRequired)
	hi := make([]int, numRequired)
	copy(lo, matcher.baseCounts)
	copy(hi, matcher.baseCounts)
	runningLo := slices.Clone(matcher.baseCounts)
	runningHi := slices.Clone(matcher.baseCounts)
	groupsByDimension := make([][]requiredSetBonusDeltaGroup, 0, len(matcher.dimensions))
	for _, dimension := range matcher.dimensions {
		if len(dimension.optionDeltas) == 0 {
			return 0, true
		}
		for idx := range numRequired {
			minDelta, maxDelta := dimension.optionDeltas[0][idx], dimension.optionDeltas[0][idx]
			for _, deltas := range dimension.optionDeltas[1:] {
				minDelta = min(minDelta, deltas[idx])
				maxDelta = max(maxDelta, deltas[idx])
			}
			runningLo[idx] += minDelta
			runningHi[idx] += maxDelta
			lo[idx] = min(lo[idx], runningLo[idx])
			hi[idx] = max(hi[idx], runningHi[idx])
		}
		groupsByDimension = append(groupsByDimension, groupRequiredSetBonusDeltas(dimension.optionDeltas))
	}

	strides := make([]int, numRequired)
	numStates := 1
	for idx := range numRequired {
		strides[idx] = numStates
		span := hi[idx] - lo[idx] + 1
		if numStates > maxRequiredSetBonusStates/span {
			return 0, false
		}
		numStates *= span
	}

	dp := make([]int, numStates)
	next := make([]int, numStates)
	counts := make([]int, numRequired)
	baseState := 0
	for idx, count := range matcher.baseCounts {
		baseState += (count - lo[idx]) * strides[idx]
	}
	dp[baseState] = 1

	for _, groups := range groupsByDimension {
		clear(next)
		for stateIdx, combos := range dp {
			if combos == 0 {
				continue
			}
			remainder := stateIdx
			for idx := numRequired - 1; idx >= 0; idx-- {
				counts[idx] = lo[idx] + remainder/strides[idx]
				remainder %= strides[idx]
			}
			for _, group := range groups {
				targetState := 0
				for idx, delta := range group.deltas {
					targetState += (counts[idx] + delta - lo[idx]) * strides[idx]
				}
				next[targetState] = saturatingCombinationsAdd(next[targetState], saturatingCombinationsMul(combos, group.options))
			}
		}
		dp, next = next, dp
	}

	matching := 0
	for stateIdx, combos := range dp {
		if combos == 0 {
			continue
		}
		remainder := stateIdx
		satisfied := true
		for idx := numRequired - 1; idx >= 0; idx-- {
			count := lo[idx] + remainder/strides[idx]
			remainder %= strides[idx]
			if count < matcher.requiredPieces[idx] {
				satisfied = false
				break
			}
		}
		if satisfied {
			matching = saturatingCombinationsAdd(matching, combos)
		}
	}
	return matching, true
}

type requiredSetBonusDeltaGroup struct {
	deltas  []int
	options int
}

// Most selected items belong to no required set, so their delta vectors are identical; this
// keeps the inner loop proportional to distinct outcomes, not item count.
func groupRequiredSetBonusDeltas(optionDeltas [][]int) []requiredSetBonusDeltaGroup {
	groups := make([]requiredSetBonusDeltaGroup, 0, 4)
	indexByKey := make(map[string]int, 4)
	var key []byte
	for _, deltas := range optionDeltas {
		key = key[:0]
		for _, delta := range deltas {
			key = strconv.AppendInt(key, int64(delta), 10)
			key = append(key, ',')
		}
		if idx, ok := indexByKey[string(key)]; ok {
			groups[idx].options++
			continue
		}
		indexByKey[string(key)] = len(groups)
		groups = append(groups, requiredSetBonusDeltaGroup{deltas: deltas, options: 1})
	}
	return groups
}
