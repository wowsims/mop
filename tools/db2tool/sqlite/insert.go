// Row insertion for the extracted tables.

package sqlite

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/wowsims/mop/tools/db2tool/wdc"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// InsertRows upserts every decoded row of one table inside one transaction,
// through a single prepared statement (prepare once, bind/step/reset per
// row — see the package comment for why this matters).
//
// Contract notes (the wowsims.db output format):
//   - definition order = column order = bind order;
//   - relation-column idx_ indexes use table-less names (idx_<col lowercased>)
//     with IF NOT EXISTS, so only the first table processed with a given
//     relation-column name gets the index — tables MUST be processed in
//     settings order;
//   - relation values of 0 stay 0, never NULLed;
//   - arrays serialize as JSON text via encoding/json over plain numeric
//     slices (u8 arrays emit [0,0,0], never base64);
//   - float scalars bind as the double-widened float32.
func InsertRows(conn *sqlite.Conn, t TableDef, decoded *wdc.Decoded) (err error) {
	defs := t.Version.Definitions

	pkColumn := ""
	for _, d := range defs {
		if d.IsID {
			pkColumn = d.Name
			break
		}
	}
	if pkColumn == "" {
		return fmt.Errorf("table %s has no id column", t.Name)
	}

	var cols, vals []string
	for _, d := range defs {
		cols = append(cols, "["+d.Name+"]")
		vals = append(vals, "?")
	}

	var updates []string
	for _, d := range defs {
		if d.Name != pkColumn {
			updates = append(updates, fmt.Sprintf("[%s] = excluded.[%s]", d.Name, d.Name))
		}
	}
	updateClause := "DO NOTHING"
	if len(updates) > 0 {
		updateClause = "DO UPDATE SET " + strings.Join(updates, ", ")
	}

	upsertSql := fmt.Sprintf("INSERT INTO [%s] (%s) VALUES (%s) ON CONFLICT([%s]) %s;",
		t.Name, strings.Join(cols, ", "), strings.Join(vals, ", "), pkColumn, updateClause)

	endFn, err := sqlitex.ImmediateTransaction(conn)
	if err != nil {
		return err
	}
	defer endFn(&err)

	// Relation-column indexes, created before the inserts.
	for _, d := range defs {
		if d.IsRelation {
			stmt := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%s ON %s (%s);", strings.ToLower(d.Name), t.Name, d.Name)
			if err := sqlitex.ExecuteTransient(conn, stmt, nil); err != nil {
				return fmt.Errorf("creating relation index on %s.%s: %w", t.Name, d.Name, err)
			}
		}
	}

	stmt, err := conn.Prepare(upsertSql)
	if err != nil {
		return fmt.Errorf("preparing upsert for %s: %w", t.Name, err)
	}

	for _, row := range decoded.Rows {
		if len(row.Values) != len(defs) {
			return fmt.Errorf("table %s row %d: %d values for %d definitions", t.Name, row.ID, len(row.Values), len(defs))
		}
		for i, value := range row.Values {
			if err := bindValue(stmt, i+1, value); err != nil {
				return fmt.Errorf("table %s row %d column %s: %w", t.Name, row.ID, defs[i].Name, err)
			}
		}
		if _, err := stmt.Step(); err != nil {
			return fmt.Errorf("inserting row %d into %s: %w", row.ID, t.Name, err)
		}
		if err := stmt.Reset(); err != nil {
			return err
		}
	}

	return nil
}

// bindValue binds a decoded value to the statement's param-th parameter.
func bindValue(stmt *sqlite.Stmt, param int, value any) error {
	switch v := value.(type) {
	case nil:
		stmt.BindNull(param)
	case int64:
		stmt.BindInt64(param, v)
	case uint64:
		if v > math.MaxInt64 {
			return fmt.Errorf("uint64 value %d overflows INTEGER", v)
		}
		stmt.BindInt64(param, int64(v))
	case float32:
		stmt.BindFloat(param, float64(v)) // REAL binds as the double-widened float32
	case string:
		stmt.BindText(param, v)
	case []int64, []uint64, []float32, []string:
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		stmt.BindText(param, string(b))
	default:
		return fmt.Errorf("unsupported value type %T", value)
	}
	return nil
}
