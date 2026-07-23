package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/wowsims/mop/tools/db2tool/config"
	"github.com/wowsims/mop/tools/db2tool/dbd"
	"github.com/wowsims/mop/tools/db2tool/internal/golden"
	"github.com/wowsims/mop/tools/db2tool/sqlite"
	"github.com/wowsims/mop/tools/db2tool/wdc"
	_ "modernc.org/sqlite"
)

// Golden gate: builds a wowsims.db from the pre-extracted build-68571
// snapshot and diffs it against a reference database capture.
//
//   - Schema parity is ALWAYS strict — hotfixes never change schema.
//   - Row parity is strict when DB2TOOL_REF_DB points at a without-hotfix
//     reference capture. Against the default repo reference
//     (tools/database/wowsims.db, built WITH hotfixes), small per-table diffs
//     are tolerated and logged: they are the hotfix overlay. A systematic
//     decoder bug produces thousands of diff lines and still fails.
//
// Skips when the gitignored snapshot/reference are absent (e.g. CI).
func TestGoldenParity(t *testing.T) {
	const snapshotBuild = 68571
	db2Dir := "refs/dbfilesclient"
	dbdDir := "refs/DBDCache"
	settingsPath := "../database/generator-settings.json"

	refPath := os.Getenv("DB2TOOL_REF_DB")
	strict := refPath != ""
	if refPath == "" {
		refPath = "../database/wowsims.db"
	}
	for _, p := range []string{db2Dir, dbdDir, settingsPath, refPath} {
		if _, err := os.Stat(p); os.IsNotExist(err) {
			t.Skipf("%s not present; skipping golden gate", p)
		}
	}

	settings, err := config.Load(settingsPath)
	if err != nil {
		t.Fatal(err)
	}

	outPath := filepath.Join(t.TempDir(), "wowsims.go.db")
	goDB, err := sqlite.Open(outPath)
	if err != nil {
		t.Fatal(err)
	}
	defer goDB.Close()

	var tableDefs []sqlite.TableDef
	decodedByTable := map[string]*wdc.Decoded{}
	floatCols := map[string][]int{} // table -> float array definition indexes

	for _, tableName := range settings.Tables {
		table, err := wdc.ReadFile(filepath.Join(db2Dir, tableName+".db2"))
		if err != nil {
			t.Fatal(err)
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
		tableDefs = append(tableDefs, sqlite.TableDef{Name: tableName, Def: def, Version: version})
		decodedByTable[tableName] = decoded
		for i, d := range version.Definitions {
			if def.ColumnDefinitions[d.Name].Type == "float" {
				floatCols[tableName] = append(floatCols[tableName], i)
			}
		}
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

	// 1. Schema parity — strict.
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

	// 2. Float-notation risk: no critical-table float ARRAY element may fall
	// in the divergent text-rendering ranges (golden.FloatDiverges). Scalars
	// are exempt: they
	// bind numerically as REAL and never go through text formatting (e.g.
	// SpellEffect has ±1e17 scalar coefficients that are byte-identical in
	// the reference).
	critical := map[string]bool{}
	for _, name := range golden.CriticalTables {
		critical[name] = true
	}
	for tableName, cols := range floatCols {
		if !critical[tableName] {
			continue
		}
		for _, decodedRow := range decodedByTable[tableName].Rows {
			for _, ci := range cols {
				switch v := decodedRow.Values[ci].(type) {
				case []float32:
					for _, f := range v {
						if golden.FloatDiverges(f) {
							t.Errorf("%s row %d: float %v in divergent notation range (needs a reference-compatible formatter)", tableName, decodedRow.ID, f)
						}
					}
				}
			}
		}
	}

	// 3. Row parity.
	const hotfixTolerance = 12 // diff lines per table vs a with-hotfix reference
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
		if !critical[td.Name] {
			t.Logf("%s (slack): %d diff lines (informational)", td.Name, n)
			continue
		}
		if strict || n > hotfixTolerance {
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
		} else {
			t.Logf("%s: %d diff lines (within with-hotfix tolerance — expected hotfix-overlay deltas)", td.Name, n)
		}
	}
	t.Logf("total row diff lines across all tables: %d", totalDiff)
}
