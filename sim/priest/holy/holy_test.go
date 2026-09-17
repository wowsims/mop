package holy

import (
	"testing"

	_ "github.com/wowsims/mop/sim/common" // imported to get item effects included.
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func init() {
	RegisterHolyPriest()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered. The empty APL
// rotation and the fake prepull (no SkipRotation) make it exercise a full environment reset, the
// path the UI's stats request takes.
func TestHolyPriest(t *testing.T) {
	newPlayer := func(gearSetDir string, gearSet string, glyphs *proto.Glyphs) *proto.Player {
		return core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassPriest,
				Race:          proto.Race_RaceUndead,
				Equipment:     core.GetGearSet(gearSetDir, gearSet).GearSet,
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: StandardTalents,
				Glyphs:        glyphs,
				Profession1:   proto.Profession_Engineering,
				Profession2:   proto.Profession_Enchanting,
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
		statsTest("preraid", newPlayer("../../../ui/specs/priest/holy/gear_sets", "preraid", StandardGlyphs)),
		statsTest("p5", newPlayer("../../../ui/specs/priest/holy/gear_sets", "p5", StandardGlyphs)),
		// Shadow's tier items are shared cloth: the set bonuses must not touch Shadow-only state
		// (the T16 4pc hooks the Shadow Orb bar) when a healer wears them.
		statsTest("p5-shadow-tier", newPlayer("../../../ui/specs/priest/shadow/gear_sets", "p5", StandardGlyphs)),
		// Glyph of Inner Fire: the armor gained from Inner Fire is 90% instead of 60%.
		statsTest("p5-glyph-of-inner-fire", newPlayer("../../../ui/specs/priest/holy/gear_sets", "p5", InnerFireGlyphs)),
	}
	core.RunTestSuite(t, t.Name(), generators)
}

var StandardTalents = "122112"
var StandardGlyphs = &proto.Glyphs{
	Major1: int32(proto.PriestMajorGlyph_GlyphOfRenew),
	Major2: int32(proto.PriestMajorGlyph_GlyphOfPrayerOfMending),
	Major3: int32(proto.PriestMajorGlyph_GlyphOfCircleOfHealing),
}

var InnerFireGlyphs = &proto.Glyphs{
	Major1: int32(proto.PriestMajorGlyph_GlyphOfInnerFire),
	Major2: int32(proto.PriestMajorGlyph_GlyphOfPrayerOfMending),
	Major3: int32(proto.PriestMajorGlyph_GlyphOfCircleOfHealing),
}

var FullConsumes = &proto.ConsumesSpec{
	FlaskId: 76085, // Flask of the Warm Sun
	FoodId:  74650, // Mogu Fish Stew
	PotId:   76093, // Potion of the Jade Serpent
}

var PlayerOptions = &proto.Player_HolyPriest{
	HolyPriest: &proto.HolyPriest{
		Options: &proto.HolyPriest_Options{
			ClassOptions: &proto.PriestOptions{
				Armor: proto.PriestOptions_InnerFire,
			},
		},
	},
}
