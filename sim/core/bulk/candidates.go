package bulk

import (
	"fmt"
	"sync"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// Bulk candidate/count generation temporarily mutates the shared core item database
// using request-scoped SimDatabase payloads. Keep that mutation + generation path
// serialized to avoid concurrent map read/write panics with parallel sim requests.
var bulkCandidateDatabaseMu sync.Mutex

func EnsureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	bulkCandidateDatabaseMu.Lock()
	defer bulkCandidateDatabaseMu.Unlock()

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
	bulkCandidateDatabaseMu.Lock()
	defer bulkCandidateDatabaseMu.Unlock()

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
		scratchCounts := make([]int, len(matcher.baseCounts))
		for comboIdx := 0; comboIdx < rawCombinations; comboIdx++ {
			if generator.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher, scratchCounts) {
				matchingCombinations++
			}
		}
	}

	return &proto.BulkCombinationCountResult{
		RawCombinations:  int32(rawCombinations),
		Combinations:     int32(matchingCombinations),
		Iterations:       estimateIterationsForCountRequest(request.GetBulkSettings(), matchingCombinations),
		UseLegacyBulkSim: shouldUseLegacyBulkSimForCountRequest(request.GetBulkSettings(), matchingCombinations),
	}
}

func estimateIterationsForCountRequest(settings *proto.BulkSettings, candidateCount int) float64 {
	iterations, _ := estimateBulkSimIterations(settings, settings.GetIterationsPerCombo(), candidateCount)
	return float64(iterations)
}

func shouldUseLegacyBulkSimForCountRequest(settings *proto.BulkSettings, candidateCount int) bool {
	useLegacyBulkSim := shouldUseLegacyBulkSim(settings, settings.GetIterationsPerCombo(), candidateCount)
	return useLegacyBulkSim
}

func BulkCandidates(request *proto.BulkCandidatesRequest) *proto.BulkCandidatesResult {
	bulkCandidateDatabaseMu.Lock()
	defer bulkCandidateDatabaseMu.Unlock()

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
