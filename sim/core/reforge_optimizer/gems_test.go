package reforgeoptimizer

import (
	"slices"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func TestGemMatchesSocketSecondaryColors(t *testing.T) {
	testCases := []struct {
		name        string
		gemColor    proto.GemColor
		socketColor proto.GemColor
		want        bool
	}{
		{name: "orange matches red", gemColor: proto.GemColor_GemColorOrange, socketColor: proto.GemColor_GemColorRed, want: true},
		{name: "orange matches yellow", gemColor: proto.GemColor_GemColorOrange, socketColor: proto.GemColor_GemColorYellow, want: true},
		{name: "purple matches red", gemColor: proto.GemColor_GemColorPurple, socketColor: proto.GemColor_GemColorRed, want: true},
		{name: "purple matches blue", gemColor: proto.GemColor_GemColorPurple, socketColor: proto.GemColor_GemColorBlue, want: true},
		{name: "green matches yellow", gemColor: proto.GemColor_GemColorGreen, socketColor: proto.GemColor_GemColorYellow, want: true},
		{name: "green matches blue", gemColor: proto.GemColor_GemColorGreen, socketColor: proto.GemColor_GemColorBlue, want: true},
		{name: "orange does not match blue", gemColor: proto.GemColor_GemColorOrange, socketColor: proto.GemColor_GemColorBlue, want: false},
		{name: "red matches prismatic", gemColor: proto.GemColor_GemColorRed, socketColor: proto.GemColor_GemColorPrismatic, want: true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := gemMatchesSocket(testCase.gemColor, testCase.socketColor); got != testCase.want {
				t.Fatalf("gemMatchesSocket(%s, %s) = %t, want %t", testCase.gemColor, testCase.socketColor, got, testCase.want)
			}
		})
	}
}

func TestBuildReforgeGemOptionsFiltersAndPreservesMetadata(t *testing.T) {
	weights := core.NewUnitStats()
	weights.Stats[stats.Intellect] = 1
	weights.Stats[stats.MasteryRating] = 0.5
	weights = setUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent), 100)

	request := &proto.ReforgeOptimizeRequest{
		Settings: &proto.ReforgeSettings{IncludeGems: true},
		GemOptions: []*proto.UIGem{
			uiGem(101, "Brilliant Primordial Ruby", proto.GemColor_GemColorRed, stats.Intellect, 160, proto.Profession_ProfessionUnknown, true),
			uiGem(102, "Rigid River's Heart", proto.GemColor_GemColorBlue, stats.HitRating, 320, proto.Profession_ProfessionUnknown, false),
			uiGem(103, "Fractured Serpent's Eye", proto.GemColor_GemColorYellow, stats.MasteryRating, 320, proto.Profession_Jewelcrafting, false),
			uiGem(104, "Perfect Brilliant Pandarian Garnet", proto.GemColor_GemColorRed, stats.Intellect, 80, proto.Profession_ProfessionUnknown, false),
			uiGem(105, "Brilliant Serpent's Eye", proto.GemColor_GemColorRed, stats.Intellect, 320, proto.Profession_Jewelcrafting, false),
		},
	}
	player := &proto.Player{
		Profession1: proto.Profession_Jewelcrafting,
		Spec:        &proto.Player_ShadowPriest{},
	}

	options := buildReforgeGemOptions(request, player, weights, nil, nil, 1, false, playerIsHybridCaster(player))
	if _, ok := findGemOption(options, 102); ok {
		t.Fatalf("expected hybrid caster hit gem to be filtered")
	}
	if _, ok := findGemOption(options, 103); ok {
		t.Fatalf("expected non-primary JC gem to be filtered for non-tank specs")
	}
	if _, ok := findGemOption(options, 104); ok {
		t.Fatalf("expected perfect gem to be filtered")
	}
	if option, ok := findGemOption(options, 101); !ok || !option.unique {
		t.Fatalf("expected unique normal gem metadata to be preserved, got %#v", option)
	}
	if option, ok := findGemOption(options, 105); !ok || !option.isJewelcrafting {
		t.Fatalf("expected primary-stat JC gem metadata to be preserved, got %#v", option)
	}
}

