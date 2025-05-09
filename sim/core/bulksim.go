package core

import (
	"fmt"
	"math"
	"runtime"
	"runtime/debug"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	goproto "google.golang.org/protobuf/proto"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
)

const (
	defaultIterationsPerCombo = 1000
)

// raidSimRunner runs a standard raid simulation.
type raidSimRunner func(*proto.RaidSimRequest, chan *proto.ProgressMetrics, bool, simsignals.Signals) *proto.RaidSimResult

// bulkSimRunner runs a bulk simulation.
type bulkSimRunner struct {
	// SingleRaidSimRunner used to run one simulation of the bulk.
	SingleRaidSimRunner raidSimRunner
	// Request used for this bulk simulation.
	Request *proto.BulkSimRequest
}

func BulkSim(signals simsignals.Signals, request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics) *proto.BulkSimResult {
	bulk := &bulkSimRunner{
		SingleRaidSimRunner: runSim,
		Request:             request,
	}

	result := bulk.Run(signals, progress)

	if progress != nil {
		progress <- &proto.ProgressMetrics{
			FinalBulkResult: result,
		}
		close(progress)
	}

	return result
}

func BulkSimCombos(signals simsignals.Signals, req *proto.BulkSimCombosRequest) *proto.BulkSimCombosResult {
	// Bulk simming is only supported for the single-player use (i.e. not whole raid-wide simming).
	// Verify that we have exactly 1 player.
	var playerCount int
	var player *proto.Player
	for _, p := range req.BaseSettings.GetRaid().GetParties() {
		for _, pl := range p.GetPlayers() {
			// TODO(Riotdog-GehennasEU): Better way to check if a player is valid/set?
			if pl.Name != "" {
				player = pl
				playerCount++
			}
		}
	}
	if playerCount != 1 || player == nil {
		return &proto.BulkSimCombosResult{
			ErrorResult: fmt.Sprintf("bulksim: expected exactly 1 player, found %d", playerCount),
		}
	}

	if player.GetDatabase() != nil {
		addToDatabase(player.GetDatabase())
	}
	// reduce to just base party.
	req.BaseSettings.Raid.Parties = []*proto.Party{req.BaseSettings.Raid.Parties[0]}
	// clean to reduce memory
	player.Database = nil

	validCombos, iterations, err := buildCombos(signals, req.BaseSettings, req.BulkSettings, player)
	if err != nil {
		return &proto.BulkSimCombosResult{
			ErrorResult: err.Error(),
		}
	}

	result := &proto.BulkSimCombosResult{
		NumCombinations: int32(len(validCombos)),
		NumIterations:   int32(len(validCombos)) * iterations,
	}

	return result
}

type singleBulkSim struct {
	req *proto.RaidSimRequest
	cl  *raidSimRequestChangeLog
	eq  *equipmentSubstitution
}

