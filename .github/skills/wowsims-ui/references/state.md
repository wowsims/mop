# State: one Zustand store per page

**Source of truth:** `ui/sim/state/sim_store.ts` for the shape, `ui/sim/state/subscriptions.ts` for
the read side, `ui/sim/state/batch.ts` for gating. `ui/sim/state/README.md` is the long-form
companion and has the add-a-field recipe — it predates the `runs` slice, so read the slice list from
the code:

```
sed -n '/^export interface SimState {/,/^}/p' ui/sim/state/sim_store.ts
```

There is exactly one store per page: `Sim.store`, built by `createSimStore()` and wrapped in
`subscribeWithSelector`. It is UI-free _and_ browser-free (see the `no-restricted-globals` ban in
`layers.md`), which is what lets `tools/state-snapshots` construct the whole model in node.

## Slices and who owns them

| Slice                   | Owner facade                             | Contents                                                                                            |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ui`                    | `Sim`                                    | show\* flags, language, `wasmConcurrency` — presentation                                            |
| `sim`                   | `Sim`                                    | iterations, phase, faction, `fixedRngSeed`, filters, `lastUsedRngSeed(+version)`, `metadataVersion` |
| `encounter`             | `Encounter`                              | duration, execute proportions, `useHealth`, `targets` (replace-on-write)                            |
| `raid`                  | `Raid` / `Party`                         | buffs, debuffs, tanks, targetDummies, numActiveParties, `partyBuffs[5]`, `composition[5][5]`        |
| `players[storeKey]`     | `Player` / `ItemSwapSettings`            | the settings fields listed in `PLAYER_FIELDS`, plus a per-field version counter `v`                 |
| `reforge[storeKey]`     | `ReforgeSettings`                        | reforge-optimizer settings (`REFORGE_FIELDS`) + counters                                            |
| `statWeights[storeKey]` | `StatWeightActionSettings`               | excluded stats + counter                                                                            |
| `bulk[storeKey]`        | `BulkSettingsStore` (`ui/sim/settings/`) | version counters only; `BulkTab` keeps the values                                                   |
| `runs`                  | `SimRuns` (`ui/sim/sim_runs.ts`)         | `{ isRunning, isAborting }` per `SimRunKind` — one _user-visible operation_, not one worker request |

`runs` is keyed by `SimRunKind` (`individual-sim`, `bulk-sim`, `stat-weights`,
`reforge-optimize`) and written only through `patchRun`. The combustion calculator issues ten worker
requests under one progress bar and one stop button; that is why the unit is the operation.

Class-side by design, deliberately not in the store: the Party↔Player object graph (composition in
the store is the notification source, the objects stay on the classes), `aplRotation` (tracked by
the `rotation` counter), caches, and server-derived metadata objects.

## The write path

A facade setter keeps `setX(eventID, value)`. `eventID` is an opaque action id from
`nextEventID()` (`ui/sim/state/batch.ts`), kept for future undo grouping and **unused by the store**. It
survives lint only because `no-unused-vars` is configured `args: "after-used"` — an unused parameter
before a used one is not reported. A setter that takes an eventID and nothing else needs the `_`
prefix (`argsIgnorePattern: "^_"`). The setter guards equality exactly as it always did, then writes
ONCE:

- `patchSlice(store, 'sim', patch)` — the unkeyed slices
- `patchKeyed(store, 'players', key, patch, bumps)` — the per-entity slices, with `seedKeyed` /
  `deleteKeyed` for lifetime
- `patchRun(store, kind, patch)` — the `runs` slice

One logical change is one `setState`: the value and its counter bump go in the same write, so a
subscriber sees it once. Values that must notify even when the new value compares equal
(`epWeights`, `epRatios`, `currentStats`, `rotation`, `itemSwap`, `lastUsedRngSeed`, the reforge and
stat-weight counters) bump a version counter instead of relying on reference identity. Never
content-hash to force a notification.

Features are lint-banned from importing the four writers directly — go through a facade.

## The read path

Subscribe through `ui/sim/state/subscriptions.ts`, never by hand:

- field level: `subscribePlayerField(player, 'gear')`, `subscribeSimField`, `subscribeUiField`,
  `subscribeEncounterField`, `subscribeRaidField`, `subscribePartyBuffs`, `subscribeReforgeField`,
  `subscribeBulkField`, `subscribeUnitMetadata`, `subscribeRunState(sim, kind)`
- aggregate level: `subscribePlayerChange`, `subscribePartyChange`, `subscribeRaidChange`,
  `subscribeEncounterChange`, `subscribeSimSettingsChange`, `subscribeSimChange`,
  `subscribeReforgeChange`, `subscribeStatWeightsChange`, `subscribeBulkChange`,
  `subscribeStatsInputs`
- `subscribeAll([...])` folds several selector sources into ONE tuple selector, so a write or batch
  touching all of them notifies exactly once. Prefer it over a hand-written combined selector;
  only non-selector sources fall back to one fire per source.

Everything above is **batch-gated** through `subscribeGated` (`ui/sim/state/batch.ts`): inside
`batch(() => …)` a subscriber is deferred and fires once at the end with final state. `batch()`
replaced `freezeAllAndDo` and logs errors the same way. `TypedEvent` is gone.

Aggregates deliberately exclude server-derived state: `PLAYER_CHANGE_FIELDS` drops `currentStats`
and `simSettingsKey` drops the rng seed and metadata counters. Including them makes stat
recomputation re-trigger itself — a self-sustaining loop that looks like a perf bug.

### From React

`ui/sim/hooks/useStoreSubscribe.ts` is the binding, with `useReadyStoreSubscribe` for the
before-init window; `ui/ui-kit/hooks/useInput.ts` is what a picker component uses. From vanilla
code, a picker binds through `InputConfig.storeSubscribe: obj => StoreSubscribe`
(declared in `ui/ui-kit/input.tsx`; the `input_helpers.ts` factories already supply it). Omit it for
inputs re-synced by their parent — the nested APL pickers — and for UI-local toggles.

## State vs events — the rule that gets got wrong

- A **value in the store changed** → a store subscription. Class-side values (`aplRotation`, item
  swap, rng seed, reforge / stat-weight settings) are tracked by version counters in their slice;
  bump the counter where the old emitter fired.
- **Something happened** (a sim result, a crash, a reference set or swapped, progress, "filters
  changed") → `Emitter<T>` from `ui/sim/state/events.ts`. `on` returns an unsubscribe function,
  `emit` fires synchronously. No `EventID`, no batching, no dedup. **Never put these in the store.**

`Emitter.on` is an arrow property, so `storeSubscribe: () => this.changeEmitter.on` is valid.

## Writes that need a specific shape

**Rotation.** `player.modifyAplRotation(eventID, r => …)` is sugar for "mutate, then
`player.touchRotation(eventID)`". The APL pickers hold references _into_ the rotation tree, so they
mutate in place and call `touchRotation` themselves — either form is fine, but a missed
`touchRotation` is silently stale, with no error anywhere.

**Targets.** `encounter.modifyTarget(eventID, i, draft => …)`. Mutate **only the draft**: targets are
replace-on-write, so re-reading state inside the closure hands you a stale object and your edit
disappears.

**Lists.** A picker that hands a list to `ListPicker` must return a COPY from `getValue`
(`.slice()`), never the live store array. `ListPicker.tsx` splices the array `getValue` returns, in
place, and relies on the store notification to re-render — the React port kept that behaviour
deliberately. Confirm with `/usr/bin/grep -n splice ui/ui-kit/ListPicker/ListPicker.tsx`.

## Adding a field

1. Add it to the slice with its default in `sim_store.ts`. Player fields must also be appended to
   `PLAYER_FIELDS` (the version counters are derived from that list), reforge fields to
   `REFORGE_FIELDS`.
2. Facade getter reads the store; setter keeps the old equality guard and writes via `patchSlice` /
   `patchKeyed`. If the old code notified unconditionally, pass the field in `bumps`.
3. Consumers use the matching `subscribe*` helper and store the unsubscribe on the component's
   dispose list.
4. `npm run test:snapshots` — the store contract test runs first and asserts the notification
   contract, so a field that notifies twice fails there rather than in the browser.

## Player lifetime

`Player.dispose()` unsubscribes its store reactions and drops its `players` / `reforge` /
`statWeights` / `bulk` slices on the next tick. The discard rule: `Party.setPlayer` disposes a
_displaced_ player on the next microtask if it still has no party — moves and swaps re-place the
instance within the same task and are never disposed, and removals (`setPlayer(…, null)`) never
dispose. Explicit `dispose()` remains for `Party.fromProto` spec changes and import temporaries.