func TestPreferHitOverExpertiseReforgesFiltersSameSourceExpertise(t *testing.T) {
	hasteToExpertise := int32(-101)
	hasteToHit := int32(-102)
	critToExpertise := int32(-103)
	installTestReforges(t,
		core.ReforgeStat{ID: hasteToExpertise, FromStat: proto.Stat_StatHasteRating, ToStat: proto.Stat_StatExpertiseRating},
		core.ReforgeStat{ID: hasteToHit, FromStat: proto.Stat_StatHasteRating, ToStat: proto.Stat_StatHitRating},
		core.ReforgeStat{ID: critToExpertise, FromStat: proto.Stat_StatCritRating, ToStat: proto.Stat_StatExpertiseRating},
	)

	filtered := preferHitOverExpertiseReforges([]int32{0, hasteToExpertise, hasteToHit, critToExpertise})

	if hasReforgeID(filtered, hasteToExpertise) {
		t.Fatalf("expected Haste->Expertise to be filtered when Haste->Hit exists, got %v", filtered)
	}
	if !hasReforgeID(filtered, hasteToHit) || !hasReforgeID(filtered, critToExpertise) {
		t.Fatalf("expected Hit alternative and non-duplicate Expertise to remain, got %v", filtered)
	}
}

func TestPreferHitOverExpertiseReforgesKeepsExpertiseWithoutHitAlternative(t *testing.T) {
	hasteToExpertise := int32(-201)
	critToHit := int32(-202)
	installTestReforges(t,
		core.ReforgeStat{ID: hasteToExpertise, FromStat: proto.Stat_StatHasteRating, ToStat: proto.Stat_StatExpertiseRating},
		core.ReforgeStat{ID: critToHit, FromStat: proto.Stat_StatCritRating, ToStat: proto.Stat_StatHitRating},
	)

	filtered := preferHitOverExpertiseReforges([]int32{0, hasteToExpertise, critToHit})

	if !hasReforgeID(filtered, hasteToExpertise) {
		t.Fatalf("expected Haste->Expertise to remain when Haste->Hit is unavailable, got %v", filtered)
	}
}

func installTestReforges(t *testing.T, reforges ...core.ReforgeStat) {
	t.Helper()
	originals := make(map[int32]core.ReforgeStat, len(reforges))
	existed := make(map[int32]bool, len(reforges))
	for _, reforge := range reforges {
		original, ok := core.ReforgeStatsByID[reforge.ID]
		originals[reforge.ID] = original
		existed[reforge.ID] = ok
		core.ReforgeStatsByID[reforge.ID] = reforge
	}
	t.Cleanup(func() {
		for _, reforge := range reforges {
			if existed[reforge.ID] {
				core.ReforgeStatsByID[reforge.ID] = originals[reforge.ID]
			} else {
				delete(core.ReforgeStatsByID, reforge.ID)
			}
		}
	})
}

func hasReforgeID(reforgeIDs []int32, reforgeID int32) bool {
	return slices.Contains(reforgeIDs, reforgeID)
}

func findGemOption(options map[proto.GemColor][]reforgeGemOption, id int32) (reforgeGemOption, bool) {
	for _, colorOptions := range options {
		for _, option := range colorOptions {
			if option.id == id {
				return option, true
			}
		}
	}
	return reforgeGemOption{}, false
}

func uiGem(id int32, name string, color proto.GemColor, stat stats.Stat, value float64, requiredProfession proto.Profession, unique bool) *proto.UIGem {
	gemStats := make([]float64, int(stats.ProtoStatsLen))
	gemStats[stat] = value
	return &proto.UIGem{Id: id, Name: name, Color: color, Stats: gemStats, RequiredProfession: requiredProfession, Unique: unique}
}
