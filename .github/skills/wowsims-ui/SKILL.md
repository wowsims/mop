---
name: wowsims-ui
description: "Work on the wowsims MoP frontend (ui/). Use when touching ui/domain (Sim/Player/Raid/Encounter facades, the Zustand sim store in ui/domain/state, batching, persistence/serialization), ui/ui-kit (base classes/pickers), ui/features, ui/generated/proto, spec configs, or when a UI change needs verifying (golden snapshot harness, bridge test, dev-server smoke). Self-documenting: update the 'Change log' section whenever the architecture described here changes."
---

# wowsims-ui

Frontend = `ui/` (TypeScript, tsx-vanilla JSX → live DOM nodes, no framework).
Sim engine is Go/WASM behind `ui/worker/*`; the UI only speaks protobuf to it.
Full plan + history: `STATE_UI_SEPARATION_PLAN.md` (repo root).

## Layer map (dependency direction is enforced by oxlint)

```
generated → worker → {domain, i18n} → ui-kit → features → app → specs → pages

ui/generated/proto                   generated protobuf (alias @generated/proto)
ui/domain/proto_utils                pure data + value objects (Gear, Stats, EquippedItem are immutable)
ui/domain/state/                     UI-free AND browser-free state layer (Zustand store, persistence, Env)
ui/domain/{sim,raid,party,encounter,player}.ts + {reforge,stat_weight,item_swap,bulk}_settings.ts
                                     facade classes over the store; public API unchanged
ui/domain/{talents,constants,bulk,wasm,player_classes,player_specs,utils,worker_pool,…}
ui/i18n/                             LEAF, top-level (alias @i18n): framework-agnostic i18next
                                     config + localization tables (config.ts, entity_mapping.ts,
                                     locale_service.ts, localization.tsx). May import @domain and
                                     @generated/proto; may NOT import @app/@features/@ui-kit/@specs (PR 6c)
ui/ui-kit/                           sim-agnostic widgets + base classes (Component, Input, pickers/,
                                     modals, action_id_dom, dom_utils, css_utils)
ui/features/<x>/{model,view}/        per-capability code (see ui/README.md)
ui/app/                              composition root; browser_env.ts, header/, tabs/ (incl. settings_tab),
                                     settings_menu.tsx, notice_native_sim.tsx,
                                     preset_configuration_picker.tsx, sim_ui.tsx,
                                     individual_sim_ui.tsx, preset_utils.ts (PR 6b/6c, PR 8b)
ui/sims/<class>/<spec>/               spec data + SimUI subclass — may import everything
                                     (no html here; ui/index_template.html is the one spec page)
BANNED: ui/domain/** → @ui-kit/** @features/** @app/** @specs/**
BANNED: ui/domain/** → window/document/localStorage/location/navigator (use `sim.env`, an `Env`)
BANNED: ui/i18n/** → @app/** @features/** @ui-kit/** @specs/** (domain is allowed)
BANNED: ui/ui-kit/** → @features/** @app/** @specs/**;  ui/features/** → @app/** @specs/**
BANNED: ui/features/** → patchSlice/patchKeyed/seedKeyed/deleteKeyed (use a facade)
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

Plain `vite --port N` half-renders spec pages with ZERO console errors unless you first build
worker bundles: `npx tsx vite.build-workers.mts` → `dist/mop/*_worker.js` (otherwise the worker
probe hangs and `waitForInit()` never resolves → `loadSettings` never runs → defaults never
applied). Copying per-spec `ui/**/index.html` from a built checkout is NO LONGER a step — the
`spec-pages` plugin serves every spec URL itself; only an *unknown* spec URL falls through to
the landing page.
Then `/mop/warrior/arms/` should show ~121 pickers / 156 icon buttons.
Other generated files a fresh worktree needs from a built checkout: `ui/generated/proto/*`, `*_auto_gen.ts`.

## Running REAL sims locally for QA (the only way sims run outside production)

Plain `vite` cannot run sims (the worker's backend fetch fails on localhost). Use the Go host:
```
make wasm                                   # dist/mop/lib.wasm.gz (needs Go)
npx tsx vite.build-workers.mts              # dist/mop/*_worker.js
node_modules/.bin/vite build                # dist/mop bundle + the 34 per-spec index.html
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
- Spec configs are pure data; `Player` consumes only the narrow `SpecConfigData` subset.
  All 34 specs are a single `ui/sims/<class>/<spec>/spec.ts` (or `.tsx` for `mage/arcane` and
  `warlock/demonology`, whose reforge tooltips need real JSX) default-exporting
  `defineSpec({ spec, ...config, reforge?, enableHealing?, derivedSettings?, features? })` — no
  `sim.ts`, no `index.ts`, no `IndividualSimUI` subclass anywhere; `ui/app/spec_entry.ts` loads
  it from the URL. Adding a spec = the `spec.ts`, an entry in `ui/domain/player_specs`, and a
  `$sim-themes` map entry in `ui/scss/sims/sim.scss` (PR 8a: 68 per-spec scss files collapsed
  into one shared `sim.scss` + `mage_fire.scss` for fire mage's extra rules); the `spec-pages` vite
  plugin globs `ui/sims/*/*/spec.ts(x)` so the page at `/mop/<class>/<spec>/` follows automatically
  — no html to add, in the source tree or the build config.
  Rules shared by several specs of one class live in `ui/sims/<class>/shared/`.
  See "How to author a spec" in `ui/README.md`.
- `PartyBuffs` is an empty proto message in MoP — party-buff code paths are vestigial.

## Change log (keep current — this skill documents itself)

- 2026-09-02 UI restructure P2 "spec pages generated by vite": no per-spec `index.html` and no
  `ui/<class>/<spec>/` directories exist any more — the 34 class dirs, the `ui/*/*/index.html`
  `.gitignore` line, `makefile`'s `PAGE_INDECES` and both `sed`-the-template rules
  (`ui/%/index.html` and `$(OUT_DIR)/%/index.html`) are gone. `tools/vite/spec_pages.mts` replaces
  them: `discoverSpecPages()` globs `ui/sims/*/*/spec.ts(x)`, `configureServer` answers
  `/mop/<class>/<spec>/{,index.html}` with `ui/index_template.html` through `transformIndexHtml`
  (base-stripped url, so the inline-script html-proxy ids resolve), and an `enforce: 'post'`
  `generateBundle` re-emits the page vite already processed as `<class>/<spec>/index.html` ×34 and
  `delete`s its own `index_template.html` output path. `rollupOptions.input` is now two explicit
  entries — `'ui/index.html'` and `spec_entry` (the template) — instead of a `ui/**/index.html`
  glob, which would otherwise pick stale per-spec html back up. All 34 built pages are now
  byte-identical (`md5sum dist/mop/*/*/index.html | sort -u | wc -l` == 1) and share one entry
  chunk `bundle/spec_entry-<hash>.entry.js`; the old build produced 34 near-identical entries under
  `bundle/ui/<class>/<spec>/`, so 8 chunks that were only split out because 34 entries shared them
  are now inlined. Landing page byte-identical. `make -n` for the default target, `clean`, `devmode`
  and `go-to-ts` all still parse.
- 2026-09-02 UI restructure P1 "spec page template constant": `ui/index_template.html` no longer
  has `@@CLASS@@`/`@@SPEC@@` placeholders and every asset reference is root-absolute (`/scss/...`,
  `/index.ts`, `/app/spec_entry.ts`, `/i18n/localization.tsx` — vite's root is `ui/`, so a leading
  `/` resolves correctly in dev and build). The makefile's `sed` substitution is now a no-op, so all
  34 generated `ui/<class>/<spec>/index.html` are byte-identical (`md5sum ui/*/*/index.html | sort
  -u | wc -l` == 1) — this sets up a later step to emit one built page and copy it to all 34 URLs.
  `ui/i18n/localization.tsx`'s `extractClassAndSpecFromDataAttributes` now derives class/spec from
  `location.pathname` the same way `spec_entry.ts`'s `specModuleKey` does, falling back to
  `data-class`/`data-spec` attributes (kept for any non-URL caller); `initLocalization`'s branch
  that used to check for `title[data-class]`/`meta[data-class]` now checks that derivation instead,
  so the landing page (no class/spec segments) still gets its `data-i18n` link-localization path.
- 2026-09-02 UI restructure F4 "proto into ui/generated": `ui/core/proto/**` moved to
  `ui/generated/proto/**` (protobuf-ts output, incl. `google/protobuf/`); `ui/core/` is now gone.
  `@core/*` alias dropped from `tsconfig.json`/`vite.config.mts`/`vite.harness.mts`; `move.mjs`'s
  `DIR_TO_ALIAS` lost its `core` entry. ~400 `@core/proto/...` import sites repointed to
  `@generated/proto/...` via the move tool. Updated: `makefile` (`protoc --ts_out`, clean rule,
  `ui/core/proto/api.ts` target), `tsconfig.json` `exclude`, `.oxlintrc.json` `ignorePatterns`,
  `tools/database/gen_bulksim_constants.ts.go` + `gen_character_constants_ts.go` (emitted import
  strings), `ui/README.md`.
- 2026-09-02: fixed the "Empty action id!" console error + broken pet icon on the hunter "No Pet"
  picker entry. `ActionId` (`ui/domain/proto_utils/action_id.ts`) gained a `static empty(name,
  iconUrl?)` factory (sets a private `isEmptyPlaceholder` flag) for INTENTIONALLY empty ids —
  `toStringIgnoringTag()` skips its `console.error` only for those, so accidental empties (e.g. a
  bad `fromPetName`/`fromProto` call) still log. `hunter_pet.ts`'s "No Pet" entry now uses
  `ActionId.empty('No Pet', '.../inv_misc_questionmark.jpg')` instead of `fromPetName('')`.
  Evaluated `import/no-cycle` for `.oxlintrc.json`: 188 warnings across `ui/`, so it was left off
  (not added).
- 2026-09-02 UI restructure PR 11a: cleanup pass. 21 `.tsx` files with no JSX renamed to `.ts`
  via the move tool (`preset_utils.ts`, the apl list-picker/condition-builder views, the
  import-export importer/exporter views, `sticky_toolbar.ts`, `topline_results.ts`,
  `table_sorter.ts`, `hunter_pet.ts`, `quick_gem_popover.ts`/`quick_enchant_popover.ts`,
  `mage/fire/inputs.ts`); the two `spec.tsx` files (`mage/arcane`, `warlock/demonology`) keep
  `.tsx` (real JSX). `.oxlintrc.json`'s overrides were audited — every block's `files` glob still
  matches a live directory, nothing removed; probed the domain/features/i18n/ui-kit/app layer
  blocks with a throwaway violating file each (all five fired, then deleted). `ui/README.md`
  dropped the "in progress"/`EXISTS` framing (the tree is final) and the `core/` row now reads
  "proto/ only (generated)". No empty directories found under `ui/`.
- 2026-09-02 UI restructure PR 9c: the 11 class source dirs moved `ui/<class>/` → `ui/sims/<class>/` via the move tool (`@specs` alias in `tsconfig.json`/`vite.config.mts`/`vite.harness.mts` now resolves to `ui/sims`; `move.mjs`'s `DIR_TO_ALIAS` table key renamed `specs` → `sims`). The generated page location and URL are unchanged: `makefile`'s `PAGE_INDECES` now derives `ui/<class>/<spec>/index.html` from `ui/sims/*/*/spec.ts(x)` (the `ui/%/index.html` rule gained a `mkdir -p $(@D)` since the class/spec dirs no longer pre-exist), and `spec_entry.ts`'s glob/module-key both gained a `sims/` segment. 34/34 golden specs still match.
- 2026-09-02 UI restructure PR 9b (part 1): EP-weight and talent presets become JSON under `ui/<class>/<spec>/presets/{ep,talents}/` (enum NAMES as keys; `makePresetEpWeightsFromJSON` / `makePresetTalentsFromJSON` in `app/preset_utils.tsx`); computed presets (`.withStat`, glyph spreads, `onLoad`) stay in TS. Done: warrior, death_knight, druid, hunter, mage; the other six classes follow the same recipe.
- 2026-09-02 UI restructure PR 9b (part 2): same recipe applied to monk, paladin, priest, rogue, shaman, warlock — all 12 specs converted. Presets left in TS: shaman/enhancement P1/P3 EP (pseudoStat values computed via `Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT`/`PHYSICAL_HIT_RATING_PER_HIT_PERCENT` multipliers); shaman/elemental `TalentsCleave`/`TalentsAoE` (spread another preset's glyphs); priest discipline/holy `StandardTalents`/`EnlightenmentTalents` and shaman/restoration `TankHealingTalents`/`RaidHealingTalents` (fully commented-out talentsString/glyphs, nothing literal to move). All 34 golden specs still match; `tsc`/`oxlint`/`vite build` clean.
- 2026-09-02 UI restructure PR 9a: shared lift. Every class now has fixed-name
  `<class>/shared/{inputs,presets}.ts` (root `<class>/inputs.ts` / `<class>/shared.ts` /
  `<class>/presets.ts` moved in via the move tool; DK's split inputs.ts merged into one file,
  monk's `utils.ts` folded into `shared/derived.ts`, its only caller). Added
  `ui/domain/presets/stat_caps.ts` (`meleeHitExpertiseCaps`/`expertiseCap`/`spellHitCap`) and
  `ui/domain/presets/encounters.ts` (`singleTargetEncounterProto`/`malkorokEncounterProto`) for
  the byte-identical `statCaps`/encounter-proto copies across specs — 19 `statCaps` copies and
  both Malkorok proto builders (warrior 144s/5s/100% vs. death knight 300s/30s/0%, kept
  divergent on purpose) converted; 6 `statCaps` variants left inline (monk/windwalker,
  mage/arcane, shaman/enhancement, shaman/elemental, druid/guardian, death_knight/frost).
  Added per-class `DefaultRaidBuffs` to `shared/presets.ts` for the 8 raid-buff literal groups
  that were byte-identical across a class's specs (hunter x3, rogue x3, warlock x3, paladin x2,
  monk x2, warrior x2, death knight x2 frost/unholy); death_knight/blood, warrior/protection,
  druid/{feral,guardian,balance,restoration}, monk/mistweaver, paladin/holy,
  priest/{discipline,holy,shadow}, shaman/{elemental,enhancement,restoration}, mage's shared
  presets kept their own inline blocks (either singletons or cross-class matches left
  unconsolidated — cross-class raid-buff sharing is riskier and out of scope here).
  `npm run test:snapshots` (34/34 golden) is unchanged throughout.
- 2026-09-02 UI restructure PR 7c: the last 7 hand-written specs converted — **zero
  `extends IndividualSimUI` remain, and 34 of 34 specs are `spec.ts`**. `IndividualSimUI`'s
  constructor now takes `SpecDefinition<S>` (the `& SpecBehaviors` union is gone; nothing else
  called it). Constructor bodies that were more than a reforger became shared per-class rules:
  `ui/rogue/shared/derived.ts` (`lethalPoisonRule` — Deadly Poison unless
  `applyPoisonsManually`, used by all 3 rogues), `ui/monk/shared/derived.ts`
  (`talentBasedSettingsRule` — `MonkUtils.setTalentBasedSettings` on `talentsString`) and
  `ui/death_knight/shared/derived.ts` (`amsIntakeRule` — `disableAMSIntakeOnMagicDamageEncounters`
  on encounter change). A shared rule must be typed `DerivedSetting<any>`: `Player<S>` is
  invariant in `S`, so `DerivedSetting<A | B>` is NOT assignable to `DerivedSetting<A>` (tsc
  rejects it via `autoRotationGenerator`); annotate the callback's `player` param to keep the
  body checked against the union. `ui/death_knight/{frost,unholy}/inputs.ts` were byte-identical
  modulo the spec type argument and folded into `ui/death_knight/shared/inputs.ts` typed
  `Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight` (the input helpers ARE generic-friendly
  across the union — only `DerivedSetting` is not). `monk/windwalker` keeps the
  `reforge: host => ({...})` form deliberately: its `getEPDefaults` called `this.reforger?.` when
  `this.reforger` was still null during the optimizer's own construction, and `host.reforger?.`
  reproduces that exactly, where `ctx.reforger` (never null) would not.
  Behaviour deltas, both verified benign and neither visible to the goldens (the snapshot tool
  never builds a UI): (1) the 3 rogues gain one `apply` at construction that the old ctors did
  not have — safe because `optionsCreate()` seeds `classOptions: {}` and `applyDefaults`
  overwrites it moments later; (2) `derivedSettings` run AFTER the reforger, where the old monk
  and DK ctors ran them before — nothing the optimizer's constructor reads depends on them.
  `makefile`'s `PAGE_INDECES` is now
  `$(patsubst %/spec.ts,%/index.html,$(wildcard ui/*/*/spec.ts)) $(patsubst %/spec.tsx,…)`
  (still 34) and all 34 `index.html` were regenerated — `make` is no longer a footgun.
  **Found and fixed a latent bug from `b4a3d0a0f` (the ui/domain move):** `tools/database/gen_{bulksim_constants.ts,
  character_constants_ts}.go` still emitted `'../proto/common'` / `'../../proto/api'` in the
  three `*_auto_gen.ts` files after their output paths moved to `ui/domain/**`, so any `make`
  run broke `tsc`; they now emit `@core/proto/{common,api}`.
- 2026-09-02 UI restructure PR 7b: converted 25 more specs to `spec.ts`/`spec.tsx` (27 of 34
  total, on top of the two PR 7a pilots). `spec_entry.ts`'s glob is now
  `import.meta.glob('../*/*/spec.{ts,tsx}')` — `mage/arcane` and `warlock/demonology` keep real
  JSX in their reforge `additionalSoftCapTooltipInformation`, so they stayed `.tsx`; every other
  converted spec is plain `.ts`. A ctor body's `this.reforger?.foo` became `ctx.reforger.foo`,
  `this.individualConfig.defaults` became `ctx.defaults`, and a callback's captured outer
  `player` became the callback's own `player` parameter — except where a callback (e.g.
  `additionalSoftCapTooltipInformation`) has no `player` param of its own, which needed
  `reforge: host => ({ ... })` closing over `host.player` instead (mage/arcane, demonology).
  Pure ctor precomputes (`statSelectionPresets` for balance/arcane/fire/affliction/demonology/
  destruction) were hoisted to module scope above `defineSpec`. `mage/fire`'s
  `new CalculateCombustionThresholds(this.rootElem, this)` became
  `features: [host => new CalculateCombustionThresholds(host.rootElem, host)]`; its constructor's
  `simUI` param is now `IndividualSimHost<Spec.SpecFireMage>` (from `@features/sim_host`), which
  required adding `runSimLightweight` to the `SimHost` interface (it used a lightweight sim call
  IndividualSimHost didn't expose). 5 specs (`death_knight/blood`, `druid/guardian`,
  `paladin/holy`, `paladin/protection`, `warrior/protection`) gained `enableHealing: true`
  (verified against their old `index.ts` calling `player.enableHealing()`). Skipped 7 for hand
  work: `death_knight/{frost,unholy}`, `monk/{brewmaster,windwalker}`,
  `rogue/{assassination,combat,subtlety}`. `tools/state-snapshots/snapshot.ts` updated to
  explicit `registerSpecConfig` imports for all 27; goldens stayed byte-identical (34 specs).
  `npx vite build`: 35 entries, 27 `spec-*.chunk.js` (one per converted spec — not "+2", that
  was this task's estimate before the pilots' baseline was known).
