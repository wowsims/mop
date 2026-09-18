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
npm run fmt            # npx oxfmt . --check — the whole repo, not just ui/
```

Add `npm run test:locales` whenever you touched `assets/locales/**` or `schemas/**`, and
`npm run lint:css` (stylelint) whenever you touched CSS.

What each one is actually for:

| Gate             | Catches                                                                                                                    | Does not catch                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `type-check`     | broken specifiers, alias mismatches, spec-config shape drift                                                               | a legal import that violates the layer direction                              |
| `lint:js`        | layer violations (`no-restricted-imports`), browser globals in `ui/sim` and feature models, hook-rule breaks, import order | anything not listed in `.oxlintrc.json` — `categories.correctness` is **off** |
| `test:unit`      | component and helper behaviour, the store hooks' gating                                                                    | anything without a `.test.ts(x)` beside it                                    |
| `test:snapshots` | the store notification contract, then serialization drift across all 34 specs                                              | rendering                                                                     |
| `fmt`            | formatting across the repo, markdown included — `assets/**` and `**/test-fixtures/*.json` are the ignored trees            | anything `.gitignore` already hides, which is how generated output escapes it |

**Zero `no-restricted-imports` errors is the bar**, not "no new ones": the layer rules are the whole
point of the current tree, and `lint:js` is the only thing enforcing them anywhere.

## What CI runs

`.github/workflows/run_tests.yml` has two jobs:

- **`build-ui`**, in order: `npm ci` and `npm run test:locales`, then `npm run fmt`,
  `npm run lint:js`, `npm run lint:css`, `make ui/generated/proto/api.ts go-to-ts`,
  `npm run type-check`, `npm run test:unit`, and finally `make dist/mop/.dirstamp`.
- **`test`**: eight shards of `go test --tags=with_db ./sim/...` — the Go sim, not the UI.

Cheapest first, so a formatting slip reports in about a minute instead of behind the wasm build.
The generation step is not optional: `tsc` and the unit tests resolve `@generated/proto/*` and the
three `*_auto_gen.ts`, all gitignored and absent from a fresh checkout.

`make dist/mop/.dirstamp` is not a thin wrapper: through `dist/mop/bundle/.dirstamp` it runs
`tsc --noEmit`, `npx tsx vite.build-workers.mts` and `npx vite build`, and it also builds
`dist/mop/lib.wasm.gz`, `ui/generated/proto/api.ts` and the asset copies. It keeps its own `tsc`
even though the step above already ran one.

**`test:snapshots` is deliberately not a CI step.** The 34 goldens move far less often than the
tests do. Run it locally when you touch the store or its serialization; nothing upstream will.

`build-ui` is reused through `workflow_call` by `deploy.yml` and `release.yml`, both with
`needs: tests`, so every gate above also blocks a deploy and a release.

Read the current job list rather than trusting this section:

```
RTK_DISABLED=1 /usr/bin/grep -n "name:\|run:" .github/workflows/run_tests.yml
```

## Warnings are invisible unless you ask for them

vitest intercepts console output, so React and Base UI warnings do not reach stdout on a normal run
— `npm run test:unit` can be entirely green while the suite emits hundreds of them. They surface in
CI logs and nowhere else, which makes them look like a CI-only phenomenon. They are not:

```
RTK_DISABLED=1 npx vitest run --disableConsoleIntercept 2>&1 | grep -c "not wrapped in act"
```

Three counts worth keeping at zero, all of which were nonzero before anyone looked:

- `not wrapped in act` — a state update landing outside an act window. Usually a promise resolving
  after the test body, or a store notify called bare between acts.
- `overlapping act` — the failure mode introduced by fixing the first one carelessly.
- `Base UI:` — the `nativeButton` contract, among others.

**Prefix `RTK_DISABLED=1` on anything whose output you grep for a count**, not just git. RTK rewrites
dev commands too, and a compressed one-line summary greps as zero — indistinguishable from success.

If a flag the count depends on might be silently ignored, pass a deliberately bogus one first: an
unknown flag throws `CACError: Unknown option`, so a clean run proves the real flag was accepted.

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

**`tools/state-snapshots/` is developer-local and not tracked.** `npm run test:snapshots` and
`test:snapshots:update` therefore do nothing in a fresh clone, and the 34/34 figure a PR quotes
cannot be reproduced by a reviewer who does not have the harness. It stays local because
`golden.json` is 3.9 MB and regenerating it is a fixture update, which only the repo owner does. The
`virtual:i18next-loader` alias the unit tests need is a separate, **tracked** file
(`tools/vite/stub-i18n.js`), so `npm run test:unit` works in a fresh clone regardless.

`check.mjs` runs two passes, both as vite SSR builds into `tmp/harness/`
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

Rendering, layout and interaction. None of the five commands above constructs the shell —
`tools/state-snapshots/snapshot.ts` imports `IndividualSimUIConfig` as a _type_ and mirrors
`applyDefaults` by hand, so the goldens prove no state write leaked into a component and say nothing
about whether anything rendered.

**Nothing above proves the page rendered.** The goldens are a state contract, not a render check, so
a change that only moves DOM or CSS around can pass every command here. When a change touches
rendering, layout or interaction, drive the built page yourself — build it, serve it, and compare
against a build of the parent commit rather than against a remembered element count. Say in the PR
what you ran or what you clicked.

`tools/browser-perf/` (perf timings) is **git-excluded**: it is a line in `.git/info/exclude`, which
lives in the shared common git dir, so the rule applies to every worktree of this clone but the
directory travels with none of them. It exists wherever its owner made it — not in a fresh clone and
not in CI. Check before relying on it (`/usr/bin/ls tools/browser-perf/`) and do not tell anyone else
a path is there.

## A fresh checkout needs generated files first

`npm run type-check` and every build need files that are gitignored and produced by Go tooling:
`ui/generated/proto/*` (`make ui/generated/proto/api.ts`) and the three `*_auto_gen.ts`
(`make go-to-ts`, which runs `go run ./tools/database/gen_db -gen=go-to-ts`). Copying them from a
built checkout works and is faster. Never run `gen_db` concurrently with another copy of itself.

The makefile declares those paths in `AUTO_GEN_FILES_TS` and the Go generators write them with their
own literals, so a rename has to land in both. A target make cannot see never counts as made: it
re-runs `gen_db` and re-bundles on every build, silently. After moving a generated file, check the
two agree:

```
/usr/bin/grep -n AUTO_GEN_FILES_TS makefile | head -1
/usr/bin/grep -rn 'os.WriteFile("ui/' tools/database/
```
