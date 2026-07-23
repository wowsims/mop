// db2tool extracts World of Warcraft client data into tools/database/wowsims.db.
//
// The default mode reads the local install named by the settings' BaseDir:
// .build.info picks the build, files come from local CASC
// (root → encoding → .idx → data.NNN → BLTE), .dbd definitions and the
// community listfile are fetched/cached over plain HTTPS. The client's
// DBCache.bin hotfixes for the extracted build are applied to the decoded
// rows; --dbcache <file> pins specific cache files instead of the default
// scan and --no-hotfixes disables the overlay.
//
// With --build (and optionally --db2dir/--dbddir), the offline mode decodes
// pre-extracted .db2 files instead — no install required and no hotfixes
// unless --dbcache is given.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/wowsims/mop/tools/db2tool/config"
	"github.com/wowsims/mop/tools/db2tool/dbd"
	"github.com/wowsims/mop/tools/db2tool/sqlite"
	"github.com/wowsims/mop/tools/db2tool/tact"
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
	db2Dir       string   // offline mode only
	dbdDir       string   // offline mode override
	buildNumber  uint32   // nonzero → offline mode
	dbCaches     []string // explicit DBCache files, overriding the default scan
	noHotfixes   bool     // skip hotfix application entirely
}

// parseArgs scans the args pairwise. --settings/-s and --output/-output/-o
// are aliases, plus the offline-mode and hotfix flags.
func parseArgs(args []string) (options, error) {
	opts := options{
		settingsFile: "appsettings.json",
		databaseFile: "wowsims.db",
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
		case "--dbcache":
			var f string
			if f, err = next(); err == nil {
				opts.dbCaches = append(opts.dbCaches, f)
			}
		case "--no-hotfixes":
			opts.noHotfixes = true
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

// resolvePath resolves a possibly-relative settings path against the tool
// home directory tools/db2tool — relative settings values like
// "../../assets/db_inputs/basestats" are anchored there.
func resolvePath(toolHome, value string) string {
	if filepath.IsAbs(value) {
		return value
	}
	return filepath.Join(toolHome, value)
}

func run(args []string) error {
	opts, err := parseArgs(args)
	if err != nil {
		return err
	}

	settingsAbs, err := filepath.Abs(opts.settingsFile)
	if err != nil {
		return err
	}
	settings, err := config.Load(settingsAbs)
	if err != nil {
		return fmt.Errorf("loading settings: %w", err)
	}
	if len(settings.Tables) == 0 {
		return fmt.Errorf("settings file lists no Tables")
	}

	// The tool home is resolved from the working directory, which must be the
	// repo root — the same invariant gen_db already has (its ./tools/... and
	// ./assets literals). Fail loud otherwise.
	toolHome, err := filepath.Abs(filepath.Join("tools", "db2tool"))
	if err != nil {
		return err
	}
	if _, err := os.Stat(toolHome); err != nil {
		return fmt.Errorf("tools/db2tool not found — run from the repository root (CWD-dependent like gen_db): %w", err)
	}
	dbdCacheDir := opts.dbdDir
	if dbdCacheDir == "" {
		dbdCacheDir = filepath.Join(toolHome, "DBDCache")
	}

	var buildNumber uint32
	var openTable func(tableName string) (*wdc.Table, error)

	if opts.buildNumber != 0 {
		// Offline mode: pre-extracted .db2 files.
		buildNumber = opts.buildNumber
		db2Dir := opts.db2Dir
		if db2Dir == "" {
			db2Dir = filepath.Join(toolHome, "dbfilesclient")
		}
		openTable = func(tableName string) (*wdc.Table, error) {
			return wdc.ReadFile(filepath.Join(db2Dir, tableName+".db2"))
		}
	} else {
		// Local-CASC mode (the default): everything from the install.
		if settings.Settings.BaseDir == "" {
			return fmt.Errorf("settings BaseDir is required (or pass --build for offline mode)")
		}
		build, err := tact.Open(settings.Settings.BaseDir, settings.Settings.Product)
		if err != nil {
			return err
		}
		buildNumber = build.BuildNumber
		fmt.Printf("Extracting %s %s (build %d) from local install\n", build.Entry.Product, build.Entry.Version, buildNumber)

		listfile := &tact.Listfile{Path: filepath.Join(toolHome, "listfile.csv")}
		if err := listfile.Refresh(); err != nil {
			return err
		}

		// GameTables: raw bytes, filename casing preserved from settings.
		gameTablesOutDir := resolvePath(toolHome, settings.GameTablesOutDirectory)
		if err := os.MkdirAll(gameTablesOutDir, 0o755); err != nil {
			return err
		}
		for _, gameTable := range settings.GameTables {
			fdid, err := listfile.GetFDID("gametables/" + gameTable + ".txt")
			if err != nil {
				return err
			}
			data, err := build.OpenFileByFDID(fdid)
			if err != nil {
				return fmt.Errorf("gametable %s: %w", gameTable, err)
			}
			if err := os.WriteFile(filepath.Join(gameTablesOutDir, gameTable+".txt"), data, 0o644); err != nil {
				return err
			}
		}

		// Tables: extract each .db2 to the target directory, then parse it.
		// The FDID key uses the RAW settings TargetDirectory value; only the
		// on-disk output use is resolved.
		targetDirOnDisk := resolvePath(toolHome, settings.TargetDirectory)
		if err := os.MkdirAll(targetDirOnDisk, 0o755); err != nil {
			return err
		}
		openTable = func(tableName string) (*wdc.Table, error) {
			fdid, err := listfile.GetFDID(settings.TargetDirectory + "/" + tableName + ".db2")
			if err != nil {
				return nil, err
			}
			data, err := build.OpenFileByFDID(fdid)
			if err != nil {
				return nil, fmt.Errorf("table %s: %w", tableName, err)
			}
			path := filepath.Join(targetDirOnDisk, tableName+".db2")
			if err := os.WriteFile(path, data, 0o644); err != nil {
				return nil, err
			}
			return wdc.ReadFile(path)
		}
	}

	type loaded struct {
		def     sqlite.TableDef
		table   *wdc.Table
		decoded *wdc.Decoded
	}
	tables := make([]loaded, 0, len(settings.Tables))
	tableDefs := make([]sqlite.TableDef, 0, len(settings.Tables))

	for _, tableName := range settings.Tables {
		table, err := openTable(tableName)
		if err != nil {
			return err
		}
		dbdPath, err := dbd.FetchCached(dbdCacheDir, tableName)
		if err != nil {
			return err
		}
		def, err := dbd.ReadFile(dbdPath, true)
		if err != nil {
			return err
		}
		version, err := dbd.SelectVersion(def, buildNumber)
		if err != nil {
			return fmt.Errorf("table %s: %w", tableName, err)
		}
		decoded, err := table.DecodeRows(def, version, buildNumber)
		if err != nil {
			return fmt.Errorf("table %s: %w", tableName, err)
		}
		td := sqlite.TableDef{Name: tableName, Def: def, Version: version}
		tables = append(tables, loaded{def: td, table: table, decoded: decoded})
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

	// Hotfixes: overlay the client's DBCache.bin records before the inserts.
	// Only a cache for this exact build applies; having none is not an error.
	// --dbcache pins specific cache files (deterministic runs); with no
	// override, local-CASC mode scans tools/db2tool/caches plus
	// <BaseDir>/**/DBCache.bin, while the offline --build mode stays
	// hotfix-free.
	var hotfixReader *wdc.HotfixReader
	if !opts.noHotfixes {
		var readers map[uint32]*wdc.HotfixReader
		if len(opts.dbCaches) > 0 {
			if readers, err = wdc.CombineHotfixFiles(opts.dbCaches); err != nil {
				return err
			}
		} else if opts.buildNumber == 0 {
			if readers, err = wdc.LoadHotfixCaches(filepath.Join(toolHome, "caches"), settings.Settings.BaseDir); err != nil {
				return err
			}
		}
		hotfixReader = readers[buildNumber]
	}

	for _, t := range tables {
		if hotfixReader != nil {
			if err := hotfixReader.ApplyHotfixes(t.table, t.def.Def, t.def.Version, buildNumber, t.decoded); err != nil {
				return fmt.Errorf("table %s: applying hotfixes: %w", t.def.Name, err)
			}
		}
		if err := sqlite.InsertRows(db, t.def, t.decoded); err != nil {
			return err
		}
	}

	fmt.Println("Processing completed.")
	return nil
}
