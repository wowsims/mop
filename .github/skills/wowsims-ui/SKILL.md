---
name: wowsims-ui
description: "Work on the wowsims MoP frontend, ui/ (TypeScript). Use when touching ui/sim (the Sim/Player/Raid/Encounter facades, the Zustand store in ui/sim/state, batching, persistence, the IndividualSimSettings envelope), ui/ui-kit, ui/features, ui/app, ui/i18n, ui/specs or ui/generated/proto; when an import trips the oxlint layer rules; or when a UI change needs verifying (type-check, lint, vitest, the golden snapshot harness, a dev-server or real-sim smoke). Start here, then open the one file under references/ that owns the subject — the routing table is in this file."
---

# wowsims-ui

`ui/` is the frontend: TypeScript, built by vite, no server-side rendering. The sim engine is
Go compiled to WASM behind `ui/worker/*`; the UI only ever speaks protobuf to it, so nothing in
`ui/` models combat.

The view layer is mid-migration from `tsx-vanilla` (JSX that returns live DOM nodes) to React 19.
React is the default dialect — a new `.tsx` file is a React file — and the files that have not been
ported opt back out on line 1 with `/** @jsxImportSource @jsx-vanilla */`. Count them with
`/usr/bin/grep -rl "jsxImportSource @jsx-vanilla" ui/ | wc -l`; that number only goes down.
**This skill documents everything below the view layer.** Components, JSX, SCSS-next-to-component
and the migration's position live in the `wowsims-react` skill — which is untracked and only present
in the migration worktree, so on a fresh clone it will not be there and nothing here depends on it.

## Layer map

Each layer may import only from layers to its left. `ui/sim` and `ui/i18n` are peers: both are
leaves everything above may depend on, and they may depend on each other.

```
generated → worker → {sim, i18n} → ui-kit → features → app → specs → pages
```

| Directory                  | Alias        | What lives there                                                                                                                          |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/generated/`            | `@generated` | protobuf-ts output (`proto/**`) and `*_auto_gen.ts`. Tool output — never hand-edit, never lint (`ignorePatterns`)                         |
| `ui/worker/`               | `@worker`    | the three worker entries (`local_worker`, `net_worker`, `sim_worker`) plus the Go package that `go:embed`s `highs.wasm`                   |
| `ui/sim/`                  | `@sim`       | DOM-free, node-runnable model: the facades, `state/` (Zustand), `player/`, `raid/`, `settings/`, `talents/`, `presets/`, `hooks/`         |
| `ui/i18n/`                 | `@i18n`      | LEAF: i18next config, entity/label tables, `localization.tsx`                                                                             |
| `ui/ui-kit/`               | `@ui-kit`    | sim-agnostic widgets, base classes, `pickers/`, `hooks/`, `utils/` — no `Player`/`Sim` types except through generic params                |
| `ui/features/<x>/`         | `@features`  | twelve capabilities; `model/` is DOM-free _and_ React-free, `components/` + `hooks/` are React, and a `view/` is what has not been ported |
| `ui/app/`                  | `@app`       | composition root: `SimApp`/`SimShell`/`SimTabs`, `header/`, `tabs/`, `spec_entry.tsx`, `browser_env.ts`                                   |
| `ui/specs/<class>/<spec>/` | `@specs`     | spec data — one `spec.ts` per spec, may import everything                                                                                 |

Not layers, and not in the arrow: `ui/scss/` (stylesheets; `ui/scss/sims/sim.scss` drives all 34 spec
themes off one `$sim-themes` map), `ui/shared/` (the `@jsx-vanilla` shim and bootstrap overrides),
`ui/types/` (ambient `.d.ts`), `ui/tracking/` (the analytics shim), and `ui/index.html` /
`ui/index_template.html` / `ui/index.ts` at the root.

The remaining `view/` folders are the migration's surface; list them with
`ls -d ui/features/*/view/` rather than trusting a count written here.

The direction is **enforced, not conventional** — `.oxlintrc.json` fails the build on a violation.
Read the exact bans, and the three ways they surprise people, in `references/layers.md` before
arguing with one.

## Which reference to open

| You are…                                                                                           | Open                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------- |
| moving a file, adding an import that lints, or deciding which directory something belongs in       | `references/layers.md`          |
| adding a settings field, wiring a picker, or chasing a notification that fires twice or not at all | `references/state.md`           |
| touching saved settings, the URL hash, autosave, or `IndividualSimSettings`                        | `references/persistence.md`     |
| about to call a change done, or wondering what CI actually runs                                    | `references/verification.md`    |
| running the sim in a browser, in a fresh worktree, or measuring a perf regression                  | `references/running-locally.md` |
| adding a spec, formatting code, or about to re-litigate a decision that was already made           | `references/conventions.md`     |

## The short version of "done"

Four commands, all from the repo root, all needing `npm ci` first:

```
npm run type-check     # tsc --noEmit over the whole repo, tools/ included
npm run lint:js        # oxlint on ui/ — zero no-restricted-imports allowed
npm run test:unit      # vitest + happy-dom, ui/**/*.test.ts(x)
npm run test:snapshots # store-contract test, then 34 golden spec protos
```

`references/verification.md` says what each one actually covers, what CI runs instead (it is not
this list), and which gate catches which class of mistake.

## Keeping this skill true

The old version of this file rotted because it described the tree in prose and nothing checked the
prose. Two rules keep that from recurring.

**Point at code, not at copies of code.** Every reference file opens with a _Source of truth_ line
naming the file that defines the behaviour and a command that re-derives the claim. When the two
disagree, the code is right and the reference is a bug — fix it in the same commit as the code
change, the way you would a stale comment.

**Route by kind of change, so nobody has to re-read everything:**

| You changed…                                                                                          | Update                                         |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `.oxlintrc.json`, `tsconfig.json` `paths`, or a top-level `ui/` directory                             | `references/layers.md` and the layer map above |
| `ui/sim/state/sim_store.ts`, `subscriptions.ts`, `batch.ts`, `events.ts`                              | `references/state.md`                          |
| `ui/sim/state/persistence.ts`, `serialization.ts`, `sim_links.ts`                                     | `references/persistence.md`                    |
| a `package.json` script, `.github/workflows/run_tests.yml`, or the snapshot harness                   | `references/verification.md`                   |
| `vite.config.mts`, `vite.build-workers.mts`, `tools/vite/spec_pages.mts`, the makefile's dist targets | `references/running-locally.md`                |
| `.oxfmtrc.json`, `ui/specs/**` authoring, or a decision recorded as settled                           | `references/conventions.md`                    |

Then run the path check, which fails on any file this skill names that no longer exists:

```
.github/skills/wowsims-ui/check_paths.sh
```

There is no change log here any more. It was 73% of this file, it was a worse copy of
`git log`, and by the end it was naming three tools that had been deleted. The narrative is still
in git — `git log --oneline -- .github/skills/wowsims-ui/SKILL.md`, then `git show <rev>:<path>` —
and every claim from it that was still load-bearing was promoted into the reference file that owns
the subject. Facts about how the UI works go in a reference; the record of when they changed stays
in git.
