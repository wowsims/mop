# Migration Plan: Reimplement `tools/DB2ToSqlite` (.NET 9) in Pure Go

Author target: wowsims/mop maintainer, Go-fluent, repo-familiar; phases are contributor-handoff-ready. This is a **plan, not an implementation**.

Two hard constraints govern every decision below:

- **Minimal API surface.** Each ported component implements *only* what the configured `Tables[]` / `GameTables[]` → `wowsims.db` path exercises for the current live MoP-Classic build. No whole-library ports.
- **Licensing.** Per-file notices as spelled out in §4; CC BY-SA `.dbd` data is fetched at build time, never vendored into the MIT tree; `WoW.txt` TACT keys are user-supplied, never vendored.

> **Revised after maintainer review + verification against the vendored `.db2` files and the maintainer's live install.** (1) the build is **not pinned** — the tool tracks the live game and is re-run on every patch/hotfix (§1); (2) the committed `db.json` is built **with hotfixes**, so Phase D is **required** for parity (§6, §7 H4); (3) **the current tool uses NO TACT keys** — verified: every encrypted DB2 section in the vendored `.db2` is zero-filled and skipped, so the shipped data simply omits a small amount of pre-release content. Decrypting (Salsa20 + `WoW.txt`) is an **optional future enhancement**, not needed for parity (§7 C1, §4). (4) **[adversarial review 2026-07-16] the current tool never actually reads local CASC** — `Program.cs:41` constructs `BuildInstance()` without passing the JSON-bound settings, so `Settings.BaseDir` stays null and TACTSharp fetches configs, group/file indices, encoding, root, and every `.db2`/gametable byte from the **Blizzard CDN** into `tools/DB2ToSqlite/cache/` (~1.2 GB; blob timestamps match the vendored `.db2` to the minute). The local install supplies only `.build.info` and `DBCache.bin` (§2.1 step 5, §6 Phase B, §7 C3). The live install's local CASC files were separately verified *present and well-formed* — `.build.info`, `.idx` v7, archives, WoW root + TVFS (§7 C3, §10 Q4) — but they are **not what the current tool reads**; the planned local-first port is a deliberate behavior change, de-riskable with a one-line dotnet patch before any Go is written (§1 Stance, §6 Phase B).

---

## 1. Executive summary

