// Row insertion for the extracted tables.

package sqlite

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/wowsims/mop/tools/db2tool/wdc"
)

// InsertRows upserts every decoded row of one table inside one transaction.
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
func InsertRows(db *sql.DB, t TableDef, decoded *wdc.Decoded) error {
	defs := t.Version.Definitions

	columnNames := make([]string, len(defs))
	for i, d := range defs {
		columnNames[i] = d.Name
	}

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
	for _, c := range columnNames {
		cols = append(cols, "["+c+"]")
		vals = append(vals, "@"+c)
	}

	var updates []string
	for _, c := range columnNames {
		if c != pkColumn {
			updates = append(updates, fmt.Sprintf("[%s] = excluded.[%s]", c, c))
		}
	}
	updateClause := "DO NOTHING"
	if len(updates) > 0 {
		updateClause = "DO UPDATE SET " + strings.Join(updates, ", ")
	}

	upsertSql := fmt.Sprintf("INSERT INTO [%s] (%s) VALUES (%s) ON CONFLICT([%s]) %s;",
		t.Name, strings.Join(cols, ", "), strings.Join(vals, ", "), pkColumn, updateClause)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Relation-column indexes, created before the inserts.
	for _, d := range defs {
		if d.IsRelation {
			stmt := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%s ON %s (%s);", strings.ToLower(d.Name), t.Name, d.Name)
			if _, err := tx.Exec(stmt); err != nil {
				return fmt.Errorf("creating relation index on %s.%s: %w", t.Name, d.Name, err)
			}
		}
	}

	stmt, err := tx.Prepare(upsertSql)
	if err != nil {
		return fmt.Errorf("preparing upsert for %s: %w", t.Name, err)
	}
	defer stmt.Close()

	args := make([]any, len(defs))
	for _, row := range decoded.Rows {
		if len(row.Values) != len(defs) {
			return fmt.Errorf("table %s row %d: %d values for %d definitions", t.Name, row.ID, len(row.Values), len(defs))
		}
		for i, value := range row.Values {
			bound, err := bindValue(value)
			if err != nil {
				return fmt.Errorf("table %s row %d column %s: %w", t.Name, row.ID, defs[i].Name, err)
			}
			args[i] = sql.Named(defs[i].Name, bound)
		}
		if _, err := stmt.Exec(args...); err != nil {
			return fmt.Errorf("inserting row %d into %s: %w", row.ID, t.Name, err)
		}
	}

	return tx.Commit()
}

// bindValue converts a decoded value into a driver-bindable one.
func bindValue(value any) (any, error) {
	switch v := value.(type) {
	case nil:
		return nil, nil
	case int64:
		return v, nil
	case uint64:
		if v > math.MaxInt64 {
			return nil, fmt.Errorf("uint64 value %d overflows INTEGER", v)
		}
		return int64(v), nil
	case float32:
		return float64(v), nil // REAL binds as the double-widened float32
	case string:
		return v, nil
	case []int64, []uint64, []float32, []string:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	default:
		return nil, fmt.Errorf("unsupported value type %T", value)
	}
}
