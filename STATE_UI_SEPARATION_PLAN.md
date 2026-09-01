# wowsims-mop — Separate Data State from UI (React-ready)

## Context

The sim frontend mixes state and UI: domain state lives partly in encapsulated classes (`Sim`/`Raid`/`Party`/`Player`/`Encounter` with a hand-rolled `TypedEvent` system), partly inside component files (ReforgeOptimizer, ItemSwapSettings, StatWeightActionSettings), and some of it is mutated in place by pickers with manual emits (`encounter.targets`, `player.aplRotation`). Persistence (localStorage, link import/export, load order) is implemented as methods on UI classes. `ui/core/` even imports from `ui/core/components/` (7 files, backwards dependency). Goal: a complete, framework-agnostic state layer so components become thin views — enabling an incremental React migration later without a big-bang rewrite.

Prior art: wowsims/cata#462 (authored by the user) already proposes "Separate UI and Logic — perhaps Zustand".

## State-manager decision: Zustand (vanilla) — nanostores runner-up

**Chosen: `zustand/vanilla` `createStore` + `subscribeWithSelector` middleware.**
Rationale:
- First-class vanilla story with zero React dependency now; later, React components use `useStore(store, selector)` with **zero store changes** — exactly the two-phase requirement.
- Equality-checked selector subscriptions (`subscribe(selector, cb, {equalityFn})`) replace EventID dedup naturally: a subscriber fires only when its selected value actually changed. One `set()` = one notification pass = `freezeAllAndDo` batching for free.
- Largest ecosystem/maintenance of the vanilla-capable options (~1.2 kB core); migration path from the existing emitter system is mechanical (see bridge below).
- Organizational alignment: it's what cata#462 already proposed.

**Runner-up: nanostores** — maximally framework-agnostic and structurally a 1:1 match (one atom per emitter), but loses on deep selector subscriptions over a large object (would fragment Player into dozens of atoms) and weaker whole-model snapshot/undo story.

Rejected: MobX (proto interop + weight + React 19 uncertainty), Valtio (proxying protobuf-ts objects is risky), Jotai (React-first ergonomics), Redux Toolkit (full domain rewrite ceremony), TanStack Store (alpha), preact signals (patches React internals), TC39 signals (Stage 1).

## Key design decisions

**Store topology: one vanilla store per page, with slices**, created in the entry point where `new Sim()` is built today (`ui/mage/arcane/index.ts:8-11` pattern):

```ts
// ui/core/state/sim_store.ts
interface SimState {
  sim: SimSettingsSlice;      // iterations, phase, faction, fixedRngSeed, filters
  ui: UISettingsSlice;        // show* flags, language, wasmConcurrency — moved OUT of Sim
  encounter: EncounterSlice;  // duration, executeProportions, targets (immutable, replace-on-write)
  raid: RaidSlice;            // buffs, debuffs, tanks, targetDummies, numActiveParties, partyBuffs[5]
  players: (PlayerSlice | null)[]; // by raid index; individual sim uses [0]
}
export const createSimStore = () =>
  createStore<SimState>()(subscribeWithSelector(() => initialState));
```

`PlayerSlice` = Player's current private fields as plain immutable values (protos cloned, `Gear`/`Stats` value objects as-is). Server-derived state (`currentStats`, metadata) in a separate `derived` sub-slice (excluded from future undo/redo).

**Classes become facades, signatures unchanged.** `Player`/`Sim`/`Raid`/`Encounter`/`Party` keep their public API — the ~500 setter/getter call sites and every `InputConfig` closure untouched:

```ts
// player.ts after conversion — same signature, store-backed
setGear(eventID: EventID, newGear: Gear) {
  if (newGear.equals(selectPlayer(this.store.getState(), this.index).gear)) return;
  withEventID(eventID, () =>
    this.store.setState(s => patchPlayer(s, this.index, { gear: newGear })));
}
```

**TypedEvent survives as a bridge layer during migration.** Setters stop firing emitters; emitters re-fire from store subscriptions, carrying the eventID via a module-level current-action holder:

```ts
// ui/core/state/emitter_bridge.ts
export function bridgeEmitter<T>(store, selector, emitter, equality = Object.is) {
  return store.subscribe(selector, () => emitter.emit(currentEventID()), { equalityFn: equality });
}
// wired in Player ctor:
bridgeEmitter(store, s => selectPlayer(s, i).gear, this.gearChangeEmitter, (a, b) => a.equals(b));
```

Because notifications still flow through `TypedEvent.emit` (`typed_event.ts:72-98`), **EventID dedup, `freezeAllAndDo`, and `onAny` keep working unchanged** — the bridge only changes who calls `emit`. `fromProto` bodies stay wrapped in `freezeAllAndDo` and behave identically. End state (React phase): components subscribe to the store directly, bridges deleted per-component, emitters die with their last consumer.

**Undo/redo:** future = store snapshots minus `derived`. Not built now; plain-value slices keep it possible.

## Directory layout + dependency rules

```
ui/core/state/   NEW — sim_store.ts, slices/*.ts, selectors.ts, actions/*.ts,
                 emitter_bridge.ts, persistence.ts, serialization.ts,
                 reforge_settings.ts, item_swap_settings.ts, stat_weight_settings.ts
```

Allowed edges (enforce with `eslint-plugin-import` `no-restricted-paths` zones; escalate to `dependency-cruiser` in CI if too coarse):

```
core/proto, core/proto_utils     → nothing above them
core/state                       → proto, proto_utils, typed_event, worker_pool
core/{player,sim,raid,party,encounter}.ts → core/state (facades over it)
core/components, sim_ui, spec uis → everything
BANNED: core/** (except components/) → core/components/**
```

## Phases (each independently shippable; site never broken)

### Phase 0 — Safety net (S, days) — ✅ DONE (commit 792bb2724)
1. ✅ oxlint `no-restricted-imports` rule at **warn** — flags exactly the known violators (player.ts ×3, sim.ts ×2, reforge_cache.ts ×2, preset_utils.tsx ×2), zero noise. (The repo uses oxlint, not eslint.)
2. ✅ Golden snapshot harness (`tools/state-snapshots/`, `npm run test:snapshots`): all 34 launched specs, Sim+Player constructed in node (vite SSR bundle + happy-dom), spec defaults applied, player/sim/raid/encounter protos snapshotted against a committed golden; `fromProto(toProto(x))` asserted as a fixed point. Deterministic across runs. Quirks encoded, not fixed: `Sim.toProto` collapses all-selected filter arrays; `Sim.fromProto` re-expands them AND mutates its argument in place; `waitForInit` never resolves under a stubbed Worker (await `Database.get()` instead).
3. → moved to Phase 2: the `IndividualSimSettings` envelope (reforge settings, ref stats, load-order contract) is serialized by UI classes today; it gets covered when Phase 2 extracts it into `core/state/serialization.ts`.

### Phase 1 — Import inversions: make `core/` UI-free (M) — ✅ DONE (commit 3f6430ec0)
All 7 inverted edges fixed; lint rule at **error**, zero violations; snapshots byte-identical; full vite build clean. Notable deltas from the original table: bulk utils/types/constants_auto_gen moved wholesale to `ui/core/bulk/` (generator path updated); link parsing went to `core/state/sim_links.ts` with importer statics delegating; `Player` now consumes a narrow `SpecConfigData` interface instead of `IndividualSimUIConfig` (full type stays in the UI layer); `getSpecConfig` mutate-before-null-check fixed; `relevantStatOptions` import was dead — deleted. Original table:

| Violation | Fix |
|---|---|
| `player.ts:2` → `ItemSwapSettings` (item_swap_picker.tsx:17) | Move class to `core/state/item_swap_settings.ts` |
| `player.ts:3` → `Toast` (used :574, :585) | Replace with error/cancel callbacks or an emitter; UI pops the toast |
| `player.ts:1` → `relevantStatOptions` | Move pure filtering logic to `proto_utils/` or `core/state/` |
| `player.ts:7` → `IndividualSimUIConfig` (coupling pt 10; EP presets read at :560) | Extract spec-config type + `registerSpecConfig`/`getSpecConfig` registry (player.ts:220-233) into a UI-free module (already pure data); also fix `getSpecConfig` mutating shared config before its null check (:228-229) |
| `sim.ts:14` → `ReforgeOptimizer` statics (:834, :852, :868) | Extract `getConfigHash`/`getReforgeGemOptions`/`makeReforgeConfigRequestFields` → `core/state/reforge_request.ts` |
| `sim.ts:11-13`, `reforge_cache.ts:3-4`, `preset_utils.tsx:2-3` | Move `throwIfAborted` + link-decode helpers into `core/` utility modules |