`make db` / `make ptrdb` currently run a .NET 9 tool (`tools/DB2ToSqlite`) that extracts the live World of Warcraft build (MoP Classic, `wow_classic` / PTR `wow_classic_ptr`; the build is identified via the local install's `.build.info`, but the file bytes come from the Blizzard CDN — see the revision note above) into `tools/database/wowsims.db` plus 8 basestats `.txt` files, then run the existing Go generator (`tools/database/gen_db/*.go`) to emit the shipped `assets/database/db.{bin,json}`. This plan replaces the .NET half with a pure-Go tool at `tools/db2tool/`, removing dotnet from the build entirely.

**What changes**

- The first stage of `make db` / `make ptrdb` changes from `dotnet run` to `go run ./tools/db2tool ...`. Target names, settings files, and the second (`gen_db`) stage are unchanged.
- Four vendored .NET DLLs (TACTSharp, DBCD, DBCD.IO, DBDefsLib), the NuGet `Microsoft.Data.Sqlite` dependency, the `.csproj`, and the `.sln` entry are deleted.

**What does not change (the drop-in contract)**

- **`tools/database/wowsims.db`** — the SQLite schema, generated `[Col_i]` VIRTUAL columns, JSON-array text encoding, and exact-build column set are a frozen integration contract consumed by `tools/database/*.go` (sole reader: `dbhelper.go:22`, `sql.Open("sqlite", DatabasePath)` via `modernc.org/sqlite`).
- **`assets/db_inputs/basestats/*.txt`** — 8 GameTables copied verbatim.
- **`tools/DB2ToSqlite/listfile.csv`** — a *second* output contract (see §5), hardcoded in three downstream Go files.
- **`assets/database/db.{bin,json}` + `leftover_db.{bin,json}`** — the committed, shipped goldens produced by the unchanged `gen_db` stage. These are the true end-to-end acceptance target.

**Stance**

- **Pure Go, no cgo.** The existing `modernc.org/sqlite v1.37.0` (pure Go) writes the output — the same driver the reader already uses. All decompression/crypto is stdlib (`compress/zlib`, `crypto/md5`, `encoding/binary`) plus, only if a needed file is ever encrypted, `golang.org/x/crypto/salsa20`. The repo's one cgo file (`sim/lib/library.go`) is a separate `c-shared` target and is not on the `make db` path.
- **Keep the SQLite intermediate.** Do not go direct-to-`dbc`; the schema *is* the contract and keeping it makes the port a true drop-in and gives a clean per-half validation seam.
- **Local-install-first — a deliberate behavior change, not the status quo.** The current tool is CDN-fed (revision note above); the port reads the full local install instead. Same build config → same CKeys → same bytes, so parity is expected, but it must be *proven*: Phase B gate 1 byte-diffs the locally-extracted `.db2` against the CDN-sourced vendored ones. **Cheap de-risk before writing any Go:** TACTSharp's `Settings` fields are public and Program.cs already mutates them, so a one-line dotnet patch (`buildInstance.Settings.BaseDir = settings.BaseDir;`) makes the *current* tool exercise the local path — run it once and byte-diff the outputs (§6 Phase B pre-flight). CDN/Ribbit in Go stays deferred to an explicit, optional phase (§6 Phase C); porting CDN-first instead is the strict-parity fallback if local extraction ever proves incomplete.

**Live build, not pinned.** The tool always targets **whatever build the local install currently is** (via `.build.info`); `5.5.4.68571` was current at analysis time (listed verbatim in all 72 cached `.dbd`, with build-specific unnamed columns `Field_1_15_3_55112_014` / `Field_1_15_7_59706_054`). It is re-run whenever Blizzard patches or new hotfixes land, so the build number, the required `.dbd` (WoWDBDefs must already contain the new build), and the WDC format version are all **moving targets** the tool must track — not constants to hardcode. PTR differs by `Product = "wow_classic_ptr"` and, concretely, a *different build*: on the live install right now `wow_classic` = `5.5.4.68571` while `wow_classic_ptr` = `5.5.4.67849`.

**Required per-run inputs (all track the live game, none committed):** the `.dbd` schemas (fetched from WoWDBDefs) and the `listfile.csv` (path→FDID). **No TACT keys are used** — encrypted DB2 sections are skipped (§7 C1); a `WoW.txt` would only be needed if you later choose to decrypt pre-release content (§4). The committed `db.json` is generated **with hotfixes** applied (§6 Phase D).

**Overall effort: L–XL**, dominated by the WDC5 decoder and the local CASC/TACT reader.

---

## 2. Current pipeline (as-is)

### 2.1 `make db` data flow

```
make db  (makefile:249-255)
 ├─ cd tools/DB2ToSqlite
 │   └─ dotnet run -- -s <generator-settings.json> --output <abs .../wowsims.db>
 │        (ptrdb: ptr-generator-settings.json; only Product differs)
 │
 │   Program.cs (126 lines), 11 steps:
 │    1. parse --settings/-s, --output/-o
 │    2. load JSON: Settings→BindableSettings:TACTSharp.Settings + Tables[72],GameTables[8],
 │       GameTablesOutDirectory="../../assets/db_inputs/basestats", TargetDirectory="dbfilesclient"
 │    3. Listfile.Initialize(CDN, settings)            [downloads/caches 148 MB listfile.csv via HTTP, path→FDID]
 │    4. BuildInfo(BaseDir/.build.info)                [pick entry where Product==settings.Product]
 │    5. LoadConfigs(BuildConfig,CDNConfig); Load()    [configs + group/file indices + encoding + root + install
 │                                                      ALL fetched from the Blizzard CDN into cache/ —
 │                                                      Program.cs:41 creates BuildInstance() with a fresh default
 │                                                      Settings (BaseDir=null, never copied from the JSON settings),
 │                                                      so cdn.OpenLocal() is never called; local .idx/data.NNN unread]
 │    6. for GameTables: OpenFileByFDID(GetFDID("gametables/<n>.txt")) → write raw bytes to basestats dir
 │    7. for Tables:     OpenFileByFDID(GetFDID("<TargetDirectory>/<n>.db2")) → write <TargetDirectory>/<n>.db2;
 │                       fetch .dbd; DBCD.Load   [TargetDirectory does double duty: listfile-key prefix AND
 │                                                output dir (Program.cs:77-78) — see §7 M4 carve-out]
 │    8. buildNumber = uint.Parse(Version.Split('.')[3])          [= 68571]
 │    9. SqliteDbCreator.CreateDatabaseWithDefinitions(...)       [DELETES any existing output DB first
 │                                                                 (SQLiteDbCreator.cs:11) — every run starts
 │                                                                 from an empty file — then schema from DBD]
 │   10. HotfixManager.LoadCaches(BaseDir)                        [best-effort; throw commented out]
 │   11. per table: ApplyingHotfixes; SqliteDataInserter.InsertRows (upsert)
 │
 └─ go run tools/database/gen_db/*.go -outDir=./assets -gen=db
      reads wowsims.db (dbhelper.go:22) + tools/DB2ToSqlite/listfile.csv (icon map)
      + runs tools/database/overrides/{0,1,2}.sql (0.sql/1.sql create item_enchantment_template)
      → assets/database/db.{bin,json}, leftover_db.{bin,json}  (COMMITTED goldens)
```

### 2.2 The four vendored .NET libraries (source not in repo, DLLs only)

| Library | Upstream | Role in the tool |
|---|---|---|
| TACTSharp | github.com/wowdev/TACTSharp | CASC/TACT client: parse `.build.info`, load build/CDN configs, encoding + root, BLTE-decode, `OpenFileByFDID`; listfile path→FDID (Jenkins96). Has *both* a local-CASC read path (`.idx` + `data.NNN`) and a CDN one — **only the CDN path is exercised here** (BaseDir is never handed to it, §2.1 step 5), including `GroupIndex.Generate` (the four ~120 MB generated group indices in `cache/`). |
| DBCD.IO | github.com/wowdev/DBCD (subproject) | WDC5 binary DB2 decoder + `XFTH` hotfix reader. |
| DBCD | github.com/wowdev/DBCD | Thin orchestration: `Load(table, version)`, `row[col]`, `Values`, `ApplyingHotfixes`. |
| DBDefsLib | github.com/wowdev/WoWDBDefs (`code/C#/DBDefsLib`) | `.dbd` text parser → column/version definitions. |

Two helpers (`DBCacheParser.cs`, `HotfixManager.cs`) are copied from `github.com/Marlamin/wow.tools.local`. Output SQLite uses NuGet `Microsoft.Data.Sqlite 9.0.3`.

### 2.3 Downstream Go consumer (unchanged by this migration)

- `tools/database/dbhelper.go:22` — the *only* reader of `wowsims.db`.
- `tools/database/tables.go` — fixed SQL over named tables + generated `[Col_i]` columns; array base columns parsed as JSON text (`tools/database/utils.go:15` `parseIntArrayField`, `:29` `parseFloatArrayField`).
- `tools/database/icon_loader.go:13` `LoadArtTexturePaths` reads `listfile.csv` (`;`-delimited `FDID;path`), hardcoded at `gen_db/main.go:153`, `gen_protos.go:458`, `tables.go:1123`.
- `tools/database/dbc/spell_scaling.go:12` `//go:embed GameTables/SpellScaling.txt` — a committed copy independent of the extractor run.

---

## 3. Target architecture

### 3.1 Package layout (single module `github.com/wowsims/mop`, no new module)

```
tools/db2tool/
  main.go              cobra command (-s/--settings, -o/--output); faithful transcription of Program.cs's 11 steps
  config/              settings JSON binding: Settings{Region,Product,BaseDir,BuildConfig,CDNConfig,CacheDir,Locale,
                       RootMode,ListfileFallback,ListfileURL} + Tables[],GameTables[],GameTablesOutDirectory,TargetDirectory
                       (CacheDir is bound-but-unused in v1: the local path needs no CDN cache; Phase C would
                        reintroduce one under tools/db2tool/)
  dbd/                 .dbd text parser            -- BSD-3-Clause (derivative of DBDefsLib)
    dbd.go               DBDReader.Read + full DBDefinition model (incl. size/isSigned/isNonInline for the WDC5 reader)
    select.go            exact-build versionDef selection (see §5.5)
  wdc/                 WDC5 + XFTH decoders        -- MIT (derivative of DBCD / DBCD.IO)
    bitreader.go         byte-exact unaligned little-endian bit reader
    wdc5.go              header/sections/field-meta/column-meta/pallet/common/idlist/copytable/offsetmap/relationship
    section.go           per-section iteration + TactKeyLookup!=0 SKIP path (see §7 C1)
    row.go               DBD-driven field→meta mapping, id-field-offset, trailing-relation refID, sign/float32 reinterpret
    hotfix.go            Phase D only: XFTH v9 parse + SStrHash + PushId-ordered overlay
  tact/                CASC/TACT local read path   -- MIT (derivative of TACTSharp); Phase D helpers also cite wow.tools.local
    buildinfo.go         parse .build.info; select entry by Product; Version.Split('.')[3] → buildNumber
    config.go            build/CDN config key=value parse (values are `ckey [ekey]`; skip the ~318 `vfs-*` TVFS lines — unused, §10 Q4)
    cascidx.go           local .idx v7 (bucket XOR + packed archive/offset bits)
    dataarchive.go       data.NNN via os.ReadAt (no mmap) + 30-byte frame skip
    encoding.go          EN table (paged BE binary search + 40-bit sizes)
    root.go              TSFM/MFST WoW root (root CKey -> EKey via encoding); post-10.1.7 dfVersion 1/2; enUS locale
    blte.go              BLTE N/Z decode (stdlib zlib); F unimplemented (never hit); E chunks left zero-filled (skipped, §7 C1)
    (keys.go)            OPTIONAL, not in v1: only if you later decrypt pre-release content (Salsa20 + local WoW.txt)
    fdid.go              static name→FDID map (primary) + optional Jenkins96 + listfile.csv fallback
    cdn.go               Phase C only: versions/cdns, ranged archive GET, group/file .index
  sqlite/              output writer               -- original code (repo MIT, no attribution owed)
    schema.go            SQLiteDbCreator port (deletes any pre-existing output DB first — SQLiteDbCreator.cs:11, §5 lifecycle;
                         type map, PK, FK IX_ index, array TEXT + [Col_i] VIRTUAL)
    insert.go            SqliteDataInserter port (upsert, idx_ on relation cols in settings order, JSON arrays; NO relation-0->NULL — that C# path is dead code, §5.4)
  internal/golden/     validation harness (schema comparer, per-table row dumper) — see §8
```

**Boundary intent:** `dbd` knows no binary formats; `wdc` depends on `dbd` (types drive decode) but not `tact`; `tact` yields raw bytes and knows no DB2 semantics; `sqlite` consumes decoded rows + DBD metadata. `main.go` is the only meeting point.

Do **not** merge into `tools/database/dbc` — that package is a *consumer* of `wowsims.db`, not a decoder; there is nothing to share today. A future direct-to-`dbc` refactor is out of scope.

### 3.2 Reuse-vs-port decision table

| Component | Decision | Chosen Go lib / port source (license) | Minimal surface covered |
|---|---|---|---|
| SQLite writer | **Reuse** | `modernc.org/sqlite` v1.37.0 (BSD-3, already a dep, no cgo) + stdlib `encoding/json` | schema DDL + upsert insert only |
| `.dbd` parser | **Port** | from WoWDBDefs `code/C#/DBDefsLib` (**BSD-3**) | COLUMNS block + version blocks; exact-build select; 4 types {int,float,locstring,string} + dead-but-keep `uint`; throw on unknown |
| WDC5 record decoder | **Port** | from `wowdev/DBCD` `WDC5Reader`/`BitReader` (**MIT**); `jonathanherbst/model_export` `db2.go` (MIT) as algorithm oracle; `Frostshake/WDBReader` (MIT, C++) cross-check | WDC5 only (all 72 files are WDC5); 6 compression modes; multi-section; sparse/offset-map; copy-table; relationship; **encrypted-section skip** |
| DBCD storage/`Load` | **Port (thin)** | from `wowdev/DBCD` (**MIT**) | `Load` + `row[col]` + `Values` + array materialization; no writers/enums/locale-array/encryption-key |
| Hotfixes | **Defer (no-op v1)** | Phase D: `wowdev/DBCD` `HTFXReader` (MIT) + `wow.tools.local` `DBCacheParser`/`HotfixManager` (verify license) | XFTH v9 + SStrHash + PushId-ordered overlay — only if a concrete gap appears |
| CASC/TACT local read | **Port** | from `wowdev/TACTSharp` (**MIT**); `ladislav-zezula/CascLib` (MIT, C) as `.idx` reference; `erorus/casc` (MIT, PHP) cross-check | `.build.info`, config, `.idx` v7, `data.NNN`, encoding, TSFM root, BLTE N/Z; **ignore TVFS** (`vfs-*` entries are in the build config but unused — §10 Q4), no InstallInstance, no GroupIndex.Generate |
| BLTE | **Port** (part of `tact`) | stdlib `compress/zlib` | N + Z (the only modes needed); F never hit; **no LZ4 mode exists — do not add pierrec/lz4**. 'E' appears only in skipped encrypted sections (§7 C1) — left zero-filled, not decoded in v1 |
| CDN/Ribbit fallback | **Defer (Phase C)** | stdlib `net/http` | optional; only for install-free builds |
| listfile FDID resolution | **Reuse file, replace mechanism** | static `name→FDID` map (primary); Jenkins96 + `listfile.csv` fallback | 80 fixed paths/FDIDs (72 `dbfilesclient/*.db2` + 8 `gametables/*.txt`; 79 unique *names* since `SpellScaling` appears as both); FDIDs stable per path |
| TACT keys + 'E' decrypt | **Skip (not in v1); optional later** | `golang.org/x/crypto/salsa20` + a `WoW.txt` (wowdev/TACTKeys) if ever enabled | The current tool uses no keys and skips every encrypted section (§7 C1); v1 matches that. Build this only if you later want pre-release content — it would add currently-skipped rows and thus **change** output vs today's golden |

**No importable pure-Go option exists** for CASC/TACT or WDC5. Rejected candidates: `superp00t/gophercraft` (GPL-3.0, non-compiling stub), `lukegb/snowstorm` (cgo, WoD-era root), `jybp/casc` (no LICENSE file → cannot vendor; no WoW root, no WDC), `gtker/wow_dbc` (Rust, classic WDBC only), `erorus/db2` (PHP, tops at WDC3). All are reference-only.

---

## 4. Licensing & attribution

Ground truth (already confirmed against upstream LICENSE files):

| Upstream | License | Obligation on our ported files |
|---|---|---|
| TACTSharp | MIT | `tools/db2tool/tact/*.go` carry an upstream MIT copyright/attribution notice header. |
| DBCD + DBCD.IO | MIT | `tools/db2tool/wdc/*.go` carry an upstream MIT copyright/attribution notice header. |
| WoWDBDefs **code** (DBDefsLib, the `.dbd` parser) | **BSD-3-Clause** | A Go translation is a derivative work: `tools/db2tool/dbd/*.go` carry a **BSD-3-Clause** notice + copyright + the non-endorsement clause, and **stay BSD-3** (not relicensed to MIT). BSD-3 is compatible with the MIT repo. |
| WoWDBDefs **data** (`.dbd` files) | **CC BY-SA 4.0** | **Do NOT vendor into the MIT tree.** Keep fetching at build time (see below). |
| wow.tools.local (`DBCacheParser`, `HotfixManager`, SStrHash S-box) | verify before copying | Phase D only; carry upstream notice if ported. |
| **`WoW.txt` TACT keys** (wowdev/TACTKeys) — **only relevant if you opt into decryption (not in v1)** | **NONE (no `LICENSE`; GitHub license API 404 → all-rights-reserved by default)** | The current tool uses no keys, so this is moot for v1. If decryption is ever added: **do NOT vendor** — supply/fetch `WoW.txt` at runtime and resolve the redistribution question (§10 Q11) first. Keys are hex facts, but the repo grants no license. |
| `modernc.org/sqlite` (replaces Microsoft.Data.Sqlite) | BSD-3 | already a dep; no new obligation. |

Model export / WDBReader oracles are MIT; if a specific algorithm is cross-checked against them, add a one-line note in the relevant `wdc/*.go` header. Pin the exact upstream commit for any oracle used.

**`.dbd` data handling decision (recommended):** mirror `GithubDBDProvider` — fetch `https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/<Table>.dbd` at build time, cache under a **gitignored** `DBDCache/` with the 24h-mtime rule. This matches the current clean state (verified: `DBDCache/*.dbd` and `listfile.csv` are already gitignored). The extracted game facts that flow into `wowsims.db` are *not* bound by share-alike; the `.dbd` files themselves are. **Fallback if offline/CI reproducibility ever forces vendoring:** isolate the ~72 `.dbd` under a clearly-attributed directory retaining CC BY-SA 4.0 + share-alike notice, do not relicense — a separate, reviewed decision, not part of this port.

**Concrete NOTICE plan (decide once, before coding, to avoid per-file drift):**

1. Add `tools/db2tool/NOTICES.md` (or `THIRD_PARTY_NOTICES`) listing each upstream (URL, license, pinned commit) and which package directory derives from it.
2. Standardize a 3–5 line header block per license (one for MIT-attribution, one for BSD-3-with-non-endorsement). Every new file in `dbd/`, `wdc/`, `tact/` opens with the correct block.
3. `sqlite/` and `config/` are original repo code (the schema/insert rules are facts, not a translation) — standard repo MIT, no attribution header needed.
4. Keep `.dbd` fetched-not-committed and `listfile.csv` gitignored, unchanged from today.

---

## 5. The output / schema contract to preserve

Every rule below is byte-exact-critical for the tables the consumer reads (§5.6); the ~11 "slack" tables must merely extract without error.

**Run lifecycle (easy to miss — it lives in the helper, not Program.cs):** `CreateDatabaseWithDefinitions` first **deletes the output file if it exists** (`SQLiteDbCreator.cs:11`) — the port must recreate `wowsims.db` from scratch on every run. `CREATE TABLE IF NOT EXISTS` (§5.3) and the upsert (§5.4) therefore only ever see a fresh file — keep the `IF NOT EXISTS` text verbatim anyway, because the §8 step-3 schema gate diffs `sqlite_master` DDL, which contains it. Delete-first is what makes post-patch re-runs and `make db`/`make ptrdb` alternation (shared `CLIENTDATA_OUTPUT`, different builds — §1) correct: without it, upserts never delete removed rows and `IF NOT EXISTS` silently keeps a stale build's schema (e.g. the build-suffixed `Field_*` column names, §5.5).

### 5.1 Version-definition selection (drives the whole schema)

Per table: `versionDef = the LAST versionDefinition in file order whose Builds contains a Build with build == buildNumber`, where `buildNumber = uint(Version.Split('.')[3])` **from the live install** (`68571` at analysis time, but it changes on every game patch — §1). **Exact equality**, `builds` only — `buildRanges` and `layoutHashes` are *not* consulted. This must be replicated bug-for-bug (see §7 H1 / §5.5). Because the build moves, the matching `.dbd` for the *current* build must already exist in WoWDBDefs before a run; if not, fail loud (do not fall back to a nearby build — §5.5).

**Scope caveat — this is the SQLite helpers' rule, and the C# tool actually has *two* selection rules.** The builds-only, trailing-build-number, LAST-match rule above is what `SQLiteDbCreator.cs:35` / `SqliteDataInserter.cs:13` use. The row-decode half (`DBCD.Load`, Program.cs:84) uses a different one: DBDefsLib's `GetVersionDefinitionByBuild` takes the **FIRST** block whose `builds` contains the **full 4-part** version (`5.5.4.68571`) *or* whose `buildRanges` contains it, with a **layoutHash fallback** when no build matches. Today both rules resolve to the same block for every table (verified against all 72 cached `.dbd`: no build listed in two blocks; ranges exist up through 5.4.8 but none contains 5.5.4.68571), so the port's single exact-build selector (`select.go`) is a *deliberate simplification of two C# rules*, not a transcription of one. Keep the fail-loud error when the exact build is absent — that is precisely the case where the C# halves diverge (decode would succeed via range/layoutHash while the helpers NRE on a default-struct `versionDef` at `SQLiteDbCreator.cs:40`).

### 5.2 Scalar columns (`arrLength == 0`)

- Type map: `int`/`uint` → `INTEGER`; `float` → `REAL`; `string`/`locstring` → `TEXT`. **Throw on anything else** (matches `MapToSqLiteType`).
- `[Name] <type>`. Append ` NULL` iff the column has both `foreignTable` and `foreignColumn` set **and** is not the ID column. Append ` PRIMARY KEY` iff `isID`.
- If FK (both foreign fields set): also emit `CREATE INDEX IF NOT EXISTS IX_<table>_<name> ON [<table>] ([<name>])`.
- `locstring` maps to a single `_lang` TEXT column named verbatim from the DBD (`Display_lang`, `Name_lang`, `HordeName_lang`, …). **No suffix synthesis, no locale array** — this is settled by the DBD, not open.

### 5.3 Array columns (`arrLength > 0`)

- One real column `[Name] TEXT` holding a JSON array.
- Plus, for `i` in `0..arrLength-1`, a generated column:
  `[Name_i] <elemType> GENERATED ALWAYS AS (json_extract([Name], '$[i]')) VIRTUAL`
  where `<elemType>` is the type map applied to the base type.
- `CREATE TABLE IF NOT EXISTS [<table>] (...)`; then FK index statements. `PRAGMA foreign_keys = ON;` is set for parity but no `FOREIGN KEY` constraints are emitted — only indexes.

### 5.4 Inserts

- Preserve `versionDef.definitions` column order.
- Upsert: `INSERT INTO [<table>] ([c1],...) VALUES (@c1,...) ON CONFLICT([pk]) DO UPDATE SET [c]=excluded.[c] ...` for every non-PK column; if only the PK exists → `DO NOTHING`.
- For each `isRelation` column: `CREATE INDEX IF NOT EXISTS idx_<col-lowercased> ON <table> (<col>);`. **The index name omits the table**, so with `IF NOT EXISTS` only the *first* table processed with a given relation-column name gets the index (reference DB has exactly 11 `idx_*`; e.g. `idx_spellid` lands on `SpellMisc` only, by settings order). The port must create indexes in settings-`Tables[]` order with the same table-less names — and must **not** iterate tables via a Go map anywhere (also §7 M3).
- Per row: `NULL` for missing values; array values JSON-serialized as `[a,b,c]`. **Do NOT convert relation-0 to NULL:** the C# `if (colDef.isRelation && value == (object)0)` (`SqliteDataInserter.cs:78`) is a *boxed reference comparison* that is always false — dead code. The reference DB keeps 0s (e.g. `ItemSubClass.ClassID` has 9 zero rows, no NULLs), so the port must insert 0 as 0. Replicating the *apparent* intent would break row parity on `ItemSubClass` / `ItemUpgrade` / `ItemNameDescription` (all critical).

### 5.5 Array-serialization hazards the consumer enforces (verified in `tools/database/utils.go`)

- `parseIntArrayField` (`utils.go:15`) returns `nil,nil` on `""`, else unmarshals and **errors unless `len == expectedLen`**. Used on many base TEXT columns (non-exhaustive): `EffectMiscValue`(2), `EffectSpellClassMask`(4), `ImplicitTarget`(2), `ItemSparse.StatModifier_bonusStat`→`BonusStat`(10) / `SocketType`→`Sockets`(3), `SpellItemEnchantment` triplets, and `Spell*` masks incl. a 17-length `Attributes`.
- `parseFloatArrayField` (`utils.go:29`) has **no empty-string guard** — `""` → error. Used on `StatPercentageOfSocket`(10), `Field_1_15_3_55112_014`→`StatAlloc`(10), `StatModifier_bonusAmount`→`BonusAmountCalculated`(10), `StatPercentEditor`→`SocketModifier`(10), `ItemDamage*.Quality`(7).

**Consequence:** array columns must serialize as a JSON array with **exactly `arrLength` elements**, matching what C# `JsonSerializer.Serialize` emits for an all-zero/empty array (i.e. `[0,0,...]`, not `NULL`/`[]`/`""`). Confirm the C# emission and match it byte-for-byte, or `make db` dies in the consumer.

**Float precision (load-bearing):** DBD `type=="float"` fields must be decoded and marshaled as **`float32`**, not `float64`. Go's `encoding/json` prints 32-bit-precise text only for a `float32` value; an upcast makes `0.1f` become `0.10000000149011612` in both the JSON text and the `json_extract` REAL column — silently wrong item stats. **Scalar** float REAL columns differ but come out right: binding a `float32` stores the double-widened value (verified: `SpellProcsPerMinute.BaseProcRate` = `0.5809999704360962`), which `database/sql` reproduces automatically — so bind scalars as `float32` and let widening happen; don't format either side as text.

**Float *notation* divergence (verified — `float32` + raw `json.Marshal` is NOT full text parity):** .NET's shortest-round-trip formatter switches to scientific notation (uppercase `E`, two-digit zero-padded exponent) for `|v| < 1e-4` or `>= 1e15`; Go's `encoding/json` does so only for `|v| < 1e-6` or `>= 1e21` (lowercase `e`, unpadded). Already observable in real data: `CurvePoint` Id=236585 stores `Pos = "[1,-6E-05]"` (reference) where Go emits `"[1,-0.00006]"` — the only E-notation values in the entire DB today, and `CurvePoint` is slack (§5.6) with no reader under `tools/database`. **Resolution:** keep raw `json.Marshal`, scope array-text byte parity to the critical set (§5.6, §8 step 4), and add a harness assertion that no *critical*-table float array element falls in the divergent ranges `[1e-6,1e-4)` / `[1e15,1e21)` — if that assertion ever fires, implement a small .NET-compatible float32-to-text formatter for JSON array elements instead. **String-array escaping (future-proofing):** no string/locstring *arrays* exist in the 68571 blocks, but if one ever appears, C# `JsonSerializer` escapes non-ASCII/HTML as uppercase `<` while Go emits lowercase `<` / raw UTF-8 — a byte-parity trap to handle then.

**Schema shape is build-dependent, not just values:** `ItemRandomSuffix.dbd` defines `AllocationPct` as `<32>[3]` in one build block and `<u16>[5]`/`<32>[5]` in others. The consumer reads `AllocationPct_0..AllocationPct_4` (5 virtual columns); a wrong version block yields `arrLength=3` → columns `AllocationPct_3/_4` don't exist → `tables.go` fails "no such column". This is why exact-build match must be replicated and why "nearest ≤ build" is unsafe. On no match, fail loud (not nil-panic).

### 5.6 Byte-exact-critical vs slack tables

**Critical (row + value parity required):** `Item`, `ItemSparse`, `SpellEffect`, `SpellItemEnchantment`, `ItemRandomSuffix`, `RandPropPoints`, `SpellMisc`, all 8 `ItemDamage*`, `ItemArmorQuality/Shield/Total`, `ArmorLocation`, `GemProperties`, `ItemEffect`, `ItemClass`, `ItemSubClass`, `ItemSet`, `ItemNameDescription`, `RulesetItemUpgrade`, `ItemUpgrade`, `Spell` + the large joined set (`SpellName`, `SpellLevels`, `SpellCooldowns`, `SpellScaling`, `SpellLabel`, `SpellCategories`, `SpellCategory`, `SpellDuration`, `SpellPower`, `SpellInterrupts`, `SpellEquippedItems`, `SpellAuraOptions`, `SpellClassOptions`, `SpellShapeshift`, `SpellXDescriptionVariables`, `SpellDescriptionVariables`, `SpellTargetRestrictions`, `SpellRange`, `SpellRadius`, `SpellProcsPerMinute`, `SpellProcsPerMinuteMod`), `GlyphProperties`, `SkillLineAbility`, `Talent`, `Faction`, `Map`, `JournalEncounter/EncounterItem/Instance`, `AreaTable`.

**Slack (extract without error; schema/values not in today's acceptance test):** `ItemSetSpell`, `ItemSubClassMask`, `ItemReforge`, `ItemBonus`, `ItemRandomProperties`, `ItemExtendedCost`, `Curve`, `CurvePoint`, `ScalingStatDistribution`, `SpellReagents`, `SpellMechanic` (and, subject to grep-caveat, `Difficulty`, `TalentTab`, `SkillLine`).

### 5.7 The other two outputs

- **8 basestats `.txt`** written verbatim; **filename casing preserved from settings** (`chancetomeleecrit`, `chancetomeleecritbase`, `chancetospellcrit`, `chancetospellcritbase`, `combatratings`, `octbasempbyclass`, `OCTBaseHPByClass`, `SpellScaling`). `SpellScaling.txt` additionally exists as a committed `//go:embed` at `tools/database/dbc/GameTables/SpellScaling.txt` — independent of the run; document that it is not auto-synced.
- **`listfile.csv`** must still exist at the path the consumer expects (see §9 for the repoint decision).
- **`item_enchantment_template`** is created by `tools/database/overrides/{0,1}.sql` (`RunOverrides`, `dbhelper.go:63`), **not** by DB2 — the port must not fold it in.

---

## 6. Phased implementation plan

Each phase ends with a concrete golden-diff gate (§8) before the next begins. The validation assets are two references re-captured per build by today's dotnet tool on a WoW-installed machine — `wowsims.nohotfix.db` (gates A/B) and `wowsims.hotfix.db` (gates D) — plus the `dbfilesclient/*.db2` and `DBDCache/*.dbd` it drops (§8 step 1, §10 Q5).

### Phase A — `.dbd` parser + WDC5 decoder + SQLite writer (fed by pre-extracted `.db2`)

**Scope.** Everything downstream of file extraction, decoupled from CASC:
- `dbd`: full parser + exact-build `versionDef` selection (§5.1), complete data model (incl. `size`/`isSigned`/`isNonInline` for the reader). Strip UTF-8 BOM; handle CRLF; hard-error on a version-field name absent from COLUMNS.
- `wdc`: WDC5 reader — header (magic assert `"WDC5"`; fail loud on WDC6+), **multi-section iteration** (only 51/72 are single-section; core tables have 26–36), all 6 compression modes (None / Immediate / SignedImmediate / Common / Pallet / PalletArray), id-list, copy-table, sparse/offset-map inline strings (**`Spell` and `ItemSparse` are both `Flags=0x5` = Sparse(0x1)|Index(0x4)**, i.e. sparse + non-inline id list; per DBCD `DB2Flags`, `SecondaryKey` (0x2) is *not* set on any table here), relationship/parent-lookup trailing FK columns, negative-base string-offset resolution, and the **encrypted-section skip path** (§7 C1). No hotfixes.
- `sqlite`: schema creator + inserter (§5.2–§5.5), incl. `float32` marshaling and strict-length arrays.
- Temporary driver: read `.db2` from `tools/DB2ToSqlite/dbfilesclient/` and `.dbd` from `DBDCache/`; `buildNumber` passed as a flag.

**Key tasks:** bit reader (byte-exact unaligned LE load + shift pair); section skip + copy-of-skipped-source drop; DBD field→meta index mapping (id-field-offset, `fieldIndex >= Meta.Length` → refID); JSON array shaping to match C#.

**Exit criteria.**
1. **Schema parity:** all 72 tables — `sqlite_master` DDL (whitespace-normalized) identical to reference, including PK / `NULL` / `IX_*` / `idx_*` / `[Col_i]` VIRTUAL count and DBD-derived names (`Field_1_15_3_55112_014`, `Field_1_15_7_59706_054`).
2. **Row parity:** every critical table (§5.6) — `SELECT * ORDER BY <pk>` canonical dump equals reference; **row counts checked first** as a cheap tripwire (encrypted-skip makes this non-trivial — see §7 C1). Slack tables must extract without error only.
3. **End-to-end:** `go run tools/database/gen_db/*.go -outDir=./assets -gen=db` against the Go DB yields **byte-identical** `assets/database/db.json` / `leftover_db.json` vs the reference DB (control ordering per §7/§8; run gen_db against *copies* — it mutates its input via `RunOverrides`, §8 step 1). This is the true acceptance test.

**Effort: L** (dbd = S, sqlite = S, WDC5 decoder = L and dominates; multi-section + sparse + encrypted-skip on the core tables is the critical path).
**Dependencies:** none (uses pre-extracted artifacts). Proves the correctness core with zero CASC code.

### Phase B — Local CASC/TACT extraction (a deliberate behavior change: the current tool is CDN-fed, §2.1 step 5)

**Scope.** Replace the pre-extracted-`.db2` driver with real extraction from a local install. Note this is *new* behavior, not a transcription — the .NET tool fetches everything from the CDN (revision note, §1 Stance); the local path is chosen because it is simpler (no HTTP, no group-index generation, no 1.2 GB cache) and because gate 1 gives an exact oracle. Components:
- `tact`: `.build.info` parse + entry-by-Product + `Version.Split('.')[3]`→`buildNumber`; build/CDN config parse; local `.idx` v7 (bucket XOR, packed offset/archive bits, +30 frame); `data.NNN` via `os.ReadAt`; EN encoding table; TSFM root (post-10.1.7 dfVersion 1/2, enUS); **BLTE N/Z only** (encrypted 'E' chunks stay zero-filled, so the WDC layer skips those sections — matching the keyless .NET tool; §7 C1). No Salsa20 / `WoW.txt` in v1.
- `OpenFileByFDID`: FDID → root CKey → encoding EKey → local `.idx` → `data.NNN` → BLTE.
- FDID: static `name→FDID` map (primary) + optional Jenkins96 + `listfile.csv` fallback.
- GameTables extraction: open `gametables/<name>.txt` by FDID, write raw bytes to `GameTablesOutDirectory`, **preserving filename casing**.
- **`listfile.csv` contract fix** (§9): repoint the three hardcoded literals in the same change.
- **CWD/relative-path fix** (§7 M4): resolve `GameTablesOutDirectory`, `TargetDirectory`, `DBDCache/`, `listfile.csv` relative to the settings file (or repo root), not the process CWD.
- **HTTP fetchers (the current tool does these every run — they are NOT CASC/CDN and belong here, not Phase C):** (a) fetch each `.dbd` from `https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/<Table>.dbd` into the gitignored `DBDCache/` with a 24h-mtime refresh (mirrors `GithubDBDProvider`); (b) fetch/refresh `listfile.csv` from `ListfileURL` (HEAD + Last-Modified, honoring `ListfileFallback`). Without these, a fresh machine — or any machine after a game patch (new-build `.dbd` mandatory per H1; listfile gains new FDIDs) — cannot run `make db`.
- Wire `makefile` (§9).

**Exit criteria.**
1. On a machine with a real `wow_classic` install, the tool produces a `wowsims.db` passing all Phase A criteria; first gate is a per-table diff of the extracted `.db2` bytes vs the vendored `dbfilesclient/*.db2` (a free exact oracle).
2. 8 basestats `.txt` byte-identical to the committed files.
3. `make db` runs end-to-end **with no dotnet installed** → byte-identical `db.json` / `leftover_db.json`.
4. Fail-loud (not nil-panic) when: a table's build isn't in the `.dbd`; `BaseDir` is missing; a needed FDID isn't in the local `.idx`.

**Effort: L** (~6 byte-exact parsers; local-first avoids CDN).
**Dependencies:** Phase A. **Pre-flight:** the live install's local CASC files are verified *present and well-formed* (`5.5.4.68571`): the build config has a usable WoW `root` (TVFS coexists but is unused — skip `vfs-*` lines, §10 Q4); 16 `.idx` buckets (v7 confirmed: 9-byte keys, 30-bit offsets), 27 `data.NNN` (~1 GB each), `config/` (build+cdn), prebuilt `indices/*.index`; Install Key + KeyRing are empty in `.build.info` (no InstallInstance, no keyring). **But the current tool never reads any of it** (§2.1 step 5), so the load-bearing precondition — *every needed FDID resolves through the local `.idx` to a resident `data.NNN` chunk* (only the unencrypted section 0 matters; the rest are skipped encrypted sections, §7 C1) — is **unproven**. Prove it before writing Go: apply the one-line dotnet patch (`buildInstance.Settings.BaseDir = settings.BaseDir;` after Program.cs:41), run the tool, and byte-diff the extracted `.db2`/gametables against a CDN-fed run's (§1 Stance). That also pins the exact TSFM `dfVersion` question (§10 Q4) against the local root. In the ported local path, `GroupIndex.Generate` and InstallInstance are never needed — fail loud if hit (the as-is CDN tool *does* generate group indices; that code is not ported). Encrypted DB2 sections are BLTE-'E' chunks; leaving them zero-filled (no keys) reproduces today's output (§7 C1), so v1 needs no key handling.

### Phase C — CDN/Ribbit fallback (optional; only if install-free builds are wanted)

**Scope.** `tact/cdn.go`: patch-service `versions`/`cdns`, host selection, config-by-hash fetch, ranged archive GET, group/file `.index` footer/TOC binary search. (The `.dbd` and `listfile.csv` HTTP fetches live in Phase B, not here — they are plain GETs the tool always needs, independent of CASC/CDN.)

**Exit criteria.** With `BaseDir` empty/incomplete, the tool downloads missing pieces and still produces a Phase-A-passing DB; `make db` succeeds with no WoW install.

**Effort: L–XL** (largest networking surface, incl. `GroupIndex.Generate` — the as-is tool builds four ~120 MB group indices). **Explicitly optional, but note the framing:** the CDN path is what the *current* tool actually uses (§2.1 step 5), so porting it is the strict-parity route; it is deferred anyway because the local path is smaller and Phase B gate 1 proves byte equivalence. Pursue Phase C only for CI/install-free builds — or promote it if the Phase B pre-flight ever shows local extraction incomplete.
**Dependencies:** Phase B.

### Phase D — Hotfixes (REQUIRED for parity with the committed `db.json`)

**Scope.** `wdc/hotfix.go`: XFTH v9 header + 28-byte entry parse (the entry follows a 4-byte per-record `XFTH` magic); SStrHash (verbatim 16-entry S-box) `name→tableHash`; byte-aligned sequential blob decode driven by the same DBD field metadata + non-inline-ID rule; `CombineCache` dedup; add/delete overlay (verified against DBCD.IO 2.1.2: `ReadHotfixes` applies records in an explicit stable ascending-PushId sort — LINQ `orderby x.PushId`, file/combine insertion order preserved within a PushId. Row ops via `DefaultProcessor`: Add iff `IsValid && DataSize > 0`, else Delete when `shouldDelete`, else Ignore; `shouldDelete` is false only for tableHash `0xDF2F53CF` (TactKey) and `0x021826BB` (BroadcastText) while a valid PushId == -1 record with data exists — neither table is in our `Tables[]`, so for this port `shouldDelete` is always true and the rule collapses to the plain add/delete overlay. `Combine` dedups via `HashSet<HTFXRow>` whose `GetHashCode` also hashes the record's *data bytes* — port dedup as full-record identity (PushId, TableHash, RecordId, IsValid, DataSize, **plus data bytes**), not the 5-tuple alone); exact `buildNumber` match. `HotfixManager.LoadCaches` scans `caches/*.bin` + `<BaseDir>/**/DBCache.bin`. `knownPushIDs.json` (untracked, written by `HotfixManager`) is logging-only — **do not reproduce it**. In Phases A–C this is a **no-op stub**, but it is **not optional overall**: the maintainer confirmed the committed `db.json` is generated **with** hotfixes applied from the local client's `DBCache.bin`. To reproduce the shipped artifacts, the port must apply them too.

**Exit criteria.** A run *with* the same `DBCache.bin` matches the committed (with-hotfix) `db.json`; a run *without* matches the un-hotfixed reference used to gate Phases A/B (§8). Also quantify which sim-read fields hotfixes actually touch, to bound risk.

**Effort: M** (S for hotfix-specific code; rides the Phase A field-metadata layer).
**Dependencies:** Phase A (field metadata). **Sequencing note:** because the end-to-end golden gate (§8 step 6) diffs the *committed, with-hotfix* `db.json`, that gate cannot fully pass until D lands — Phases A/B must gate against a freshly-regenerated *without-hotfix* reference instead (§8).

**Net recommendation:** execute **A → B → D** (D is required for committed-artifact parity, though it can land last since A/B gate against a without-hotfix reference); treat **C** as opt-in. That removes dotnet from `make db`/`make ptrdb` for the real workflow while proving correctness at every step.

---

## 7. Risks & blockers

Risk IDs are historical labels kept stable for cross-references; the **Sev** column is authoritative (C1 was downgraded to High and M5 to Low after verification; M6 was upgraded and renamed H4).

| ID | Sev | Risk | Mitigation |
|---|---|---|---|
| C1 | High | **Encrypted DB2 sections are skipped — the tool uses NO TACT keys (VERIFIED against the vendored `.db2`).** Most core tables have 35 encrypted sections of 36 (`TactKeyLookup != 0` — `Item`/`Spell`/`SpellEffect`/`SpellMisc`/`ItemEffect`/`SpellName`; `ItemSparse` is 25 of 26; section 0 is always the sole unencrypted section), and in the extracted files **all encrypted sections are zero-filled** → DBCD skips them. This is a small amount of pre-release content: per-section counts are tiny (mostly 1–41). Exact check: `SpellEffect` header `record_count` 142756 − 136 encrypted rows = **142620, the DB row count**. The committed `db.json` is this keyless-skip result. Consequences: header `record_count` ≠ emitted rows; copy-table entries whose source is in a skipped section are dropped. | Port DBCD's exact skip test — `TactKeyLookup != 0` **and** the section's record-data all-zero (WDC5Reader also guards first id-list value 0 / first sparse-entry size 0) → skip the section and its copies — a small, well-defined path, **no crypto**. Never derive expected row count from header `record_count`. Golden-diff row counts table-by-table (§8). Decryption is an optional future enhancement (§3.2/§4) that *changes* output — out of scope for a parity port. |
| C2 | **Critical** | **WDC5 decoder correctness.** No importable pure-Go reader; must be byte-exact across ~50 critical tables. Multi-section (26–36 on core tables), sparse offset-map (`Spell` + `ItemSparse` both `Flags=0x5`), 6 compression modes, trailing non-inline relations, negative-base string offsets, and **sign/float32 reinterpretation** each silently corrupt on a single off-by-one. | Golden-diff every critical table vs reference (Phase A). DBCD `WDC5Reader`/`BitReader` as exact spec; `model_export/db2.go` as oracle. WDC5-only (no version matrix). Tolerate 0-section/0-record files (`ItemBonus.db2` is empty). |
| C3 | **Critical** | **Local CASC/TACT read path.** ~6 byte-exact parsers (`.idx` bucket XOR + packed bits, `data.NNN` 30-byte frame, EN 40-bit BE sizes, TSFM dfVersion 1/2 root, BLTE N/Z); any failure yields empty/garbage with no crash. The live install's files are verified *present and well-formed* — `.idx` v7 (9-byte keys, 30-bit offsets), 16 buckets, 27 `data.NNN`, build+cdn configs, prebuilt `indices/`; `.build.info` Install Key + KeyRing empty — **but the current tool never reads them** (§2.1 step 5): the local path is *new behavior*, and its precondition (every needed FDID resident in local archives) is unproven until the Phase B pre-flight. | Prove residency first via the one-line dotnet BaseDir patch + byte-diff (§6 Phase B pre-flight); then diff Go-extracted `.db2` bytes vs vendored `dbfilesclient/*.db2` (free exact oracle). stdlib primitives; `os.ReadAt` not mmap. Skip `vfs-*` config lines (TVFS present but unused, §10 Q4). In the *ported local path*, fail loud if `GroupIndex.Generate` / InstallInstance are ever hit (the as-is CDN tool does run `GroupIndex.Generate` — that code is not ported). |
| H1 | High | **Exact-build `.dbd` match fragility — a recurring operational reality, not a one-off (CORRECTED — the build is not pinned; the tool tracks the live game).** `versionDefinitions.LastOrDefault(v => v.builds.Any(b => b.build == <live build>))`; every game patch changes the build, so each run depends on WoWDBDefs *already* containing that build. Schema (incl. `Field_*` names, `AllocationPct` arrLength) derives from that block; relaxing the rule silently changes the contract (§5.5). | Replicate exact-match bug-for-bug; emit a **clear error** ("build N not in WoWDBDefs yet — wait for upstream"), not a nil-panic, on no match. Refresh `.dbd` per run. Any range fallback is a separate, reviewed change. |
| H2 | High | **`listfile.csv` second contract.** Hardcoded at `gen_db/main.go:153`, `gen_protos.go:458`, `tables.go:1123`; 148 MB; also needed for extractor FDID lookup. Easy to overlook since it's not the `.db`. | Repoint all three literals in Phase B (§9). Static FDID map removes the download *from extraction*, but the icon map still needs the full listfile — keep producing/caching it. |
| H3 | High | **Float32 precision** (§5.5). `float64` marshaling silently corrupts item stats in `db.json`. | Decode/marshal DBD `float` as `float32`; spot-check anchored IDs incl. float values (§8). |
| M1 | Med | **CI without a WoW install.** `make db` needs a ~100 GB local install; no CI runner has it. *Not a regression* — the dotnet tool has the same constraint and outputs are committed, so CI never runs `make db`. Consequence: the port is validated on a maintainer machine, not CI. | Keep `make db` maintainer-run. Phase A validates offline against vendored `.db2`; Phase B against vendored `.db2` outputs. |
| M2 | Med | **Byte-diffing the `.db` file fails spuriously.** Microsoft.Data.Sqlite vs modernc differ in SQLite version, page size, journal/encoding PRAGMAs, rowid/freelist. | Validate *logically* — schema DDL + per-table `ORDER BY pk` dumps + `db.json` text diff (§8). Never MD5 the `.db`. |
| M3 | Med | **Row/section ordering vs the committed `db.json`.** Section iteration / copy-table / Go map order can produce a logically-equal DB but a different (committed, text) `db.json`. | Guarantee deterministic order matching C#, or make the `db.json` gate order-insensitive; don't assume `git diff db.json == 0` without controlling order. |
| M4 | Med | **CWD / relative-path contract.** `make db` does `cd tools/DB2ToSqlite && dotnet run`; `GameTablesOutDirectory="../../assets/db_inputs/basestats"`, `TargetDirectory`, `DBDCache/`, `listfile.csv` all resolve relative to that dir. `go run ./tools/db2tool` from repo root resolves `../../...` above the repo. | Resolve these paths relative to the settings file (or repo root) in `config`/`main.go`; re-pin every relative base deliberately in Phase B. **Carve-out:** `TargetDirectory` is used *twice* in Program.cs (lines 77-78) — resolve only the on-disk output-directory use; any Jenkins96/listfile FDID lookup (the §3.2 fallback) must key on the raw game path `dbfilesclient/NAME.db2` (the unresolved settings value), never a resolved filesystem path — a resolved path hashes to a listfile miss (`GetFDID` → 0) and `OpenFileByFDID` throws "File not found in root". The primary static name→FDID map (§3.2) is immune. |
| M5 | Low | **BLTE 'E' decode is NOT needed for parity (VERIFIED — the tool runs keyless).** Encrypted chunks arrive zero-filled and their sections are skipped; N + Z cover every other chunk. | Implement N + Z only; leave 'E' chunks zero (do not error). F never occurs; ARC4 ('A') not needed. Salsa20 + `WoW.txt` is an optional enhancement (§3.2), deliberately out of v1 parity scope. |
| H4 | High | **Hotfixes are applied in the committed output (CORRECTED — maintainer confirmed `db.json` is generated WITH hotfixes).** DBCache content is machine/time-dependent, but the shipped artifacts include it, so a faithful port must apply hotfixes to reach parity. | Phase D is **required** (not a permanent stub). Gate Phases A/B against a freshly-regenerated *without-hotfix* reference; gate the final committed `db.json` only after D. Quantify which sim-read fields hotfixes touch to bound scope. |
| L1 | Low | **Licensing correctness.** | Per-file headers + `NOTICES.md` (§4); `.dbd` fetched-not-vendored; `listfile.csv` gitignored. `WoW.txt`/TACTKeys (no license) is only a concern if the optional decrypt path is ever built (§4, §10 Q11) — not for v1. |
| L2 | Low | **no-cgo** already satisfied; `modernc.org/sqlite` verified for VIRTUAL cols + `json_extract` + `ON CONFLICT` + `PRAGMA foreign_keys`. | Keep the port cgo-free; no `pierrec/lz4` (no LZ4 mode exists). |

---

## 8. Validation strategy

Byte-diffing the `.db` will fail spuriously (M2). Validate in a layered ladder; build the harness once (`tools/db2tool/internal/golden/`) and reuse it every phase.

1. **Capture a reference (re-captured on every game patch/hotfix — it is not permanently frozen; maintainer-owned).** Run today's dotnet tool on the *current* live build; save two references: **`wowsims.nohotfix.db`** (no `DBCache.bin`) to gate Phases A/B, and **`wowsims.hotfix.db`** (with the client's `DBCache.bin`, matching how the committed `db.json` is produced) to gate Phase D. Also keep that run's `dbfilesclient/*.db2` and `DBDCache/*.dbd` so the WDC/DBD layers validate offline, decoupled from CASC. The 72 `.db2` + 72 `.dbd` already present in the repo working copy are exactly such a snapshot. **Producing the `nohotfix` capture:** the dotnet tool has no disable switch (`HotfixManager.LoadCaches` auto-scans `<BaseDir>/**/DBCache.bin`), so capture it by temporarily moving/renaming the client's `DBCache.bin` files (or a one-line local patch to skip `LoadCaches`) before that run. **Keep the captured references pristine:** gen_db *mutates* the DB it opens — `RunOverrides` (`dbhelper.go:63`, called at `gen_db/main.go:66`) creates/populates `item_enchantment_template` in it — so always run end-to-end gates against disposable *copies* of both the Go-produced DB and the reference (place the copy at the default `-dbPath ./tools/database/wowsims.db` or pass `-dbPath` explicitly).
2. **Pre-port audit (no code needed; inputs already on disk).** Dump per-table `SectionsCount`, per-section `TactKeyLookup`, `Flags`, and DBD `arrLength`/type for all 72 `.db2`+`.dbd`; freeze as the reader's expectation fixture. (Seed values: the *selected* build-68571 version blocks — what the reader actually sees — total int 515 / float 65 / locstring 43 / string 5, no `uint`. The larger int 786 / float 91 / locstring 50 / string 8 are all-builds COLUMNS totals across the `.dbd`, **not** per-build — don't use those as the fixture. Distinct section counts 36/33/26/22/16/9/8/3/2; `ItemBonus` empty; `Spell`/`ItemSparse` `Flags=0x5`.)
3. **Schema parity.** Compare sorted `sqlite_master` (CREATE TABLE + indexes, whitespace-normalized) reference vs Go. Catches column names/order, PK/NULL, the `[Name] TEXT` + `[Name_i] ... GENERATED ALWAYS AS (json_extract(...)) VIRTUAL` set, `IX_*`/`idx_*`, and — critically — `arrLength`-derived virtual-column counts (`AllocationPct_0..4`, §5.5).
4. **Logical row parity (not byte).** Every table: assert **row counts** first (cheap tripwire, decisive for the encrypted-skip tables in C1). Then `SELECT * ORDER BY <pk>` canonical dump equality for the **critical set (§5.6) only** — matching Phase A exit criterion 2; slack-table text diffs are reported informationally, not gating (known expected divergence: `CurvePoint` Id=236585 float notation, §5.5). Explicitly check that relation columns **keep 0** (the C# 0→NULL is dead code — §5.4; spot-check `ItemSubClass.ClassID = 0`) and the array-JSON text shape (§5.5), incl. the no-divergent-float-magnitude assertion from §5.5.
5. **Spot-check anchored IDs.** Pin known sim-relied IDs that exist in *this* DB and assert exact values incl. float precision: an `ItemSparse` row with its `Field_1_15_3_55112_014` stat array; a spell in `SpellEffect` with `EffectMiscValue`/`EffectSpellClassMask`; an `ItemRandomSuffix` row (e.g. `[6666,10000,0,0,0]`) and an `ItemArmorQuality.Qualitymod` array. (Do **not** use `146051` — verified absent from this MoP DB.)
6. **End-to-end golden (the real test).** Run full `make db` with the Go extractor **against the same live install + `DBCache.bin` the committed artifacts were built from (with hotfixes — §6 Phase D)**, then `git diff --exit-code` on the **committed** artifacts: `assets/database/db.json`, `assets/database/leftover_db.json` (text, diffable), the regenerated `.bin` files, and `assets/db_inputs/basestats/*.txt`. Control ordering (M3) or diff order-insensitively. `db.json` is what ships — this proves the whole contract, since there is **no committed golden `wowsims.db`** (it's gitignored). This gate needs Phase D; before D, gate against the without-hotfix reference (step 1).
7. **modernc smoke test (committed).** A small Go test that creates the §5.2/§5.3 schema shapes, upserts via `@name` params, and reads back `json_extract` virtual columns (int *and* float), NULL scans, and REAL vs INTEGER marshaling — so driver-marshaling parity is a permanent regression gate, not a one-off.

---

## 9. Makefile / dev-workflow changes & dotnet-removal cleanup

### 9.1 Makefile (targets and var names unchanged)

Current (`makefile:245-261`):

```make
CLIENTDATA_SETTINGS    := $(shell realpath ./tools/database/generator-settings.json)
CLIENTDATAPTR_SETTINGS := $(shell realpath ./tools/database/ptr-generator-settings.json)
CLIENTDATA_OUTPUT      := $(shell realpath ./tools/database/wowsims.db)

.PHONY: db
db:
	@echo "Running DB2ToSqlite for clientdata"
	cd tools/DB2ToSqlite && dotnet run -- -s $(CLIENTDATA_SETTINGS) --output $(CLIENTDATA_OUTPUT)
	@echo "Running DBC generation tool"
	go run tools/database/gen_db/*.go -outDir=./assets -gen=db

.PHONY: ptrdb
ptrdb:
	@echo "Running DB2ToSqlite for clientdata"
	cd tools/DB2ToSqlite && dotnet run -- -s $(CLIENTDATAPTR_SETTINGS) --output $(CLIENTDATA_OUTPUT)
	@echo "Running DBC generation tool"
	go run tools/database/gen_db/*.go -outDir=./assets -gen=db
```

Target (keep the `.PHONY` declarations — a repo-root file named `db`/`ptrdb` would otherwise make the targets report up-to-date):

```make
.PHONY: db
db:
	@echo "Extracting client data (pure Go)"
	go run ./tools/db2tool -s $(CLIENTDATA_SETTINGS) --output $(CLIENTDATA_OUTPUT)
	@echo "Running DBC generation tool"
	go run tools/database/gen_db/*.go -outDir=./assets -gen=db

.PHONY: ptrdb
ptrdb:
	@echo "Extracting client data (pure Go)"
	go run ./tools/db2tool -s $(CLIENTDATAPTR_SETTINGS) --output $(CLIENTDATA_OUTPUT)
	@echo "Running DBC generation tool"
	go run tools/database/gen_db/*.go -outDir=./assets -gen=db
```

Note the removal of `cd tools/DB2ToSqlite`: the Go tool must resolve `GameTablesOutDirectory` / `TargetDirectory` / `DBDCache` / `listfile.csv` relative to the settings file or repo root (M4), since `go run ./tools/db2tool` executes from repo root — but observe the M4 carve-out: `TargetDirectory`'s *listfile-key* use stays the raw settings value (`dbfilesclient/...`), only its output-directory use is resolved. Keep the `-s` / `--output` flag contract (also accept the single-dash `-output` and `-o` aliases, as Program.cs does); the settings `DatabaseFile` key is **dead code** — Program.cs never reads it (§10 Q7), so don't implement it.

### 9.2 `listfile.csv` path repoint (do this in Phase B)

Recommended: write `listfile.csv` to `tools/db2tool/listfile.csv` and repoint the three consumers:

- `tools/database/gen_db/main.go:153`
- `tools/database/gen_protos.go:458`
- `tools/database/tables.go:1123`

(Alternative: keep writing to `tools/DB2ToSqlite/listfile.csv` and leave the literals — but that resurrects the deleted directory as a data dir. Repointing is cleaner.) Keep `listfile.csv` gitignored under its new location.

### 9.3 dotnet-removal cleanup (after Phase B passes)

- Delete `tools/DB2ToSqlite/references/*.dll` (TACTSharp, DBCD, DBCD.IO, DBDefsLib).
- Delete `tools/DB2ToSqlite/cache/` — TACTSharp's CDN cache (~1.2 GB, `tpr/` + `wow/` layout, gitignored). The Go v1 has no use for it: the local-install path needs no CDN cache (`CacheDir` is bound-but-unused, §3.1); only Phase C would reintroduce one, under `tools/db2tool/`.
- Delete `tools/DB2ToSqlite/*.csproj`, `Program.cs`, `Helpers/`, the copied `DBCacheParser.cs` / `HotfixManager.cs`, `appsettings.json`, `appsettings.Development.json`, `Properties/launchSettings.json`, `.vscode/launch.json`, `knownPushIDs.json`, and the `obj/` / `bin/` build dirs.
- Remove the `DB2ToSqlite` project from the `.sln` (and delete the `.sln` if it has no other projects).
- Preserve or relocate build-artifact dirs still referenced: `dbfilesclient/`, `DBDCache/`, `listfile.csv` move under `tools/db2tool/` (all gitignored). Migrate the relevant `.gitignore` entries.
- Grep the repo and CI/docs for `DB2ToSqlite`, `dotnet`, `.csproj` references and update (README/build docs, any workflow that installs the .NET SDK).
- The 44-table `appsettings.json` subset is dead (both `make` targets pass the 72-table generator configs) — drop it; confirm no other caller (§10 Q).

---

## 10. Open questions to resolve before / while building

1. **Encrypted-section semantics — RESOLVED (verified against the `.db2`).** The tool uses no keys: all encrypted sections are zero-filled and skipped (§7 C1). v1 replicates the skip; no decryption. Optional future enhancement: enable Salsa20 + `WoW.txt` to pull in pre-release content — this *changes* output, so treat it as a separate feature (§3.2/§4).
2. **Hotfixes in the committed `db.json` — ANSWERED: YES, with hotfixes.** Phase D is therefore required for committed-artifact parity (§6, §7 H4); A/B gate against a without-hotfix reference (§8).
3. **Local-only vs CDN.** Is a complete local install guaranteed on every machine that runs `make db`? Note the stakes changed with revision note (4): the *current* tool is CDN-fed, so today `make db` works even against a partial install — the local-first port raises the bar to "every needed FDID resident locally". Confirm via the Phase B pre-flight (one-line dotnet BaseDir patch + byte-diff) that the local CASC path yields each table's data — in practice its single unencrypted section 0 (the encrypted sections are skipped, §7 C1) — so Phase C stays optional. PTR installs are likelier partial — check `wow_classic_ptr` specifically. `make db` is maintainer-run against a live install, re-run on each patch/hotfix (§1).
4. **Root/manifest variant — VERIFIED (against the live install's build config).** The `wow_classic` build config has a non-zero WoW `root = 8caf1829…` (a CKey — resolve via encoding to an EKey, then read from local CASC), so `OpenFileByFDID` uses the classic WoW root (MFST/TSFM). TVFS **is also present** (`vfs-root` + ~318 `vfs-N`) but is **not used** for FDID lookup — the config parser must *skip* `vfs-*` lines, not choke. (Caveat per revision note (4): the *current* tool resolves this same root via the CDN, not local CASC — the conclusion about which root type `OpenFileByFDID` uses is unaffected.) Remaining: the exact TSFM `dfVersion` (1 vs 2) still needs confirming by decoding the root file — either during the Phase B pre-flight (the BaseDir-patched dotnet run exercises it) or when the Go BLTE/`.idx` path lands.
5. **Reference capture — ANSWERED (partially): the maintainer regenerates it whenever new patches/hotfixes land; it is not a one-time frozen asset.** Formalize: keep a with-hotfix and a without-hotfix capture per build (§8 step 1), and decide where they live (local, not committed).
6. **`listfile.csv` strategy.** Static FDID map primary + Jenkins96/CSV fallback (recommended), and final on-disk location after `tools/DB2ToSqlite/` is deleted (recommended `tools/db2tool/listfile.csv`, repoint 3 literals). The full CSV is still required for the icon map regardless.
7. **`--output` vs settings `DatabaseFile` — ANSWERED: `DatabaseFile` is dead code.** Program.cs never reads the JSON key; the output path is the hardcoded default `wowsims.db` overridden only by `--output` / `-output` / `-o` (note the single-dash `-output` alias). The port should implement the flags and **not** read `DatabaseFile`; both `make` targets always pass `--output`.
8. **Exact-build match: keep bug-for-bug or add a reviewed range fallback?** Recommend exact-match + clear error now (schema-stability guarantee); treat any relaxation as a separate PR (§5.5, H1). Note the build changes every patch, so "build not yet in WoWDBDefs" is a routine, expected error, not an edge case.
9. **Slack tables.** Confirm none of the ~11 slack tables are read outside `tools/database` before treating their schema as non-critical (they may be staged for planned features).
10. **`SpellScaling.txt` double location.** Decide whether the committed `//go:embed` copy (`tools/database/dbc/GameTables/SpellScaling.txt`) should be auto-synced from the extracted `assets/db_inputs/basestats/SpellScaling.txt` or remain a manual, independently-committed file (status quo).
11. **Decrypt pre-release content? (optional, post-v1).** The tool has always run keyless (no `WoW.txt`), so encrypted sections are skipped and the sim omits unreleased items/spells. If that ever matters, decide whether to add the Salsa20 + `WoW.txt` decrypt path — noting it (a) changes output vs the golden, (b) needs a licensing read (TACTKeys has no license), and (c) needs a key-refresh story. Default: stay keyless.