- 2026-09-02 UI restructure PR 7a: **a spec is now DATA.** `@features/spec_config` gained
  `SpecDefinition<S>` (= `IndividualSimUIConfig<S>` + `spec: S` + `SpecBehaviors<S>`),
  `SpecBehaviors` (`reforge`, `enableHealing`, `derivedSettings`, `features` — all optional),
  `DerivedSetting` and the identity helper `defineSpec()`. `IndividualSimUI` is no longer
  `abstract`: its constructor takes `IndividualSimUIConfig & SpecBehaviors` and runs the
  behaviour slots (reforge → derivedSettings → features) as its LAST statements — that is
  precisely where a subclass constructor body ran, i.e. after every tab exists but still
  synchronously, so `loadSettings()` (queued on `waitForInit`) still sees `this.reforger`.
  `SpecBehaviors` is a separate optional-only interface rather than folding everything into
  `SpecDefinition` because the 32 unconverted `super(parentElem, player, SPEC_CONFIG)` calls
  pass a bare `IndividualSimUIConfig`.
  New `ui/app/spec_entry.ts`: one page entry for all specs. Lazy
  `import.meta.glob('../*/*/spec.ts')` keyed off `location.pathname` minus
  `import.meta.env.BASE_URL` (`/mop/`), so each spec gets its own chunk. It is the ONE place
  the register-before-`new Player()` ordering is expressed (`Player`'s constructor calls
  `getSpecConfig`). Body is an async IIFE, not top-level await — vite's build target reports
  TLA as a TOLERATED_TRANSFORM.
  Piloted on `warrior/arms` (with `reforge`) and `priest/discipline` (without); their `sim.ts`
  + `index.ts` are deleted. `ui/index_template.html` now points at `../../app/spec_entry.ts`,
  but only those two `index.html` were regenerated — **`make` regenerates all 34 from the
  template and would break the other 32; regenerate individually until PR 7b converts them.**
  `tools/state-snapshots/{snapshot,store-contract-test}.ts` import those two spec modules and
  call `registerSpecConfig` explicitly instead of relying on `sim.ts` side effects; goldens
  stayed byte-identical (34 specs).
