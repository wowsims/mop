# Stage 4 handoff — Tailwind migration on `wt/tailwind`

Read this first when relaunching the orchestrator. The plan is the source of truth:
`/home/lutz/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md` (Decisions, Master
sequence of 29 steps in 6 phases, workstreams A/B/C, censuses). This file only records where the
chain is and what a fresh orchestrator needs to keep it moving without the user.

## Where the chain is

- Worktree `/home/lutz/personal/wowsims-mop-tailwind`, branch `wt/tailwind`.
- **Phase 0 complete** (steps 1–8). Commits: `08f053b0f` A-S1 · `0548bbbc4` A-S2a · `6b24a7a68`
  A-S2b · `2b85a156d` C-1a · `b5e3f601f` C-1b · `9eb4dd186` A-S3 · `50e98f544` B0/A-U0 · C-2 as
  `3ff190f77` ui-kit, `34712448a` app+shell, `049b19034` results, `a1f32fe10` features A,
  `5d0886a79` features B · `32379c002` this file · `469c9f7b4` C-U1.1 (Phase 1 started early) ·
  `7fd56bb6c` A-S5 · `e117d4c4a` A-S4.
- **Phase 1 in flight.** Wave running now (uncommitted): **B-U1a** (Dialog/ProgressTrackerDialog/
  Toast → utilities; `Dialog` props `verticalAlign`, `maxWidth`, `headerFlush`, `bodyClassName`,
  `closeClassName`; the eight dialog piggybacks; shimmer keyframes → `--animate-shimmer` in
  `theme.css`; also appends the parked-question entry to the divergence file), **B-U1b**
  (Tooltip/Popover/ConfirmPopover/SearchBar → utilities + props `width/maxWidth/align/padded`,
  `Popover maxWidth`, `SearchBar grow`; six tooltip piggybacks → props, residue rules re-rooted
  without the `.sim-tooltip` compound), **C-U2.1a** (ui-kit picker/panel test-ids, `data-list-item`
  guard, `ListItemAction data-level`, `ListPicker hideUi` native hidden), **C-U2.1b** (done: 25
  feature/app test files locate pickers/panels by `[data-testid=…]`; its remaining failures are the
  test-ids C-U2.1a is still emitting).
- Next after this wave: one verifier on the combined tree → per-unit commits (B-U1a, B-U1b, C-U2.1a,
  C-U2.1b) → **C-U1.2** (drop the overlay class hooks; `simModalProbe.backdrop()` in `browser.mjs`
  → `q('sim-dialog-backdrop')`; `vendor.css` may key on `[role=tooltip]` instead of `.sim-tooltip`)
  → **B-U2** as a 5-worker wave (Chip, IconButton, WowheadIcon, FieldLabel/HelpText/TextArea,
  Spinner/Skeleton + ItemCell/SummaryTableRow → ui-kit; Chip must land before B-U5 because
  `_saved_data_manager.scss:33 @extend .btn`) → C-U2.2 → A-U-input (PickerShell family;
  BooleanPicker → Base UI Checkbox in its own commit). Then Phase 2.

## Deferred between units (not user questions)

- `ResultsFilter.tsx` `hidden` state travels through `UnitPicker`'s `className` array into ui-kit,
  which forwards no `hidden` prop → A-U-input.
- Feature-owned wrappers `picker-group`/`icon-group` keep class locators until `PickerGroup` (U5);
  a few ui-kit classes outside the C-U2.1 contract (`saved-data-save-input/-button/-presets/
  -custom`, `list-picker-root/-item/-compact/-new-button/-item-copy`, `dropdown-picker-positioner`)
  keep class locators until C-U2.2.
- `ItemListRow` gained a required `active` prop (VirtualList exposes `rowClassName` only) — keep.
- Tooltip piggyback *residue* (bonus-stats number-picker layout, metrics-table `thead th`,
  quick-swap `ul`/`li`, reforge popover saved-data margin) stays in the feature `.scss`, re-rooted
  without `.sim-tooltip`/`.sim-popover-popup`, converted by each feature's own unit.
- `EpWeightsDialog.scss` tank block: `.sim-dialog-footer` line removed in B-U1a via
  `footer={isTank ? undefined : …}`; the rest of that block is B-U8's.

## Parked for the user

Count: **1** — the landing page now loads the shared CSS chunk carrying the spec-theme block
(+10 KB raw) because both HTML entries link the one CSS entry by decision; a `themes.css` linked
only by the sim page would return it at S6. Full text under `## Parked for the user` in
`tools/react-migration/TAILWIND-DIVERGENCE.md` (appended by B-U1a). Rule: take the plan's default or
the most reversible choice, note it in the commit message, carry on.

## Latest verifier numbers (A-S4 + C-U1.1 + A-S5, tree at e117d4c4a)

