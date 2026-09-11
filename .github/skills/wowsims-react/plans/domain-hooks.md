# Domain classes → hooks/selectors over the Zustand store

Spike note. Branch `wt/domain-hooks`, off `feature/ui-react` @ `1f58c946c`.

## Conclusion first

The migration as stated — "turn the imperative domain classes into hooks/selectors" —
**cannot be done, and the part of it that can be done is already done.** The store is
already the single source of truth; the six classes are already facades over it. What
is left is a ~110-line ergonomics change in `ui/features/`, which is worth doing on its
own small merits and is not worth calling a migration.

The 1,695-line `player.ts` is a real problem, but it is not a React problem: ~1,450 of
those lines never touch the store or the DOM. Splitting it is orthogonal to hooks and
is the refactor actually worth scheduling.

## What exists today

`ui/sim/state/sim_store.ts` (383 lines) is one vanilla Zustand store per page, wrapped
in `subscribeWithSelector`, 8 slices, per-field version counters. Writes go through
`patchSlice` / `patchKeyed`; reads go through `store.getState()`. The facades:

| File | Lines | Store-touching lines | Rest |
| --- | --- | --- | --- |
| `ui/sim/player/player.ts` | 1695 | ~245 (23 getters, 25 setters, `slice`/`write`/`patch`) | EP math, item/enchant/gem filtering, melee crit cap, proto (de)serialization, racial bonuses |
| `ui/sim/sim.ts` | 1094 | ~180 | worker pool, database, wasm, links, unit metadata |
| `ui/sim/raid/encounter.ts` | 232 | ~150 | preset matching, proto defaults |
| `ui/sim/raid/raid.ts` | 204 | ~120 | party graph |
| `ui/sim/raid/party.ts` | 159 | ~60 | player lifetime |
| `ui/sim/settings/reforge_settings.ts` | 239 | ~150 | derived relative stat cap |

Consumers reach state two ways:

- **`InputConfig.storeSubscribe`** — 187 bindings. Plain data, evaluated by
  `ui/ui-kit/hooks/useInput.ts`. 49 of them are `subscribePlayerField`.
- **React hooks** — 55 `useStoreSubscribe` / `useReadyStoreSubscribe` call sites
  (47 in `ui/features`, 3 `ui/app`, 3 `ui/ui-kit`, 2 `ui/sim`).

## Why the classes cannot become hooks

1. **`ui/specs/**` is frozen and is written against the instance API.** 142
   `player.<method>()` call sites across the 34 spec files, plus 10
   `encounter.getTargets()`. The top ones: `getGear` ×25, `getTalents` ×22,
   `getEpWeights` ×14, `getSimpleRotation` ×13, `getClassOptions` ×11. All are called
   from plain callbacks — `showWhen: player => ...`, `getValue`/`setValue`,
   `changeEmitter`-equivalent `subscribe:` slots, `modifyDisplayStats`. None is inside
   a component. A hook cannot serve any of them.

2. **Half the runtime is outside React.** `ui/sim/state/persistence.ts` drives the
   load-order contract (defaults → storage → hash → autosave subscribed last) against
   `player.setName`, `host.fromProto`; `ui/sim/sim_runs.ts` writes `runs` from a
   promise chain; `ui/sim/workers/worker_pool.ts`, `ui/features/bulk/model/run.ts`,
   `ui/features/reforge/model/reforge_optimizer.ts` and 40 other `.ts` model files
   hold a `Player` and call it. `SpecBehaviors.features` and
   `SpecBehaviors.derivedSettings` hand a spec the host and let it subscribe by hand.

3. **`tools/state-snapshots/snapshot.ts` constructs `Sim` + `Player` in node** under
   `memory_env`, with `Worker` stubbed and no React in the bundle at all. It is the
   only byte-exact gate on the model layer. Anything that made the model depend on a
   React runtime would delete that gate.

So the end state is not "hooks instead of classes". It is, at most, "hooks **on top of**
an unchanged class core" — and that layer already exists in `ui/sim/hooks/`
(`useStoreSubscribe`, `useReadyStoreSubscribe`, `useSimReady`, `useDisplayMetrics`,
`useShowExperimental`) plus one per-feature instance,
`ui/features/reforge/hooks/useReforgeField.ts`.

## The only real change left

`useReforgeField` is the shape, applied to exactly one slice:

```ts
export const useReforgeField = <T>(settings: ReforgeSettings, field: ReforgeField, read: () => T): T =>
	useStoreSubscribe(useMemo(() => subscribeReforgeField(settings, field), [settings, field]), read);
```

Everywhere else, components hand-assemble the same thing:

```tsx
const gear = useStoreSubscribe(
	useMemo(() => subscribePlayerField(player, 'gear'), [player]),
	() => player.getGear(),
);
```