- 2026-09-02 UI restructure PR 6c: `ui/app/i18n/**` → `ui/i18n/**` (by hand: `git mv` + repoint
  `@i18n/*` in `tsconfig.json`/`vite.config.mts`/`vite.harness.mts`; `ui/index.html` +
  `ui/index_template.html` entry script; the 34 gitignored `ui/*/*/index.html` regenerated).
  i18n is a LEAF and lives at the top level rather than under `ui/app/` — PR 6b's alias made
  `@i18n` a back door letting domain/ui-kit/features reach app-owned code through an alias the
  layer lint could not see. `.oxlintrc.json` gained an `ui/i18n/**/*.{ts,tsx}` override banning
  `@app`/`@features`/`@ui-kit`/`@specs/**` (domain allowed) — this is now enforced, not
  "deliberate but unenforced" as PR 6b left it. `ui/i18n/entity_mapping.ts` imported
  `LaunchStatus` from `../launched_sims` (a relative reach into `ui/app/`, broken by the move
  and disallowed either way); `LaunchStatus` moved to `ui/domain/constants/other.ts` next to
  `Phase`, and `ui/app/launched_sims.tsx` re-exports it so its other consumers are untouched.
- 2026-09-02 UI restructure PR 6b: `ui/core/` is now **proto only**. The shells moved to
  `ui/app/`: `sim_ui.tsx`, `individual_sim_ui.tsx`, `preset_utils.tsx`, `launched_sims.tsx`;
  `ui/i18n/**` → `ui/app/i18n/**` (`@i18n/*` alias repointed in `tsconfig.json`,
  `vite.config.mts`, `vite.harness.mts`; `ui/index.html` + `ui/index_template.html` entry
  script; the 34 gitignored `ui/*/*/index.html` regenerated with the makefile sed).
  `ui/core/components/` is deleted — `sim_toolbar_item.tsx` → `ui/ui-kit/` (it is generic),
  `settings_tab.tsx` → `ui/app/tabs/`; `ConsumesPicker` stored a `SettingsTab` it never read,
  so the parameter was dropped rather than an interface invented.
  To cut features/ui-kit/domain off the shells, **narrow host interfaces** replaced the classes
  in every downstream signature (`import type` is not enough — the lint bans the specifier):
  `ui/ui-kit/sim_host.ts` (`SimUIHost`, `SimHeaderHost`) and `ui/features/sim_host.ts`
  (`SimHost`, `IndividualSimHost<Spec>`, `SimWarning`, `ActionGroupItem`, `isIndividualSimHost`).
  `SimUI implements SimHost`, `IndividualSimUI implements IndividualSimHost` — the `implements`
  clause is what keeps the interfaces honest. The spec-config schema moved to
  `ui/features/spec_config.ts` (`IndividualSimUIConfig`, `InputConfig`, `InputSection`,
  `OtherDefaults`, `Settings`, `registerSpecConfig`, `itemSwapEnabledSpecs`); it could **not**
  go to `ui/domain` as planned because it names `@ui-kit` types (`InputHelpers`, `IconInputs`,
  `ContentBlock`, `SavedDataConfig`) and `@features/encounter`'s `EncounterPickerConfig`.
  `app/individual_sim_ui.tsx` re-exports it so the 34 spec `sim.ts` files are untouched.
  The preset types (`PresetGear`/`PresetEpWeights`/…) moved to `ui/domain/presets/types.ts`
  (`preset_utils.tsx` re-exports them) so domain can name them; `required_talents.ts` now takes
  `Pick<SpecConfigData, 'requiredTalentRows'>` instead of the whole UI config, and
  `requiredTalentRows` was added to `SpecConfigData` — there is still ONE registry
  (`domain/player.ts` `SPEC_CONFIGS`), no `domain/spec_config.ts` was created.
  Gotcha: `ui/features/gear/view/item_list.tsx` used `instanceof IndividualSimUI`, a runtime
  import an interface cannot replace — it now calls the `isIndividualSimHost()` predicate.
  Gotcha: `tools/restructure/move.mjs` rewrites `@i18n/*` → `@app/i18n/*`, which would break the
  layer lint in domain/features — the i18n move must be done by hand (`git mv` + repoint the
  alias), not with the move tool.
