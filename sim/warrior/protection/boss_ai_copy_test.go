package protection

import (
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	googleProto "google.golang.org/protobuf/proto"
)

const shaOfFearID int32 = 60999
const garajalBossID int32 = 60143
const garajalAddID int32 = 66992

// The encounter modal's copy button clones the Target proto verbatim (TargetsPicker.tsx),
// so a copy keeps the preset Id and gets a second instance of the same boss AI.
func encounterWithPresetTargets(t *testing.T, presetTargetIDs ...int32) *proto.Encounter {
	t.Helper()

	targets := make([]*proto.Target, len(presetTargetIDs))

	for i, presetTargetID := range presetTargetIDs {
		preset := core.GetPresetTargetWithID(presetTargetID)
		if preset == nil {
			t.Fatalf("No preset target with ID %d", presetTargetID)
		}
		targets[i] = googleProto.Clone(preset.Config).(*proto.Target)
	}

	return &proto.Encounter{
		Duration:             60,
		ExecuteProportion_20: 0.2,
		ExecuteProportion_25: 0.25,
		ExecuteProportion_35: 0.35,
		Targets:              targets,
	}
}

func tankRaidSimRequest(encounter *proto.Encounter) *proto.RaidSimRequest {
	return &proto.RaidSimRequest{
		Raid: &proto.Raid{
			Parties: []*proto.Party{
				{
					Players: []*proto.Player{
						{
							Name:          "Tank",
							Race:          proto.Race_RaceOrc,
							Class:         proto.Class_ClassWarrior,
							TalentsString: DefaultTalents,
							Glyphs:        DefaultGlyphs,
							Spec:          PlayerOptionsBasic,
							Consumables:   FullConsumesSpec,
							Equipment:     core.GetGearSet("../../../ui/specs/warrior/protection/gear_sets", "p5_bis").GearSet,
							Rotation:      core.GetAplRotation("../../../ui/specs/warrior/protection/apls", "default").Rotation,
						},
					},
				},
			},
			Tanks: []*proto.UnitReference{
				{Type: proto.UnitReference_Player, Index: 0},
			},
		},
		Encounter: encounter,
		SimOptions: &proto.SimOptions{
			Iterations: 1,
			IsTest:     true,
			RandomSeed: 1,
		},
	}
}

func runTankSim(t *testing.T, rsr *proto.RaidSimRequest) {
	t.Helper()

	result := core.RunRaidSim(rsr)
	if result.GetError() != nil {
		t.Fatalf("Sim failed: %s", result.GetError().GetMessage())
	}
	if result.GetRaidMetrics().GetDps().GetAvg() <= 0 {
		t.Fatal("Sim produced no raid damage")
	}
}

func TestCopiedBossTargetGetsItsOwnTankAuras(t *testing.T) {
	rsr := tankRaidSimRequest(encounterWithPresetTargets(t, shaOfFearID, shaOfFearID))

	env, _, _ := core.NewEnvironment(rsr.Raid, rsr.Encounter, false, false)
	tank := env.Raid.Parties[0].Players[0].GetCharacter()
	seen := map[*core.Aura]bool{}

	for _, target := range env.Encounter.AllTargets {
		aura := tank.GetAura("Naked and Afraid " + target.Label)
		if aura == nil {
			t.Fatalf("Tank has no Naked and Afraid aura for %s", target.Label)
		}
		if seen[aura] {
			t.Fatal("Both Sha targets share a single Naked and Afraid aura on the tank")
		}
		seen[aura] = true
	}

	runTankSim(t, rsr)
}

func TestPresetTankSwapEncountersStillRun(t *testing.T) {
	for _, tc := range []struct {
		name            string
		presetTargetIDs []int32
	}{
		{name: "Sha of Fear", presetTargetIDs: []int32{shaOfFearID}},
		{name: "Gara'jal the Spiritbinder", presetTargetIDs: []int32{garajalBossID, garajalAddID}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runTankSim(t, tankRaidSimRequest(encounterWithPresetTargets(t, tc.presetTargetIDs...)))
		})
	}
}
