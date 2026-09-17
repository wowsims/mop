package encounters

import (
	"os"
	"testing"

	"github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/warrior/protection"
	"google.golang.org/protobuf/encoding/protojson"
	googleProto "google.golang.org/protobuf/proto"
)

// The Dynamic Adds presets are only registered by this package's init, and a test package
// that registers every preset cannot live next to the tank suites: pulling this package
// into sim/warrior/protection would also register the Iron Juggernaut AI, which that
// suite's iron_juggernaut_default fixture was generated without.
func init() {
	protection.RegisterProtectionWarrior()
	common.RegisterAllEffects()
}

// The preset add spawns after 10s and stays up for 20s, so a 60s encounter covers two
// full spawn cycles and the add provably takes damage.
const dynamicAddsEncounterDuration float64 = 60

// The encounter modal's copy button clones the Target proto verbatim (TargetsPicker.tsx),
// so a copy keeps the preset Id and gets a second instance of the same boss AI.
func dynamicAddsSimRequest(t *testing.T, presetTargetIDs ...int32) *proto.RaidSimRequest {
	t.Helper()

	data, err := os.ReadFile("../../ui/specs/warrior/protection/builds/iron_juggernaut_default.build.json")
	if err != nil {
		t.Fatalf("Failed to read the tank build: %s", err)
	}

	settings := &proto.IndividualSimSettings{}
	if err := protojson.Unmarshal(data, settings); err != nil {
		t.Fatalf("Failed to parse the tank build: %s", err)
	}

	targets := make([]*proto.Target, len(presetTargetIDs))

	for i, presetTargetID := range presetTargetIDs {
		preset := core.GetPresetTargetWithID(presetTargetID)
		if preset == nil {
			t.Fatalf("No preset target with ID %d", presetTargetID)
		}
		targets[i] = googleProto.Clone(preset.Config).(*proto.Target)
	}

	return &proto.RaidSimRequest{
		Raid: &proto.Raid{
			Parties: []*proto.Party{
				{Players: []*proto.Player{settings.Player}},
			},
			Tanks: settings.Tanks,
		},
		Encounter: &proto.Encounter{
			Duration:             dynamicAddsEncounterDuration,
			ExecuteProportion_20: 0.2,
			ExecuteProportion_25: 0.25,
			ExecuteProportion_35: 0.35,
			Targets:              targets,
		},
		SimOptions: &proto.SimOptions{
			Iterations: 1,
			IsTest:     true,
			RandomSeed: 1,
		},
	}
}

func runDynamicAddsSim(t *testing.T, rsr *proto.RaidSimRequest) *proto.RaidSimResult {
	t.Helper()

	result := core.RunRaidSim(rsr)
	if result.GetError() != nil {
		t.Fatalf("Sim failed: %s", result.GetError().GetMessage())
	}
	if result.GetRaidMetrics().GetDps().GetAvg() <= 0 {
		t.Fatal("Sim produced no raid damage")
	}

	return result
}

// Copying the Dynamic Boss appends a second boss to the target list. Each boss AI has to
// resolve itself and its adds by preset rather than by array position, or the copy takes
// the original boss for itself and finds itself sitting in its own add list, where it is
// disabled and respawned on the add cycle.
func TestCopiedDynamicBossResolvesItsAddsByPreset(t *testing.T) {
	rsr := dynamicAddsSimRequest(t, dynamicBossID, dynamicAddID, dynamicBossID)

	env, _, _ := core.NewEnvironment(rsr.Raid, rsr.Encounter, false, false)
	addUnit := env.Encounter.AllTargetUnits[1]

	for _, targetIndex := range []int32{0, 2} {
		target := env.Encounter.AllTargets[targetIndex]
		ai, isDynamic := target.AI.(*DynamicAddsAI)
		if !isDynamic {
			t.Fatalf("%s was not given a DynamicAddsAI", target.Label)
		}
		if ai.BossUnit != &target.Unit {
			t.Fatalf("%s resolved its boss unit to %s", target.Label, ai.BossUnit.Label)
		}
		if len(ai.AddUnits) != 1 || ai.AddUnits[0] != addUnit {
			t.Fatalf("%s did not resolve the single Dynamic Add as its only add", target.Label)
		}
	}

	// The add is disabled until the boss spawns it, so it only takes damage if the spawn
	// actually ran. This is what stops the resolution above from being asserted on a sim
	// that never reached the spawn.
	result := runDynamicAddsSim(t, rsr)
	if result.GetEncounterMetrics().GetTargets()[1].GetDtps().GetAvg() <= 0 {
		t.Fatal("The Dynamic Add took no damage, so it was never spawned")
	}
}

// The encounter modal also lets either preset be deleted, which used to leave the AI
// indexing an empty add list while it was still initializing.
func TestDynamicAddsEncountersStillRun(t *testing.T) {
	for _, tc := range []struct {
		name            string
		presetTargetIDs []int32
	}{
		{name: "Boss and add", presetTargetIDs: []int32{dynamicBossID, dynamicAddID}},
		{name: "Boss without adds", presetTargetIDs: []int32{dynamicBossID}},
		{name: "Add without a boss", presetTargetIDs: []int32{dynamicAddID}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runDynamicAddsSim(t, dynamicAddsSimRequest(t, tc.presetTargetIDs...))
		})
	}
}