- 2026-09-02 UI restructure PR 6a: `ui/app/` gains `header/` (`sim_header`, `sim_title_dropdown`,
  `social_links`), `settings_menu.tsx`, `tabs/` (`gear_tab`, `talents_tab`, `rotation_tab`),
  `notice_native_sim.tsx`, `preset_configuration_picker.tsx` — moved from `ui/core/components/`
  via `tools/restructure/move.mjs` (9 files, 45 import specifiers rewritten). Left behind for
  PR 6b because a feature imports them: `ui/core/components/header/sim_toolbar_item.tsx`
  (`features/results/view/results_viewer.tsx`) and
  `ui/core/components/individual_sim_ui/settings_tab.tsx`
  (`features/settings/view/consumes_picker.tsx`). `ui/core/components/` now holds only those two
  files.
- 2026-09-02 UI restructure PR 5c: picker config data (`buffs_debuffs`, `consumables`, `stat_options`) → `features/settings/model`; `other_inputs.ts` moved whole into `features/settings/view` (still mixes constants with five `make*Selector` DOM constructors — split pending); saved EP weights → `features/stat-weights/view`; quick_swap/gear_change_icon → `features/gear/view`; results_viewer → `features/results/view`; spec_change_warning_toast → `features/settings/view`.
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
- 2026-09-02 PR 8a: SCSS collapse. 68 per-spec `ui/scss/sims/<class>/<spec>/{index,_sim}.scss`
  files (plus the dead unimported `ui/scss/sims/index.scss`) replaced by one
  `ui/scss/sims/sim.scss` driving a `$sim-themes` map (cssClass → class color, opacity, bg image)
  built programmatically from the old files, plus `ui/scss/sims/mage_fire.scss` for fire mage's
  extra combustion-threshold rules. `totem_inputs` is now imported unconditionally (its rules are
  namespaced under `.totems-settings`) instead of being duplicated per shaman/hunter/rogue spec.
  `ui/index_template.html` now links `../../scss/sims/sim.scss` for every spec. Verified
  byte-identical (whitespace-normalized) compiled CSS per `.<cssClass>-sim-ui` selector, old vs.
  new, across all 34 specs.
