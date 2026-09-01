package bulk

import (
	"fmt"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// newGeneratorFromRequest validates the shared preconditions of every bulk entry point (player
// present, equipment present), registers the request's database items, and builds the candidate
// generator. Callers map the returned error into their own result type.
func newGeneratorFromRequest(request *proto.BulkSimRequest) (*bulkSimCandidateGenerator, error) {
	player, playerErr := getPlayer(request)
	if playerErr != nil {
		return nil, playerErr
	}
	if player.GetEquipment() == nil {
		return nil, fmt.Errorf("bulk sim request is missing player equipment")
	}
	if player.GetDatabase() != nil {
		// Safe to run unserialized: core guards the shared database itself, so generation
		// (minutes, for a large selection) does not block other bulk requests.
		core.AddToDatabase(player.GetDatabase())
	}
	return newBulkSimCandidateGenerator(request, player)
}

func EnsureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	if request == nil || request.GetBulkSettings() == nil || len(request.GetCandidates()) > 0 {
		return nil
	}
	if request.GetBaseRequest() == nil || request.GetBaseRequest().GetRaid() == nil {
		return fmt.Errorf("bulk sim request is missing base raid")
	}
	generator, buildErr := newGeneratorFromRequest(request)
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
	generator, err := newGeneratorFromRequest(bulkRequest)
	if err != nil {
		return &proto.BulkCombinationCountResult{Error: &proto.ErrorOutcome{Message: err.Error()}}
	}

	rawCombinations := generator.rawCombinationsCount()
	matchingCombinations := rawCombinations
	if matcher := generator.buildRequiredSetBonusMatcher(generator.settings.GetRequiredSetBonuses()); matcher != nil {
		counted, ok := matcher.countMatchingCombos()
		if !ok {
			counted = generator.scanMatchingCombos(rawCombinations, matcher)
		}
		matchingCombinations = counted
	}

	return &proto.BulkCombinationCountResult{
		RawCombinations:  int32(rawCombinations),
		Combinations:     int32(matchingCombinations),
		Iterations:       estimateIterationsForCountRequest(request.GetBulkSettings(), matchingCombinations),
		UseLegacyBulkSim: shouldUseLegacyBulkSim(request.GetBulkSettings(), request.GetBulkSettings().GetIterationsPerCombo(), matchingCombinations),
	}
}

func (generator *bulkSimCandidateGenerator) scanMatchingCombos(rawCombinations int, matcher *bulkSimRequiredSetBonusComboMatcher) int {
	matching := 0
	scratchCounts := make([]int, len(matcher.baseCounts))
	for comboIdx := range rawCombinations {
		if generator.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher, scratchCounts) {
			matching++
		}
	}
	return matching
}

func estimateIterationsForCountRequest(settings *proto.BulkSettings, candidateCount int) float64 {
	iterations, _ := estimateBulkSimIterations(settings, settings.GetIterationsPerCombo(), candidateCount)
	return float64(iterations)
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
	generator, err := newGeneratorFromRequest(bulkRequest)
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
