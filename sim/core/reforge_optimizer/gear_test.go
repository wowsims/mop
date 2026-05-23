package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/mop/sim/core"
)

func TestRestoreMetaSocketGemKeepsOriginalHeadMeta(t *testing.T) {
	newItem := &core.Item{Gems: []core.Gem{{ID: 95346}, {ID: 76659}}}
	originalItem := &core.Item{Gems: []core.Gem{{ID: 95347}, {ID: 76659}}}

	restoreMetaSocketGem(newItem, originalItem, 0)

	if got := gemIDAt(newItem, 0); got != 95347 {
		t.Fatalf("expected original meta gem to be restored, got %d", got)
	}
	if got := gemIDAt(newItem, 1); got != 76659 {
		t.Fatalf("expected non-meta socket to be unchanged, got %d", got)
	}
}

func TestRestoreMetaSocketGemCanRestoreEmptyMeta(t *testing.T) {
	newItem := &core.Item{Gems: []core.Gem{{ID: 95346}, {ID: 76659}}}
	originalItem := &core.Item{Gems: []core.Gem{{ID: 0}, {ID: 76659}}}

	restoreMetaSocketGem(newItem, originalItem, 0)

	if got := gemIDAt(newItem, 0); got != 0 {
		t.Fatalf("expected empty original meta socket to be restored, got %d", got)
	}
}