- 2026-09-01 Phases 0–4 of the state/UI separation: lint guard, golden harness, core made
  UI-free, satellites + persistence extracted to `ui/core/state/`, Zustand store with
  emitter bridges for all five slices, `storeSubscribe` seam. Phases 2–4 uncommitted on
  `feature/state-ui-separation` pending review. Skill lives in `.github/skills/` (shared).
- 2026-09-02 PR 8b: one spec registry. `ui/app/launched_sims.tsx` (hand-maintained
  `Record<Spec, {phase, status}>`) deleted; every `PlayerSpec` class now carries its own
  `readonly launch: { phase: Phase; status: LaunchStatus }` (base type in `ui/domain/player_spec.ts`).
  Consumers (`sim_ui.tsx`, `individual_sim_ui.tsx`, `sim_title_dropdown.tsx`) read
  `spec.launch`/`player.getPlayerSpec().launch` instead of the old lookup table. The landing page
  (`ui/index.html`) no longer hand-writes its ~34 `<a href="/mop/<class>/<spec>/">` sim-link
  anchors; `ui/index.ts` now renders them into an empty `#sim-links` container from `PlayerSpecs`,
  guarded so it's a no-op on every other page that also loads `index.ts`. Verified structurally
  byte-identical (whitespace-normalized, launch-status text masked) against the old static markup
  via a vite lib-mode build of the generator run in Node. USER-VISIBLE CHANGE: the old landing
  markup was stale vs. the registry (18 specs said "Beta" but were already `Launched`: DK
  blood/unholy, priest shadow, druid balance, all 3 rogue, all 3 hunter, all 3 mage, all 3
  warlock, paladin protection/retribution) — these now correctly show "Launched". Class-level
  badges (aggregate per class, not spec data) are re-derived as all-launched→launched,
  all-unlaunched→unlaunched, mixed→beta, which flips 7 classes (death_knight/rogue/hunter/
  mage/warlock beta→launched; shaman/monk launched→beta, since each has one still-unlaunched spec).