Generalising `useReforgeField` to the player slice turns each of those into one line.
Applied across the tree that is **28 files**, 47 call sites, about **-110 lines** net
in a 145,569-line `ui/`. It also removes 28 hand-written `useMemo(..., [player])`
dependency arrays, which is the part with any safety value: a wrong dep array there is
a silent stale subscription, not a crash.

### What it does not fix

Naming the field in the hook call does not stop you naming too few. Two live examples
found while enumerating the call sites, both "subscribe set ⊂ read set":

- `ui/features/gear/components/SummaryTable/GemSummary.tsx:42` subscribes to `gear`
  and reads `gear.getAllGems(player.isBlacksmithing())`. Toggling Blacksmithing changes
  the extra-socket gem count and does not re-render the table.
- `ui/features/gear/components/GearPicker/QuickGemList.tsx:25` subscribes to `gear`
  and reads `currentItem.curSocketColors(player.isBlacksmithing())[socketIdx]`. Same
  cause; the favourite-gem popover offers the wrong socket colour.

The only variant that *would* prevent this class of bug is an auto-tracking read: run
the reader once against a proxy over the player slice, record the fields touched,
subscribe to exactly those. That is MobX/valtio machinery — roughly 60 lines, plus a
re-subscribe-during-render hazard with `useSyncExternalStore`, plus a global
"currently tracking" flag in the sim layer that exists only for React's benefit, plus
an under-subscription hole the first time a reader takes a different branch. Rejected.

The cheap alternative — subscribe every reader to `subscribePlayerChange` and let
value equality suppress the render — fixes correctness and costs a full re-run of
every reader on every player write. Several readers are not cheap
(`computeStatAttribution`, `unitOptionModels`, `availableCooldowns`,
`Player.filterItemData` at 123 lines). On a branch where a previous React port was
reverted for +12.2%, that is not a trade to make blind.

## What a full migration would cost and delete

If it were done anyway, "full" means the 55 React call sites and nothing else, because
the other 187 bindings and every `.ts` model caller must keep the class API:

- **Adds** `ui/sim/hooks/usePlayerField.ts`, `useSimField.ts`, `useUiField.ts`,
  `useEncounterField.ts`, `useRaidField.ts` — 5 files, ~60 lines total.
- **Touches** 28 files for Player, ~12 more for Sim/UI/Encounter/Raid.
- **Deletes** ~110 lines of `useMemo`/`subscribe` pairing, ~25 `useMemo` imports,
  and `ui/features/reforge/hooks/useReforgeField.ts` (folded into the family).
- **Deletes zero class code.** `player.ts` stays 1,695 lines. `subscriptions.ts` stays
  200 lines — the hooks are built on it, and the 187 `storeSubscribe` bindings need it
  unchanged.

## The refactor that is actually worth doing

`player.ts` is 1,695 lines and 131 methods, and ~1,450 of them are pure domain logic
with no store and no React:

| Candidate module | Members | Approx lines |
| --- | --- | --- |
| `player/ep.ts` | `computeStatsEP`, `computeGemEP`, `computeEnchantEP`, `computeRandomSuffixEP`, `computeReforgingEP`, `computeUpgradeEP`, `computeItemEP` | ~180 |
| `player/filters.ts` | `filterItemData`, `filterEnchantData`, `filterGemData` | ~170 |
| `player/crit_cap.ts` | `getMeleeCritCapInfo`, `getMeleeCritCap` | ~55 |
| `player/serialization.ts` | `toProto`, `fromProto`, `clone`, `applySharedDefaults` | ~130 |
| `player/racials.ts` | `getActiveRacialExpertiseBonuses`, `getAmplificationTrinkets`, `getTotalAmplificationTrinketStatModifier`, `hasArmorSpecializationBonus`, `hasEotBPItemEquipped` | ~110 |

Each takes the data it needs as arguments and is unit-testable without a `Sim`. That
leaves a ~900-line `Player` that is mostly store access and the party/raid graph. It
keeps the frozen spec contract intact (the methods stay as thin delegating members),
it is verifiable by the existing snapshot gate byte-for-byte, and it needs no React at
all. It is the change that makes the file navigable; "hooks" does not.

## Recommendation

1. Take the `usePlayerField` family — it is small, it pays for itself in the dep-array
   hazard, and it makes the 28 call sites read like the rest of the codebase. One
   commit, reviewable in ten minutes. Slice built on this branch.
2. Fix the two under-subscription bugs it surfaced.
3. Do **not** pursue "domain classes → hooks" as a project. There is no third act: the
   frozen spec contract, the persistence envelope and the node snapshot harness all
   pin the class API, and the store already holds the state.
4. Schedule the `player.ts` split instead, if the 1,695-line file is the actual
   complaint.