### Phase 2 — Complete + encapsulate the state surface, extract persistence (L) — ✅ DONE (committed 2026-09-02, in review)
All six sub-steps done 2026-09-01; snapshots byte-identical, tsc + full vite build clean, lint rule still zero violations. Deltas vs plan below: `encounter.targets` → private + `getTargets/getTarget/setTargets/modifyTarget` (all ~22 picker writes routed, redundant post-`applyPresetTarget` emit deleted as dedup no-op); `player.aplRotation` → private `aplRotation_` + read-only getter + `modifyAplRotation` (3 emit-less mutation sites deliberately left on the live object — see review notes); `showWhen` side effect replaced by a guarded subscription; satellite stores extracted to `core/state/{reforge_settings,stat_weight_settings,ui_settings}.ts` with component/Sim delegation preserving emitter identity; CharacterStats math → `computeStatAttribution` in `proto_utils/stats.ts` (StatMods/StatWrites types moved, re-exported); persistence/serialization → `core/state/{persistence,serialization}.ts` with IndividualSimUI as thin wrappers (load-order contract documented); blessings → `core/state/blessings.ts`; UI flags → `UISettings` with Sim emitter aliases. RaidSimUI persistence deliberately NOT factored (different proto envelope; Phase-3-adjacent). Original spec:
Still no Zustand — makes Phase 3 convert one thing, not eleven.

1. **Encapsulate `encounter.targets`**: private + `getTargets()/setTargets(eventID,…)/modifyTarget(eventID, idx, fn)`; rewrite ~8 in-place mutation sites in `encounter_picker.ts` (:152, :165, :223, :333, :365, :389). Remove the `showWhen` side effect (:129-140) — move the `setTargetDummies` reset into the change handler.
2. **Encapsulate `player.aplRotation`** (public at player.ts:255): private + `setAplRotation(eventID, fn|value)`; rewrite the 8 APL-picker mutation sites (`pre_pull_list_picker.tsx:27` etc.).
3. **Extract satellite stores** → `core/state/`: ReforgeOptimizer's settings block + 11 emitters (`suggest_reforges_action.tsx:102-149`) → `ReforgeSettings` with its existing `toProto/fromProto`; `StatWeightActionSettings` (stat_weights_action.tsx:24); `CharacterStats.updateStats()` math (character_stats.tsx:179-230) → `proto_utils/stats.ts`. Defer BulkTab/results managers (transient result state, not settings).
4. **Extract persistence**: `core/state/persistence.ts` — storage-key derivation, `loadSettings` preserving exact order (defaults → localStorage → link → clear hash → subscribe-last), autosave subscription. `toProto/fromProto` bodies of `IndividualSimUI`/`RaidSimUI` → `core/state/serialization.ts` taking `(sim, player, reforgeSettings)`; `SimSettingCategories` filtering moves with it.
5. **UI flags out of `Sim`** (sim.ts:113-121) into a `UISettings` object (emitter-based for now); `Sim` keeps delegating getters temporarily. `getShowHealingMetrics` hidden dependency (sim.ts:1042-1050) becomes an explicit derived function in the UI layer.
6. **Blessings**: proto transform out of `raid_sim_ui.tsx:127-149` → `core/state/blessings.ts`; `modifyRaidProto` injection stays, calls the core function.

Verify: snapshots + round trips green (serialized shape must not change); manual QA: APL editor, encounter picker, reforge panel.

