//go:build with_db

package reforgeoptimizer

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/wowsims/mop/assets/database"
	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
	protopkg "google.golang.org/protobuf/proto"
)

func TestReforgerOptimizer(t *testing.T) {
	sim.RegisterAll()

	testCases := []struct {
		name     string
		fileName string
		skip     bool
	}{
		{name: "multi-softcap", fileName: "multi-softcap.test.json"},
		{name: "multi-hardcap", fileName: "multi-hardcap.test.json"},
		{name: "expertise", fileName: "expertise.test.json"},
		{name: "threshold", fileName: "threshold.test.json"},
		{name: "breakpoint-limit", fileName: "breakpoint-limit.test.json"},
		{name: "relative-statcap", fileName: "relative-statcap.test.json"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.skip {
				t.Skip("skipping test case")
			}
			request := loadPreset(t, tc.fileName)
			expectedGear := request.GetRaid().GetParties()[0].GetPlayers()[0].GetEquipment()
			if expectedGear == nil {
				t.Fatal("preset has no player equipment to compare against")
			}

			result := Optimize(request)
			if err := result.GetError(); err != nil {
				t.Fatalf("Optimize returned error: %s", err.GetMessage())
			}
			optimizedGear := result.GetOptimizedGear()
			if optimizedGear == nil {
				t.Fatal("Optimize returned no optimized gear")
			}

			if !protopkg.Equal(expectedGear, optimizedGear) {
				t.Fatal("optimized gear does not match expected gear")
			}
		})
	}
}

var (
	reforgeGemOptionsOnce sync.Once
	reforgeGemOptions     []*proto.ReforgeGemOption
)

// loadReforgeGemOptionsFromDB mirrors ReforgeOptimizer.getReforgeGemOptions in TypeScript:
// all gems eligible for the 6 reforge socket colors, quality >= Rare, no "Perfect" gems.
func loadReforgeGemOptionsFromDB() []*proto.ReforgeGemOption {
	reforgeGemOptionsOnce.Do(func() {
		db := database.Load()
		seen := make(map[int32]bool)
		for _, socketColor := range []proto.GemColor{
			proto.GemColor_GemColorPrismatic,
			proto.GemColor_GemColorShaTouched,
			proto.GemColor_GemColorCogwheel,
			proto.GemColor_GemColorRed,
			proto.GemColor_GemColorBlue,
			proto.GemColor_GemColorYellow,
		} {
			for _, gem := range db.Gems {
				if seen[gem.Id] || gem.Quality < proto.ItemQuality_ItemQualityRare || strings.Contains(gem.Name, "Perfect") {
					continue
				}
				if !uiGemEligibleForSocket(gem.Color, socketColor) {
					continue
				}
				seen[gem.Id] = true
				reforgeGemOptions = append(reforgeGemOptions, &proto.ReforgeGemOption{
					Id:                 gem.Id,
					Name:               gem.Name,
					Color:              gem.Color,
					Stats:              gem.Stats,
					Quality:            gem.Quality,
					Unique:             gem.Unique,
					RequiredProfession: gem.RequiredProfession,
				})
			}
		}
	})
	return reforgeGemOptions
}

// uiGemEligibleForSocket mirrors gemEligibleForSocket in ui/core/proto_utils/gems.ts.
func uiGemEligibleForSocket(gemColor, socketColor proto.GemColor) bool {
	switch socketColor {
	case proto.GemColor_GemColorMeta:
		return gemColor == proto.GemColor_GemColorMeta
	case proto.GemColor_GemColorCogwheel:
		return gemColor == proto.GemColor_GemColorCogwheel
	case proto.GemColor_GemColorShaTouched:
		return gemColor == proto.GemColor_GemColorShaTouched
	default:
		return gemColor != proto.GemColor_GemColorMeta &&
			gemColor != proto.GemColor_GemColorCogwheel &&
			gemColor != proto.GemColor_GemColorShaTouched
	}
}

func loadPreset(t testing.TB, fileName string) *proto.ReforgeOptimizeRequest {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(".", fileName))
	if err != nil {
		t.Fatalf("failed reading preset %s: %v", fileName, err)
	}

	request := &proto.ReforgeOptimizeRequest{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(data, request); err != nil {
		t.Fatalf("failed unmarshalling fixture %s: %v", fileName, err)
	}
	if len(request.GemOptions) == 0 && request.GetSettings().GetIncludeGems() {
		request.GemOptions = loadReforgeGemOptionsFromDB()
	}
	return request
}