type-check clean · vitest **1683 / 205** (may only rise) · lint:js **0 errors, 263 warnings**
(ceiling 280) · lint:css clean · test:locales 8/8 · **test:snapshots 34/34** (Phase-0 close) ·
vite build OK · tw-probe **193,572 elements, zero diffs** · a11y.mjs warrior/arms clean · tabs-a11y
PASS vs master (C-2 run).
Bundles (files the built HTML links): spec `spec_entry-*.style.css` **216,157 B** (start 383,069) ·
home `index-*.style.css` **99,248 B** (start 115,972) · shared Tailwind/theme chunk, now named
`colors-*.style.css` by Vite, **38,462 B** · `SidebarActionButton-*.style.css` 3,831 B. Spec page
total 258,450 B; home page total 137,710 B (the parked +10 KB). `dist/` is never cleaned — grep
`bundle/[A-Za-z0-9_.-]+\.css` in `dist/mop/index.html` and `dist/mop/mage/frost/index.html`.

## Environment facts

- Probe baseline: `/tmp/claude-1000/tailwind-baseline-dist` (a `dist/` copy at `ea0f92e69`). Never
  use the `wowsims-mop-react` worktree as baseline. `tw-probe.mjs` normalises `color(srgb …)` to
  `rgb()`/`rgba()` with a 1e-4 channel epsilon (exact halves from 50/50 `color-mix` round up, as Sass
  did). The probe's stdout truncates when piped; read its own `report.txt` (path printed by the
  script, under the scratchpad `tw/probe/`).
- `tools/react-migration/` is tracked but matched by an ignore rule: stage with `git add -f`.
- **No standing servers.** Per gate run: `npx vite build` → `nohup npx http-server dist -p 3404 -s`
  + `nohup npx http-server /tmp/claude-1000/tailwind-baseline-dist -p 3406 -s` →
  `REACT_PORT=3406 TW_PORT=3404 node tools/react-migration/tw-probe.mjs` → kill by the PIDs
  `ss -ltnp` shows (`kill -9`; the npx wrapper PID does not stop the listener) →
  `ss -ltnp | grep -E ':340[1-6] '` empty. Master (`/home/lutz/personal/wowsims-mop`, `npx vite
  build` there first) on 3401 only for `tabs-a11y.mjs`, `parity.mjs`, `panes-parity.mjs`.
  `a11y.mjs` reads `REACT_PORT`; `tabs-a11y.mjs` reads `BASE_PORT`/`REACT_PORT`.
- Every heavy command under `flock -o -w 3000 /tmp/claude-1000/e2e.lock`; one browser, one build.
- Constraints: `RTK_DISABLED=1` on every command · `/usr/bin/grep` · graphify stale, never use ·
  never `npm install`/`npm ci` · never `git stash` · never touch fixtures/goldens/`ui/specs/**` ·
  never `rm -rf dist` · no comments in `ui/` `.ts`/`.tsx`/`.css` (`.scss`/`.mjs`/`.md` comment-safe) ·
  `npx oxfmt` every touched `.ts`/`.tsx` · 1rem = 14px below 1921px · `@theme static` emits
  nothing for a missing token (the five primary-derived tokens must stay in `@theme` AND on
  `.sim-ui`) · utilities `important` + unlayered · no tree change in a style commit.
- Operating model: Sonnet workers do edits (one unit each, cheap gates only under the lock:
  type-check, lint:js, own-dir vitest); waves of ≤5 disjoint workers; single-writer files
  (`theme.css`, `tailwind.css`, `vendor.css`, `shell_classes.ts`, `browser/intended/tw-probe.mjs`,
  `README.md`, this file) go to exactly one worker per wave; `TAILWIND-DIVERGENCE.md` is appended
  by workers **only via shell heredoc `>>`** (never Edit/Write) so concurrent appends cannot clobber;
  same-file edits across workers are Edit-only with a re-read first. A Sonnet verifier runs the full
  gate set per wave (report-only); the orchestrator reviews diffs (`git diff -- <files>`), commits
  per unit with `git add -- <files>`, sends a short `main` update after every commit, and briefs the
  next worker in the same turn. Commit trailer:
  `Claude-Session: https://claude.ai/code/session_014Qxt6yChJpLi78oNZJ7jFq`. Nothing pushes.
- Before U8b (Timeline): merge `feature/ui-react` (`a215eead5`) into `wt/tailwind` at the end of
  Phase 3, resolve toward this branch's Tailwind form keeping `feature/ui-react` behaviour, full
  gates, report the merge to `main` as its own message.
- Measured facts a worker must not re-derive: Chrome computes `color-mix()` to `color(srgb …)` and
  `rgb(r g b / a)` to `rgba()`; Base UI treats explicit `container={null}` as "wait" (renders
  nothing) — portal defaults are `container ?? ctx ?? undefined`; `host.rootElem` ≡ `SimShell.rootEl`
  (the `.sim-ui` div); `$btn-hover-bg-shade-amount: 30%` (hover 70% / active 80% of primary over
  black is correct); `data-base-ui-inert` is applied by Base UI `markOthers` to elements outside an
  open modal — `SimTitleDropdown.scss:4` is live and element-carried (inline variant at U3);
  `_global_old.scss` styles `.safe` green (DANGER_TEXT.safe = text-success until U-base); the six
  secondary resources are arcane charges, shadow orbs, demonic fury, burning embers, soul shards,
  holy power — only holy-power has a colour token; Toast's `$tooltip-bg` `#212329` is
  `--color-overlay`, `#373d57` is `--color-surface-border`, `--bs-box-shadow` is
  `0 .5rem 1rem rgba(0,0,0,.15)`.
