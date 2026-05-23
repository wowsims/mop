package reforgeoptimizer

import (
	"math"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func BenchmarkForEachGemOptionForSocket(b *testing.B) {
	gemOptions := map[proto.GemColor][]reforgeGemOption{
		proto.GemColor_GemColorRed: {
			{id: 1, color: proto.GemColor_GemColorRed},
			{id: 2, color: proto.GemColor_GemColorOrange},
			{id: 3, color: proto.GemColor_GemColorPurple},
		},
		proto.GemColor_GemColorPrismatic: {
			{id: 1, color: proto.GemColor_GemColorRed},
			{id: 4, color: proto.GemColor_GemColorPrismatic},
			{id: 5, color: proto.GemColor_GemColorGreen},
		},
	}

	b.ReportAllocs()
	for b.Loop() {
		count := 0
		forEachGemOptionForSocket(gemOptions, proto.GemColor_GemColorRed, false, func(reforgeGemOption) {
			count++
		})
		if count != 5 {
			b.Fatalf("gem option count = %d, want 5", count)
		}
	}
}

func BenchmarkBuildChoiceMIPModel(b *testing.B) {
	search := benchmarkReforgeSearchState()
	statConstraints := []mipStatConstraint{
		{unitStat: stats.UnitStatFromStat(stats.HitRating), lower: 150, upper: math.Inf(1), actualLower: 150, hasActualLower: true},
		{unitStat: stats.UnitStatFromStat(stats.HasteRating), lower: math.Inf(-1), upper: 320, actualUpper: 320, hasActualUpper: true},
	}

	b.ReportAllocs()
	for b.Loop() {
		model := buildChoiceMIPModel(search, search.weights, statConstraints, search.relativeCaps)
		if len(model.variables) == 0 || len(model.constraints) == 0 {
			b.Fatalf("empty model: vars=%d constraints=%d", len(model.variables), len(model.constraints))
		}
	}
}

func benchmarkReforgeSearchState() *reforgeSearchState {
	weights := core.NewUnitStats()
	weights.Stats[stats.CritRating] = 1.6
	weights.Stats[stats.HasteRating] = 1.4
	weights.Stats[stats.MasteryRating] = 1.5
	weights.Stats[stats.HitRating] = 2.2

	slots := make([]reforgeSlotChoices, 0, 16)
	for slotIdx := 0; slotIdx < 16; slotIdx++ {
		choices := make([]reforgeChoice, 0, 10)
		for choiceIdx := 0; choiceIdx < 10; choiceIdx++ {
			delta := core.NewUnitStats()
			delta.Stats[stats.CritRating] = float64(choiceIdx*7 - slotIdx)
			delta.Stats[stats.HasteRating] = float64(slotIdx*5 - choiceIdx)
			delta.Stats[stats.MasteryRating] = float64(choiceIdx*3 + slotIdx)
			delta.Stats[stats.HitRating] = float64(choiceIdx * 4)
			choice := reforgeChoice{slot: proto.ItemSlot(slotIdx), hasReforge: true, reforgeID: int32(113 + choiceIdx), delta: delta, objectiveDelta: delta}
			if choiceIdx%4 == 0 {
				choice.gems = []reforgeGemChoice{{socketIdx: 0, gemID: int32(76000 + choiceIdx)}}
				choice.jewelcraftingGems = choiceIdx % 2
			}
			if choiceIdx == 7 {
				choice.uniqueGemIDs = []int32{77000 + int32(slotIdx%2)}
			}
			choices = append(choices, choice)
		}
		slots = append(slots, reforgeSlotChoices{slot: proto.ItemSlot(slotIdx), choices: choices})
	}

	return &reforgeSearchState{
		request: &proto.ReforgeOptimizeRequest{Settings: &proto.ReforgeSettings{}},
		slots:   slots,
		weights: weights,
		relativeCaps: []reforgeRelativeStatCap{
			{forcedStat: stats.UnitStatFromStat(stats.MasteryRating), constrainedStat: stats.UnitStatFromStat(stats.CritRating), minDelta: 1, actualMinDelta: 1, adjustWeight: true},
			{forcedStat: stats.UnitStatFromStat(stats.MasteryRating), constrainedStat: stats.UnitStatFromStat(stats.HasteRating), minDelta: 1, actualMinDelta: 1, adjustWeight: true},
		},
	}
}
