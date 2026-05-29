package reforgeoptimizer

import (
	"os"
	"path/filepath"
	"testing"

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
	}{
		{name: "normal", fileName: "normal.test.json"},
		{name: "relative-statcap", fileName: "relative-statcap.test.json"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
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

func loadPreset(t *testing.T, fileName string) *proto.ReforgeOptimizeRequest {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(".", fileName))
	if err != nil {
		t.Fatalf("failed reading preset %s: %v", fileName, err)
	}

	request := &proto.ReforgeOptimizeRequest{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(data, request); err != nil {
		t.Fatalf("failed unmarshalling fixture %s: %v", fileName, err)
	}
	return request
}