- 2026-09-02 PR 8c: declarative custom sections. `IndividualSimUIConfig.sections?: Array<CustomSection>`
  (`id`, `title`, `tooltip?`, `cssClass?`, `iconGroupCssClass?`, `iconInputs?`, `inputs?`, `when?`)
  added to `@features/spec_config`; `customSections` (the function-returning-a-ContentBlock form) is
  deprecated, still rendered, and now has no callers. `app/tabs/settings_tab.tsx` grew a module-level
  `buildCustomSection()` on top of a hoisted `buildInputPickers()` (the old private
  `configureInputSection` body, now a one-line delegate) — one renderer, not two. Shaman's
  `TotemsSection` DOM builder is gone: `ShamanInputs.totemsSection<S>()` / `enhancementTotemsSection()`
  are plain data, and the three shaman `spec.ts` files declare `sections` (restoration's empty
  `customSections: []` deleted — it never rendered totems). Verified byte-identical `outerHTML`
  (enhancement *and* elemental) old vs. new via an SSR harness entry through `vite.harness.mts` +
  `tools/state-snapshots/run.mjs`. Rendered in the same slot as before (before Consumes/Other),
  not appended after the standard sections, so nothing moves on screen.
- 2026-09-02 UI restructure PR F1: `other_inputs.ts` split by role (the "split pending" noted under
  PR 5c). The 12 DOM-free picker config constants (`InputDelay`, `ChallengeMode`, `ChannelClipDelay`,
  `InFrontOfTarget`, `DistanceFromTarget`, `TankAssignment`, `IncomingHps`, `HealingCadence`,
  `HealingCadenceVariation`, `AbsorbFrac`, `BurstWindow`, `HpPercentForDefensives`) moved verbatim to
  `features/settings/model/other_inputs.ts`; the five `make*Selector(parent, sim)` DOM constructors
  (`makeShow1hWeaponsSelector`, `makeShow2hWeaponsSelector`, `makeShowMatchingGemsSelector`,
  `makeShowEPValuesSelector`, `makePhaseSelector`) stay in `features/settings/view/other_inputs.ts`.
  Nothing is re-exported from `view/` for convenience: the 35 alias importers (all 34 `spec.ts` plus
  `app/individual_sim_ui.tsx`, every one a constants-only `import * as OtherInputs`) now point at
  `@features/settings/model/other_inputs`, and `features/gear/view/item_list.tsx` — the only consumer
  of the constructors — keeps its `view/` import. The two halves are disjoint: view imports nothing
  from model.
