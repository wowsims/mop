---
name: wowsims-ui
description: "Work on the wowsims MoP frontend (ui/). Use when touching ui/domain (Sim/Player/Raid/Encounter facades, the Zustand sim store in ui/domain/state, batching, persistence/serialization), ui/ui-kit (base classes/pickers), ui/features, ui/core/components, spec configs, or when a UI change needs verifying (golden snapshot harness, bridge test, dev-server smoke). Self-documenting: update the 'Change log' section whenever the architecture described here changes."
---

# wowsims-ui

Frontend = `ui/` (TypeScript, tsx-vanilla JSX → live DOM nodes, no framework).
Sim engine is Go/WASM behind `ui/worker/*`; the UI only speaks protobuf to it.
Full plan + history: `STATE_UI_SEPARATION_PLAN.md` (repo root).

## Layer map (dependency direction is enforced by oxlint)

```
generated → worker → domain → ui-kit → features → app → specs → pages

ui/core/proto                        generated protobuf (still under core/; alias @core/proto)
ui/domain/proto_utils                pure data + value objects (Gear, Stats, EquippedItem are immutable)
ui/domain/state/                     UI-free AND browser-free state layer (Zustand store, persistence, Env)
ui/domain/{sim,raid,party,encounter,player}.ts + {reforge,stat_weight,item_swap,bulk}_settings.ts
                                     facade classes over the store; public API unchanged
ui/domain/{talents,constants,bulk,wasm,player_classes,player_specs,utils,worker_pool,…}
ui/ui-kit/                           sim-agnostic widgets + base classes (Component, Input, pickers/,
                                     modals, action_id_dom, dom_utils, css_utils)
ui/features/<x>/{model,view}/        per-capability code (see ui/README.md)
ui/app/                              composition root; today only browser_env.ts
ui/core/components/, ui/core/*_ui.tsx, ui/<class>/<spec>/   UI not yet placed — may import everything
BANNED: ui/domain/** → @ui-kit/** @features/** @app/** @specs/** @core/components/**
BANNED: ui/domain/** → window/document/localStorage/location/navigator (use `sim.env`, an `Env`)
BANNED: ui/ui-kit/** → @features/** @app/** @specs/**;  ui/features/** → @app/** @specs/**
BANNED: ui/core/components/** → patchSlice/patchKeyed/seedKeyed/deleteKeyed (use a facade)
```

The rule lives in `.oxlintrc.json` (`no-restricted-imports`, error level), keyed on the
top-level directory. Patterns must use `**`, not `*`: oxlint matches one path segment per `*`,
so `@features/*` silently misses `@features/gear/view/action_id_dom`. Scoping is an explicit
file list — negated globs in oxlint `overrides.files` break scoping, so add new dirs to that
list, don't use `!`.

## State: one Zustand store per page

`Sim.store` (`createSimStore()` in `ui/domain/state/sim_store.ts`, `subscribeWithSelector`).
Slices: `ui`, `sim` (both owned by `Sim`), `encounter`, `raid` (+ `partyBuffs[5]`, `composition`), `players[storeKey]`,
`reforge[storeKey]`, `statWeights[storeKey]`, `bulk[storeKey]` (counters only).
Read `ui/domain/state/README.md` before adding a field — it has the add-a-field recipe
(player fields must also be appended to `PLAYER_FIELDS` in sim_store.ts).

Pickers that hand a list to `ListPicker` must return a COPY from `getValue` (`.slice()`), never
the live store array — ListPicker splices its input in place.

Write path: facade setter keeps `setX(eventID, v)` (eventID = opaque action id from
`state/batch.ts`, unused by the store), guards equality exactly as before, then writes ONCE via
`patchSlice` / `patchKeyed` (`sim_store.ts`) — value and counter bump in the same setState. Unconditional notifications use per-field version counters (`v`):
epWeights/epRatios/currentStats/rotation/itemSwap/lastUsedRngSeed, reforge + stat-weight slices.
`TypedEvent` is GONE — `batch()` replaced `freezeAllAndDo`; consumers use the `subscribe*`
helpers (batch-gated) or `Emitter<T>` for events.

Class-side by design: the Party↔Player object graph (composition lives in the store), `aplRotation`
(tracked by the `rotation` counter), caches, metadata objects.

