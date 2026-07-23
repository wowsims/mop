package sqlite

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/wowsims/mop/tools/db2tool/dbd"
	"github.com/wowsims/mop/tools/db2tool/wdc"
	_ "modernc.org/sqlite"
)

// modernc driver-marshaling smoke test: creates the extractor's schema
// shapes, upserts via named params, and reads back json_extract virtual
// columns, NULL scans, and REAL vs INTEGER marshaling — a permanent
// regression gate for driver behavior, independent of any game-data
// snapshot.
func TestModerncMarshalingContract(t *testing.T) {
	path := filepath.Join(t.TempDir(), "smoke.db")

	def := dbd.DBDefinition{
		ColumnDefinitions: map[string]dbd.ColumnDefinition{
			"ID":       {Type: "int"},
			"Name":     {Type: "locstring"},
			"Rate":     {Type: "float"},
			"Stats":    {Type: "int"},
			"Scales":   {Type: "float"},
			"ParentID": {Type: "int", ForeignTable: "Other", ForeignColumn: "ID"},
		},
	}
	version := dbd.VersionDefinitions{
		Definitions: []dbd.Definition{
			{Name: "ID", Size: 32, IsID: true, IsSigned: true},
			{Name: "Name"},
			{Name: "Rate"},
			{Name: "Stats", Size: 32, ArrLength: 3, IsSigned: true},
			{Name: "Scales", ArrLength: 2},
			{Name: "ParentID", Size: 32, IsSigned: true, IsRelation: true},
		},
	}
	td := TableDef{Name: "Smoke", Def: def, Version: version}

	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := CreateTables(db, []TableDef{td}); err != nil {
		t.Fatal(err)
	}

	decoded := &wdc.Decoded{
		ColumnNames: []string{"ID", "Name", "Rate", "Stats", "Scales", "ParentID"},
		Rows: []wdc.Row{
			{ID: 1, Values: []any{int64(1), "first", float32(0.581), []int64{1, -2, 3}, []float32{0.1, 0}, int64(0)}},
			{ID: 2, Values: []any{int64(2), "", float32(0), []int64{0, 0, 0}, []float32{0, 0}, int64(7)}},
		},
	}
	if err := InsertRows(db, td, decoded); err != nil {
		t.Fatal(err)
	}
	// Upsert (same PK) must update, not duplicate.
	if err := InsertRows(db, td, &wdc.Decoded{ColumnNames: decoded.ColumnNames, Rows: []wdc.Row{
		{ID: 2, Values: []any{int64(2), "second", float32(1.5), []int64{9, 9, 9}, []float32{2.5, 0}, int64(7)}},
	}}); err != nil {
		t.Fatal(err)
	}

	var n int
	if err := db.QueryRow("SELECT count(*) FROM Smoke").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("expected 2 rows after upsert, got %d", n)
	}

	// float32 scalar must store the double-widened value.
	var rate float64
	if err := db.QueryRow("SELECT Rate FROM Smoke WHERE ID=1").Scan(&rate); err != nil {
		t.Fatal(err)
	}
	if rate != float64(float32(0.581)) {
		t.Errorf("Rate = %v, want double-widened float32 %v", rate, float64(float32(0.581)))
	}

	// Arrays: exact JSON text and virtual-column extraction (int and float).
	var statsText string
	var stats1 int
	var scales0 float64
	if err := db.QueryRow("SELECT Stats, Stats_1, Scales_0 FROM Smoke WHERE ID=1").Scan(&statsText, &stats1, &scales0); err != nil {
		t.Fatal(err)
	}
	if statsText != "[1,-2,3]" {
		t.Errorf("Stats text = %q, want [1,-2,3]", statsText)
	}
	if stats1 != -2 {
		t.Errorf("Stats_1 = %d, want -2", stats1)
	}
	// json_extract parses the stored float32 shortest-round-trip TEXT ("0.1")
	// as a double — so virtual float columns yield 0.1, NOT the widened
	// float32 0.10000000149011612.
	if scales0 != 0.1 {
		t.Errorf("Scales_0 = %v, want 0.1", scales0)
	}

	// All-zero arrays serialize as [0,...], never NULL/[]/"".
	var zeroStats, zeroScales string
	if err := db.QueryRow("SELECT Stats, Scales FROM Smoke WHERE ID=2").Scan(&zeroStats, &zeroScales); err != nil {
		t.Fatal(err)
	}
	if zeroStats != "[9,9,9]" || zeroScales != "[2.5,0]" {
		t.Errorf("upserted arrays = %q / %q, want [9,9,9] / [2.5,0]", zeroStats, zeroScales)
	}

	// Relation value 0 stays 0 — never converted to NULL (§5.4).
	var parent sql.NullInt64
	if err := db.QueryRow("SELECT ParentID FROM Smoke WHERE ID=1").Scan(&parent); err != nil {
		t.Fatal(err)
	}
	if !parent.Valid || parent.Int64 != 0 {
		t.Errorf("ParentID = %+v, want valid 0", parent)
	}

	// Schema shape: FK index + relation index + PK + generated columns exist.
	for _, wantIdx := range []string{"IX_Smoke_ParentID", "idx_parentid"} {
		var cnt int
		if err := db.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?", wantIdx).Scan(&cnt); err != nil {
			t.Fatal(err)
		}
		if cnt != 1 {
			t.Errorf("index %s missing", wantIdx)
		}
	}
}
