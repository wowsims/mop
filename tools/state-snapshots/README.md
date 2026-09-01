# State snapshots — golden serialization tests

Safety net for the state/UI separation refactor (see `STATE_UI_SEPARATION_PLAN.md`).

For every launched spec this harness constructs `Sim` + `Player` in node (no UI),
applies the spec's defaults, and serializes player / sim / raid / encounter to
JSON. The output is compared byte-for-byte against `golden.json`. It also asserts
that `fromProto(toProto(x))` is a fixed point per spec.

```
npm run test:snapshots          # store contract test, then check against golden.json
npm run test:snapshots:update   # regenerate golden.json — only when a diff is intended
```

`store-contract-test.ts` runs first: it asserts the store notification contract
(one gated subscriber fire per facade write, equal-value writes suppressed,
unconditional setters still notifying via version counters, `batch()` deferring
to one fire with final state, aggregate/composition selectors, satellites,
`Emitter`, `setGearAsync`). Any failure stops the run before snapshots are compared.

How it runs: `check.mjs` builds `snapshot.ts` with a throwaway vite SSR bundle
(`vite.harness.mts` at the repo root), then executes it via `run.mjs`, which
registers happy-dom, stubs `Worker`, and serves `/mop/assets/**` fetches from
the local checkout (so `Database.get()` loads the real db.bin).

Known quirks the harness deliberately works around (do NOT "fix" them mid-refactor;
snapshots encode current behavior):

- `Sim.toProto` collapses "all selected" filter arrays to `[]` and `Sim.fromProto`
  re-expands them — the serialized form is only a fixed point from the second
  pass, so the harness does one canonicalization round trip before snapshotting.
- `Sim.fromProto` mutates its *argument* in place (expands empty filter arrays on
  the passed proto object). Serialize before round-tripping.
- `sim.waitForInit()` never resolves under the stubbed `Worker` (it probes for
  wasm); await `Database.get()` instead.
- `applySpecDefaults` in `snapshot.ts` mirrors `IndividualSimUI.applyDefaults`
  minus the UI-owned satellites (reforger, stat-weight settings, defaultBuild).
  When defaults application moves into `ui/core/state/`, replace the mirror with
  the real implementation — the snapshot diff then verifies the move.

Not yet covered: the `IndividualSimSettings` envelope (reforge settings,
epWeights ref stats, saved-data slots) — it is serialized by the UI classes
today and gets covered when Phase 2 extracts it into `core/state/serialization.ts`.