- 2026-09-02 UI restructure PR F3: the two APL kind registries are now DOM-free data.
  `features/apl/model/field_descriptors.ts` defines `APLFieldDescriptor` (a `type`-tagged
  plain-object union) plus constructors whose names and argument order match the old
  `*FieldConfig` picker factories one-for-one; `model/value_kinds.ts` (`valueKinds`, 125
  entries) and `model/action_kinds.ts` (`actionKinds`, 30 entries) hold label / submenu /
  short+fullDescription / includeIf / newValue / dynamicStringResolver / `fields` descriptors
  and the kind type aliases (`APLValueKind`, `APLValueImplMap`, `APLActionImplStruct`, ...).
  The view keeps every picker: `apl_helpers.tsx` gained `makeCommonFieldConfig` (21 tags),
  `apl_values.ts` a `makeFieldConfig` that adds cmp/math/executePhase/totem/value/valueList
  and delegates the rest, `apl_actions.ts` one that adds action/actionList and delegates to
  `AplValues.makeFieldConfig`. `valueKindFactories`/`actionKindFactories` are still built at
  module load — now by spreading the model entry and attaching
  `aplInputBuilder(newValue, fields.map(makeFieldConfig))` — so `Object.keys` order (= kind
  dropdown order), field order and option order are unchanged. All 155 entries moved; none
  stayed behind. The tables are byte-identical to the old ones modulo the removed
  `AplHelpers.`/`AplValues.` qualifiers. Pass/fail check (`norm` absorbs oxfmt re-joining
  15 `fields:` arrays that got shorter once the qualifier was dropped, which also drops
  their trailing comma):
  `norm() { sed 's/AplHelpers\.//g; s/AplValues\.//g' | tr -d '[:space:]' | sed 's/,\]/]/g'; }`
  `L=$(git show <base>:ui/features/apl/view/apl_values.ts | sed -n '562,1771p' | norm)`
  `R=$(sed -n '186,$p' ui/features/apl/model/value_kinds.ts | norm); [ "$L" = "$R" ]`
  (48565 chars; actions is the same recipe with `339,793p` / `85,$p` on `action_kinds.ts`,
  16144 chars). Drop the `norm` pipe and `diff` the two side by side to *see* the 15 reflow
  hunks. `DEFAULT_UNIT_REF` moved to `field_descriptors.ts` and is re-exported from
  `apl_helpers.tsx`.
