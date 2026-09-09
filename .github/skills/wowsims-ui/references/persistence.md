# Persistence and serialization

**Source of truth:** `ui/sim/state/persistence.ts` (load order + autosave),
`ui/sim/state/serialization.ts` (the `IndividualSimSettings` envelope),
`ui/sim/state/sim_links.ts` (URL-hash import). The load-order contract is written as a comment at
the top of `persistence.ts` — read it there if this file and the code disagree:

```
sed -n '1,20p' ui/sim/state/persistence.ts
```

All three are browser-free: the localStorage and `location` surfaces arrive through the injected
`Env` (`sim.env`), never through globals.

## The load-order contract — do not reorder

`loadIndividualSettings(host, opts)` runs the whole sequence inside one `batch()`:

1. `host.applyDefaults()`
2. saved settings from `env.storage` (parse failures are warned and swallowed — a corrupt blob must
   not brick the page)
3. the URL-hash link, via `tryParseUrlLocation(env.location)`. **After** step 2 on purpose: a
   partial link import (rotation only, say) must keep the previous settings for the other categories
4. `env.location.setHash('')`
5. `player.setName('Player')`
6. `opts.autosaveSubscribe(schedulePersist)` — **last**, so initialization does not re-store what it
   just loaded
7. `opts.statWeightSettings.load()`

Then one explicit `persist()` outside the batch, because the subscription registered in step 6 only
sees changes made after it existed.

Autosave is debounced by `AUTOSAVE_DEBOUNCE_MS` (300 ms): serializing and storing the full envelope
on every keystroke cost ~50 ms per APL edit. A pending write is flushed by `env.onPageHide`.

**The trap this cost an afternoon:** `persistTimer` must be declared _before_ the load batch. The
batch's flush can already schedule a persist, so declaring the timer after it is a TDZ error that
only fires on a path with saved settings.

## Storage keys

The key is built by the caller and handed in — the state layer never derives one.
`SimUI.getStorageKey(postfix)` is the builder; `ui/sim/constants/other.ts` holds
`LOCAL_STORAGE_PREFIX`. Suffixes in use:

| Constant                                                  | Key                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SETTINGS_STORAGE_SUFFIX`                                 | the settings envelope, per spec                                                                |
| `SHARED_SAVED_ENCOUNTER_STORAGE_KEY`                      | saved encounters — deliberately **not** per-spec prefixed, so they are shared across every sim |
| `'__statweight_settings__'`                               | stat-weight action settings                                                                    |
| `SAVED_GEAR_STORAGE_KEY` / `SAVED_EP_WEIGHTS_STORAGE_KEY` | the saved-data slots                                                                           |

If you add a key, add it via `getStorageKey` unless you positively want it shared across specs, and
say which in a comment — the saved-encounter exception is the only one today and it is easy to
imitate by accident.

## The envelope

`individualSimSettingsToProto(ctx, exportCategories?)` and `applyIndividualSimSettings(...)` in
`serialization.ts` assemble and apply `IndividualSimSettings`. `IndividualSimUI.toProto` /
`fromProto` are thin wrappers. The envelope covers more than the store:
`IndividualSimSerializationContext` also carries the reforge settings model and the EP
reference-stat selections owned by the sim UI.

`updateIndividualSimProtoVersion` migrates older blobs — a settings shape change usually belongs
there rather than in a new field default.

Category filtering is shared with link import: `SimSettingCategories`, and
`LINK_DEFAULT_CATEGORIES` in `sim_links.ts` is every category except `UISettings` (your show-flags
and language do not travel through a shared link).

## What is gated

`npm run test:snapshots` covers this end to end: for every launched spec it builds `Sim` + `Player`
in node, applies defaults, serializes, and compares byte-for-byte against `golden.json`, then
asserts `fromProto(toProto(x))` is a fixed point. A persistence change that alters the serialized
shape shows up there as a diff — which is the point, so read the diff before regenerating.

Two `Sim` round-tripping quirks will bite you here specifically — the filter-array collapse and the
fact that `Sim.fromProto` mutates its **argument**. They are written up once, under "The snapshot
harness" in `verification.md`; read them before you write a round-trip.