Rotation writes: `player.modifyAplRotation(eventID, r => ...)` is sugar for "mutate, then
`player.touchRotation(eventID)`". The APL pickers hold references INTO the rotation tree, so they
mutate in place and call `touchRotation` — either form is fine, a missed `touchRotation` is silently
stale. Target writes go through `encounter.modifyTarget(eventID, i, draft => ...)`. Mutate ONLY the draft inside `modifyTarget`
(targets are replace-on-write; re-reading state inside the closure edits a stale object).

React seam: `InputConfig.storeSubscribe: obj => StoreSubscribe` replaces `changedEvent` for a picker
(`storeSubscribe: player => subscribePlayerField(player, 'gear')`; omit it for parent-synced inputs).
Field helpers live in `ui/domain/state/subscriptions.ts` (`subscribePlayerField(player, 'gear')`,
`subscribeSimField`, `subscribeEncounterField`, `subscribeRaidField`, `subscribeUiField`) and the
`input_helpers.ts` factories already pass them. `subscribeAll([...])` folds selector sources into one
selector (one notification per write/batch) — prefer it over hand-written combined selectors. Direct store subscribers go through
`subscribeGated` (`ui/domain/state/batch.ts`): deferred while a `batch()` is open,
fired once at the end with final state. React later: `useStore(sim.store, selector)`.

## Notifications: state vs events (the rule the next dev gets wrong)

- **State changes** (a value in the store changed) → subscribe with `subscribeGated` / the
  `subscriptions.ts` helpers. Class-side values (`aplRotation`, item swap, rng seed, reforge /
  stat-weight settings) are tracked by version counters in their slice — bump the counter where
  the old emitter fired; never content-hash.
- **Events** (something happened: sim result, crash, reference set, progress) → `Emitter<T>` in
  `ui/domain/state/events.ts`. No EventID, no batching, no dedup. Never put these in the store.
- `EventID` / `nextEventID()` live in `ui/domain/state/batch.ts`; setters keep the `eventID` param
  as an opaque action id (oxlint `no-unused-vars` has `args: "none"` for exactly this reason).
  `batch()` replaced `freezeAllAndDo`.

## Verification — run all of these before calling a UI change done

```
npm run type-check                 # tsc --noEmit (tools/ is included)
npm run lint:js                    # oxlint; zero no-restricted-imports allowed
npm run test:snapshots             # bridge-semantics test + 34-spec golden protos (tools/state-snapshots)
node_modules/.bin/vite build       # full multi-page build
```

Perf regressions: `tools/browser-perf/` holds Playwright protocols for reference-swap and
APL-edit timing (needs the Go host below); compare against the README table before/after
touching pickers, `SavedDataManager`, persistence, or the Timeline.

`test:snapshots:update` regenerates `golden.json` — only with intent, and diff the old vs new
JSON to confirm only the intended fields moved. Harness quirks it encodes on purpose:
`Sim.toProto` collapses all-selected filter arrays; `Sim.fromProto` re-expands them AND mutates
its argument; `waitForInit()` never resolves under a stubbed Worker (await `Database.get()`).

## Browser smoke in a fresh worktree (traps that cost hours)

Plain `vite --port N` half-renders spec pages with ZERO console errors unless you first:
1. copy the gitignored per-spec `ui/**/index.html` from a built checkout (otherwise every
   spec URL serves the landing page), and
2. build worker bundles: `npx tsx vite.build-workers.mts` → `dist/mop/*_worker.js`
   (otherwise the worker probe hangs and `waitForInit()` never resolves → `loadSettings`
   never runs → defaults never applied).
Then `/mop/warrior/arms/` should show ~121 pickers / 156 icon buttons.
Other generated files a fresh worktree needs from a built checkout: `ui/core/proto/*`, `*_auto_gen.ts`.

## Running REAL sims locally for QA (the only way sims run outside production)