func (b *bulkSimRunner) Run(signals simsignals.Signals, progress chan *proto.ProgressMetrics) (result *proto.BulkSimResult) {
	defer func() {
		if err := recover(); err != nil {
			result = &proto.BulkSimResult{
				Error: &proto.ErrorOutcome{
					Message: fmt.Sprintf("%v\nStack Trace:\n%s", err, string(debug.Stack())),
				},
			}
		}
		signals.Abort.Trigger()
	}()

	// Bulk simming is only supported for the single-player use (i.e. not whole raid-wide simming).
	// Verify that we have exactly 1 player.
	var playerCount int
	var player *proto.Player
	for _, p := range b.Request.GetBaseSettings().GetRaid().GetParties() {
		for _, pl := range p.GetPlayers() {
			// TODO(Riotdog-GehennasEU): Better way to check if a player is valid/set?
			if pl.Name != "" {
				player = pl
				playerCount++
			}
		}
	}
	if playerCount != 1 || player == nil {
		return &proto.BulkSimResult{
			Error: &proto.ErrorOutcome{
				Message: fmt.Sprintf("bulksim: expected exactly 1 player, found %d", playerCount),
			},
		}
	}
	if player.GetDatabase() != nil {
		addToDatabase(player.GetDatabase())
	}
	// reduce to just base party.
	b.Request.BaseSettings.Raid.Parties = []*proto.Party{b.Request.BaseSettings.Raid.Parties[0]}
	// clean to reduce memory
	player.Database = nil

	originalIterations := b.Request.BulkSettings.GetIterationsPerCombo()
	if originalIterations <= 0 {
		originalIterations = defaultIterationsPerCombo
	}

	validCombos, newIters, err := buildCombos(signals, b.Request.BaseSettings, b.Request.BulkSettings, player)
	if err != nil {
		return &proto.BulkSimResult{
			Error: &proto.ErrorOutcome{Message: err.Error()},
		}
	}

	// TODO(Riotdog-GehennasEU): Make this configurable?
	maxResults := 30

	var rankedResults []*itemSubstitutionSimResult
	var baseResult *itemSubstitutionSimResult

	for {
		var tempBase *itemSubstitutionSimResult
		var errorOutcome *proto.ErrorOutcome
		// TODO: we could theoretically make getRankedResults accept a channel of validCombos that stream in to it and launches sims as it gets them...
		rankedResults, tempBase, errorOutcome = b.getRankedResults(signals, validCombos, newIters, progress)

		if errorOutcome != nil {
			return &proto.BulkSimResult{Error: errorOutcome}
		}
		// keep replacing the base result with more refined base until we don't have base in the ranked results anymore.
		if tempBase != nil {
			baseResult = tempBase
		}

		// If we aren't doing fast mode, or if halving our results will be less than the maxResults, be done.
		if !b.Request.BulkSettings.FastMode || len(rankedResults) <= maxResults*2 {
			break
		}

		// we have reached max accuracy now
		if newIters >= originalIterations {
			break
		}

		// Increase accuracy
		newIters *= 2
		newNumCombos := len(rankedResults) / 2
		validCombos = validCombos[:newNumCombos]
		rankedResults = rankedResults[:newNumCombos]
		for i, comb := range rankedResults {
			validCombos[i] = singleBulkSim{
				req: comb.Request,
				cl:  comb.ChangeLog,
				eq:  comb.Substitution,
			}
		}
	}

	if baseResult == nil {
		return &proto.BulkSimResult{
			Error: &proto.ErrorOutcome{
				Message: fmt.Sprintf("no base result for equipped gear found in bulk sim"),
			},
		}
	}

	if len(rankedResults) > maxResults {
		rankedResults = rankedResults[:maxResults]
	}

	bum := baseResult.Result.GetRaidMetrics().GetParties()[0].GetPlayers()[0]
	bum.Actions = nil
	bum.Auras = nil
	bum.Resources = nil
	bum.Pets = nil

	result = &proto.BulkSimResult{
		EquippedGearResult: &proto.BulkComboResult{
			UnitMetrics: bum,
		},
	}

	for _, r := range rankedResults {
		um := r.Result.GetRaidMetrics().GetParties()[0].GetPlayers()[0]
		um.Actions = nil
		um.Auras = nil
		um.Resources = nil
		um.Pets = nil
		result.Results = append(result.Results, &proto.BulkComboResult{
			ItemsAdded:    r.ChangeLog.AddedItems,
			UnitMetrics:   um,
			TalentLoadout: r.ChangeLog.TalentLoadout,
		})
	}

	if progress != nil {
		progress <- &proto.ProgressMetrics{
			FinalBulkResult: result,
		}
	}

	return result
}

