//go:build with_db

package reforgeoptimizer

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/wowsims/mop/assets/database"
	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"google.golang.org/protobuf/encoding/protojson"
	protopkg "google.golang.org/protobuf/proto"
)

func TestReforgerOptimizer(t *testing.T) {
	sim.RegisterAll()

	// Runs every committed fixture in test-fixtures/. Enumerating by glob keeps this suite
	// self-contained: it does not depend on the fixture_*_test.go generators (not committed). If no
	// fixtures are present, skip rather than fail so the package's other tests (gear, highswasm)
	// still run.
	paths, err := filepath.Glob(filepath.Join(fixturesDir, "*.test.json"))
	if err != nil {
		t.Fatalf("globbing fixtures: %v", err)
	}
	if len(paths) == 0 {
		t.Skip("no fixtures in " + fixturesDir)
	}
	sort.Strings(paths)

	for _, path := range paths {
		fileName := filepath.Base(path)
		t.Run(strings.TrimSuffix(fileName, ".test.json"), func(t *testing.T) {
			request := loadPreset(t, fileName)
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

			expectedRaid := protopkg.Clone(request.Raid).(*proto.Raid)
			expectedRaid.Parties[0].Players[0].Equipment = expectedGear
			expectedResult := computeReforgeStats(&proto.ComputeStatsRequest{Raid: expectedRaid})
			if expectedResult.ErrorResult != "" {
				t.Fatalf("ComputeStats on expected gear failed: %s", expectedResult.ErrorResult)
			}
			expStats := protoToCoreUnitStats(expectedResult.RaidStats.Parties[0].Players[0].FinalStats)
			optStats := protoToCoreUnitStats(result.GetOptimizedPlayerStats().GetFinalStats())
			diff := subtractUnitStats(optStats, expStats)
			statsDiffer := !isEmptyUnitStats(diff)
			if statsDiffer {
				for i, expItem := range expectedGear.GetItems() {
					var optItem *proto.ItemSpec
					if i < len(optimizedGear.GetItems()) {
						optItem = optimizedGear.GetItems()[i]
					}
					if !protopkg.Equal(expItem, optItem) {
						expJSON, _ := protojson.Marshal(expItem)
						optJSON, _ := protojson.Marshal(optItem)
						t.Logf("slot %d: expected %s", i, expJSON)
						t.Logf("slot %d: got      %s", i, optJSON)
					}
				}
				for statIdx, d := range diff.Stats {
					if d != 0 {
						t.Logf("stat %-24s expected=%8.2f got=%8.2f diff=%+.2f", stats.Stat(statIdx).StatName(), expStats.Stats[statIdx], optStats.Stats[statIdx], d)
					}
				}
				for psIdx, d := range diff.PseudoStats {
					if d != 0 {
						name := proto.PseudoStat_name[int32(psIdx)]
						if name == "" {
							name = fmt.Sprintf("PseudoStat(%d)", psIdx)
						}
						t.Logf("stat %-24s expected=%8.4f got=%8.4f diff=%+.4f", name, expStats.PseudoStats[psIdx], optStats.PseudoStats[psIdx], d)
					}
				}
				t.Fatal("optimized stats do not match expected stats")
			}
		})
	}
}

var (
	reforgeGemOptionsOnce sync.Once
	reforgeGemOptions     []*proto.ReforgeGemOption
)

// loadReforgeGemOptionsFromDB builds the reforge gem pool from the DB: all gems eligible for the
// 6 reforge socket colors, quality >= Rare, excluding "Perfect" gems.
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

// uiGemEligibleForSocket reports whether a gem color may be socketed into the given socket color.
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

// fixturesDir holds the committed coverage fixtures (<name>.test.json) that TestReforgerOptimizer
// runs. It is defined here (not in the uncommitted fixture_*_test.go generators) so this suite
// compiles and runs standalone.
const fixturesDir = "test-fixtures"

func loadPreset(t testing.TB, fileName string) *proto.ReforgeOptimizeRequest {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(fixturesDir, fileName))
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