### Phase 3 — Zustand store + facade conversion (L) — ✅ DONE (committed 2026-09-02, in review)
All five slices converted 2026-09-01 (ui → encounter → sim → raid+partyBuffs → players); zustand@5 vanilla + subscribeWithSelector; `Sim.store` owns the per-page store (created in the Sim ctor rather than the entry point — entry points untouched). Facade APIs unchanged; all legacy emitters preserved by identity and re-fired from store subscriptions with the causing eventID (`withEventID`/`currentEventID` in emitter_bridge.ts). Notable mechanics: player slice uses per-field version counters so unconditional-emit setters (setEpWeights/setEpRatios/setCurrentStats) and `setGear(force)` fire exactly as before; `Sim.lastUsedRngSeed` deliberately NOT store-backed (unconditional emitter); encounter targets replace-on-write with draft-passing `modifyTarget`; `aplRotation` + Party↔Player object graph deliberately class-side. Bridge semantics locked by `tools/state-snapshots/bridge-test.ts` (11 assertions, runs inside `npm run test:snapshots`). Browser QA vs master dev server: DOM parity (121 pickers/156 icon buttons/3945 elements), bidirectional store↔input sync, autosave + reload persistence, gear/encounter edits — all verified with Playwright. Original spec:
Add `zustand` (vanilla import only). Build `createSimStore` + `withEventID` + `bridgeEmitter`. Convert leaf-first, one slice per PR:

1. `ui` slice → 2. `encounter` → 3. `sim` settings → 4. `raid` → 5. `player` fields, a few per PR (start gear + bonusStats; end aplRotation/itemSwap/reforge) → 6. `party`.

Per conversion: field → slice, setter/getter → facade, emitter → `bridgeEmitter`, old field deleted. `Party.setPlayer` reuse logic (party.ts:134-141) and Player↔Party back-pointers stay in the facades — store holds data, classes keep the object graph; cyclicity becomes harmless. `Sim.updateCharacterStats` write-back (sim.ts:770) becomes one `setState` into `players[i].derived` — closes the async-`freezeAllAndDo` hole (sim.ts:764) as a side effect.

Verify per PR: snapshots + bridge test — mutate via facade, assert (a) selector fired once, (b) legacy emitter fired once with right eventID, (c) `freezeAllAndDo` around two setters yields one aggregate emit.

### Phase 4 — Prove the React seam + docs (S) — ✅ DONE (committed 2026-09-02)
`InputConfig.storeSubscribe` added (input.tsx) — an input can subscribe to the store directly instead of a TypedEvent; piloted on the sidebar iterations NumberPicker (verified both directions in the browser). `ui/core/state/README.md` documents topology, eventID rules, add-a-field recipe, and the React recipe (`useStore(sim.store, selector)` / `useSyncExternalStore`). The optional behind-a-flag React leaf component was skipped — adding a react dependency for a demo widget isn't worth the review noise; the seam is proven by the pilot + bridge test. Original spec:
1. Convert one input (e.g. iterations `NumberPicker`) to subscribe to the store directly, bypassing its emitter — `InputConfig` gains an optional store-selector form.
2. `ui/core/state/README.md`: topology, eventID rules, how to add a field, React recipe (`useStore(simStore, selector)` / `useSyncExternalStore`).
3. Optional: one leaf React component behind a flag against the vanilla store.

### Phase 5 — Replace TypedEvent with native store subscriptions — ✅ 5a–5f DONE (committed 2026-09-02)
Goal (user request): components subscribe to the store; TypedEvent deleted with its last consumer. Remaining surface at start: 166 `changedEvent` picker configs + 147 direct `.on`/`onAny` listeners.

**Mechanism**
- **Batch gate in the store layer** (`ui/core/state/batch.ts`): module-level depth counter. Direct store subscribers registered through `subscribeGated` are deferred while depth > 0 and fire once at depth 0 with final state (selector-equality means one fire per changed field). `freezeAllAndDo` opens/closes the gate — so today's batching semantics hold for store subscribers without EventIDs; end state is `freezeAllAndDo` → `store.batch`.
- **Bridges stay ungated** — they already batch through TypedEvent's freeze queue and need `currentEventID()` at write time.
- **Picker migration through `input_helpers.ts`**: field-subscription helpers in `ui/core/state/subscriptions.ts` (`subscribePlayerField(player, field)` over the version counters, plus sim/encounter/raid/ui equivalents) wired into the ~30 config factories as `storeSubscribe`; hand-written component configs follow individually. Multi-field emitters (duration ← 3 fields, professions ← 2) fire once per changed field instead of once per action — harmless for idempotent inputs.
- Aggregates (`raid.changeEmitter`, `sim.changeEmitter`) still carry class-side comp changes — their consumers are NOT migrated yet.