func (b *bulkSimRunner) getRankedResults(signals simsignals.Signals, validCombos []singleBulkSim, iterations int32, progress chan *proto.ProgressMetrics) ([]*itemSubstitutionSimResult, *itemSubstitutionSimResult, *proto.ErrorOutcome) {
	concurrency := runtime.NumCPU() + 1
	if concurrency <= 0 {
		concurrency = 2
	}

	tickets := make(chan struct{}, concurrency)
	for i := 0; i < concurrency; i++ {
		tickets <- struct{}{}
	}

	results := make(chan *itemSubstitutionSimResult, 10)

	numCombinations := int32(len(validCombos))
	totalIterationsUpperBound := numCombinations * iterations

	var totalCompletedIterations int32
	var totalCompletedSims int32

	reporterSignal := simsignals.CreateSignals()

	// reporter for all sims combined.
	go func() {
		for !signals.Abort.IsTriggered() && !reporterSignal.Abort.IsTriggered() {
			complIters := atomic.LoadInt32(&totalCompletedIterations)
			complSims := atomic.LoadInt32(&totalCompletedSims)

			// stop reporting
			if complIters == int32(totalIterationsUpperBound) || numCombinations == complSims {
				return
			}

			progress <- &proto.ProgressMetrics{
				TotalSims:           numCombinations,
				CompletedSims:       complSims,
				CompletedIterations: complIters,
				TotalIterations:     int32(totalIterationsUpperBound),
			}
			time.Sleep(time.Second)
		}
	}()

	// launcher for all combos (limited by concurrency max)
	go func() {
		for _, singleCombo := range validCombos {
			<-tickets
			singleSimProgress := make(chan *proto.ProgressMetrics)

			// watches this progress and pushes up to main reporter.
			go func(prog chan *proto.ProgressMetrics) {
				var prevDone int32
				for p := range singleSimProgress {
					delta := p.CompletedIterations - prevDone
					atomic.AddInt32(&totalCompletedIterations, delta)
					prevDone = p.CompletedIterations
					if p.FinalRaidResult != nil {
						break
					}
				}
			}(singleSimProgress)
			// actually run the sim in here.
			go func(sub singleBulkSim) {
				// overwrite the requests iterations with the input for this function.
				sub.req.SimOptions.Iterations = int32(iterations)
				results <- &itemSubstitutionSimResult{
					Request:      sub.req,
					Result:       b.SingleRaidSimRunner(sub.req, singleSimProgress, false, signals),
					Substitution: sub.eq,
					ChangeLog:    sub.cl,
				}
				atomic.AddInt32(&totalCompletedSims, 1)
				tickets <- struct{}{} // when done, allow for new sim to be launched.
			}(singleCombo)
		}
	}()

	rankedResults := make([]*itemSubstitutionSimResult, numCombinations)
	var baseResult *itemSubstitutionSimResult

	for i := range rankedResults {
		result := <-results
		if result.Result == nil || result.Result.Error != nil {
			reporterSignal.Abort.Trigger() // cancel reporter
			return nil, nil, result.Result.Error
		}
		if !result.Substitution.HasItemReplacements() && result.ChangeLog.TalentLoadout == nil {
			baseResult = result
		}
		rankedResults[i] = result
	}
	reporterSignal.Abort.Trigger() // cancel reporter

	sort.Slice(rankedResults, func(i, j int) bool {
		return rankedResults[i].Score() > rankedResults[j].Score()
	})
	return rankedResults, baseResult, nil
}

