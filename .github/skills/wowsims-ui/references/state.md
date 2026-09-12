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
| `players[storeKey]`     | `Player` / `ItemSwapSettings`            | the values, as `PlayerSlice`, plus a per-field version counter `v` keyed by `PLAYER_FIELDS`         |
| `reforge[storeKey]`     | `ReforgeSettings`                        | reforge-optimizer settings (`REFORGE_FIELDS`) + counters                                            |
| `statWeights[storeKey]` | `StatWeightActionSettings`               | excluded stats + counter                                                                            |
| `bulk[storeKey]`        | `ui/sim/settings/bulk_settings.ts`       | the batch's items, picker groups, limits, run flags and results, plus `v: { settings, items }`     |
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
  `subscribePlayerReforgeField`, `subscribePlayerStatWeightsField`, `subscribeBulkField`,
  `subscribeUnitMetadata`, `subscribeRunState(sim, kind)`
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

## Reading the store from React

Four kinds of read. Picking the wrong one is the most common defect in this codebase — see the last
section of this file. In order of preference:

**`usePlayerStore('gear')`** (`ui/sim/hooks/usePlayerStore.ts`) for one player field. It is typed on
`keyof Omit<PlayerSlice, 'v'>`, deliberately **not** on `PlayerField`. `PlayerSlice` holds the real
values as stable references, and `patchKeyed` replaces one only on a real change, so Zustand's own
identity check is the entire subscription: no counter, no snapshot cache, no read callback.
`PlayerField` is the version-_counter_ list (`PLAYER_FIELDS`) and is a **different set** in both
directions — it carries `rotation`, `itemSwap` and `epRefStat`, which have no value in the slice at
all, and it omits the six slice values the last two stand for (`itemSwap*`, `*RefStat`). Reach for
the one that matches what you want: a value, or a notification. The hook reads its player from
`usePlayer()`, and there is exactly one — the raid sim is sunset, so "which player" is never a
question a component has to answer.

**A named store field on an `InputConfig`.** `InputConfig` (`ui/ui-kit/input.ts`) takes
`storeField`, resolved by `ui/sim/hooks/useStoreField.ts` against the host from context. A
`StoreField` is either a bare player field or a scoped one — `sim:` `ui:` `encounter:` `raid:`
`reforge:` `bulk:` `statWeights:` — and an array of them folds into one `subscribeAll`, so several
fields still notify once. The `StoreBinding` type requires one of `storeField` / `storeSubscribe`,
and `storeSubscribe` wins where a config carries both. Prefer naming the field: it is data rather
than a closure, it is greppable, and it cannot capture the wrong object.

`StoreField` also has two aggregates, `'player:*'` and `'encounter:*'`, which watch a whole slice.
**They are a last resort** — each one is a component re-rendering on writes it does not read. There
are nine uses today; that number should fall and never rise:

```
/usr/bin/grep -rn "player:\*\|encounter:\*" --include=*.ts --include=*.tsx ui/ | /usr/bin/grep -v useStoreField.ts
```

**`useStoreSubscribe(source, read)`** (`ui/sim/hooks/useStoreSubscribe.ts`) for a source that is not
a field: an APL per-row source, a facade that owns its own `.subscribe`, an aggregate. It caches the
snapshot and invalidates on notification, because `useSyncExternalStore` reports a fresh object from
`getSnapshot` as _"The result of getSnapshot should be cached to avoid an infinite loop"_ and most
model getters here return one. Its before-init form is
`useReadyStoreSubscribe(source, read, ready)`, and the shape is the point: `ready` is folded into the
**subscription's identity**, not only into the read. `getSnapshot` runs on the first render, long
before a `useSimReady` gate can flip, so gating the read alone caches a `null` that nothing ever
invalidates.

**Not a subscription at all.** `useSpecConfig()` and `useSpecPresets()`
(`ui/sim/context/SimHostContext.tsx`) are plain context reads: the spec declaration is built once in
the `SimHostObject` constructor and never replaced, so they re-render nothing, by design. That makes
them the wrong tool for anything reactive — a value read through one is correct on mount and stale
afterwards. `useSimHost()` / `usePlayer()` / `useSim()` are the same kind of read.
`useOptionalSimHost()` is the nullable variant, for a hook that needs the host on only some paths
and still has to run unconditionally.

Composite hooks, so nobody rebuilds one: `useIsBlacksmithing()` (`ui/sim/hooks/`, both profession
fields), `useTalents()` (`ui/features/talents/hooks/useTalents.ts`), and `useAplRotation(select)` —
the rotation is the one player field with no value in the store, so that hook keys a `useMemo` on the
`rotation` counter and reads `player.aplRotation` through it.

