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
	var generators []core.TestGenerator
	for _, gearSet := range []string{"preraid", "p5"} {
		player := core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassPriest,
				Race:          proto.Race_RaceUndead,
				Equipment:     core.GetGearSet("../../../ui/priest/discipline/gear_sets", gearSet).GearSet,
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: StandardTalents,
				Glyphs:        StandardGlyphs,
				Profession1:   proto.Profession_Engineering,
				Rotation:      &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
				Profession2:   proto.Profession_Tailoring,
			},
			PlayerOptions,
		)
		generators = append(generators, &core.SingleCharacterStatsTestGenerator{
			Name: gearSet,
			Request: &proto.ComputeStatsRequest{
				Raid: core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs),
			},
		})
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