func buildCombos(signals simsignals.Signals, baseSettings *proto.RaidSimRequest, bulkSettings *proto.BulkSettings, player *proto.Player) ([]singleBulkSim, int32, error) {
	// Gemming for now can happen before slots are decided.
	// We might have to add logic after slot decisions if we want to enforce keeping meta gem active.
	if bulkSettings.AutoGem {
		for _, replaceItem := range bulkSettings.Items {
			itemData := ItemsByID[replaceItem.Id]
			if len(itemData.GemSockets) == 0 && itemData.Type != proto.ItemType_ItemTypeWaist {
				continue
			}

			sockets := make([]int32, len(itemData.GemSockets))
			if len(sockets) < len(replaceItem.Gems) {
				// this means the extra gem was specified, just add an extra element
				sockets = append(sockets, 0)
			}
			// now copy over what we have from inputs.
			copy(sockets, replaceItem.Gems)
			if itemData.Type == proto.ItemType_ItemTypeWaist {
				// Assume waist always has the eternal belt buckle and add extra red gem.
				// TODO: is there a better way to do this?
				// Should we have a 'prismatic' standard gem in the defaults?
				if len(sockets) == len(itemData.GemSockets) {
					sockets = append(sockets, bulkSettings.DefaultRedGem)
				} else if len(sockets) > len(itemData.GemSockets) && sockets[len(sockets)-1] == 0 {
					sockets[len(sockets)-1] = bulkSettings.DefaultRedGem
				}
			}

			for i, color := range itemData.GemSockets {
				if sockets[i] > 0 {
					// This means gem was already specified, skip autogem
					continue
				}
				if ColorIntersects(color, proto.GemColor_GemColorRed) {
					sockets[i] = bulkSettings.DefaultRedGem
				} else if ColorIntersects(color, proto.GemColor_GemColorYellow) {
					sockets[i] = bulkSettings.DefaultYellowGem
				} else if ColorIntersects(color, proto.GemColor_GemColorBlue) {
					sockets[i] = bulkSettings.DefaultBlueGem
				} else if ColorIntersects(color, proto.GemColor_GemColorMeta) {
					sockets[i] = bulkSettings.DefaultMetaGem
				}
			}
			replaceItem.Gems = sockets
		}
	}

	iterations := bulkSettings.GetIterationsPerCombo()
	if iterations <= 0 {
		iterations = defaultIterationsPerCombo
	}

	items := bulkSettings.GetItems()
	isFuryWarrior := player.GetFuryWarrior() != nil
	// numItems := len(items)
	// if b.Request.BulkSettings.Combinations && numItems > maxItemCount {
	// 	return nil, fmt.Errorf("too many items specified (%d > %d), not computationally feasible", numItems, maxItemCount)
	// }

	// Create all distinct combinations of (item, slot). For example, let's say the only item we
	// want to bulk sim is a one-handed item that can be worn both as an off-hand or a main-hand weapon.
	// For each slot, we will create one itemWithSlot pair, so (item, off-hand) and (item, main-hand).
	// We verify later that we are not emitting any invalid equipment set.
	var distinctItemSlotCombos []*itemWithSlot
	for index, is := range items {
		item, ok := ItemsByID[is.Id]
		if !ok {
			return nil, 0, fmt.Errorf("unknown item with id %d in bulk settings", is.Id)
		}
		for _, slot := range eligibleSlotsForItem(&item, isFuryWarrior) {
			distinctItemSlotCombos = append(distinctItemSlotCombos, &itemWithSlot{
				Item:  is,
				Slot:  slot,
				Index: index,
			})
		}
	}
	baseItems := player.Equipment.Items

	allCombos := generateAllEquipmentSubstitutions(signals, baseItems, bulkSettings.Combinations, distinctItemSlotCombos, isFuryWarrior)

	var validCombos []singleBulkSim
	count := 0
	for sub := range allCombos {
		count++
		if count > 1000000 {
			panic("over 1 million combos, abandoning attempt")
		}

		substitutedRequest, changeLog := createNewRequestWithSubstitution(baseSettings, sub, bulkSettings.AutoEnchant, isFuryWarrior)
		if isValidEquipment(substitutedRequest.Raid.Parties[0].Players[0].Equipment, isFuryWarrior) {
			// Need to sim base dps of gear loudout
			validCombos = append(validCombos, singleBulkSim{req: substitutedRequest, cl: changeLog, eq: sub})
			// Todo(Netzone-GehennasEU): Make this its own step?
			if !bulkSettings.SimTalents {

			} else {
				var talentsToSim = bulkSettings.GetTalentsToSim()

				if len(talentsToSim) > 0 {
					for _, talent := range talentsToSim {
						sr := goproto.Clone(substitutedRequest).(*proto.RaidSimRequest)
						cl := *changeLog
						if sr.Raid.Parties[0].Players[0].TalentsString == talent.TalentsString && goproto.Equal(talent.Glyphs, sr.Raid.Parties[0].Players[0].Glyphs) {
							continue
						}

						sr.Raid.Parties[0].Players[0].TalentsString = talent.TalentsString
						sr.Raid.Parties[0].Players[0].Glyphs = talent.Glyphs
						cl.TalentLoadout = talent
						validCombos = append(validCombos, singleBulkSim{req: sr, cl: &cl, eq: sub})
					}
				}
			}
		}
	}

	// In fast mode try to keep starting iterations between 1000 and 2000
	if bulkSettings.FastMode {
		iterations /= 10

		if iterations < 1000 {
			iterations = 1000
		} else if iterations > 2000 {
			iterations = 2000
		}
	}

	maxIterations := int64(iterations) * int64(len(validCombos))
	if maxIterations > math.MaxInt32 {
		return nil, 0, fmt.Errorf("number of total iterations %d too large", maxIterations)
	}

	return validCombos, iterations, nil
}

// itemSubstitutionSimResult stores the request and response of a simulation, along with the used
// equipment susbstitution and a changelog of which items were added and removed from the base
// equipment set.
type itemSubstitutionSimResult struct {
	Request      *proto.RaidSimRequest
	Result       *proto.RaidSimResult
	Substitution *equipmentSubstitution
	ChangeLog    *raidSimRequestChangeLog
}

// Score used to rank results.
func (r *itemSubstitutionSimResult) Score() float64 {
	if r.Result == nil || r.Result.Error != nil {
		return 0
	}
	return r.Result.RaidMetrics.Dps.Avg
}

