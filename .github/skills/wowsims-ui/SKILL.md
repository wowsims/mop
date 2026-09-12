---
name: wowsims-ui
description: "Work on the wowsims MoP frontend, ui/ (React 19 + TypeScript). Use when touching ui/sim (the Sim/Player/Raid/Encounter facades, the Zustand store in ui/sim/state, the store hooks in ui/sim/hooks, batching, persistence, the IndividualSimSettings envelope), ui/ui-kit, ui/features, ui/app, ui/i18n, ui/specs or ui/generated/proto; when an import trips the oxlint layer rules; or when a UI change needs verifying (type-check, lint, vitest, the golden snapshot harness, a dev-server or real-sim smoke). Start here, then open the one file under references/ that owns the subject — the routing table is in this file."
---

# wowsims-ui

`ui/` is the frontend: TypeScript, built by vite, no server-side rendering. The sim engine is
Go compiled to WASM behind `ui/worker/*`; the UI only ever speaks protobuf to it, so nothing in
`ui/` models combat.

The view layer is **React 19**, and it is now the only dialect. The `tsx-vanilla` runtime that half
of `ui/` used to be written in has been retired: the package is uninstalled, no file carries a
`@jsxImportSource` pragma, and the shim they pointed at is deleted — along with the vanilla
`Component`/`Input` stack and every picker built on it, tippy, Bootstrap's JavaScript, and the
`ui/index.ts` entry that booted the old landing page. Bootstrap's **stylesheet** is the part that
stayed: `ui/scss/index.scss` imports its partials, so `form-control`, `d-none` and `btn` inside a
React component are load-bearing, not residue.

What the view is built from — reach for the existing thing before writing a new one:
**Base UI** (`@base-ui/react`) for Dialog, Menu, Popover, Tabs and Toast, and also for the Field,
Input, Button and Progress primitives the pickers are built on; **`react-tooltip`** behind
`ui/ui-kit/Tooltip/`; **`@tanstack/react-table`** and **`@tanstack/react-virtual`** for the results
tables, the log runner and `ui/ui-kit/VirtualList/`; **`react-i18next`** — `<Trans>` only where a
locale string carries markup, `i18n.t` everywhere else; and **Zustand**, which is the whole subject
of `references/state.md`.

**This skill documents everything below the view layer.** Components, the shared-component registry
and SCSS-next-to-component live in the `wowsims-react` skill — local working notes, git-excluded on
purpose (`.git/info/exclude`, see `verification.md` on what that means), so it is present only where
its owner made it and nothing here depends on it.

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
| `ui/sim/`                  | `@sim`       | node-runnable model: the facades, `state/` (Zustand), `player/`, `raid/`, `settings/`, `talents/`, `presets/`, plus the React bindings in `context/` and `hooks/`. DOM-free and browser-global-free, **not** React-free |
| `ui/i18n/`                 | `@i18n`      | LEAF: i18next config, entity/label tables, `localization.ts`                                                                              |
| `ui/ui-kit/`               | `@ui-kit`    | sim-agnostic React widgets, one folder per component (`NumberPicker/`, `Dialog/`, `Tooltip/`, …), plus `hooks/` and `utils/` — no `Player`/`Sim` types except through generic params |
| `ui/features/<x>/`         | `@features`  | twelve capabilities; `model/` is DOM-free _and_ React-free, `components/` + `hooks/` are React                                            |
| `ui/app/`                  | `@app`       | composition root: `SimHostObject` (`individual_sim_ui.tsx`), `SimApp`/`SimShell`/`SimTabs`, `header/`, `tabs/`, `landing/`, `spec_entry.tsx`, `browser_env.ts` |
| `ui/specs/<class>/<spec>/` | `@specs`     | spec data — one `spec.ts` per spec, may import everything                                                                                 |

Not layers, and not in the arrow: `ui/scss/` (the stylesheets not owned by one component;
`ui/scss/sims/sim.scss` drives all 34 spec themes off one `$sim-themes` map), `ui/shared/` (three
browser helpers — `dom.ts`, `pointer.ts`, `page_boot.ts`), `ui/types/` (ambient `.d.ts`),
`ui/tracking/` (the analytics shim), and `ui/index.html` / `ui/index_template.html` at the root.
The React entry points are `ui/app/spec_entry.tsx` and `ui/app/landing_entry.tsx`.

The direction is **enforced, not conventional** — `.oxlintrc.json` fails the build on a violation.
Read the exact bans, and the three ways they surprise people, in `references/layers.md` before
arguing with one.

## Which reference to open

| You are…                                                                                           | Open                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------- |
| moving a file, adding an import that lints, or deciding which directory something belongs in       | `references/layers.md`          |
| adding a settings field, wiring a picker, or chasing a component that renders stale data or re-renders twice | `references/state.md`  |
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
| `ui/sim/hooks/*`, `ui/sim/context/SimHostContext.tsx`, `ui/ui-kit/hooks/useInput.ts`, `ui/ui-kit/input.ts` | `references/state.md`                     |
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
