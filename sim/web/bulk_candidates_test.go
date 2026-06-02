package main

import (
	"fmt"
	"os"
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
	googleProto "google.golang.org/protobuf/proto"
)

func TestBackendBulkCandidateGenerationMatchesReference(t *testing.T) {
	referenceRequest := &proto.BulkSimRequest{}
	requestBytes, err := os.ReadFile("../../candidates-reference.json")
	if err != nil {
		t.Fatalf("failed to read candidates reference: %v", err)
	}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(requestBytes, referenceRequest); err != nil {
		t.Fatalf("failed to decode candidates reference request: %v", err)
	}

	bulkSettings := &proto.BulkSettings{}
	settingsBytes, err := os.ReadFile("../../bulk-selected-items-reference.json")
	if err != nil {
		t.Fatalf("failed to read bulk settings reference: %v", err)
	}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(settingsBytes, bulkSettings); err != nil {
		t.Fatalf("failed to decode bulk settings reference: %v", err)
	}

	expectedCandidates := googleProto.Clone(referenceRequest).(*proto.BulkSimRequest)
	referenceCacheHits := expectedCandidates.GetOptimizedCandidates()
	referenceMisses := expectedCandidates.GetCandidates()

	referenceRequest.Candidates = nil
	referenceRequest.OptimizedCandidates = nil
	referenceRequest.BulkSettings = bulkSettings

	if err := ensureBulkSimCandidatesGenerated(referenceRequest); err != nil {
		t.Fatalf("backend candidate generation failed: %v", err)
	}

	generated := referenceRequest.GetCandidates()
	expectedTotal := len(referenceCacheHits) + len(referenceMisses)
	if len(generated) != expectedTotal {
		t.Fatalf("generated %d candidates, expected %d total candidates", len(generated), expectedTotal)
	}

	for idx, candidate := range generated {
		if candidate.GetIndex() != int32(idx) {
			t.Fatalf("generated candidate %d has index %d", idx, candidate.GetIndex())
		}
	}

	for _, expected := range referenceMisses {
		idx := int(expected.GetIndex())
		if idx < 0 || idx >= len(generated) {
			t.Fatalf("reference miss index %d is out of bounds for %d generated candidates", idx, len(generated))
		}
		if !googleProto.Equal(generated[idx].GetGear(), expected.GetGear()) {
			t.Fatalf("generated candidate %d does not match miss reference gear: %s", idx, summarizeBulkCandidateMismatch(generated[idx].GetGear(), expected.GetGear()))
		}
	}
}

func summarizeBulkCandidateMismatch(actual *proto.EquipmentSpec, expected *proto.EquipmentSpec) string {
	if actual == nil || expected == nil {
		return fmt.Sprintf("actual nil=%t expected nil=%t", actual == nil, expected == nil)
	}
	for idx := range min(len(actual.GetItems()), len(expected.GetItems())) {
		actualItem := actual.GetItems()[idx]
		expectedItem := expected.GetItems()[idx]
		if !googleProto.Equal(actualItem, expectedItem) {
			return fmt.Sprintf("slot %d actual=%s expected=%s", idx, actualItem.String(), expectedItem.String())
		}
	}
	return fmt.Sprintf("item count actual=%d expected=%d", len(actual.GetItems()), len(expected.GetItems()))
}
