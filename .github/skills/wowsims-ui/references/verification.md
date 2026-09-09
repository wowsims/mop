# Verification: what to run, and what each gate actually catches

**Source of truth:** the `scripts` block in `package.json` and `.github/workflows/run_tests.yml`.
Never quote a command from memory; print the current list:

```
node -e "console.log(require('./package.json').scripts)"
```

## Before you call a UI change done

```
npm run type-check     # node_modules/typescript/bin/tsc --noEmit — the whole repo, tools/ included
npm run lint:js        # npx oxlint ./ui
npm run test:unit      # vitest run — happy-dom, ui/**/*.test.ts(x)
npm run test:snapshots # store-contract test, then 34 golden spec protos
npm run fmt            # npx oxfmt ui --check
```

Add `npm run test:locales` whenever you touched `assets/locales/**` or `schemas/**`, and
`npm run lint:css` (stylelint) whenever you touched SCSS.

What each one is actually for:

| Gate             | Catches                                                                                                                    | Does not catch                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `type-check`     | broken specifiers, alias mismatches, spec-config shape drift                                                               | a legal import that violates the layer direction                              |
| `lint:js`        | layer violations (`no-restricted-imports`), browser globals in `ui/sim` and feature models, hook-rule breaks, import order | anything not listed in `.oxlintrc.json` — `categories.correctness` is **off** |
| `test:unit`      | component and helper behaviour, the store hooks' gating                                                                    | anything without a `.test.ts(x)` beside it                                    |
| `test:snapshots` | the store notification contract, then serialization drift across all 34 specs                                              | rendering                                                                     |
| `fmt`            | `ui/` formatting only — `.oxfmtrc.json` has no markdown and no `tools/` in scope                                           |                                                                               |

**Zero `no-restricted-imports` errors is the bar**, not "no new ones": the layer rules are the whole
point of the current tree, and `lint:js` is the only thing enforcing them anywhere.

## What CI runs — it is not the list above

`.github/workflows/run_tests.yml` has two jobs:

- **`build-ui`**: `npm ci`, `npm run test:locales`, then `make dist/mop/.dirstamp`.
- **`test`**: eight shards of `go test --tags=with_db ./sim/...` — the Go sim, not the UI.

`make dist/mop/.dirstamp` is not a thin wrapper: through `dist/mop/bundle/.dirstamp` it runs
`tsc --noEmit`, `npx tsx vite.build-workers.mts` and `npx vite build`, and it also builds
`dist/mop/lib.wasm.gz`, `ui/generated/proto/api.ts` and the asset copies. So CI does type-check and
does build the bundle — through make, never by calling `vite build` directly.

**CI does not run oxlint, vitest, or the snapshot harness.** A layer violation, a failing unit test
and a golden diff all reach master green. Run them locally; nothing else will.

Read the current job list rather than trusting this section:

```
/usr/bin/grep -n "run:" -A3 .github/workflows/run_tests.yml
```

## Locales

`npm run test:locales` runs `test-locales.mjs`, which compiles each `schemas/<name>.schema.json`
with ajv and validates every `assets/locales/**/<name>.json` against it. Today that is `character`,
`glyphs`, `talents` and `translation` across `assets/locales/{en,fr}` — `gear.schema.json` exists
but matches no locale file, so it validates nothing.

**Every schema sets `additionalProperties: false`**, so a new locale key is a two-file change: the
key in `assets/locales/en/…` _and_ `assets/locales/fr/…`, plus a matching property in
`schemas/<name>.schema.json`. Skip the schema and CI fails on the very first job. Verify the
constraint rather than trusting it:

```
node -e "const j=require('./schemas/translation.schema.json'); const s=new Set(); (function w(o){if(!o||typeof o!=='object')return; if('additionalProperties' in o) s.add(String(o.additionalProperties)); for(const k in o) w(o[k]);})(j); console.log([...s])"
```

Both locales ship together. French is expected to match the existing file's register — a key added
to `en` only is an unfinished change, not a follow-up.

## The snapshot harness

`tools/state-snapshots/` — `check.mjs` runs two passes, both as vite SSR builds into `tmp/harness/`
executed under happy-dom by `run.mjs` (which stubs `Worker` and serves `/mop/assets/**` from the
checkout so `Database.get()` loads the real `db.bin`):

1. **`store-contract-test.ts`** first, fast-fail. It asserts the notification contract: one gated
   subscriber fire per facade write, equal-value writes suppressed, unconditional setters still
   notifying via version counters, `batch()` deferring to one fire with final state, the aggregate
   and composition selectors, the satellites, `Emitter`, `setGearAsync`. Nothing else runs if this
   fails.
2. **`snapshot.ts`** — for every launched spec, build `Sim` + `Player` in node, apply defaults,
   serialize player / sim / raid / encounter, and compare byte-for-byte against `golden.json`. It
   also asserts `fromProto(toProto(x))` is a fixed point per spec.

Quirks it encodes **on purpose** — do not "fix" them:

- `Sim.toProto` collapses all-selected filter arrays to `[]`; `Sim.fromProto` re-expands them, so
  the form is only a fixed point from the second pass and the harness canonicalizes once first.
- `Sim.fromProto` mutates its **argument** in place. Serialize before round-tripping.
- `sim.waitForInit()` never resolves under the stubbed `Worker` (it probes for wasm). Await
  `Database.get()` instead.
- `applySpecDefaults` in `snapshot.ts` mirrors `IndividualSimUI.applyDefaults` minus the UI-owned
  satellites. When defaults application moves into `ui/sim/state/`, replace the mirror with the real
  implementation — the snapshot diff then verifies the move.

`npm run test:snapshots:update` regenerates `golden.json`. **Never run it to make a red gate green,
and never commit a regenerated golden without asking** — diff the old and new JSON and confirm only
the fields you intended moved. The same rule covers every fixture in this repo.

Because the harness builds the real module graph, it is also the gate that catches a
module-evaluation-order cycle (see `layers.md`) — that failure looks like a crash in `new Player`.

## What no gate covers

Rendering, layout and interaction. There is no DOM-parity harness on this branch; the closest thing
is running the page yourself — see `running-locally.md`. Do that for anything that changes what a
user sees, and say in the PR what you clicked.

## A fresh checkout needs generated files first

`npm run type-check` and every build need files that are gitignored and produced by Go tooling:
`ui/generated/proto/*` (`make ui/generated/proto/api.ts`) and the three `*_auto_gen.ts`
(`make go-to-ts`, which runs `go run ./tools/database/gen_db -gen=go-to-ts`). Copying them from a
built checkout works and is faster. Never run `gen_db` concurrently with another copy of itself.

Known wart: the makefile's `AUTO_GEN_FILES_TS` still lists the pre-restructure path
`ui/sim/player_classes/capabilities_auto_gen.ts`, while `tools/database/gen_character_constants_ts.go`
writes `ui/sim/player/classes/capabilities_auto_gen.ts`. The prerequisite therefore never appears, so
every `make` that depends on it — `dist/mop/.dirstamp`, `host`, `devmode`, `rundevserver` — re-runs
`gen_db` and re-bundles even when nothing changed. Verify before blaming your own change:

```
/usr/bin/grep -n AUTO_GEN_FILES_TS makefile | head -1
/usr/bin/grep -n 'os.WriteFile("ui/' tools/database/gen_character_constants_ts.go
```
