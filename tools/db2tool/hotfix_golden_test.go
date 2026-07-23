package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wowsims/mop/tools/db2tool/config"
	"github.com/wowsims/mop/tools/db2tool/dbd"
	"github.com/wowsims/mop/tools/db2tool/internal/golden"
	"github.com/wowsims/mop/tools/db2tool/sqlite"
	"github.com/wowsims/mop/tools/db2tool/wdc"
	_ "modernc.org/sqlite"
)

// Hotfix golden gate: builds a wowsims.db from the pre-extracted build-68571
// snapshot WITH the refs/DBCache.68571.bin hotfix overlay applied, and diffs
// it against refs/wowsims.hotfix.db — a reference capture produced with that
// same cache. Row parity is strict for every table; the only tolerated
// divergence is the documented CurvePoint Id=236585 float notation
// (reference "[1,-6E-05]" vs Go "[1,-0.00006]") — exactly one line per side.
//
// Skips when the gitignored snapshot/refs assets are absent (e.g. CI).
func TestHotfixGoldenParity(t *testing.T) {
	const snapshotBuild = 68571
	db2Dir := "refs/dbfilesclient"
	dbdDir := "refs/DBDCache"
	settingsPath := "../database/generator-settings.json"
	cachePath := "refs/DBCache.68571.bin"
	refPath := "refs/wowsims.hotfix.db"

	for _, p := range []string{db2Dir, dbdDir, settingsPath, cachePath, refPath} {
		if _, err := os.Stat(p); os.IsNotExist(err) {
			t.Skipf("%s not present; skipping hotfix golden gate", p)
		}
	}

	settings, err := config.Load(settingsPath)
	if err != nil {
		t.Fatal(err)
	}

	readers, err := wdc.CombineHotfixFiles([]string{cachePath})
	if err != nil {
		t.Fatal(err)
	}
	reader := readers[snapshotBuild]
	if reader == nil {
		t.Fatalf("%s holds no build-%d hotfixes", cachePath, snapshotBuild)
	}

	outPath := filepath.Join(t.TempDir(), "wowsims.go.db")
	goDB, err := sqlite.Open(outPath)
	if err != nil {
		t.Fatal(err)
	}
	defer goDB.Close()

	var tableDefs []sqlite.TableDef
	decodedByTable := map[string]*wdc.Decoded{}

	for _, tableName := range settings.Tables {
		table, err := wdc.ReadFile(filepath.Join(db2Dir, tableName+".db2"))
		if err != nil {
			t.Fatal(err)
		}
		// SStrHash port check: the uppercased table name must hash to the
		// WDC5 header TableHash the hotfix records are keyed by.
		if got := wdc.SStrHash(strings.ToUpper(tableName)); got != table.TableHash {
			t.Errorf("SStrHash(%q) = 0x%08X, want header TableHash 0x%08X", tableName, got, table.TableHash)
		}
		def, err := dbd.ReadFile(filepath.Join(dbdDir, tableName+".dbd"), true)
		if err != nil {
			t.Fatal(err)
		}
		version, err := dbd.SelectVersion(def, snapshotBuild)
		if err != nil {
			t.Fatalf("%s: %v", tableName, err)
		}
		decoded, err := table.DecodeRows(def, version, snapshotBuild)
		if err != nil {
			t.Fatalf("%s: %v", tableName, err)
		}
		if err := reader.ApplyHotfixes(table, def, version, snapshotBuild, decoded); err != nil {
			t.Fatalf("%s: applying hotfixes: %v", tableName, err)
		}
		tableDefs = append(tableDefs, sqlite.TableDef{Name: tableName, Def: def, Version: version})
		decodedByTable[tableName] = decoded
	}

	if err := sqlite.CreateTables(goDB, tableDefs); err != nil {
		t.Fatal(err)
	}
	for _, td := range tableDefs {
		if err := sqlite.InsertRows(goDB, td, decodedByTable[td.Name]); err != nil {
			t.Fatal(err)
		}
	}

	refDB, err := sql.Open("sqlite", refPath)
	if err != nil {
		t.Fatal(err)
	}
	defer refDB.Close()

	// Schema parity — hotfixes must never change schema.
	refSchema, err := golden.SchemaDDL(refDB)
	if err != nil {
		t.Fatal(err)
	}
	goSchema, err := golden.SchemaDDL(goDB)
	if err != nil {
		t.Fatal(err)
	}
	if len(refSchema) != len(goSchema) {
		t.Fatalf("schema object count: ref %d vs go %d", len(refSchema), len(goSchema))
	}
	for i := range refSchema {
		if refSchema[i] != goSchema[i] {
			t.Errorf("schema mismatch:\n  ref: %s\n  go:  %s", refSchema[i], goSchema[i])
		}
	}

	// Row parity — strict, modulo the known CurvePoint notation divergence.
	totalDiff := 0
	for _, td := range tableDefs {
		refRows, err := golden.DumpRows(refDB, td.Name)
		if err != nil {
			t.Fatalf("ref %s: %v", td.Name, err)
		}
		goRows, err := golden.DumpRows(goDB, td.Name)
		if err != nil {
			t.Fatalf("go %s: %v", td.Name, err)
		}
		refOnly, goOnly := golden.DiffLines(refRows, goRows)
		n := len(refOnly) + len(goOnly)
		totalDiff += n
		if n == 0 {
			continue
		}
		if td.Name == "CurvePoint" && len(refOnly) == 1 && len(goOnly) == 1 &&
			strings.Contains(refOnly[0], "|236585|") && strings.Contains(refOnly[0], "-6E-05") &&
			strings.Contains(goOnly[0], "|236585|") && strings.Contains(goOnly[0], "-0.00006") {
			t.Logf("CurvePoint: known Id=236585 float-notation divergence (2 lines)")
			continue
		}
		for i, l := range refOnly {
			if i >= 3 {
				break
			}
			t.Errorf("%s: ref-only row: %.200s", td.Name, l)
		}
		for i, l := range goOnly {
			if i >= 3 {
				break
			}
			t.Errorf("%s: go-only row: %.200s", td.Name, l)
		}
		t.Errorf("%s: %d row diff lines", td.Name, n)
	}
	t.Logf("total row diff lines across all tables: %d (2 expected: CurvePoint notation)", totalDiff)
}
