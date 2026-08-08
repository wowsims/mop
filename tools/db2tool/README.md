# db2tool

Extracts World of Warcraft client data into `tools/database/wowsims.db`, the
SQLite database that `gen_db` consumes.

The flow end to end: `generator-settings.json` says *what* to extract, `tact`
finds the bytes inside the WoW install, `wdc` + `dbd` turn them into typed rows
(with hotfixes applied), and `sqlite` writes `wowsims.db`.

## Usage

The normal entry points are `make db` (live client) and `make ptrdb` (PTR
client), which run this tool and then `gen_db`. To run it directly, do so from
the repository root (the tool is CWD-dependent, like `gen_db`):

```sh
go run ./tools/db2tool -s tools/database/generator-settings.json --output tools/database/wowsims.db
```

Two modes:

- **Local-CASC mode (default)** — reads the WoW install named by the settings'
  `BaseDir`: `.build.info` picks the build, files come out of local CASC
  storage, and the client's `DBCache.bin` hotfixes for that build are applied
  to the decoded rows.
- **Offline mode (`--build <number|version>`)** — decodes pre-extracted `.db2`
  files (from `dbfilesclient/` or `--db2dir`) instead. No install required, no
  hotfixes unless `--dbcache` is given.

Flags: `--settings/-s`, `--output/-o`, `--build`, `--db2dir`, `--dbddir`,
`--dbcache <file>` (pin specific hotfix caches for deterministic runs),
`--no-hotfixes`.

## Package layout

**`main.go`** — orchestration and CLI. Parses flags, loads settings, then runs
the pipeline: open the install → extract each table → fetch its schema
definition → decode the rows → apply hotfixes → insert into SQLite.

**`config/`** — loader for the JSON settings file (see below).

**`tact/`** — the "get bytes out of the WoW install" layer. Blizzard stores
game files in a content-addressed archive system called CASC/TACT, so you
can't just open `Spell.db2` off disk. This package walks the chain:
`.build.info` picks the installed build (`buildinfo.go`), the build config and
root manifest map a FileDataID to a content hash (`build.go`, `config.go`,
`root.go`), the encoding table and `.idx` files locate that hash inside the
big `data.NNN` archives (`encoding.go`, `cascidx.go`), and BLTE decompresses
the result (`blte.go`). `listfile.go` handles the community-maintained
`listfile.csv` that maps human filenames (`dbfilesclient/spell.db2`) to
FileDataIDs, since the game itself only knows numbers.

**`wdc/`** — the DB2 file format decoder. Once tact hands over raw bytes, this
parses the WDC5 container format (`wdc5.go`, `row.go`, `bitreader.go` for its
bit-packed columns). `hotfix.go` reads the client's `DBCache.bin` — Blizzard's
server-pushed data corrections — and overlays those records onto the decoded
rows so the output matches what the live client actually uses.

**`dbd/`** — schema definitions. DB2 files don't fully describe their own
columns, so the community maintains [WoWDBDefs](https://github.com/wowdev/WoWDBDefs)
(`.dbd` files) that say "for build X, the Spell table has these fields with
these types". This package downloads and caches them (`fetch.go`), parses the
format (`dbd.go`), and picks the definition version matching our build number
(`select.go`).

**`sqlite/`** — the output end: translates a dbd definition into a
`CREATE TABLE` statement (`schema.go`) and bulk-inserts the decoded rows
(`insert.go`).

**Data directories** (populated on first run, cached afterwards):

- `dbfilesclient/` — the extracted `.db2` files. Written as a side effect in
  local-CASC mode, read as input in offline `--build` mode.
- `DBDCache/` — cached `.dbd` definition downloads.
- `listfile.csv` — cached filename→FileDataID mapping.
- `caches/` — optional extra `DBCache.bin` hotfix files, scanned in
  local-CASC mode alongside `<BaseDir>/**/DBCache.bin`.

`NOTICES.md` carries license attributions for the projects the format-parsing
code was ported from.

## generator-settings.json

Lives at `tools/database/generator-settings.json` (with a PTR variant,
`ptr-generator-settings.json`, differing only in `Product`) and drives what
gets extracted:

- **`Settings.BaseDir` / `Product`** — where the WoW install lives and which
  product to read from it (`wow_classic` = the Classic client, which is what
  MoP Classic ships under). An install can hold several products; this picks
  the right one out of `.build.info`.
- **`TargetDirectory`** — `dbfilesclient`, doing double duty: it's the path
  prefix used to look up files in the listfile (`dbfilesclient/Spell.db2`) and
  the on-disk folder the extracted `.db2` files are written to.
- **`GameTables` / `GameTablesOutDirectory`** — GameTables are a separate,
  simpler thing: plain-text `.txt` files of per-level constants (crit chance
  per agility, combat rating conversions, base HP/mana, spell scaling…).
  They're extracted as-is to `assets/db_inputs/basestats`, where the sim's
  base-stats generation reads them. No DB2 decoding involved.
- **`Tables`** — the list of DB2 tables to decode into SQLite. Roughly:
  everything item-related (ItemSparse, damage/armor tables, random suffixes,
  upgrades, reforging, gems, sets), everything spell-related (the ~25 `Spell*`
  tables that MoP split spell data into, enchants, procs-per-minute),
  talents/glyphs, and dungeon-journal/zone tables (Map, JournalEncounter…)
  used for item source info.

**To add a new table to `wowsims.db`**: add its name to `Tables` — that's all
it takes. The schema comes from WoWDBDefs automatically. GameTable additions
work the same way via `GameTables` (names match the `gametables/*.txt` files
in the client).
