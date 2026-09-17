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

// Gara'jal's Voodoo Dolls lasts 71s and Banishment only fires when it expires, so a
// shorter encounter never reaches the downstairs phase that resolves the add units.
const shaEncounterDuration float64 = 60
const garajalEncounterDuration float64 = 300

// The encounter modal's copy button clones the Target proto verbatim (TargetsPicker.tsx),
// so a copy keeps the preset Id and gets a second instance of the same boss AI.
func encounterWithPresetTargets(t *testing.T, durationSeconds float64, presetTargetIDs ...int32) *proto.Encounter {
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
		Duration:             durationSeconds,
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

func runTankSim(t *testing.T, rsr *proto.RaidSimRequest) *proto.RaidSimResult {
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

func TestCopiedBossTargetGetsItsOwnTankAuras(t *testing.T) {
	rsr := tankRaidSimRequest(encounterWithPresetTargets(t, shaEncounterDuration, shaOfFearID, shaOfFearID))

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
		duration        float64
		presetTargetIDs []int32
	}{
		{name: "Sha of Fear", duration: shaEncounterDuration, presetTargetIDs: []int32{shaOfFearID}},
		{name: "Gara'jal the Spiritbinder", duration: garajalEncounterDuration, presetTargetIDs: []int32{garajalBossID, garajalAddID}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runTankSim(t, tankRaidSimRequest(encounterWithPresetTargets(t, tc.duration, tc.presetTargetIDs...)))
		})
	}
}

func tankSwapAuraLabels(targetLabel string) []string {
	return []string{"Banishment " + targetLabel, "Voodoo Dolls " + targetLabel}
}

// Copying Gara'jal appends a second boss to the target list. Every boss AI has to own
// the auras it registers on itself and on the tank, and has to resolve its adds by
// preset rather than by array position, or the copy re-registers on the original boss
// and treats the original boss as one of its own adds.
func TestCopiedGarajalBossGetsItsOwnAuras(t *testing.T) {
	rsr := tankRaidSimRequest(encounterWithPresetTargets(t, garajalEncounterDuration, garajalBossID, garajalAddID, garajalBossID))

	env, _, _ := core.NewEnvironment(rsr.Raid, rsr.Encounter, false, false)
	tank := env.Raid.Parties[0].Players[0].GetCharacter()
	bossUnits := []*core.Unit{env.Encounter.AllTargetUnits[0], env.Encounter.AllTargetUnits[2]}
	addUnit := env.Encounter.AllTargetUnits[1]

	if addUnit.GetAura("Frenzy") != nil {
		t.Fatal("The Severer of Souls add was given a Frenzy aura")
	}

	seenFrenzy := map[*core.Aura]bool{}
	seenTankAuras := map[*core.Aura]bool{}

	for _, bossUnit := range bossUnits {
		frenzy := bossUnit.GetAura("Frenzy")
		if frenzy == nil {
			t.Fatalf("%s has no Frenzy aura", bossUnit.Label)
		}
		if seenFrenzy[frenzy] {
			t.Fatalf("%s shares its Frenzy aura with the other boss", bossUnit.Label)
		}
		seenFrenzy[frenzy] = true

		for _, label := range tankSwapAuraLabels(bossUnit.Label) {
			aura := tank.GetAura(label)
			if aura == nil {
				t.Fatalf("Tank has no %q aura", label)
			}
			if seenTankAuras[aura] {
				t.Fatalf("Both Gara'jal targets share the tank aura %q", label)
			}
			seenTankAuras[aura] = true
		}
	}

	// The add only ever takes damage once Banishment sends the tank downstairs, so this
	// is what stops the add resolution above from being asserted on a sim that never
	// reaches the tank swap.
	result := runTankSim(t, rsr)
	if result.GetEncounterMetrics().GetTargets()[1].GetDtps().GetAvg() <= 0 {
		t.Fatal("The Severer of Souls add took no damage, so the tank never swapped downstairs")
	}
}

// The encounter modal also lets the add be deleted, which leaves the boss AI with an
// empty add list to hand the tank when Banishment fires.
func TestGarajalBossWithoutAddsStillRuns(t *testing.T) {
	runTankSim(t, tankRaidSimRequest(encounterWithPresetTargets(t, garajalEncounterDuration, garajalBossID)))
}

// Two copies of the boss with no add between them: neither boss may end up in the
// other's add list, which would banish the tank onto a boss that is being disabled.
func TestCopiedGarajalBossWithoutAddsStillRuns(t *testing.T) {
	runTankSim(t, tankRaidSimRequest(encounterWithPresetTargets(t, garajalEncounterDuration, garajalBossID, garajalBossID)))
}