// equipmentSubstitution specifies all items to be used as replacements for the equipped gear.
type equipmentSubstitution struct {
	Items []*itemWithSlot
}

// HasChanges returns true if the equipment substitution has any item replacmenets.
func (es *equipmentSubstitution) HasItemReplacements() bool {
	return len(es.Items) > 0
}

func (es *equipmentSubstitution) CanonicalHash() string {
	slotToID := map[proto.ItemSlot]int32{}
	for _, repl := range es.Items {
		slotToID[repl.Slot] = repl.Item.Id
	}

	// Canonical representation always has the ring or trinket with smaller item ID in slot1
	// if the equipment substitution mentions two rings or trinkets.
	if ring1, ok := slotToID[proto.ItemSlot_ItemSlotFinger1]; ok {
		if ring2, ok := slotToID[proto.ItemSlot_ItemSlotFinger2]; ok {
			if ring1 == ring2 {
				return ""
			}
			if ring1 > ring2 {
				slotToID[proto.ItemSlot_ItemSlotFinger1], slotToID[proto.ItemSlot_ItemSlotFinger2] = ring2, ring1
			}
		}
	}
	if trink1, ok := slotToID[proto.ItemSlot_ItemSlotTrinket1]; ok {
		if trink2, ok := slotToID[proto.ItemSlot_ItemSlotTrinket2]; ok {
			if trink1 == trink2 {
				return ""
			}
			if trink1 > trink2 {
				slotToID[proto.ItemSlot_ItemSlotTrinket1], slotToID[proto.ItemSlot_ItemSlotTrinket2] = trink2, trink1
			}
		}
	}

	parts := make([]string, 0, len(proto.ItemSlot_name))
	for i := 0; i < len(proto.ItemSlot_name); i++ {
		if id, ok := slotToID[proto.ItemSlot(i)]; ok {
			parts = append(parts, fmt.Sprintf("%d=%d", i, id))
		}
	}

	return strings.Join(parts, ":")
}

// isValidEquipment returns true if the specified equipment spec is valid.
// An equipment spec is valid if:
// - The main-hand is not empty.
// - The off-hand is not a two-hander, unless the player is a Fury Warrior.
// - The off-hand is not empty, unless the main-hand is a two-hander and the player is not a Fury Warrior.
// - Two distinct trinkets are used
func isValidEquipment(equipment *proto.EquipmentSpec, isFuryWarrior bool) bool {
	// Don't allow empty main-hands
	if equipment.Items[proto.ItemSlot_ItemSlotMainHand] == nil {
		return false
	}

	var usesTwoHander bool
	if knownItem, ok := ItemsByID[equipment.Items[proto.ItemSlot_ItemSlotMainHand].Id]; ok {
		usesTwoHander = knownItem.HandType == proto.HandType_HandTypeTwoHand
	}

	usesOffHand := equipment.Items[proto.ItemSlot_ItemSlotOffHand].Id != 0

	// Don't allow a two-hander with off-hand combination unless the player is a Fury warrior
	if usesTwoHander && usesOffHand && !isFuryWarrior {
		return false
	}

	// Validate trinkets for duplicate IDs
	if equipment.Items[proto.ItemSlot_ItemSlotTrinket1].Id == equipment.Items[proto.ItemSlot_ItemSlotTrinket2].Id && equipment.Items[proto.ItemSlot_ItemSlotTrinket1].Id != 0 {
		return false
	}

	return true
}

