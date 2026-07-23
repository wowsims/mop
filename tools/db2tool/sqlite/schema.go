// SQLite schema creation for the extracted tables.
package sqlite

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	"github.com/wowsims/mop/tools/db2tool/dbd"
)

// TableDef pairs a table name with its parsed definition and the version
// block selected for the current build (the caller selects once and both
// schema and inserts use the same block).
type TableDef struct {
	Name    string
	Def     dbd.DBDefinition
	Version dbd.VersionDefinitions
}

// Open deletes any pre-existing database file — every run starts from an
// empty file, which is what makes post-patch re-runs and db/ptrdb
// alternation correct — and opens a fresh connection with
// PRAGMA foreign_keys = ON.
func Open(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err == nil {
		if err := os.Remove(path); err != nil {
			return nil, fmt.Errorf("deleting existing database: %w", err)
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// The writer is single-threaded; a single connection keeps every
	// statement on one session.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// CreateTables emits the schema for every table, in order, inside one
// transaction.
func CreateTables(db *sql.DB, tables []TableDef) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, t := range tables {
		var columnDefinitionsSql []string
		var indexSql []string

		for _, def := range t.Version.Definitions {
			colDef, ok := t.Def.ColumnDefinitions[def.Name]
			if !ok {
				return fmt.Errorf("column definition for %s not found in table %s", def.Name, t.Name)
			}

			if def.ArrLength == 0 {
				sqliteType, err := mapToSQLiteType(colDef.Type)
				if err != nil {
					return fmt.Errorf("table %s column %s: %w", t.Name, def.Name, err)
				}
				nullability := ""
				if colDef.ForeignTable != "" && colDef.ForeignColumn != "" && !def.IsID {
					nullability = " NULL"
				}
				columnSql := fmt.Sprintf("[%s] %s%s", def.Name, sqliteType, nullability)
				if def.IsID {
					columnSql += " PRIMARY KEY"
				}
				columnDefinitionsSql = append(columnDefinitionsSql, columnSql)

				if colDef.ForeignTable != "" && colDef.ForeignColumn != "" {
					indexSql = append(indexSql, fmt.Sprintf(
						"CREATE INDEX IF NOT EXISTS IX_%s_%s ON [%s] ([%s])", t.Name, def.Name, t.Name, def.Name))
				}
			} else {
				columnDefinitionsSql = append(columnDefinitionsSql, fmt.Sprintf("[%s] TEXT", def.Name))

				elementType, err := mapToSQLiteType(colDef.Type)
				if err != nil {
					return fmt.Errorf("table %s column %s: %w", t.Name, def.Name, err)
				}
				for i := 0; i < def.ArrLength; i++ {
					columnDefinitionsSql = append(columnDefinitionsSql, fmt.Sprintf(
						"[%s_%d] %s GENERATED ALWAYS AS (json_extract([%s], '$[%d]')) VIRTUAL",
						def.Name, i, elementType, def.Name, i))
				}
			}
		}

		createTableSql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS [%s] (%s);", t.Name, strings.Join(columnDefinitionsSql, ", "))
		if _, err := tx.Exec(createTableSql); err != nil {
			return fmt.Errorf("creating table %s: %w", t.Name, err)
		}
		for _, stmt := range indexSql {
			if _, err := tx.Exec(stmt); err != nil {
				return fmt.Errorf("creating index on %s: %w", t.Name, err)
			}
		}
	}

	return tx.Commit()
}

func mapToSQLiteType(colType string) (string, error) {
	switch colType {
	case "int", "uint":
		return "INTEGER", nil
	case "float":
		return "REAL", nil
	case "string", "locstring":
		return "TEXT", nil
	default:
		return "", fmt.Errorf("unsupported type: %s", colType)
	}
}