**Status 2026-09-01**: 5a–5c done; bridge test now 18 assertions; browser QA: arms parity 121/156/3945, store-path checkbox persists across reload, holy priest target-dummies picker shows 9 after the batched load. Stopped before 5d/5e for review.

**Decisions (user, 2026-09-01)**: 5d = put party composition into the store (`raid.composition` slice: player storeKeys per party slot) so `raid/sim.changeEmitter` become pure store selectors; 5e = delete `*ChangeEmitter` members on this same branch once their last consumer is migrated; tree stays uncommitted for review; Chrome smoke across more specs before review.

**Endgame design (2026-09-01)**:
1. `EventID` + `nextEventID()` survive (moved to `ui/core/state/batch.ts`); setter signatures untouched — the id is an opaque action id (future undo grouping). `freezeAllAndDo` → `batch()`.
2. Version counters are the uniform answer for class-side state: `aplRotation` (`v.rotation` bumped wherever `rotationChangeEmitter` fired, via `touchRotation`), `lastUsedRngSeed` (sim slice, unconditional bump), item-swap fields folded into the player slice (`v.itemSwap`), ReforgeSettings + StatWeightActionSettings get their own slices + counters.
3. `raid.composition: (storeKey|null)[][]` — `Party.setPlayer` keeps the object graph and additionally writes composition (one setState replacing the comp emit). Aggregates become tuple selectors: party = [composition[i], partyBuffs[i], ...player slices], raid = raid slice + party tuples, sim = whole state.
4. Non-state events (sim results, crash, reference change, progress signals) are NOT store state: a ~20-line `Emitter<T>` in `ui/core/state/events.ts` (no EventID/freeze/dedup). Every listener is migrated by classification: state change → `subscribeGated`, event → `Emitter`.
5. Rip-cord before deletion: harness assertion that `TypedEvent.emit`/`freezeAllAndDo` are never invoked during full UI construction + loadSettings; 5f = sed renames, delete `typed_event.ts`, let tsc enumerate stragglers.
Known deltas to report: multi-field emitters notify once per changed field (not once per action); components that mutated protos in place and relied on an aggregate emitter to flush must be caught in the classification pass.

