# Stage 4 handoff — Tailwind migration on `wt/tailwind`

Read this first when relaunching the orchestrator. The plan is the source of truth:
`/home/lutz/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md` (Decisions, Master
sequence of 29 steps in 6 phases, workstreams A/B/C, censuses). This file only records where the
chain is and what a fresh orchestrator needs to keep it moving without the user.

## Where the chain is

- Worktree `/home/lutz/personal/wowsims-mop-tailwind`, branch `wt/tailwind`.
- **Phase 0 complete** (steps 1–8): `08f053b0f` A-S1 · `0548bbbc4` A-S2a · `6b24a7a68` A-S2b ·
  `2b85a156d` C-1a · `b5e3f601f` C-1b · `9eb4dd186` A-S3 · `50e98f544` B0/A-U0 · C-2 `3ff190f77`
  `34712448a` `049b19034` `a1f32fe10` `5d0886a79` · `7fd56bb6c` A-S5 · `e117d4c4a` A-S4.
- **Phase 1 in progress.** Landed: `469c9f7b4` C-U1.1 · wave 1: `1a069fc36` B-U1b (Tooltip/Popover/
  ConfirmPopover/SearchBar utilities + props `width/maxWidth/align/padded`, `Popover maxWidth`,
  `SearchBar grow`) · `39dcfdd63` C-U2.1a (picker/panel test-ids, `PickerShell testId`,
  `data-list-item`) · `d73f3be88` C-U2.1b (feature tests by test-id) · `e8a06a13b` B-U1a (Dialog/
  ProgressTrackerDialog/Toast utilities + `Dialog` props `maxWidth/headerFlush/verticalAlign/
  bodyGap/bodyClassName/closeClassName`, `Toast inline`, `--animate-shimmer`).
- **Wave 2 running now (uncommitted):** **C-U1.2** (drop the overlay class hooks in Dialog/Popover/
  ConfirmPopover/Toast/ProgressTrackerDialog/SearchBar/VirtualList; probe selectors in
  `browser.mjs`/`gear-tab`/`bulk-tab`/`selector-modal`/`stat-weights`/`reforge-popover`/
  `sidebar-popover`/`header-toolbar`.mjs go through test-ids; `data-size` on Dialog's popup for
  `stat-weights.mjs`; `sim-tooltip`/`sim-tooltip--unpadded` stay as react-tooltip vendor hooks keyed
  by `vendor.css`), **B-U2 Chip** (ui-kit `Chip` absorbs SavedDataChip/RotationFabChip/
  LogSearchGroup/PresetConfigurationPicker; deletes `_saved_data_manager.scss:32-69` incl. the
  `@extend .btn`, and LogRunner's chip rule), **B-U2 IconButton** (`tone` lookup; RotationRowLabel,
  RotationToolbar ×4, ListPickerItem/BulkItemPicker/SimWarnings/TalentTreePicker/SimToolbar
  `link-*` sites; deletes the `.link-*` overrides once unemitted), **B-U2 WowheadIcon** (24 TSX
  sites, the 10 `wowhead-background-icon` mixin sites, mixin deleted; TalentTreePicker's icon
  deferred to U-talents), **B-U2 Forms + Spinner/Skeleton** (`FieldLabel`/`HelpText`/`TextArea` +
  `INPUT_CLASSES`/`SELECT_CLASSES`; `Spinner`/`Skeleton`; `--animate-skeleton` in `theme.css` — sole
  theme.css writer; `.loader` rule from `_global_old.scss`).