// generateAllEquipmentSubstitutions generates all possible valid equipment substitutions for the
// given bulk sim request. Also returns the unchanged equipment ("base equipment set") set as the
// first result. This ensures that simming over all possible equipment substitutions includes the
// base case as well.
func generateAllEquipmentSubstitutions(signals simsignals.Signals, baseItems []*proto.ItemSpec, combinations bool, distinctItemSlotCombos []*itemWithSlot, isFuryWarrior bool) chan *equipmentSubstitution {
	results := make(chan *equipmentSubstitution)
	go func() {
		defer close(results)

		// No substitutions (base case).
		results <- &equipmentSubstitution{}

		// Organize everything by slot.
		itemsBySlot := make([][]*proto.ItemSpec, 17)
		for _, spec := range distinctItemSlotCombos {
			itemsBySlot[spec.Slot] = append(itemsBySlot[spec.Slot], spec.Item)
		}

		if !combinations {
			// seenCombos lets us deduplicate trinket/ring combos.
			comboChecker := ItemComboChecker{}

			// Pre-seed the existing item combos
			comboChecker.HasCombo(baseItems[proto.ItemSlot_ItemSlotFinger1].Id, baseItems[proto.ItemSlot_ItemSlotFinger2].Id)
			comboChecker.HasCombo(baseItems[proto.ItemSlot_ItemSlotTrinket1].Id, baseItems[proto.ItemSlot_ItemSlotTrinket2].Id)

			for slotid, slot := range itemsBySlot {
				for _, item := range slot {
					sub := equipmentSubstitution{
						Items: []*itemWithSlot{{Item: item, Slot: proto.ItemSlot(slotid)}},
					}
					// Handle finger/trinket specially to generate combos
					switch slotid {
					case int(proto.ItemSlot_ItemSlotFinger1), int(proto.ItemSlot_ItemSlotTrinket1):
						if !comboChecker.HasCombo(item.Id, baseItems[slotid+1].Id) {
							results <- &sub
						}
						// Generate extra combos
						subslot := slotid + 1
						for _, subitem := range itemsBySlot[subslot] {
							if shouldSkipCombo(baseItems, subitem, proto.ItemSlot(subslot), comboChecker, sub) {
								continue
							}
							miniCombo := createReplacement(sub, &itemWithSlot{Item: subitem, Slot: proto.ItemSlot(subslot)})
							results <- &miniCombo
						}
					case int(proto.ItemSlot_ItemSlotFinger2), int(proto.ItemSlot_ItemSlotTrinket2):
						// Ensure we don't have this combo with the base equipment.
						if !comboChecker.HasCombo(item.Id, baseItems[slotid-1].Id) {
							results <- &sub
						}
					default:
						results <- &sub
					}
				}
			}
			return
		}

		// Simming all combinations of items. This is useful to find the e.g.
		// the best set of items in your bags.
		subComboChecker := SubstitutionComboChecker{}
		for i := 0; i < len(itemsBySlot); i++ {
			genSlotCombos(proto.ItemSlot(i), baseItems, equipmentSubstitution{}, itemsBySlot, subComboChecker, results, isFuryWarrior)
		}
	}()

	return results
}

func createReplacement(repl equipmentSubstitution, item *itemWithSlot) equipmentSubstitution {
	newItems := make([]*itemWithSlot, len(repl.Items))
	copy(newItems, repl.Items)
	newItems = append(newItems, item)
	repl.Items = newItems
	return repl
}

func shouldSkipCombo(baseItems []*proto.ItemSpec, item *proto.ItemSpec, slot proto.ItemSlot, comboChecker ItemComboChecker, replacements equipmentSubstitution) bool {
	switch slot {
	case proto.ItemSlot_ItemSlotFinger1, proto.ItemSlot_ItemSlotTrinket1:
		return comboChecker.HasCombo(item.Id, baseItems[slot+1].Id)
	case proto.ItemSlot_ItemSlotFinger2, proto.ItemSlot_ItemSlotTrinket2:
		for _, repl := range replacements.Items {
			if slot == proto.ItemSlot_ItemSlotFinger2 && repl.Slot == proto.ItemSlot_ItemSlotFinger1 ||
				slot == proto.ItemSlot_ItemSlotTrinket2 && repl.Slot == proto.ItemSlot_ItemSlotTrinket1 {
				return comboChecker.HasCombo(repl.Item.Id, item.Id)
			}
		}
		// Since we didn't find an item in the opposite slot, check against base items.
		return comboChecker.HasCombo(item.Id, baseItems[slot-1].Id)
	}
	return false
}