Plain `vite` cannot run sims (the worker's backend fetch fails on localhost). Use the Go host:
```
make wasm                                   # dist/mop/lib.wasm.gz (needs Go)
npx tsx vite.build-workers.mts              # dist/mop/*_worker.js
node_modules/.bin/vite build                # dist/mop bundle + per-spec index.html
cp -r assets dist/mop/assets                # `make` does this; plain vite build does not
cp -r ../<built-checkout>/binary_dist .     # generated Go package needed to compile sim/web
go build -o wowsimmop ./sim/web && ./wowsimmop --usefs=true --launch=false --host=":3333"
```
Then `http://localhost:3333/mop/<class>/<spec>/` runs sims natively (stats, Simulate, reference
swap, timeline tooltips all work). Without `dist/mop/assets` the page half-renders with JSON
parse errors from the DB fetch.

## Persistence contract (ui/domain/state/persistence.ts)

Load order, do not reorder: defaults → localStorage → URL-hash link (partial categories keep
the rest) → clear hash → `setName('Player')` → subscribe autosave LAST → stat-weight load.
Envelope serialization is `serialization.ts` (`individualSimSettingsToProto` /
`applyIndividualSimSettings`); covered by the golden harness.

## Conventions

- Tabs, single quotes, `simple-import-sort` (run `npm run lint:js:fix` on touched files).
- Never commit fixtures/goldens without asking; never run `gen_db` concurrently.
- Spec configs (`ui/<class>/<spec>/sim.ts`) are pure data registered via `registerSpecConfig`;
  `Player` consumes only the narrow `SpecConfigData` subset.
- `PartyBuffs` is an empty proto message in MoP — party-buff code paths are vestigial.

## Change log (keep current — this skill documents itself)

- 2026-09-02 UI restructure PR 2 "split the action files": the three sim-orchestrating
  `ui/core/components/*_action.tsx` files are gone. `suggest_reforges_action.tsx` →
  `features/reforge/model/reforge_optimizer.ts` (`ReforgeOptimizerModel`: settings, EP/soft-cap
  math, the solve + cache + abort) plus `features/reforge/view/reforge_panel.tsx`, which keeps
  `export class ReforgeOptimizer(simUI, options)` and every member spec configs use, delegating
  to `.model`; `ReforgeOptimizerOptions.getEPDefaults` / `updateSoftCaps` now also receive
  `ctx = { player, reforger, defaults }` as a trailing argument (`reforger` is the MODEL, not the
  panel) so spec configs can stop closing over `this`. `stat_weights_action.tsx` →
  `features/stat-weights/view/stat_weights_panel.tsx` with `scaledEpValue` lifted to
  `proto_utils/stats.ts`. `raid_sim_action.tsx` → `features/results/model/sim_results.ts`
  (`ReferenceData`, the `ResultMetric*` types, the `results-sim-*` class maps) +
  `features/results/view/results_action.tsx` (`addSimResultsAction`, `SimResultsManager` — both
  renamed off "raid"). The toasts / progress modal / `onReforge*` handlers stayed in the view: they
  are DOM. Feature `model/` files must stay browser-global-free (lint) and must not import a `view/`.

- 2026-09-02 UI restructure PR 3 "physical moves": `ui/domain/` and `ui/ui-kit/` now exist (140 files
  moved, 1261 import specifiers rewritten by `tools/restructure/move.mjs` — the reusable move tool;
  `from -> to` list, `--dry-run`, alias form across layers, relative within). `ui/core/` keeps only
  `proto/`, `components/`, `sim_ui.tsx`, `individual_sim_ui.tsx`, `preset_utils.tsx`,
  `launched_sims.tsx`. `browser_env.ts` → `ui/app/`, so `Sim` no longer defaults its `Env`:
  `SimProps.env` is REQUIRED and the 34 `ui/<c>/<s>/index.ts` pass `browserEnv` (PR 7 folds this into
  `spec_entry.ts`). `Env` gained `location.href`, `location.hostname` and `hardwareConcurrency` —
  `sim.ts` reads wasm-concurrency storage + core count through it, `reforge_cache.ts` takes an `Env`
  (`ReforgeGearCache.get(spec, env)`). DOM-free splits: talent/glyph config types + `newTalentsConfig`
  → `ui/domain/talents/config.ts`; the SimLog classes + parsing → `ui/domain/proto_utils/logs.ts` with
  the JSX in `ui/features/results/view/log_lines.tsx` (`renderLog` / `renderDamageResult` /
  `renderEntity` replace `log.toHTML()` / `.result()`); the generic ActionId DOM writers →
  `ui/ui-kit/action_id_dom.ts` (gear's `setEquippedItemWowheadData` stays and re-exports them);
  the `document`/`location` helpers out of `utils.ts` → `ui/ui-kit/dom_utils.ts` (`getEnvironment`
  keeps the browser probe; `environmentOf(hostname)` is the pure half in domain). `worker_pool.ts`
  uses bare `Worker` / `setTimeout` (`window.Worker` would throw in a worker context anyway); dead
  `SPEC_DIRECTORY` deleted from `constants/other.ts` (it read `window.location.pathname` at module
  scope). Lint: the layer `no-restricted-imports` groups went `*` → `**` (see the layer map) and
  `ui/domain/**` also bans `@core/components/**`, keeping the guarantee the old `ui/core/*` scope
  had. Generator output paths, `AUTO_GEN_FILES_TS`, `.gitignore`, `.oxfmtrc.json` follow the moves.
  **Module-evaluation-order trap** (cost an afternoon): `getSpecSitePath` moved from
  `proto_utils/utils.ts` to `constants/other.ts`. `player_specs/<class>.ts` calls it at module scope,
  and `proto_utils/utils.ts` imports `player_specs/index` back — a cycle. Re-sorting imports flipped
  rolldown's evaluation order so `index.ts`'s `specToPlayerSpec` literal was built before
  `BloodDeathKnight` existed, and every `PlayerSpecs.fromProto` returned `undefined` (the golden
  harness died in `new Player`). Rule: `player_specs/*` and `player_classes/*` must import only leaf
  modules — never a *value* from `proto_utils/utils`. Check with
  `grep -nE '^//#region ' tmp/harness/snapshot.js` after a harness build: every
  `player_specs/<class>.ts` must be emitted before `player_specs/index.ts`.

- 2026-09-02 UI restructure PR 5a "gear/settings move (view only)": whole-file moves via
  `tools/restructure/move.mjs` (17 files, 97 specifiers in 27 files) — `gear_picker/` (8 files,
  flattened) plus `gem_summary.tsx`/`reforge_summary.tsx`/`upgrade_costs_summary.tsx` (all three
  turned out to be gear summaries, not settings-tab) and `item_notice/item_notice.tsx` all landed
  in `ui/features/gear/view/` alongside the pre-existing `action_id_dom.ts`/`item_notices.tsx` (no
  collisions); `item_swap_picker.tsx` → `features/item-swap/view/`; `character_stats.tsx` →
  `features/character-stats/view/`; `encounter_picker.ts` → `features/encounter/view/`;
  `cooldowns_picker.ts` + `consumes_picker.tsx` → `features/settings/view/`. scss under
  `ui/scss/core/components/` is untouched (scss stays in place per README) and its `@import`s
  still resolve since only the `.ts`/`.tsx` moved. Gate note: the move disturbed import order in
  every touched file — `oxlint --fix` on `ui tools` cleared all of it, no manual sorting needed.

- 2026-09-02 UI restructure PR 5b "bulk + import-export move": whole-file moves via
  `tools/restructure/move.mjs` (24 files, 93 specifiers in 23 files) — `bulk/core_sim.ts` (DOM-free)
  → `features/bulk/model/`; the rest of `bulk/` plus `bulk_tab.tsx` → `features/bulk/view/`
  (flattened); `importers/`, `exporters/`, `importer.tsx`, `exporter.tsx` →
  `features/import-export/view/`. Lint: added `ui/features/**` to the `no-restricted-imports`
  block that bans direct store-writer imports (`patchSlice`/`patchKeyed`/`seedKeyed`/
  `deleteKeyed`), since that ban was previously keyed only on `ui/core/components/**` and
  `bulk_tab.tsx` moved out of that path. `oxlint --fix` on the touched files cleared the
  import-order warnings the rewrite introduced.

- 2026-09-02 UI restructure PR 4c "apl model": the `actionIdSets` and `unitSets` registries (plus their
  `ACTION_ID_SET` / `UNIT_SET` key types) moved verbatim out of `features/apl/view/apl_helpers.tsx` into
  `features/apl/model/{action_id_sets,unit_sets}.ts`; the view imports them back. Nothing else in the apl
  files is DOM-free: `extractToVariableAction` opens an `APLNameModal` and defaults to `document.body`,
  every `*FieldConfig` carries a picker `factory`, and the `valueKindFactories`/`actionKindFactories`
  entries interleave their metadata with `fields` descriptors that are themselves picker factories — so
  splitting those tables is a ~170-call-site rewrite, not a data move. These are the first
  `features/*/model/**` files to import `@i18n/config` and a `@ui-kit` type (`DropdownValueConfig`).

- 2026-09-02 UI restructure PR 4b "apl move (view only)": `apl_values.ts`, `apl_actions.ts`,
  `apl_helpers.tsx`, `apl_condition_builder.tsx` and the `apl/` subdir (8 files, flattened) moved
  from `ui/core/components/individual_sim_ui/` to `ui/features/apl/view/` via
  `tools/restructure/move.mjs` (12 files, 48 specifiers rewritten). `apl_helpers.tsx`'s
  `@features/gear/view/action_id_dom` import became relative (both files now under `features/`).
  `rotation_tab.tsx` stays in `ui/core/components/individual_sim_ui/` and now imports the four
  moved list pickers via `@features/apl/view/...`. This is a whole-file move only — the model/view
  split for `apl/` is a later step.

- 2026-09-02 UI restructure PR 4a "detailed_results move": `ui/core/components/detailed_results.tsx`
  and `ui/core/components/detailed_results/` (incl. `metrics_table/`) moved to
  `ui/features/results/view/` via `tools/restructure/move.mjs` (22 files, 52 specifiers rewritten).
  The three `@features/gear/view/action_id_dom` re-export imports (`combat_replay.tsx`,
  `timeline.tsx`, `metrics_table.tsx`) now import `setActionIdBackground(AndHref)` /
  `setActionIdWowheadDataset` straight from `@ui-kit/action_id_dom` instead of the gear re-export.
  Two DOM-free extractions: `timeline.tsx`'s trailing spell-category tables (`MELEE/SPELL/
  DEFAULT_ACTION_CATEGORY`, `auraAsResource`, `idToCategoryMap`, `idsToGroupForRotation`,
  `percentageResources`) → `ui/features/results/model/timeline_categories.ts`; `color_settings.ts`
  (pure data, no DOM) → `ui/features/results/model/`.

- 2026-09-02 UI restructure PR 1 "layer truth": `ui/core/state/**` is now browser-free
  (`no-restricted-globals` on window/document/localStorage/location/navigator) — it reads an
  injected `Env` (`state/env.ts`; `ui/core/browser_env.ts` in the browser, `sim.env`,
  `tools/state-snapshots/memory_env.ts` in the harness). `Sim` takes `{ env }`. Facade imports in
  `state/` are `import type` (the one runtime edge left is `reforge_request` → `ReforgeGearCache`);
  `getSpecStorageKey` is gone — `IndividualSimUI.getStorageKey` builds the key and passes it in.
  `reforge_settings.ts` / `stat_weight_settings.ts` / `item_swap_settings.ts` moved
  `state/` → `ui/core/` (they hold a Player and write the store: facades, not state), joined by the
  new `ui/core/bulk_settings.ts` (`BulkSettingsStore`: `touch('settings'|'items')` + the
  `bulk-settings.v2` blob) — `ui/core/components/**` is now lint-banned from importing
  `patchSlice/patchKeyed/seedKeyed/deleteKeyed`. DOM left the pure layers: `ActionId`'s 5 DOM
  methods and `Player.setWowheadData` are free functions in `ui/features/gear/view/action_id_dom.ts`;
  `logs_parser.tsx` → `ui/features/results/model/`, `item_notices.tsx` → `ui/features/gear/view/`,
  talents/glyphs/hunter-pet pickers → `ui/features/talents/view/`; the components ban now also
  covers `ui/core/talents/**` + `ui/core/constants/**`. `getSpecSiteUrl` → `getSpecSitePath` (pure;
  `SimTitleDropdown` resolves it against `window.location.href`). `PresetConfigurationCategory`
  moved to `ui/core/constants/preset_categories.ts` so `ui/i18n` imports no component. Deleted:
  `RaidSimPreset` + all 34 `raidSimPresets` config keys, `makeBlessingsAssignments` /
  `makeBlankBlessingsAssignments` / `makeDefaultBlessings` / `NUM_SPECS`.
- 2026-09-02 /simplify pass (4 review angles): `storeSubscribe` is curried `obj => StoreSubscribe` and
  optional (141 eta-wrappers deleted); `subscribeAll` composes selectors (fixed a stats-sidebar double
  fire); raid tuple memoized; `patchSlice`/`patchKeyed`/`seedKeyed`/`deleteKeyed` replace 10 hand-rolled
  setState shapes and merge write+bump into one write; slice fields typed (28 casts gone); UISettings
  folded into Sim; `Component.disposeChild`; SavedDataManager compares JSON only (`equals` config
  dropped); results-manager `changeEmitter`/`partOfSwap` deleted (no subscribers); bulk slice keeps
  counters only; dead exports/markers removed (`isBatching`, `onAnyEmitter`, `subscribeRaidComp`,
  `within-raid-sim-hide`, `undershootCaps` counter, reforge forwarders/shim). `Emitter.on` is an arrow
  property so `storeSubscribe: () => this.changeEmitter.on` is valid; the rotation SavedDataManager keeps a
  semantic `equals` (Auto/APL types match) — every other manager compares `toJson` strings.
- 2026-09-02 perf pass + Timeline live-subtree cache: `tools/browser-perf/` Playwright protocols
  (reference swap, APL edit) with master vs branch numbers; Timeline `RotationSlot` LRU replaces
  the DOM-clone cache (tooltips survive swaps, ~3× faster); APL edit ~15× faster (dropdown memo,
  coalesced `SavedDataManager` check, debounced autosave); `persistence.ts` TDZ bug (timer declared
  after the load batch) found by the protocol's console capture and fixed. TEMP `__perf`/`__sim`
  instrumentation removed.
- 2026-09-01 (late) review fixes after the TypedEvent removal: aggregate selectors exclude
  server-derived state (`PLAYER_CHANGE_FIELDS`, `simSettingsKey`) — including `currentStats`
  looped `updateCharacterStats`; `Player.dispose()` + lifetime rule; ref stats moved into the
  player slice (autosave); `subscribeRaidComp` / `subscribeStatsInputs` combined selectors;
  `batch()` logs errors like the old `freezeAllAndDo`; results-manager `changeEmitter` emitted
  once per swap.

- 2026-09-01 Phase 5 DONE (5d–5f): TypedEvent deleted (`ui/core/typed_event.ts`, `emitter_bridge.ts`),
  all pickers/listeners on store subscriptions or `Emitter<T>`, `raid.composition` + reforge/statWeights
  slices, component child-dispose cascade + `isDisposed`, ListPicker/APL dispose fixes, Timeline DOM-clone
  cache removed (tooltip bug), RaidSimResultsManager.reset wired. Store contract test = the gate.
- 2026-09-01 Phase 5 decisions: party composition moves into the store (`raid.composition`),
  emitters deleted on this branch after their consumers migrate (5d→5e).
- 2026-09-01 Phase 5 (in progress): store batch gate wired into `freezeAllAndDo`; field subscription
  helpers; picker factories migrated to `storeSubscribe`. Direct `.on` listeners and the
  `*ChangeEmitter` members are still in place pending team review (public API).
- 2026-09-01 (later) self-review fixes: `structuredClone` seed → factory (es2020 target has no polyfill),
  `PLAYER_FIELDS` const drives version counters, `modifyTarget` missing-index guard, ListPicker
  `getValue` copies, unused imports pruned; accepted behavior changes recorded in the plan doc.
- 2026-09-02 Raid sim UI removed entirely (`ui/raid/**`, raid scss, `raid_target_picker`,
  `state/blessings.ts`, `isWithinRaidSim` plumbing, landing/dropdown links) — unsupported for
  complexity reasons; `Raid`/`Party` domain classes stay (individual sims use a 1-party raid).
  All pre-existing lint warnings cleaned (oxlint now reports zero). CLAUDE.md points here.
- 2026-09-01 Phases 0–4 of the state/UI separation: lint guard, golden harness, core made
  UI-free, satellites + persistence extracted to `ui/core/state/`, Zustand store with
  emitter bridges for all five slices, `storeSubscribe` seam. Phases 2–4 uncommitted on
  `feature/state-ui-separation` pending review. Skill lives in `.github/skills/` (shared).
