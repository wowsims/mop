// Package sqlite writes the extracted tables to wowsims.db: the schema (one
// table per .dbd definition, arrays as JSON text plus generated per-element
// columns) and the row inserts. This file is the schema half.
//
// The writer uses zombiezen.com/go/sqlite (the same pure-Go modernc engine
// gen_db reads with, minus database/sql) because its prepared statements are
// persistent: the modernc database/sql driver re-parses the SQL text on every
// Exec, which made the wide per-row upserts dominate the whole extraction
// (~40s of a ~42s run; prepare-once brings that to ~7s).
package sqlite

import (
	"fmt"
	"os"
	"strings"

	"github.com/wowsims/mop/tools/db2tool/dbd"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
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
//
// The journal and sync pragmas trade durability for speed: the file is a
// regenerated build artifact, so a run that dies mid-write is repaired by the
// next run's delete-and-rebuild, never by rollback or fsync.
func Open(path string) (*sqlite.Conn, error) {
	if _, err := os.Stat(path); err == nil {
		if err := os.Remove(path); err != nil {
			return nil, fmt.Errorf("deleting existing database: %w", err)
		}
	}
	conn, err := sqlite.OpenConn(path, sqlite.OpenReadWrite|sqlite.OpenCreate)
	if err != nil {
		return nil, err
	}
	for _, pragma := range []string{
		"PRAGMA foreign_keys = ON;",
		"PRAGMA journal_mode = MEMORY;",
		"PRAGMA synchronous = OFF;",
	} {
		if err := sqlitex.ExecuteTransient(conn, pragma, nil); err != nil {
			conn.Close()
			return nil, err
		}
	}
	return conn, nil
}

// CreateTables emits the schema for every table, in order, inside one
// transaction.
func CreateTables(conn *sqlite.Conn, tables []TableDef) (err error) {
	endFn, err := sqlitex.ImmediateTransaction(conn)
	if err != nil {
		return err
	}
	defer endFn(&err)

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
		if err := sqlitex.ExecuteTransient(conn, createTableSql, nil); err != nil {
			return fmt.Errorf("creating table %s: %w", t.Name, err)
		}
		for _, stmt := range indexSql {
			if err := sqlitex.ExecuteTransient(conn, stmt, nil); err != nil {
				return fmt.Errorf("creating index on %s: %w", t.Name, err)
			}
		}
	}

	return nil
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