**5d progress (2026-09-01 night)**: core landed (rotation/itemSwap/lastUsedRngSeed counters, `raid.composition`, aggregate selectors, `Emitter<T>`, bridge test 31 assertions); picker configs migrated across ui/core/components, individual_sim_ui/**, ui/raid + spec dirs (149 `storeSubscribe` sites); state-type `.on` listeners migrated (147 → 93 remaining = events + satellites). In flight: cleanup-defect fixes (component child registry + `isDisposed`, ListPicker/APL dispose cascade, TypedEvent live-array dispatch, Timeline DOM-clone cache removal, RaidSimResultsManager.reset, async sequence guards) and satellite slices (reforge / statWeights / unit-metadata counters).

**5d–5f done (2026-09-01 night)**: `ui/core/typed_event.ts` and `emitter_bridge.ts` deleted; zero `TypedEvent` references remain. All picker configs use `storeSubscribe` (required; `changedEvent` removed from `InputConfig`), all state listeners use the `subscribe*` helpers, events use `Emitter<T>` (sim results, crash, reference/current change, results filter, log runner, timeline hidden ids, bulk signals, blessings, language picker). `SavedDataManager.subscribe`, `SimWarning.updateOn`, `GearData.subscribe`, `UnitReferencePickerConfig.subscribeComp` are `StoreSubscribe`-typed. Facades write with plain `setState`; `eventID` params are opaque action ids (oxlint `no-unused-vars` `args: "none"`). Cleanup-defect fixes from the async/listener investigation landed alongside (Component child registry + `isDisposed`, ListPicker/APL dispose cascade, Timeline DOM-clone cache removed, `RaidSimResultsManager.reset()` wired, sequence guards on async dropdown/action-id updates).

**Behavior deltas to review**: (1) multi-field aggregates notify once per changed field, not once per action (idempotent for pickers; counting listeners would differ); (2) where a listener used to forward the causing eventID it now mints a fresh one (dedup grouping only); (3) `Emitter` listeners fire synchronously and ungated (e.g. reference-swap listeners run before the enclosing batch closes; they read already-swapped data); (4) `Raid.getActivePlayers` cache invalidates at write time instead of at thaw (strictly fresher); (5) autosave does one explicit write at the end of the initial load (previously delivered by the thaw); (6) `raid_picker` no-op moves no longer re-emit a comp change; (7) `Encounter.setTargets` with the same array reference stores a copy (still notifies).

**Post-removal review fixes (2026-09-01, late)**: (a) aggregate selectors initially included `currentStats` → `updateCharacterStats` re-triggered itself on every stats result (browser freeze); fixed via `PLAYER_CHANGE_FIELDS`/`simSettingsKey` mirroring the old emitter compositions + a contract-test guard. (b) `Player.dispose()` releases the per-instance subscription and slices (spec-change replacement, cross-window drop sources, WCL temporaries). (c) `dpsRefStat/healRefStat/tankRefStat` moved into the player slice so they autosave again. (d) `numActiveParties` reaches composition consumers (`subscribeRaidComp`). (e) Reference swap previously fired the results-manager `changeEmitter` twice → now once. (f) A batch touching raid+encounter previously issued two `computeStats` requests → one (`subscribeStatsInputs`). (g) `batch()` logs errors and still flushes, like the old `freezeAllAndDo`. (h) iterations picker gated like every other picker.

**Final status (2026-09-01/02 night)**: 5a–5f DONE — `typed_event.ts` deleted; 0 TypedEvent references; `EventID`/`nextEventID`/`batch` in `ui/core/state/batch.ts`; `Emitter<T>` for results/crash/reference/UI-local signals; store contract test (tools/state-snapshots/store-contract-test.ts) runs before the goldens. Async/DOM-cleanup investigation → fixes: `Component` child registry + `isDisposed`, ListPicker per-item dispose + AbortController, APL sub-picker dispose cascade, `APLGroupVariablesPicker` rebuild-only-on-placeholder-change, sequence guards on async dropdown/action-id loads, Timeline DOM-clone cache removed (tooltips survive reference Swap — verified live), `RaidSimResultsManager.reset()` before each content replace. Post-removal self-review found and fixed a real regression (aggregate selectors included server-derived `currentStats` → `updateCharacterStats` self-trigger loop froze the tab on Simulate) plus a per-Player subscription leak (`Player.dispose()`), lost `epRefStat` autosave (moved into the player slice), `numActiveParties` not reaching comp consumers (`subscribeRaidComp`), double stats compute per batch (`subscribeStatsInputs`), reference-swap double fire, `batch()` error semantics. Live QA on the Go host (`./wowsimmop --usefs`, native sims): full render, Simulate, Save as Reference, Swap/Swap-back with live timeline tooltips, APL editor add-action, zero console errors.

**Perf + timeline cache (2026-09-02)**: user-reported lags measured with a repeatable Playwright protocol (`tools/browser-perf/`, numbers in its README). Timeline reference switch: master's DOM-clone cache was ~300 ms per cached swap and left **zero** live tooltips after a swap (the reported bug); replaced by a live-subtree LRU (`RotationSlot`, 2 slots, nodes moved not cloned, per-slot reset callbacks) → ~105 ms sync / ~0.4 s settle with all tooltips alive. APL edit on the 317-item Festerblight rotation: master ~140 ms + 30k DOM mutations per edit → ~9 ms + 3.1k (dropdown memo, `SavedDataManager` coalesced rAF equality check with cached JSON, autosave debounced 300 ms, nested-picker self-subscriptions removed). The protocol's console capture also caught a real load-time bug: `persistence.ts` declared the autosave debounce timer *after* the load `batch()`, so the flush's first store change hit the temporal dead zone (logged "Cannot access 'r' before initialization", autosave still worked via the explicit final write) — timer now declared before the batch; `batch()` logs the error object so stacks survive. The same fixes (minus store work) live on `fix/apl-timeline-cleanup` off master for landing first.

**Sub-steps**: 5a gate + `freezeAllAndDo` integration (bridge test gains gate assertions) → 5b subscription helpers → 5c factory migration + browser parity (incl. a `showWhen` that reads a different field than its subscription, e.g. target dummies) → **STOP: checkpoint for review** → 5d migrate the 147 direct listeners → 5e delete `*ChangeEmitter` members (public API change; needs team sign-off) → 5f delete `typed_event.ts`.

## Raid sim UI removed (user decision, 2026-09-02)

The full raid sim UI (`ui/raid/**`, its scss, `raid_target_picker`, `state/blessings.ts`, the `isWithinRaidSim` plumbing in SimUI/IndividualSimUI/SettingsTab/JSON importer, landing-page and title-dropdown links, makefile entry) is deleted — unsupported for complexity reasons. `Raid`/`Party` domain classes remain because individual sims model the player as a 1-party raid. `SimUIConfig.spec` is now required. This also closes the "RaidSimUI persistence not factored" item. All pre-existing lint warnings were cleaned in the same pass (oxlint: 0).

## Accepted behavior changes (from self-review, 2026-09-01)

1. `Encounter.modifyTarget` clones before writing. The old picker code mutated the *aliased* preset/default `TargetProto` objects in place (i.e. corrupted `sim.db` preset encounters and the spec's `defaults.encounter`), so `matchesPreset` stayed true after edits and re-applying a preset silently didn't restore edited fields. Now edits mark the encounter as "no preset" and presets restore correctly. Latent-bug fix, kept.
2. Target-dummies reset moved out of `showWhen` to a guarded `player.changeEmitter` subscription: broader trigger set, no longer skipped for monks; end state converges via `shouldEnableTargetDummies()`.
3. `Encounter.fromProto` still stores the caller's `targets` array by reference, but later edits no longer reflect into the caller's proto (replace-on-write).

## Not touched (deliberate)

- `ui/worker/*`, `worker_pool.ts`, wasm bridge — already clean.
- `core/proto_utils/*` (except receiving CharacterStats math; `action_id.ts`'s four DOM `set*` methods → React-phase `<WowheadIcon/>`).
- Per-spec `sim.ts` configs and `input_helpers.ts` factories — already renderer-agnostic data.
- Layer-4 rewrites (cross-component querySelectors in `raid_sim_action.tsx`, `innerHTML` templates, bootstrap modals, timeline/replay canvas, clusterize) — React phase.
- `firedEvents` unbounded-array leak (typed_event.ts:82-85): opportunistic in Phase 3, not a goal.

## Risks

| Risk | Mitigation |
|---|---|
| `Player.fromProto` reassigns eventID (player.ts:1539) — invariant already broken | Bridges emit `currentEventID()` = whatever the facade setter was given; behavior preserved. Do NOT "fix" the reassignment mid-migration |
| Async `freezeAllAndDo` thaws at first `await` (sim.ts:764) | Fixed structurally in Phase 3 (single `setState` after await); unchanged before that |
| Lazy DOM-probed disposal (input.tsx:69-73) | Emitter fire count unchanged by design; bridge unsubscribes registered on facade dispose to avoid store-sub leaks |
| Player↔Party back-pointers / cross-party re-parenting (party.ts:78-97) | Object graph stays in facades; `players[]` keyed by raid index makes re-parent = store patch + index swap |
| Serialization drift (the real regression surface) | Phase 0 snapshots per spec + round trips in CI from Phase 1 on; any diff = stop |
| Selector equality vs proto objects | Store cloned protos, replace-on-write; protobuf-ts `equals` as `equalityFn`, mirroring today's setter guards |

## Execution notes

- Work happens in worktree `~/personal/wowsims-mop-state`, branch `feature/state-ui-separation` (off `master`).
- Generated artifacts (`ui/core/proto/*`, `*_auto_gen.ts`) were copied from the main checkout; verified identical generator inputs between master and backend-reforge, so the golden is branch-clean.
- Effort: ~6–9 weeks focused work total; every PR ships green.
