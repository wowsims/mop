package dbd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Fixture values are frozen from the build-68571 snapshot in
// tools/DB2ToSqlite/DBDCache (plan §8 step 2). The tests skip when the
// gitignored snapshot is absent (e.g. CI).
const snapshotBuild = 68571

const dbdCacheDir = "../../DB2ToSqlite/DBDCache"

func snapshotFiles(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir(dbdCacheDir)
	if os.IsNotExist(err) {
		t.Skipf("%s not present (gitignored snapshot); skipping", dbdCacheDir)
	}
	if err != nil {
		t.Fatal(err)
	}
	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".dbd") {
			files = append(files, filepath.Join(dbdCacheDir, e.Name()))
		}
	}
	if len(files) != 72 {
		t.Fatalf("expected 72 .dbd files in snapshot, got %d", len(files))
	}
	return files
}

func TestParseSnapshotAndSelect68571(t *testing.T) {
	typeCounts := map[string]int{}
	for _, file := range snapshotFiles(t) {
		def, err := ReadFile(file, true)
		if err != nil {
			t.Fatalf("parse %s: %v", file, err)
		}
		version, err := SelectVersion(def, snapshotBuild)
		if err != nil {
			t.Fatalf("select %d in %s: %v", snapshotBuild, file, err)
		}
		if len(version.Definitions) == 0 {
			t.Fatalf("%s: selected version has no definitions", file)
		}
		for _, d := range version.Definitions {
			col, ok := def.ColumnDefinitions[d.Name]
			if !ok {
				t.Fatalf("%s: definition %q missing from COLUMNS", file, d.Name)
			}
			typeCounts[col.Type]++
		}
	}

	// Frozen per-build totals for the selected 68571 blocks (plan §8 step 2).
	want := map[string]int{"int": 515, "float": 65, "locstring": 43, "string": 5}
	for typ, n := range want {
		if typeCounts[typ] != n {
			t.Errorf("type %s: got %d definitions, want %d", typ, typeCounts[typ], n)
		}
	}
	if typeCounts["uint"] != 0 {
		t.Errorf("expected no uint columns in selected blocks, got %d", typeCounts["uint"])
	}
}

func TestItemRandomSuffixShape(t *testing.T) {
	if _, err := os.Stat(dbdCacheDir); os.IsNotExist(err) {
		t.Skipf("%s not present; skipping", dbdCacheDir)
	}
	def, err := ReadFile(filepath.Join(dbdCacheDir, "ItemRandomSuffix.dbd"), true)
	if err != nil {
		t.Fatal(err)
	}
	version, err := SelectVersion(def, snapshotBuild)
	if err != nil {
		t.Fatal(err)
	}

	byName := map[string]Definition{}
	for _, d := range version.Definitions {
		byName[d.Name] = d
	}

	// §5.5: the 68571 block must be the <32>[5] one, not the legacy [3].
	if got := byName["AllocationPct"].ArrLength; got != 5 {
		t.Errorf("AllocationPct arrLength = %d, want 5", got)
	}
	if got := byName["Enchantment"].ArrLength; got != 5 {
		t.Errorf("Enchantment arrLength = %d, want 5", got)
	}
	id := byName["ID"]
	if !id.IsID || !id.IsNonInline || id.Size != 32 {
		t.Errorf("ID definition = %+v, want isID + noninline + size 32", id)
	}
}

func TestItemSparseBuildSuffixedField(t *testing.T) {
	if _, err := os.Stat(dbdCacheDir); os.IsNotExist(err) {
		t.Skipf("%s not present; skipping", dbdCacheDir)
	}
	def, err := ReadFile(filepath.Join(dbdCacheDir, "ItemSparse.dbd"), true)
	if err != nil {
		t.Fatal(err)
	}
	version, err := SelectVersion(def, snapshotBuild)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range version.Definitions {
		if d.Name == "Field_1_15_3_55112_014" {
			found = true
			if d.ArrLength != 10 {
				t.Errorf("Field_1_15_3_55112_014 arrLength = %d, want 10", d.ArrLength)
			}
		}
	}
	if !found {
		t.Error("Field_1_15_3_55112_014 not present in selected ItemSparse block")
	}
}
