package discipline

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterDisciplinePriest()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered. The empty APL
// rotation and the fake prepull (no SkipRotation) make it exercise a full environment reset, the
// path the UI's stats request takes.
func TestDisciplinePriest(t *testing.T) {
	newPlayer := func(gearSetDir string, gearSet string) *proto.Player {
		return core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassPriest,
				Race:          proto.Race_RaceUndead,
				Equipment:     core.GetGearSet(gearSetDir, gearSet).GearSet,
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: StandardTalents,
				Glyphs:        StandardGlyphs,
				Profession1:   proto.Profession_Engineering,
				Profession2:   proto.Profession_Leatherworking,
				Rotation:      &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			},
			PlayerOptions,
		)
	}
	statsTest := func(name string, player *proto.Player) core.TestGenerator {
		return &core.SingleCharacterStatsTestGenerator{
			Name: name,
			Request: &proto.ComputeStatsRequest{
				Raid: core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs),
			},
		}
	}

	generators := []core.TestGenerator{
		statsTest("preraid", newPlayer("../../../ui/specs/priest/discipline/gear_sets", "preraid")),
		statsTest("p5", newPlayer("../../../ui/specs/priest/discipline/gear_sets", "p5")),
		// Shadow's tier items are shared cloth: the set bonuses must not touch Shadow-only state
		// (the T16 4pc hooks the Shadow Orb bar) when a healer wears them.
		statsTest("p5-shadow-tier", newPlayer("../../../ui/specs/priest/shadow/gear_sets", "p5")),
	}
	core.RunTestSuite(t, t.Name(), generators)
}

var StandardTalents = "113113"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.PriestMajorGlyph_GlyphOfPenance),
	Major2: int32(proto.PriestMajorGlyph_GlyphOfPowerWordShield),
	Major3: int32(proto.PriestMajorGlyph_GlyphOfHolyFire),
}

var FullConsumes = &proto.ConsumesSpec{
	FlaskId: 76085, // Flask of the Warm Sun
	FoodId:  74650, // Mogu Fish Stew
	PotId:   76093, // Potion of the Jade Serpent
}

var PlayerOptions = &proto.Player_DisciplinePriest{
	DisciplinePriest: &proto.DisciplinePriest{
		Options: &proto.DisciplinePriest_Options{
			ClassOptions: &proto.PriestOptions{
				Armor: proto.PriestOptions_InnerFire,
			},
		},
	},
}
