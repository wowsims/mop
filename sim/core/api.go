// Proto-based function interface for the simulator
package core

import (
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	"github.com/wowsims/mop/sim/core/stats"
)

/**
 * Returns character stats taking into account gear / buffs / consumes / etc
 */
func ComputeStats(csr *proto.ComputeStatsRequest) *proto.ComputeStatsResult {
	encounter := csr.Encounter
	if encounter == nil {
		encounter = &proto.Encounter{}
	}

	_, raidStats, encounterStats := NewEnvironment(csr.Raid, encounter, !csr.SkipRotation, csr.SkipRotation)

	return &proto.ComputeStatsResult{
		RaidStats:      raidStats,
		EncounterStats: encounterStats,
	}
}

// ComputeStatDependencies builds a character from the request and returns its finalized
// StatDependencyManager. This is lightweight compared to ComputeStats — it builds the
// character and resolves all stat dependencies, but does not run the simulation.
func ComputeStatDependencies(request *proto.ComputeStatsRequest) *stats.StatDependencyManager {
	_, sdm := ComputeStatsAndDeps(request)
	return sdm
}

// ComputeStatsAndDeps combines a skip-rotation ComputeStats with ComputeStatDependencies
// in a single NewEnvironment call. Use this when both are needed for the same raid to
// avoid building the character environment twice.
func ComputeStatsAndDeps(request *proto.ComputeStatsRequest) (*proto.ComputeStatsResult, *stats.StatDependencyManager) {
	encounter := request.Encounter
	if encounter == nil {
		encounter = &proto.Encounter{}
	}
	env, raidStats, encounterStats := NewEnvironment(request.Raid, encounter, false, true)
	result := &proto.ComputeStatsResult{
		RaidStats:      raidStats,
		EncounterStats: encounterStats,
	}
	if len(env.Raid.Parties) == 0 || len(env.Raid.Parties[0].Players) == 0 {
		return result, &stats.StatDependencyManager{}
	}
	character := env.Raid.Parties[0].Players[0].GetCharacter()
	// FillPlayerStats (called inside NewEnvironment) activates build-phase auras to
	// compute FinalStats, then clears them — leaving dynamic deps (e.g. Bear Form's
	// CritRating×1.5, Mark of the Wild's Agility×1.05, Stat Amplification's dynamic
	// multiplier) disabled. Re-apply Base/Gear/Buffs auras so those multiplicative
	// deps are active in the returned SDM. Talent deps used by the optimizer (e.g.
	// Heart of the Wild's Agility×1.06) are added as static deps rather than via
	// aura, so they don't need their phase re-activated here.
	character.applyBuildPhaseAuras(CharacterBuildPhaseBase | CharacterBuildPhaseGear | CharacterBuildPhaseBuffs)
	sdm := character.StatDependencyManager
	return result, &sdm
}

/**
 * Returns stat weights and EP values, with standard deviations, for all stats.
 */
func StatWeights(request *proto.StatWeightsRequest) *proto.StatWeightsResult {
	return runStatWeights(request, nil, simsignals.CreateSignals())
}

func StatWeightsAsync(request *proto.StatWeightsRequest, progress chan *proto.ProgressMetrics, requestId string) {
	signals, err := simsignals.RegisterWithId(requestId)
	if err != nil {
		progress <- &proto.ProgressMetrics{
			FinalWeightResult: &proto.StatWeightsResult{
				Error: &proto.ErrorOutcome{
					Message: "Couldn't register for signal API: " + err.Error(),
				},
			},
		}
		return
	}
	go func() {
		defer simsignals.UnregisterId(requestId)
		result := runStatWeights(request, progress, signals)
		progress <- &proto.ProgressMetrics{
			FinalWeightResult: result,
		}
	}()
}

// Get data for all requests needed for stat weights.
func StatWeightRequests(request *proto.StatWeightsRequest) *proto.StatWeightRequestsData {
	return buildStatWeightRequests(request)
}

func StatWeightCompute(request *proto.StatWeightsCalcRequest) *proto.StatWeightsResult {
	return computeStatWeights(request)
}

/**
 * Runs multiple iterations of the sim with a full raid.
 */
func RunRaidSim(request *proto.RaidSimRequest) *proto.RaidSimResult {
	return RunSim(request, nil, simsignals.CreateSignals())
}

func RunRaidSimAsync(request *proto.RaidSimRequest, progress chan *proto.ProgressMetrics, requestId string) {
	signals, err := simsignals.RegisterWithId(requestId)
	if err != nil {
		progress <- &proto.ProgressMetrics{
			FinalRaidResult: &proto.RaidSimResult{
				Error: &proto.ErrorOutcome{
					Message: "Couldn't register for signal API: " + err.Error(),
				},
			},
		}
		return
	}
	go func() {
		defer simsignals.UnregisterId(requestId)
		RunSim(request, progress, signals)
	}()
}

// Threading does not work in WASM!
func RunRaidSimConcurrent(request *proto.RaidSimRequest) *proto.RaidSimResult {
	return runSimConcurrent(request, nil, simsignals.CreateSignals())
}

// Threading does not work in WASM!
// Exposed for internal packages that need concurrent sim execution with
// externally managed progress and abort signals.
func RunRaidSimConcurrentWithSignals(request *proto.RaidSimRequest, progress chan *proto.ProgressMetrics, signals simsignals.Signals) *proto.RaidSimResult {
	return runSimConcurrent(request, progress, signals)
}

// Threading does not work in WASM!
func RunRaidSimConcurrentAsync(request *proto.RaidSimRequest, progress chan *proto.ProgressMetrics, requestId string) {
	signals, err := simsignals.RegisterWithId(requestId)
	if err != nil {
		progress <- &proto.ProgressMetrics{
			FinalRaidResult: &proto.RaidSimResult{
				Error: &proto.ErrorOutcome{
					Message: "Couldn't register for signal API: " + err.Error(),
				},
			},
		}
		return
	}
	go func() {
		defer simsignals.UnregisterId(requestId)
		runSimConcurrent(request, progress, signals)
	}()
}

var runningInWasm = false

func SetRunningInWasm() {
	runningInWasm = true
}

func IsRunningInWasm() bool {
	return runningInWasm
}
