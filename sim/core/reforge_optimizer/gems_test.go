package reforgeoptimizer

import (
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
		GemOptions: []*proto.ReforgeGemOption{
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

func TestClearGemsPreservesHeadMetaSocket(t *testing.T) {
	const headItemID int32 = -90001
	const metaGemID int32 = -90002
	const redGemID int32 = -90003
	originalItem, itemExisted := core.ItemsByID[headItemID]
	originalMetaGem, metaGemExisted := core.GemsByID[metaGemID]
	originalRedGem, redGemExisted := core.GemsByID[redGemID]
	core.ItemsByID[headItemID] = core.Item{ID: headItemID, GemSockets: []proto.GemColor{proto.GemColor_GemColorMeta, proto.GemColor_GemColorRed}}
	core.GemsByID[metaGemID] = core.Gem{ID: metaGemID, Color: proto.GemColor_GemColorMeta}
	core.GemsByID[redGemID] = core.Gem{ID: redGemID, Color: proto.GemColor_GemColorRed}
	t.Cleanup(func() {
		if itemExisted {
			core.ItemsByID[headItemID] = originalItem
		} else {
			delete(core.ItemsByID, headItemID)
		}
		if metaGemExisted {
			core.GemsByID[metaGemID] = originalMetaGem
		} else {
			delete(core.GemsByID, metaGemID)
		}
		if redGemExisted {
			core.GemsByID[redGemID] = originalRedGem
		} else {
			delete(core.GemsByID, redGemID)
		}
	})

	equipment := &proto.EquipmentSpec{Items: make([]*proto.ItemSpec, int(core.NumItemSlots))}
	equipment.Items[proto.ItemSlot_ItemSlotHead] = &proto.ItemSpec{Id: headItemID, Gems: []int32{metaGemID, redGemID}}

	clearGems(equipment, &proto.ReforgeSettings{})

	gotGems := equipment.Items[proto.ItemSlot_ItemSlotHead].Gems
	if gotGems[0] != metaGemID {
		t.Fatalf("expected head meta gem to be preserved, got %d", gotGems[0])
	}
	if gotGems[1] != 0 {
		t.Fatalf("expected ordinary head gem to be cleared, got %d", gotGems[1])
	}
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

func uiGem(id int32, name string, color proto.GemColor, stat stats.Stat, value float64, requiredProfession proto.Profession, unique bool) *proto.ReforgeGemOption {
	gemStats := make([]float64, int(stats.ProtoStatsLen))
	gemStats[stat] = value
	return &proto.ReforgeGemOption{Id: id, Name: name, Color: color, Stats: gemStats, RequiredProfession: requiredProfession, Unique: unique}
}
