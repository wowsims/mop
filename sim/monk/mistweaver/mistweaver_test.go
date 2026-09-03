package mistweaver

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterMistweaverMonk()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered.
func TestMistweaverMonk(t *testing.T) {
	var generators []core.TestGenerator
	for _, gearSet := range []string{"preraid", "p5"} {
		player := core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassMonk,
				Race:          proto.Race_RaceHordePandaren,
				Equipment:     core.GetGearSet("../../../ui/monk/mistweaver/gear_sets", gearSet).GearSet,
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: StandardTalents,
				Glyphs:        StandardGlyphs,
				Profession1:   proto.Profession_Engineering,
				Profession2:   proto.Profession_Blacksmithing,
			},
			PlayerOptions,
		)
		generators = append(generators, &core.SingleCharacterStatsTestGenerator{
			Name: gearSet,
			Request: &proto.ComputeStatsRequest{
				Raid:         core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs),
				SkipRotation: true,
			},
		})
	}
	core.RunTestSuite(t, t.Name(), generators)
}

var StandardTalents = "213312"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.MonkMajorGlyph_GlyphOfManaTea),
	Major2: int32(proto.MonkMajorGlyph_GlyphOfRenewingMists),
	Major3: int32(proto.MonkMajorGlyph_GlyphOfSurgingMist),
}

var FullConsumes = &proto.ConsumesSpec{
	FlaskId: 76085, // Flask of the Warm Sun
	FoodId:  74650, // Mogu Fish Stew
	PotId:   76093, // Potion of the Jade Serpent
}

var PlayerOptions = &proto.Player_MistweaverMonk{
	MistweaverMonk: &proto.MistweaverMonk{
		Options: &proto.MistweaverMonk_Options{
			ClassOptions: &proto.MonkOptions{},
		},
	},
}
