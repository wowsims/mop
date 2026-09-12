# Stage 4 handoff — Tailwind migration on `wt/tailwind`

Read this first when relaunching the orchestrator. The plan is the source of truth:
`/home/lutz/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md` (Decisions, Master
sequence of 29 steps in 6 phases, workstreams A/B/C, censuses). This file only records where the
chain is and what a fresh orchestrator needs to keep it moving without the user.

## Where the chain is

- Worktree `/home/lutz/personal/wowsims-mop-tailwind`, branch `wt/tailwind`.
- Last committed master-sequence step: **6 (C-2 global state sweep)** — five per-unit commits
  `3ff190f77` ui-kit · `34712448a` app+shell · `049b19034` results · `a1f32fe10` features A ·
  `5d0886a79` features B. Earlier: `08f053b0f` A-S1 · `0548bbbc4` A-S2a · `6b24a7a68` A-S2b ·
  `2b85a156d` C-1a · `b5e3f601f` C-1b · `9eb4dd186` A-S3 · `50e98f544` B0/A-U0.
- In flight (uncommitted, workers running): **step 7 A-S4** (colour single-source: `theme.css` the
  only source, 34 spec blocks as CSS, `color-mix()` derivations on `.sim-ui`, contrast vitest,
  probe normaliser for `color(srgb …)`), and **C-U1.1** (ui-kit overlay test-ids: `testId` prop on
  Dialog/Popover/ConfirmPopover/ProgressTrackerDialog, `data-testid` = old class name on parts,
  ui-kit overlay tests rewritten to roles/test-ids).
- Next: **step 8 A-S5** (runtime class-name builders → static lookups in
  `ui/ui-kit/utils/colors.ts`; the six `@each` loops in `_global.scss:112-160` and the
  `@source inline(...)` safelist in `tailwind.css` deleted; touches `model/topline_metrics.ts`, so its
  verifier run includes `test:snapshots` 34/34 — that run is also the Phase-0 closing snapshot run).
  Then Phase 1: C-U1.1 probe half (`browser.mjs` `simModalProbe` → test-ids) → B-U1 → C-U1.2;
  C-U2.1 → B-U2 (Chip, IconButton, WowheadIcon, FieldLabel/HelpText/TextArea, Spinner/Skeleton,
  ItemCell/SummaryTableRow → ui-kit) → C-U2.2; A-U-input. B-U2's five components are a natural
  5-worker wave (disjoint files); B-U1 is one worker.

## Deferred between units (not user questions)

- `ResultsFilter.tsx` `hidden` state travels through `UnitPicker`'s `className` array into ui-kit,
  which forwards no `hidden` prop → completed in U2 (PickerShell/pickers).
- `apl-validation-*` severity classes live on ui-kit `ListItemAction` (no attribute pass-through) →
  `data-level` in U2; nine `ListItemHeader.test.tsx` assertions stay class-keyed until then.
- `ListPicker.tsx` `hideUi` → plain `hidden` class, no attribute yet → U2.
- `ItemListRow` gained a required `active` prop (VirtualList exposes `rowClassName` only) — keep.
- A-S3's "two residual `--bs-*` reads" undercounted: the six `_global.scss` loops read
  `var(--bs-#{$label})` through Sass interpolation, invisible to the `var\(--bs-[a-z0-9-]+` census.
  They die whole in A-S5 with the loops.

## Parked for the user

Count: **0**. Full text, when any exist, lives under `## Parked for the user` at the end of
`tools/react-migration/TAILWIND-DIVERGENCE.md`. Rule: take the plan's default or the most
reversible choice, note it in the commit message, carry on.

## Latest verifier numbers (C-2 wave, combined tree at 5d0886a79)

type-check clean · vitest **1667 / 203** (may only rise) · lint:js **0 errors, 268 warnings**
(ceiling 280) · lint:css clean · test:locales 8/8 · vite build OK · tw-probe **193,572 elements,
zero diffs** (3 widths × landing + 3 specs × 7 states) · a11y.mjs clean (warrior/arms, mage/fire) ·
tabs-a11y PASS vs master · `test:snapshots` 34/34 last run at Phase-0 start (per phase, and per
commit only when `ui/sim/**` or `ui/features/*/model/**` changes).
Bundles: spec `spec_entry-*.style.css` **276,336 B** (start 383,069) · home `index-*.style.css`
**102,934 B** (start 115,972) · Tailwind chunk `SimLinkContent-*.style.css` 24,592 B ·
`SidebarActionButton-*.style.css` 3,831 B. `dist/` is never cleaned — pick the files the built HTML
links (`dist/mop/index.html`, `dist/mop/mage/frost/index.html`; grep `bundle/[A-Za-z0-9_.-]+\.css`).

