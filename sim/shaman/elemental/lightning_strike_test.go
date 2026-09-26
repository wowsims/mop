package elemental

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

// Chain Lightning hits several targets at once, so the T15 two-piece can cast Lightning Strike
// again while an earlier strike is still in flight. Every result the strikes calculate must be
// dealt exactly once.
func TestLightningStrikeRecastInFlightDealsEachStrike(t *testing.T) {
	gear := core.GetGearSet("../../../ui/specs/shaman/elemental/gear_sets", "simtest").GearSet
	gear.Items[proto.ItemSlot_ItemSlotChest] = &proto.ItemSpec{Id: 95320}
	gear.Items[proto.ItemSlot_ItemSlotHands] = &proto.ItemSpec{Id: 95321}

	player := core.WithSpec(&proto.Player{
		Class:              proto.Class_ClassShaman,
		Race:               proto.Race_RaceTroll,
		Equipment:          gear,
		TalentsString:      TalentsASEB,
		Glyphs:             StandardGlyphs,
		Rotation:           core.APLRotationFromJsonString(`{"type":"TypeAPL","priorityList":[{"action":{"castSpell":{"spellId":{"spellId":421}}}}]}`),
		DistanceFromTarget: 30,
	}, PlayerOptionsFireElemental)

	var targets []*proto.Target
	for range 6 {
		targets = append(targets, core.NewDefaultTarget())
	}
	result := core.RunRaidSim(&proto.RaidSimRequest{
		Raid:       core.SinglePlayerRaidProto(player, nil, nil, nil),
		Encounter:  &proto.Encounter{Duration: 120, Targets: targets},
		SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: 101, Debug: true},
	})
	if result.Error != nil {
		t.Fatalf("Sim failed: %s", result.Error.Message)
	}

	calculated := regexp.MustCompile(`(\[Target \d+\]) \{SpellID: 138146\} \[DEBUG\].*AfterOutcome:([\d.]+)`)
	dealt := regexp.MustCompile(`(\[Target \d+\]) \{SpellID: 138146\} \w+ for ([\d.]+) damage`)
	var calculatedDamage, dealtDamage []string
	for _, line := range strings.Split(result.Logs, "\n") {
		if m := calculated.FindStringSubmatch(line); m != nil {
			calculatedDamage = append(calculatedDamage, m[1]+" "+m[2])
		}
		if m := dealt.FindStringSubmatch(line); m != nil {
			damage, _ := strconv.ParseFloat(m[2], 64)
			dealtDamage = append(dealtDamage, fmt.Sprintf("%s %0.01f", m[1], damage))
		}
	}

	if len(calculatedDamage) == 0 {
		t.Fatalf("Expected the T15 two-piece to cast Lightning Strike")
	}
	slices.Sort(calculatedDamage)
	slices.Sort(dealtDamage)
	if !slices.Equal(calculatedDamage, dealtDamage) {
		t.Fatalf("Dealt Lightning Strike damage does not match the calculated strikes:\ncalculated: %v\ndealt:      %v", calculatedDamage, dealtDamage)
	}
}
