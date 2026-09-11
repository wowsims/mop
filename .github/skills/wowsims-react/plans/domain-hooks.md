# Domain classes → hooks/selectors over the Zustand store

Spike note. Branch `wt/domain-hooks`, off `feature/ui-react` @ `1f58c946c`.

## Conclusion first

The migration as stated — "turn the imperative domain classes into hooks/selectors" —
**cannot be done, and the part of it that can be done is already done.** The store is
already the single source of truth; the six classes are already facades over it.

What is actually left is one 30-line change nowhere near a hook: the `subscribe*`
factories build a fresh closure per call, so every React consumer wraps them in a
`useMemo` to stop `useStoreSubscribe` resubscribing each render. Cache the factories and
49 of those disappear. Built and gated here (commit 2); the trade it makes is that the
call site's safety becomes non-local, and it cost five test files.

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

## What the slice found: the boilerplate is not the hook, it is the `useMemo`

The first draft of this note proposed a `usePlayerField(player, field, read)` hook family,
generalising `ui/features/reforge/hooks/useReforgeField.ts`. Building it showed that is the
wrong level. Every call site looked like this:

```tsx
const gear = useStoreSubscribe(
	useMemo(() => subscribePlayerField(player, 'gear'), [player]),
	() => player.getGear(),
);
```

and a hook that wraps the pair only hides the `useMemo` at the sites whose shape it happens to
fit. Half the sites compose (`subscribeAll([subscribePlayerField(player, 'rotation'),
subscribeUnitMetadata(player.sim)])`) and a per-class hook cannot serve those at all.

The `useMemo` is there for one reason: `useStoreSubscribe` re-subscribes whenever its source
changes identity, and every `subscribe*` factory built a fresh closure per call. But those
factories are pure over `(store, selector, equalityFn)` — `subscribeGated` (`state/batch.ts`)
builds all the per-subscriber state on each `sub(onChange)` call — so one identity can serve
every subscriber. Caching them removes the reason the `useMemo` existed, at every site, of
every shape, with no new hook and no new module:

```tsx
const gear = useStoreSubscribe(subscribePlayerField(player, 'gear'), () => player.getGear());
```

