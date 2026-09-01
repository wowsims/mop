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

### Phase 1 — Import inversions: make `core/` UI-free (M, ~1 wk)
Pure file moves + callback injection, no store yet:

| Violation | Fix |
|---|---|
| `player.ts:2` → `ItemSwapSettings` (item_swap_picker.tsx:17) | Move class to `core/state/item_swap_settings.ts` |
| `player.ts:3` → `Toast` (used :574, :585) | Replace with error/cancel callbacks or an emitter; UI pops the toast |
| `player.ts:1` → `relevantStatOptions` | Move pure filtering logic to `proto_utils/` or `core/state/` |
| `player.ts:7` → `IndividualSimUIConfig` (coupling pt 10; EP presets read at :560) | Extract spec-config type + `registerSpecConfig`/`getSpecConfig` registry (player.ts:220-233) into a UI-free module (already pure data); also fix `getSpecConfig` mutating shared config before its null check (:228-229) |
| `sim.ts:14` → `ReforgeOptimizer` statics (:834, :852, :868) | Extract `getConfigHash`/`getReforgeGemOptions`/`makeReforgeConfigRequestFields` → `core/state/reforge_request.ts` |
| `sim.ts:11-13`, `reforge_cache.ts:3-4`, `preset_utils.tsx:2-3` | Move `throwIfAborted` + link-decode helpers into `core/` utility modules |

Flip lint rule to **error**. Verify: snapshots green, `tsc --noEmit`, dev spot check.

### Phase 2 — Complete + encapsulate the state surface, extract persistence (L, 2–3 wk)
Still no Zustand — makes Phase 3 convert one thing, not eleven.

1. **Encapsulate `encounter.targets`**: private + `getTargets()/setTargets(eventID,…)/modifyTarget(eventID, idx, fn)`; rewrite ~8 in-place mutation sites in `encounter_picker.ts` (:152, :165, :223, :333, :365, :389). Remove the `showWhen` side effect (:129-140) — move the `setTargetDummies` reset into the change handler.
2. **Encapsulate `player.aplRotation`** (public at player.ts:255): private + `setAplRotation(eventID, fn|value)`; rewrite the 8 APL-picker mutation sites (`pre_pull_list_picker.tsx:27` etc.).
3. **Extract satellite stores** → `core/state/`: ReforgeOptimizer's settings block + 11 emitters (`suggest_reforges_action.tsx:102-149`) → `ReforgeSettings` with its existing `toProto/fromProto`; `StatWeightActionSettings` (stat_weights_action.tsx:24); `CharacterStats.updateStats()` math (character_stats.tsx:179-230) → `proto_utils/stats.ts`. Defer BulkTab/results managers (transient result state, not settings).
4. **Extract persistence**: `core/state/persistence.ts` — storage-key derivation, `loadSettings` preserving exact order (defaults → localStorage → link → clear hash → subscribe-last), autosave subscription. `toProto/fromProto` bodies of `IndividualSimUI`/`RaidSimUI` → `core/state/serialization.ts` taking `(sim, player, reforgeSettings)`; `SimSettingCategories` filtering moves with it.
5. **UI flags out of `Sim`** (sim.ts:113-121) into a `UISettings` object (emitter-based for now); `Sim` keeps delegating getters temporarily. `getShowHealingMetrics` hidden dependency (sim.ts:1042-1050) becomes an explicit derived function in the UI layer.
6. **Blessings**: proto transform out of `raid_sim_ui.tsx:127-149` → `core/state/blessings.ts`; `modifyRaidProto` injection stays, calls the core function.

Verify: snapshots + round trips green (serialized shape must not change); manual QA: APL editor, encounter picker, reforge panel.

### Phase 3 — Zustand store + facade conversion (L, 2–4 wk, many small PRs)
Add `zustand` (vanilla import only). Build `createSimStore` + `withEventID` + `bridgeEmitter`. Convert leaf-first, one slice per PR:

1. `ui` slice → 2. `encounter` → 3. `sim` settings → 4. `raid` → 5. `player` fields, a few per PR (start gear + bonusStats; end aplRotation/itemSwap/reforge) → 6. `party`.

Per conversion: field → slice, setter/getter → facade, emitter → `bridgeEmitter`, old field deleted. `Party.setPlayer` reuse logic (party.ts:134-141) and Player↔Party back-pointers stay in the facades — store holds data, classes keep the object graph; cyclicity becomes harmless. `Sim.updateCharacterStats` write-back (sim.ts:770) becomes one `setState` into `players[i].derived` — closes the async-`freezeAllAndDo` hole (sim.ts:764) as a side effect.

Verify per PR: snapshots + bridge test — mutate via facade, assert (a) selector fired once, (b) legacy emitter fired once with right eventID, (c) `freezeAllAndDo` around two setters yields one aggregate emit.

### Phase 4 — Prove the React seam + docs (S, days)
1. Convert one input (e.g. iterations `NumberPicker`) to subscribe to the store directly, bypassing its emitter — `InputConfig` gains an optional store-selector form.
2. `ui/core/state/README.md`: topology, eventID rules, how to add a field, React recipe (`useStore(simStore, selector)` / `useSyncExternalStore`).
3. Optional: one leaf React component behind a flag against the vanilla store.

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