## Environment facts

- Probe baseline: `/tmp/claude-1000/tailwind-baseline-dist` (a `dist/` copy at `ea0f92e69`, before
  any Phase-0 edit). Never use the `wowsims-mop-react` worktree as baseline.
- `tools/react-migration/` is tracked but matched by an ignore rule: stage with `git add -f`.
- **No standing servers.** Per gate run only: `npx vite build` → `nohup npx http-server dist -p 3404 -s`
  + `nohup npx http-server /tmp/claude-1000/tailwind-baseline-dist -p 3406 -s` →
  `REACT_PORT=3406 TW_PORT=3404 node tools/react-migration/tw-probe.mjs` → kill by the PIDs `ss -ltnp`
  shows (`pkill -f` misses the npx wrapper; `kill -9 <pid>`) → `ss -ltnp | grep -E ':340[1-6] '` empty.
  Master (`/home/lutz/personal/wowsims-mop`, build it there first) on 3401 only for `tabs-a11y.mjs`,
  `parity.mjs`, `panes-parity.mjs`. `a11y.mjs` reads `REACT_PORT`; `tabs-a11y.mjs` reads
  `BASE_PORT`/`REACT_PORT`.
- Every heavy command under `flock -o -w 3000 /tmp/claude-1000/e2e.lock`; one browser, one build.
- Constraints: `RTK_DISABLED=1` on every command · `/usr/bin/grep` (the shell `grep` is a shim) ·
  graphify index stale, never use · never `npm install`/`npm ci` · never `git stash` · never touch
  fixtures/goldens/`ui/specs/**` · never `rm -rf dist` · no comments in `ui/` `.ts`/`.tsx`/`.css`
  (`.scss`/`.mjs`/`.md` comment-safe) · `npx oxfmt` every touched `.ts`/`.tsx` · 1rem = 14px below
  1921px · `@theme static` emits nothing for a missing token · utilities `important` + unlayered ·
  no tree change in a style commit (probe is position-keyed).
- Operating model: Sonnet workers do edits (one step/unit each, cheap gates only: type-check,
  lint:js, own-dir vitest); waves of ≤5 disjoint workers from Phase 1; single-writer files
  (`theme.css`, `tailwind.css`, `vendor.css`, `shell_classes.ts`, `browser/intended/tw-probe.mjs`,
  `TAILWIND-DIVERGENCE.md`, `README.md`, this file) never edited by two workers at once; a Sonnet
  verifier runs the full gate set per wave (report-only); the orchestrator reviews diffs, commits
  per unit with `git add -- <files>`, sends a short `main` update after every commit, and briefs the
  next worker in the same turn. Commit trailer:
  `Claude-Session: https://claude.ai/code/session_014Qxt6yChJpLi78oNZJ7jFq`. Nothing pushes.
- Before U8b (Timeline): merge `feature/ui-react` (`a215eead5`) into `wt/tailwind` at the end of
  Phase 3, resolve toward this branch's Tailwind form keeping `feature/ui-react` behaviour, full
  gates, report the merge to `main` as its own message.
- Measured facts a worker must not re-derive: Chrome computes `color-mix()` to `color(srgb …)` and
  `rgb(r g b / a)` to `rgba()`; Base UI treats explicit `container={null}` as "wait" (renders
  nothing) — portal defaults are `container ?? ctx ?? undefined`; `host.rootElem` ≡ `SimShell.rootEl`
  (the `.sim-ui` div); the project sets `$btn-hover-bg-shade-amount: 30%` (hover 70% / active 80%
  of primary over black is correct); `data-base-ui-inert` is applied by Base UI `markOthers` to
  elements outside an open modal — `SimTitleDropdown.scss:4` is live and element-carried (inline
  variant at U3).
