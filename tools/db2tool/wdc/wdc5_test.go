package wdc

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wowsims/mop/tools/db2tool/dbd"
)

// Decoder test fixtures, frozen from the gitignored build-68571 .db2
// snapshot. Tests skip when the snapshot is absent.
const db2Dir = "../refs/dbfilesclient"
const dbdDir = "../refs/DBDCache"
const snapshotBuild = 68571

func db2Files(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir(db2Dir)
	if os.IsNotExist(err) {
		t.Skipf("%s not present (gitignored snapshot); skipping", db2Dir)
	}
	if err != nil {
		t.Fatal(err)
	}
	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".db2") {
			files = append(files, e.Name())
		}
	}
	if len(files) != 72 {
		t.Fatalf("expected 72 .db2 files, got %d", len(files))
	}
	return files
}

func TestParseAllHeaders(t *testing.T) {
	sectionCounts := map[int]bool{}
	for _, name := range db2Files(t) {
		table, err := ReadFile(filepath.Join(db2Dir, name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		sectionCounts[len(table.Sections)] = true

		base := strings.TrimSuffix(name, ".db2")
		switch base {
		case "ItemBonus":
			if len(table.Sections) != 0 && table.RecordsCount != 0 {
				t.Errorf("ItemBonus: expected empty table, got %d sections / %d records", len(table.Sections), table.RecordsCount)
			}
		case "Spell", "ItemSparse":
			if table.Flags != 0x5 {
				t.Errorf("%s: Flags = 0x%x, want 0x5 (Sparse|Index)", base, table.Flags)
			}
		}
		if table.Flags&flagSecondaryKey != 0 {
			t.Errorf("%s: unexpected SecondaryKey flag", base)
		}
	}
	// Distinct section counts frozen from the snapshot, plus 0 for the
	// empty ItemBonus and 1 for plain single-section tables.
	for _, want := range []int{36, 33, 26, 22, 16, 9, 8, 3, 2, 1, 0} {
		if !sectionCounts[want] {
			t.Errorf("expected some table to have %d sections", want)
		}
	}
}

func TestSpellEffectEncryptedSkip(t *testing.T) {
	if _, err := os.Stat(db2Dir); os.IsNotExist(err) {
		t.Skip("snapshot not present")
	}
	table, err := ReadFile(filepath.Join(db2Dir, "SpellEffect.db2"))
	if err != nil {
		t.Fatal(err)
	}
	if table.RecordsCount != 142756 {
		t.Errorf("SpellEffect header record_count = %d, want 142756", table.RecordsCount)
	}
	if len(table.Sections) != 36 {
		t.Errorf("SpellEffect sections = %d, want 36", len(table.Sections))
	}
	if table.SkippedSections != 35 {
		t.Errorf("SpellEffect skipped sections = %d, want 35", table.SkippedSections)
	}
	// C1 exact check: 142756 header records − 136 encrypted = 142620 emitted.
	if got := len(table.rows); got != 142620 {
		t.Errorf("SpellEffect decoded raw rows = %d, want 142620", got)
	}
}

func TestDecodeAllTables(t *testing.T) {
	if _, err := os.Stat(dbdDir); os.IsNotExist(err) {
		t.Skip("snapshot not present")
	}
	for _, name := range db2Files(t) {
		base := strings.TrimSuffix(name, ".db2")
		table, err := ReadFile(filepath.Join(db2Dir, name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		def, err := dbd.ReadFile(filepath.Join(dbdDir, base+".dbd"), true)
		if err != nil {
			t.Fatalf("%s: %v", base, err)
		}
		version, err := dbd.SelectVersion(def, snapshotBuild)
		if err != nil {
			t.Fatalf("%s: %v", base, err)
		}
		decoded, err := table.DecodeRows(def, version, snapshotBuild)
		if err != nil {
			t.Fatalf("%s: decode: %v", base, err)
		}
		if base != "ItemBonus" && len(decoded.Rows) == 0 {
			t.Errorf("%s: decoded 0 rows", base)
		}
		t.Logf("%s: %d rows, %d cols, %d skipped sections", base, len(decoded.Rows), len(decoded.ColumnNames), table.SkippedSections)
	}
}