### `revision`, and why the pickers need it

`ui/ui-kit/hooks/useInput.ts` returns `{ value, setValue, hidden, disabled, revision }`. `revision`
increments on **every** notification, including ones that leave the value unchanged. It is not a
change counter, and deleting it looks safe right up to the point an input stops re-syncing.

Four pickers own an **uncontrolled** DOM node and write it from a `useLayoutEffect` keyed
`[value, revision]`: `NumberPicker`, `AdaptiveStringPicker`, `NumberListPicker` and `EnumPicker`.
Without `revision`, a store write that lands back on the value already displayed runs no effect and
the node keeps whatever the user last typed. `IconPicker` and `IconEnumPicker` use it the other way
round, as a `lastRevision` guard that tells a real notification apart from construction.

The three text pickers commit through `useCommitChange` (`ui/ui-kit/hooks/useCommitChange.ts`),
which listens for the **native `change` event** — blur-after-edit and Enter — not React's `onChange`,
which fires per keystroke. Typing into one of them writes nothing to the store until the edit is
committed; `EnumPicker`'s `<select>` is the exception and commits on selection.

Omit both `storeField` and `storeSubscribe` for an input re-synced by its parent — the nested APL
pickers — and for UI-local toggles; `useInput` then rings its own notification after `setValue`, and
the `input_helpers.ts` factories already supply a source where one is wanted.

## The dominant defect: reading state you did not subscribe to

Every other bug class here is rarer than this one. A component subscribes to the fields it obviously
uses, then calls a facade method that reads a field it did not name, and the render is correct on
mount and silently stale afterwards. There is no error, no warning and no failing test; the value is
simply the one it had when the component last re-rendered for some other reason.

Three components were caught and fixed on 2026-09-11 alone, all the same shape:

- `GemSummary` and `QuickGemList` both call `player.isBlacksmithing()` — which decides whether an
  item's extra Blacksmithing socket counts — while subscribing only to `gear`. Toggling the
  profession left the gem totals and the favourite-gem socket colour stale until the next gear edit.
- `GearChangeIcon` called `player.hasProfession(...)` inside a `useMemo(…, [player, item])` with no
  profession subscription anywhere in the file, so a bulk-sim gear-change tooltip kept whichever
  socket count was current when the icon mounted.

All three now take `useIsBlacksmithing()`, which selects `profession1` and `profession2` directly.
What surfaced them was naming the fields at the subscription site: an aggregate, or a hand-built
`storeSubscribe`, hides the read set, and `storeField` puts it in one greppable place. That is the
practical argument for the preference order above.

**No lint can find these.** The read is a method call on a facade, so the dependency is only visible
by following `player.isBlacksmithing()` into `ui/sim/player/player.ts` and seeing which slice fields
it touches. When you add a facade call to a component, audit what that method reads, not what the
component names.

**And `react-hooks/exhaustive-deps` reports the inverse case backwards.** In
`ui/features/gear/components/SelectorModal/ItemList.tsx`, the `itemsToDisplay` memo lists `filters`
in its dependency array (`:69`) while its body, `:55`–`:69`, never mentions it. It reads as a stray
entry to delete. It is load-bearing: the body calls `player.filterItemData(…)`, and that method
reaches `this.sim.getFilters()` internally (`ui/sim/player/player.ts:1294`). Delete the entry on a
lint's word and the memo's correctness rests on `isFavourited` (`:53`) happening to close over
`filters` too — which is an accident of today's code, not the reason the entry is there. Treat a
dependency a lint calls unnecessary the same way you treat a missing one: go read the callee.

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
3. Consumers read it through `usePlayerStore('<field>')` where it is a player field, or by naming it
   as an `InputConfig.storeField` — see "Reading the store from React". A non-React consumer calls
   the matching `subscribe*` helper and keeps the returned unsubscribe.
4. `npm run test:snapshots` — the store contract test runs first and asserts the notification
   contract, so a field that notifies twice fails there rather than in the browser.

## Player lifetime

`Player.dispose()` unsubscribes its store reactions and drops its `players` / `reforge` /
`statWeights` / `bulk` slices on the next tick. The discard rule: `Party.setPlayer` disposes a
_displaced_ player on the next microtask if it still has no party — moves and swaps re-place the
instance within the same task and are never disposed, and removals (`setPlayer(…, null)`) never
dispose. Explicit `dispose()` remains for `Party.fromProto` spec changes and import temporaries.