func genSlotCombos(slot proto.ItemSlot, baseItems []*proto.ItemSpec, baseRepl equipmentSubstitution, replaceBySlot [][]*proto.ItemSpec, comboChecker SubstitutionComboChecker, results chan *equipmentSubstitution, isFuryWarrior bool) {
	// Iterate all items in this slot, add to the baseRepl, then descend to add all other item combos.
	for _, item := range replaceBySlot[slot] {
		// Create a new equipment substitution from the current replacements plus the new item.
		combo := createReplacement(baseRepl, &itemWithSlot{Slot: slot, Item: item})

		// Determine if an invalid weapon combo was created
		hasMainHand, hasOffHand, mhIs2H := false, false, false
		for _, i := range combo.Items {
			if i.Slot == proto.ItemSlot_ItemSlotMainHand {
				hasMainHand = true
				if ItemsByID[i.Item.Id].HandType == proto.HandType_HandTypeTwoHand {
					mhIs2H = true
				}
			} else if i.Slot == proto.ItemSlot_ItemSlotOffHand {
				hasOffHand = true
			}
		}

		// If the combo has already been generated,
		// or if the combo uses a two weapons, the main-hand is a two-hander, and the player is not a fury warrior, skip the combo
		if comboChecker.HasCombo(combo) || (hasMainHand && hasOffHand && mhIs2H && !isFuryWarrior) {
			continue
		}
		results <- &combo

		// Now descend to each other slot to pair with this combo.
		for j := slot + 1; int(j) < len(replaceBySlot); j++ {
			genSlotCombos(j, baseItems, combo, replaceBySlot, comboChecker, results, isFuryWarrior)
		}
	}
}

// itemWithSlot pairs an item with its fixed item slot.
type itemWithSlot struct {
	Item *proto.ItemSpec
	Slot proto.ItemSlot

	// This index refers to the item's position in the BulkEquipmentSpec of the player and serves as
	// a unique item ID. It is used to verify that a valid equipmentSubstitution only references an
	// item once.
	Index int
}

// raidSimRequestChangeLog stores a change log of which items were added and removed from the base
// equipment set.
type raidSimRequestChangeLog struct {
	AddedItems    []*proto.ItemSpecWithSlot
	TalentLoadout *proto.TalentLoadout
}

