# ui/core/state — the framework-agnostic state layer

Everything in this directory is UI-free (a lint rule bans imports from
`ui/core/components`). The sim's data state lives in one Zustand vanilla store
per page, consumed from plain TS today and from React later (`useStore(sim.store, selector)`)
with no store changes. There is no separate event system any more.

## Topology

`Sim.store` is created by `createSimStore()` (`sim_store.ts`, wrapped in
`subscribeWithSelector`). Slices:

| Slice | Owner facade | Contents |
|---|---|---|
| `ui` | `UISettings` (ui_settings.ts) | show* flags, language, wasmConcurrency |
| `sim` | `Sim` | iterations, phase, faction, fixedRngSeed, filters, lastUsedRngSeed(+version), metadataVersion |
| `encounter` | `Encounter` | duration, execute proportions, useHealth, targets (replace-on-write) |
| `raid` | `Raid` / `Party` | buffs, debuffs, tanks, targetDummies, numActiveParties, partyBuffs[5], composition[5][5] (player storeKeys) |
| `players[storeKey]` | `Player` / `ItemSwapSettings` | 23 settings fields + per-field version counters (`v`) |
| `reforge[storeKey]` | `ReforgeSettings` | 12 reforge-optimizer settings + counters |
| `statWeights[storeKey]` | `StatWeightActionSettings` | excluded stats + version |

Class-side by design: the Party↔Player object graph (composition in the store is
the notification source; the objects stay on the classes), `aplRotation`
(tracked by the `rotation` counter), caches, server-derived metadata objects.

## Writes and notifications

Facade setters keep their `setX(eventID, value)` signatures — `eventID` is an
opaque action id (`nextEventID()` in `batch.ts`), kept for future undo grouping
and unused by the store. Setters guard equality exactly as before, then
`store.setState(...)`. Values that must notify unconditionally (epWeights,
epRatios, currentStats, rotation, itemSwap, lastUsedRngSeed, reforge/stat-weight
counters) bump a version counter instead of relying on reference identity.

Consumers subscribe through `subscriptions.ts`:

- field level: `subscribePlayerField(player, 'gear')`, `subscribeSimField`,
  `subscribeUiField`, `subscribeEncounterField`, `subscribeRaidField`,
  `subscribePartyBuffs`, `subscribeReforgeField`, `subscribeUnitMetadata`…
- aggregate level: `subscribePlayerChange`, `subscribePartyChange`,
  `subscribeRaidChange`, `subscribeEncounterChange`, `subscribeSimSettingsChange`,
  `subscribeSimChange`, `subscribeReforgeChange`, `subscribeStatWeightsChange`
- `subscribeAll([...])` composes several.

All of these are **batch-gated** (`batch.ts`): inside `batch(() => ...)` a
subscriber is deferred and fires once at the end with final state (selector
equality ⇒ once per changed field). `batch` replaced `freezeAllAndDo`. A
consumer that must react once to *several* sources subscribes to ONE combined
selector (e.g. `subscribeStatsInputs`, `subscribeRaidComp`) rather than
`subscribeAll`, which fires once per changed source.

Aggregates deliberately exclude server-derived state: `PLAYER_CHANGE_FIELDS`
drops `currentStats`, `simSettingsKey` drops the rng seed / metadata counters.
Including them would make stat recomputation re-trigger itself.

Pickers bind through `InputConfig.storeSubscribe(obj, onChange)` (required);
the `input_helpers.ts` factories supply it. Pickers that hand a list to
`ListPicker` must return a COPY from `getValue` (`.slice()`).

## Events vs state

Something that *happened* (sim result, crash, reference set/swapped, a
UI-local signal like "filters changed") is an event, not state: use
`Emitter<T>` from `events.ts` (`on` → unsubscribe fn, `emit`, `onAnyEmitter`).
No batching, no dedup, fires synchronously. Never put these in the store.

## Adding a field

1. Add it to the slice with its default in `sim_store.ts`; for player fields
   also append it to `PLAYER_FIELDS` (version counters derive from that list),
   for reforge fields to `REFORGE_FIELDS`.
2. Facade getter reads the store; setter keeps the old guard, writes via
   `setState`; if the old code notified unconditionally, bump a counter.
3. Consumers use the matching `subscribe*` helper; store the unsubscribe on the
   component's dispose list.

## Also here

`persistence.ts` (load-order contract + autosave), `serialization.ts`
(IndividualSimSettings envelope, golden-tested), `sim_links.ts`,
`reforge_request.ts`, `item_swap_settings.ts`.

## Player lifetime

`Player.dispose()` unsubscribes its store reactions and drops its `players` /
`reforge` / `statWeights` / `bulk` slices on the next tick. Discard rule: `Party.setPlayer`
disposes a *displaced* player on the next microtask if it still has no party — moves
and swaps re-place the instance within the same task and are never disposed; removals
(`setPlayer(…, null)`) never dispose. Explicit `dispose()` remains for `Party.fromProto`
spec changes and import temporaries.
