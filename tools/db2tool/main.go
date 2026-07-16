// db2tool extracts World of Warcraft client data into tools/database/wowsims.db,
// replacing the .NET tools/DB2ToSqlite tool (see docs/db2tool-migration-plan.md).
//
// Phase A form: decodes pre-extracted .db2 files (default:
// tools/DB2ToSqlite/dbfilesclient) against cached .dbd definitions (default:
// tools/DB2ToSqlite/DBDCache) for an explicit --build number. Local CASC
// extraction (Phase B) will replace the pre-extracted inputs and derive the
// build from the install's .build.info.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/wowsims/mop/tools/db2tool/config"
	"github.com/wowsims/mop/tools/db2tool/dbd"
	"github.com/wowsims/mop/tools/db2tool/sqlite"
	"github.com/wowsims/mop/tools/db2tool/wdc"
	_ "modernc.org/sqlite"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "db2tool:", err)
		os.Exit(1)
	}
}

type options struct {
	settingsFile string
	databaseFile string
	db2Dir       string
	dbdDir       string
	buildNumber  uint32
}

// parseArgs mirrors Program.cs's pairwise scan, including the flag aliases
// (--settings/-s, --output/-output/-o) plus the Phase A-only flags.
func parseArgs(args []string) (options, error) {
	opts := options{
		settingsFile: "appsettings.json",
		databaseFile: "wowsims.db",
		db2Dir:       "tools/DB2ToSqlite/dbfilesclient",
		dbdDir:       "tools/DB2ToSqlite/DBDCache",
	}
	for i := 0; i < len(args); i++ {
		next := func() (string, error) {
			if i+1 < len(args) {
				i++
				return args[i], nil
			}
			return "", fmt.Errorf("flag %s needs a value", args[i])
		}
		var err error
		switch args[i] {
		case "--settings", "-s":
			opts.settingsFile, err = next()
		case "--output", "-output", "-o":
			opts.databaseFile, err = next()
		case "--db2dir":
			opts.db2Dir, err = next()
		case "--dbddir":
			opts.dbdDir, err = next()
		case "--build":
			var v string
			if v, err = next(); err == nil {
				b, perr := dbd.ParseBuild("0.0.0." + v)
				if perr != nil {
					return opts, fmt.Errorf("invalid --build %q: %w", v, perr)
				}
				opts.buildNumber = b.Build
			}
		default:
			return opts, fmt.Errorf("unknown argument %q", args[i])
		}
		if err != nil {
			return opts, err
		}
	}
	return opts, nil
}

func run(args []string) error {
	opts, err := parseArgs(args)
	if err != nil {
		return err
	}
	if opts.buildNumber == 0 {
		return fmt.Errorf("--build <number> is required in the Phase A driver (later derived from .build.info)")
	}

	settings, err := config.Load(opts.settingsFile)
	if err != nil {
		return fmt.Errorf("loading settings: %w", err)
	}
	if len(settings.Tables) == 0 {
		return fmt.Errorf("settings file lists no Tables")
	}

	type loaded struct {
		def     sqlite.TableDef
		decoded *wdc.Decoded
	}
	tables := make([]loaded, 0, len(settings.Tables))
	tableDefs := make([]sqlite.TableDef, 0, len(settings.Tables))

	for _, tableName := range settings.Tables {
		table, err := wdc.ReadFile(filepath.Join(opts.db2Dir, tableName+".db2"))
		if err != nil {
			return err
		}
		def, err := dbd.ReadFile(filepath.Join(opts.dbdDir, tableName+".dbd"), true)
		if err != nil {
			return err
		}
		version, err := dbd.SelectVersion(def, opts.buildNumber)
		if err != nil {
			return fmt.Errorf("table %s: %w", tableName, err)
		}
		decoded, err := table.DecodeRows(def, version, opts.buildNumber)
		if err != nil {
			return fmt.Errorf("table %s: %w", tableName, err)
		}
		td := sqlite.TableDef{Name: tableName, Def: def, Version: version}
		tables = append(tables, loaded{def: td, decoded: decoded})
		tableDefs = append(tableDefs, td)
	}

	db, err := sqlite.Open(opts.databaseFile)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := sqlite.CreateTables(db, tableDefs); err != nil {
		return err
	}

	// Hotfixes (Phase D) would be applied here, before the inserts.

	for _, t := range tables {
		if err := sqlite.InsertRows(db, t.def, t.decoded); err != nil {
			return err
		}
	}

	fmt.Println("Processing completed.")
	return nil
}