// createNewRequestWithSubstitution creates a copy of the input RaidSimRequest and applis the given
// equipment susbstitution to the player's equipment. Copies enchant if specified and possible.
func createNewRequestWithSubstitution(readonlyInputRequest *proto.RaidSimRequest, substitution *equipmentSubstitution, autoEnchant bool, isFuryWarrior bool) (*proto.RaidSimRequest, *raidSimRequestChangeLog) {
	request := goproto.Clone(readonlyInputRequest).(*proto.RaidSimRequest)
	changeLog := &raidSimRequestChangeLog{}
	player := request.Raid.Parties[0].Players[0]
	equipment := player.Equipment

	// Do a first pass to determine whether we have any missing paired slots (Weapon, Finger, Trinket)
	hasMainHand, hasOffHand, hasFinger1, hasFinger2, hasTrinket1, hasTrinket2 := false, false, false, false, false, false
	for _, is := range substitution.Items {
		switch is.Slot {
		case proto.ItemSlot_ItemSlotMainHand:
			hasMainHand = true
		case proto.ItemSlot_ItemSlotOffHand:
			hasOffHand = true
		case proto.ItemSlot_ItemSlotFinger1:
			hasFinger1 = true
		case proto.ItemSlot_ItemSlotFinger2:
			hasFinger2 = true
		case proto.ItemSlot_ItemSlotTrinket1:
			hasTrinket1 = true
		case proto.ItemSlot_ItemSlotTrinket2:
			hasTrinket2 = true
		}
	}

	// Record whether or not we have each item in a paired slot
	for _, is := range substitution.Items {
		oldItem := equipment.Items[is.Slot]
		newItem := is.Item
		if autoEnchant && oldItem.Enchant > 0 && is.Item.Enchant == 0 {
			equipment.Items[is.Slot] = goproto.Clone(is.Item).(*proto.ItemSpec)
			equipment.Items[is.Slot].Enchant = oldItem.Enchant
			// TODO: logic to decide if the enchant can be applied to the new item...
			// Specifically, offhand shouldn't get shield enchant
			// Main/One hand shouldn't get staff enchant
			// Later: replace normal enchant if replacement is staff.

			newItem = equipment.Items[is.Slot]
		} else {
			equipment.Items[is.Slot] = is.Item
		}

		// If the item is an off-hand and the combo doesn't have a main-hand, insert a main-hand before
		if is.Slot == proto.ItemSlot_ItemSlotOffHand && !hasMainHand {
			equipment.Items[proto.ItemSlot_ItemSlotMainHand] = player.Equipment.Items[proto.ItemSlot_ItemSlotMainHand]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotMainHand],
				Slot: proto.ItemSlot_ItemSlotMainHand,
			})
		}

		// If the item is a finger-2 and the combo doesn't have a finger-1, insert the equipped finger-1 before
		if is.Slot == proto.ItemSlot_ItemSlotFinger2 && !hasFinger1 {
			equipment.Items[proto.ItemSlot_ItemSlotFinger1] = player.Equipment.Items[proto.ItemSlot_ItemSlotFinger1]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotFinger1],
				Slot: proto.ItemSlot_ItemSlotFinger1,
			})
		}

		// If the item is a trinket-2 and the combo doesn't have a trinket-1, insert the equipped trinket-1 before
		if is.Slot == proto.ItemSlot_ItemSlotTrinket2 && !hasTrinket1 {
			equipment.Items[proto.ItemSlot_ItemSlotTrinket1] = player.Equipment.Items[proto.ItemSlot_ItemSlotTrinket1]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotTrinket1],
				Slot: proto.ItemSlot_ItemSlotTrinket1,
			})
		}

		changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
			Item: newItem,
			Slot: is.Slot,
		})

		// If the item is a main-hand and the combo doesn't have an off-hand, insert an off-hand after
		if is.Slot == proto.ItemSlot_ItemSlotMainHand && !hasOffHand {
			equipment.Items[proto.ItemSlot_ItemSlotOffHand] = player.Equipment.Items[proto.ItemSlot_ItemSlotOffHand]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotOffHand],
				Slot: proto.ItemSlot_ItemSlotOffHand,
			})
		}

		// If the item is a finger-1 and the combo doesn't have a finger-2, insert an finger-2 after
		if is.Slot == proto.ItemSlot_ItemSlotFinger1 && !hasFinger2 {
			equipment.Items[proto.ItemSlot_ItemSlotFinger2] = player.Equipment.Items[proto.ItemSlot_ItemSlotFinger2]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotFinger2],
				Slot: proto.ItemSlot_ItemSlotFinger2,
			})
		}

		// If the item is a trinket-1 and the combo doesn't have a trinket-2, insert an trinket-2 after
		if is.Slot == proto.ItemSlot_ItemSlotTrinket1 && !hasTrinket2 {
			equipment.Items[proto.ItemSlot_ItemSlotTrinket2] = player.Equipment.Items[proto.ItemSlot_ItemSlotTrinket2]
			changeLog.AddedItems = append(changeLog.AddedItems, &proto.ItemSpecWithSlot{
				Item: player.Equipment.Items[proto.ItemSlot_ItemSlotTrinket2],
				Slot: proto.ItemSlot_ItemSlotTrinket2,
			})
		}
	}

	// If the main-hand is a two-hander and the player is not a fury warrior, remove the off-hand
	if equipment.Items[proto.ItemSlot_ItemSlotMainHand].Id != 0 && ItemsByID[equipment.Items[proto.ItemSlot_ItemSlotMainHand].Id].HandType == proto.HandType_HandTypeTwoHand && !isFuryWarrior {
		equipment.Items[proto.ItemSlot_ItemSlotOffHand] = &proto.ItemSpec{}
		for _, item := range changeLog.AddedItems {
			if item.Slot == proto.ItemSlot_ItemSlotOffHand {
				item.Item = nil
			}
		}
	}

	return request, changeLog
}

type ItemComboChecker map[int64]struct{}

func (ic *ItemComboChecker) HasCombo(itema int32, itemb int32) bool {
	if itema == itemb {
		return true
	}
	key := ic.generateComboKey(itema, itemb)
	if _, ok := (*ic)[key]; ok {
		return true
	} else {
		(*ic)[key] = struct{}{}
	}
	return false
}

// put this function on ic just so it isn't in global namespace
func (ic *ItemComboChecker) generateComboKey(itemA int32, itemB int32) int64 {
	if itemA > itemB {
		return int64(itemA) + int64(itemB)<<4
	}
	return int64(itemB) + int64(itemA)<<4
}

type SubstitutionComboChecker map[string]struct{}

func (ic *SubstitutionComboChecker) HasCombo(replacements equipmentSubstitution) bool {
	key := replacements.CanonicalHash()
	if key == "" {
		// Invalid combo.
		return true
	}
	if _, ok := (*ic)[key]; ok {
		return true
	}
	(*ic)[key] = struct{}{}
	return false
}