- Next after wave 2: one verifier → per-unit commits (C-U1.2, Chip, IconButton, WowheadIcon,
  Forms) → **ItemCell/SummaryTableRow → ui-kit** (git mv + re-exports in
  `ui/features/gear/components/{ItemCell,SummaryTable}/index.ts`; deferred from B-U2 because
  WowheadIcon edits `ItemDetailCell.tsx`) → **IconButton on the Dialog/Toast close buttons** (Base UI
  `Close` slots via `render`; deferred behind C-U1.2) → **A-U-input** (PickerShell family SCSS:
  `_input`, `_boolean_picker`, `_enum_picker`, `_number_list_picker`, `_unit_picker`,
  `_consumes_picker`, `_settings_tab` picker-group rules; the 8 kit inputs consume
  `INPUT_CLASSES`/`SELECT_CLASSES`; **BooleanPicker → Base UI Checkbox in its own commit**, tree
  change) → **C-U2.2** (drop picker/panel class hooks — only after A-U-input, since the picker SCSS
  still reads them). Then Phase 2 (A-U-shell + B-U3 TabNav/TabPanel/Menu/TabPanelColumns; A-U-icon
  before the two ladders; A-U-list).

## Deferred between units (not user questions)

- `ResultsFilter.tsx` `hidden` via `UnitPicker`'s `className` array → A-U-input.
- Feature wrappers `picker-group`/`icon-group` keep class locators until `PickerGroup` (U5); ui-kit
  classes outside the C-U2.1 contract keep class locators until C-U2.2.
- `ItemListRow` gained a required `active` prop — keep.
- Tooltip piggyback residue re-rooted in feature `.scss` (bonus-stats number-picker layout, reforge
  popover saved-data margin, `.metrics-table-tooltip thead th`, `.tooltip-quick-swap ul/li`) →
  each feature's unit.
- `EpWeightsDialog.scss` tank block minus `.sim-dialog-footer` → B-U8.
- CooldownRow `link-danger`, CombinationsCount `link-warning` → U5 (their files went to the
  Forms/Spinner worker this wave); TalentTreePicker's wowhead icon → U-talents.

## Parked for the user

Count: **1** — landing page +10 KB shared chunk since A-S4 (full text under `## Parked for the
user` in `tools/react-migration/TAILWIND-DIVERGENCE.md`; default taken: plan as written).

## Latest verifier numbers (wave 1, tree at e8a06a13b)

type-check clean · vitest **1683 / 205** · lint:js **0 errors, 259 warnings** (ceiling 280) ·
lint:css clean · test:locales 8/8 · test:snapshots 34/34 (Phase-0 close; per phase, and per commit
when `ui/sim/**` or `ui/features/*/model/**` changes) · vite build OK · tw-probe **193,572
elements, zero diffs** · a11y.mjs clean (warrior/arms, mage/fire) · tabs-a11y PASS vs master
(C-2 run).
Bundles (files the built HTML links): spec `spec_entry-*.style.css` **209,833 B** (start 383,069) ·
home `index-*.style.css` **99,248 B** (start 115,972) · shared Tailwind/theme chunk
(`colors-*.style.css`) **49,706 B** · the lazy `SidebarActionButton-*.style.css` no longer exists.
`dist/` is never cleaned — grep `bundle/[A-Za-z0-9_.-]+\.css` in `dist/mop/index.html` and
`dist/mop/mage/frost/index.html`.

## Environment facts

- Probe baseline: `/tmp/claude-1000/tailwind-baseline-dist` (a `dist/` copy at `ea0f92e69`). Never
  use the `wowsims-mop-react` worktree as baseline. `tw-probe.mjs` normalises `color(srgb …)` to
  `rgb()`/`rgba()` with a 1e-4 channel epsilon. Its stdout truncates when piped; read its own
  `report.txt` under the scratchpad `tw/probe/` (the path the script prints). The probe's property
  string is `display|position|top|right|bottom|left|…` — read diffs by that order.
- `tools/react-migration/` is tracked but matched by an ignore rule: stage with `git add -f`.
- **No standing servers.** Per gate run: `npx vite build` → `nohup npx http-server dist -p 3404 -s`
  + `nohup npx http-server /tmp/claude-1000/tailwind-baseline-dist -p 3406 -s` →
  `REACT_PORT=3406 TW_PORT=3404 node tools/react-migration/tw-probe.mjs` → `kill -9` the PIDs
  `ss -ltnp` shows (the npx wrapper PID does not stop the listener) → `ss -ltnp | grep -E
  ':340[1-6] '` empty. Master (`/home/lutz/personal/wowsims-mop`, `npx vite build` there first) on
  3401 only for `tabs-a11y.mjs`, `parity.mjs`, `panes-parity.mjs`. `a11y.mjs` reads `REACT_PORT`;
  `tabs-a11y.mjs` reads `BASE_PORT`/`REACT_PORT`.