Implemented as ~30 lines in `ui/sim/state/subscriptions.ts`: a `WeakMap` keyed on the owning
facade (so a disposed player's sources are collected with it), plus a source id so
`subscribeAll` can key a composition on its parts. A caller-built source (`gearData.subscribe`,
`rowSource(...)`, the APL `changeSource`) has no id, stays uncached, and keeps its `useMemo`.

Measured, in one commit: **50 files, +233/−252**, 49 `useMemo` wrappers gone, 17 now-unused
`useMemo` imports dropped, and with them 49 hand-written `[player]` / `[sim]` / `[settings]`
dependency arrays whose staleness was a silent wrong-subscription rather than a crash.

### The cost, which is real

Five test files (57 tests) went from green to an infinite render loop. Each mocked
`@sim/state/subscriptions` with a factory returning a fresh closure per call — e.g.
`subscribeSimChange: () => () => () => {}`. The call-site `useMemo` used to absorb that; without
it the component resubscribes on every render forever.

That is the honest trade: **the call site's safety became non-local.** Reading
`useStoreSubscribe(subscribePlayerField(player, 'gear'), …)` in a component, nothing on the page
says the source is stable — it reads like a fresh call per render, which is a React red flag. It
is correct only because of a cache two modules away. The old `useMemo` was noisy and got the dep
array wrong sometimes, but it was locally verifiable.

The fixes were three lines each (hoist the fake out of the factory, one identity per key, like
the real module), and the mocks are more faithful for it. But anyone adding a test mock now has
to know the invariant.

### What it did not fix

Naming fields at the subscription site does not stop you naming too few. Two live bugs of the
"subscribe set ⊂ read set" shape, found while enumerating the call sites and fixed in the
following commit:

- `ui/features/gear/components/SummaryTable/GemSummary.tsx` subscribed to `gear` and read
  `gear.getAllGems(player.isBlacksmithing())`. Toggling Blacksmithing changes whether an item's
  extra socket counts, and the table did not re-render.
- `ui/features/gear/components/GearPicker/QuickGemList.tsx` subscribed to `gear` and read
  `currentItem.curSocketColors(player.isBlacksmithing())[socketIdx]`. Same cause; the
  favourite-gem popover offered the wrong socket colour.

The only variant that would prevent that class of bug is an auto-tracking read: run the reader
against a proxy over the player slice, record the fields touched, subscribe to exactly those.
That is MobX/valtio machinery — ~60 lines, a re-subscribe-during-render hazard with
`useSyncExternalStore`, a global "currently tracking" flag in the sim layer that exists only for
React, and an under-subscription hole the first time a reader takes a different branch.
Rejected.

The cheap alternative — point every reader at `subscribePlayerChange` and let value equality
suppress the render — is correct and costs a full re-run of every reader on every player write.
Several readers are not cheap (`computeStatAttribution`, `unitOptionModels`,
`availableCooldowns`, `Player.filterItemData` at 123 lines). On a branch where a previous React
port was reverted for +12.2%, that is not a trade to make blind.

## Gates

All at `050189e6e`, against the baseline on 3401 confirmed to be `~/personal/wowsims-mop`:

| Gate | Result |
| --- | --- |
| `type-check` | clean |
| `vitest run` | 1624 passed / 196 files — baseline exactly |
| `lint:js` | 297 warnings, 0 errors — baseline exactly |
| `lint:css` | clean |
| `test:snapshots` | store contract OK, **34/34 byte-identical** |
| `vite build` | clean |
| `parity.mjs` (unsplit, 3401 vs 3405) | 6 pass, 0 fail |
| `panes-parity.mjs` | pane contents identical on every tab |

## The refactor that is actually worth doing

`player.ts` is 1,695 lines and 131 methods, and ~1,450 of them are pure domain logic with no
store and no React:

| Candidate module | Members | Approx lines |
| --- | --- | --- |
| `player/ep.ts` | `computeStatsEP`, `computeGemEP`, `computeEnchantEP`, `computeRandomSuffixEP`, `computeReforgingEP`, `computeUpgradeEP`, `computeItemEP` | ~180 |
| `player/filters.ts` | `filterItemData`, `filterEnchantData`, `filterGemData` | ~170 |
| `player/crit_cap.ts` | `getMeleeCritCapInfo`, `getMeleeCritCap` | ~55 |
| `player/serialization.ts` | `toProto`, `fromProto`, `clone`, `applySharedDefaults` | ~130 |
| `player/racials.ts` | `getActiveRacialExpertiseBonuses`, `getAmplificationTrinkets`, `getTotalAmplificationTrinketStatModifier`, `hasArmorSpecializationBonus`, `hasEotBPItemEquipped` | ~110 |

Each takes the data it needs as arguments and is unit-testable without a `Sim`. That leaves a
~900-line `Player` that is mostly store access and the party/raid graph. It keeps the frozen
spec contract intact (the methods stay as thin delegating members), it is verified byte-for-byte
by the existing snapshot gate, and it needs no React at all. It is the change that makes the
file navigable; "hooks" does not.

## Recommendation

1. **Do not pursue "domain classes → hooks" as a project.** There is no third act. The frozen
   `ui/specs/**` contract (142 `player.<method>()` call sites), the persistence envelope, the sim
   run controller, the worker pool and the node snapshot harness all pin the class API, and the
   store already holds the state. The classes are already the thin part.
2. **The subscription-source cache is worth taking on its own merits**, and it is separable from
   any of this: one commit, 30 lines of mechanism, −19 net lines, every gate at baseline. Take it
   if the non-local-safety trade reads as acceptable; the `useMemo`s are honest documentation and
   reverting is one commit.
3. **Take the two gem bug fixes regardless** — they are independent of the refactor.
4. **Schedule the `player.ts` split instead**, if the 1,695-line file is the actual complaint.