- Every heavy command under `flock -o -w 3000 /tmp/claude-1000/e2e.lock`; one browser, one build.
- Constraints: `RTK_DISABLED=1` on every command · `/usr/bin/grep` · graphify stale, never use ·
  never `npm install`/`npm ci` · never `git stash` · never touch fixtures/goldens/`ui/specs/**` ·
  never `rm -rf dist` · no comments added in `ui/` `.ts`/`.tsx`/`.css`, no pre-existing comment
  removed (`.scss`/`.mjs`/`.md` comment-safe) · `npx oxfmt` every touched `.ts`/`.tsx` · 1rem =
  14px below 1921px · `@theme static` emits nothing for a missing token (the five primary-derived
  tokens must stay in `@theme` AND on `.sim-ui`) · utilities `important` + unlayered · no tree
  change in a style commit · a B unit never removes a class (C-Un.2 does) · one kit property is
  varied by a prop selecting a whole string, never by a second utility on the same element.
- Operating model: Sonnet workers do edits (one unit each, cheap gates only under the lock:
  type-check, lint:js, own-dir vitest); waves of ≤5 disjoint workers; single-writer files
  (`theme.css`, `tailwind.css`, `vendor.css`, `shell_classes.ts`, `browser/intended/tw-probe.mjs`,
  `README.md`, this file) go to exactly one worker per wave; `TAILWIND-DIVERGENCE.md` is appended
  by workers **only via shell heredoc `>>`**; same-file edits across workers are Edit-only with a
  re-read first. A Sonnet verifier runs the full gate set per wave (report-only); the orchestrator
  reviews diffs (`git diff -- <files>`; check dropped `className=` strings, added comments, JSX tag
  balance — `Record<…>` type lines match `<[A-Za-z]` too), commits per unit with `git add -A --
  <paths>` (only existing paths, or `git add` aborts the chain), sends a short `main` update after
  every commit, and briefs the next wave in the same turn. Commit trailer:
  `Claude-Session: https://claude.ai/code/session_014Qxt6yChJpLi78oNZJ7jFq`. Nothing pushes.
- Before U8b (Timeline): merge `feature/ui-react` (`a215eead5`) into `wt/tailwind` at the end of
  Phase 3, resolve toward this branch's Tailwind form keeping `feature/ui-react` behaviour, full
  gates, report the merge to `main` as its own message.
- Measured facts a worker must not re-derive: Chrome computes `color-mix()` to `color(srgb …)` and
  `rgb(r g b / a)` to `rgba()`; Base UI treats explicit `container={null}` as "wait" — portal
  defaults are `container ?? ctx ?? undefined`; `host.rootElem` ≡ `SimShell.rootEl`;
  `$btn-hover-bg-shade-amount: 30%` (hover 70% / active 80% of primary over black); `data-base-ui-
  inert` is Base UI `markOthers` on elements outside an open modal — `SimTitleDropdown.scss:4` is
  live and element-carried (inline variant at U3); `_global_old.scss` styles `.safe` green
  (DANGER_TEXT.safe = text-success until U-base); only holy-power of the six secondary resources has
  a colour token; Toast's `$tooltip-bg` `#212329` is `--color-overlay`, `#373d57` is
  `--color-surface-border`, `--bs-box-shadow` is `0 .5rem 1rem rgba(0,0,0,.15)`; Base UI
  `Toast.Title` renders an `h2` (needs `text-[length:inherit] leading-[inherit]`); a converted
  component must reproduce *every* declaration of the old cascade, including inert ones (the probe
  compares computed values, e.g. `right: 0` on a `position: static` element).
