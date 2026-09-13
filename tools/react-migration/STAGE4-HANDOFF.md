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
- **Phase 1 in progress.** Landed: `469c9f7b4` C-U1.1 · wave 1 `1a069fc36` B-U1b, `39dcfdd63`
  C-U2.1a, `d73f3be88` C-U2.1b, `e8a06a13b` B-U1a · wave 2 `d0233d67e` C-U1.2, `12cee47fc` Chip,
  `0dc5a2f3e` IconButton, `542a321ac` WowheadIcon (first slice), `e1b0f40f4` FieldLabel/HelpText/
  TextArea + Spinner/Skeleton + the `--spacing-block → --spacing-stack` rename.
- **Wave 3 landed:** `1a0b30dab` C-U3.1 (app-shell test-ids, probe rewrites through `q()`) ·
  `14f7a684f` W2 (IconButton on the Dialog/Toast `Close` slots; `ItemCell`/`SummaryTableRow` →
  `ui/ui-kit/` with re-exports) · `b03885473` A-U-input part 1 — **shipped small**: only the
  uncontested picker rules converted (disabled filter, description block, flex-wrap, UnitIcon,
  ListPicker `hidden`); the first attempt (all of `_input.scss` + four picker files as utilities,
  label rules via named-group variants) produced 49 probe diff sections and was reverted under the
  coordinator's rule: **a declaration converts only if nothing overrides it, per rule; never bridge
  with `!important`; a contested property stays in SCSS until its overrider's unit converts both
  sides** (list under "Deferred"). `_consumes_picker.scss` does not exist (plan correction);
  `_settings_tab.scss` stays with U5.
- **Phase 1 complete:** `d03b60798` A-U-input part 2 (BooleanPicker → Base UI `Checkbox`: a
  `<span role="checkbox">` + hidden native input carrying the picker `id` + `<Icon name="check">`
  indicator; CONFINE probe run 0 unconfined sections, no shifts) · `c30cdfb0d` C-U2.2 (six classes
  dropped; `saved-data-set-name` stays — `Chip.tsx:55` styles it through an arbitrary variant, a
  non-SCSS reader; `pet-spec-picker-root` never existed) · `44074d539` gate tooling (tw-probe
  `CONFINE` mode, settings-tab clicks `label[for]`, apl-tab/log-runner readers through `q()`).
  `test:snapshots` 34/34 at the close.
- **Phase 2 wave A landed:** `bdc84d932` B-U3a TabNav/TabPanel (`tab_pane_class.ts`, `SimTabs.scss`,
  the `.nav-tabs` overrides block deleted; five list + three panel sites) · `37f4d469c` B-U3b
  Menu/MenuItem (`DropdownPicker.scss`, `ImportExportMenu.scss`, `SimTitleDropdown.scss` deleted;
  `ui/ui-kit/Menu/classes.ts` exports the strings for DropdownMenu's radio/submenu trees and
  SimTitleDropdown). Four probe rounds; the lessons are under "Lessons from wave A" below.
  **Bootstrap `nav`, `transitions`, `dropdown` are still imported** — each dies with its last reader
  (nav: SimShell's two toolbar divs → A-U-shell, landing header → A-U-landing; transitions: no
  reader left once `nav` goes, delete together; dropdown: DropdownPicker roots, IconEnumPicker/
  MultiIconPicker, BulkItemSearch, the `dropdown-toggle` caret, both landing menus). The two
  landing menus stay on Bootstrap until A-U-landing. Probe: **0 diffs vs baseline-2, no tree
  change, no re-baseline** (TabBadge renders nothing without a label).
- **Wave B = A-U-shell, landed as `47012afa4`** (committed by the main session, which now orchestrates directly; the handoff commit that preceded it was re-split so the two stylesheet deletions land with wave B).
  Orchestration moved to the main session at this point; the tree below is the state to pick up.
  Three disjoint Sonnet workers produced it, meant to land as ONE commit after a green verifier:
  - **W1 shell core** — `ui/scss/core/sim_ui/{_shared,_sidebar,_header,_main,index}.scss`,
    `ui/scss/core/components/_sim_title_dropdown.scss`, `ui/app/SimShell.tsx`,
    `ui/app/header/{ImportExportMenu/ImportExportMenu,SimTitleDropdown/SimTitleDropdown,
    SimToolbar/SimToolbar,SimToolbar/ToolbarItem}.tsx`,
    `ui/features/results/components/SimResultsPanel/UnlaunchedNotice.tsx`. (`SidebarActionButton.tsx`
    was converted then reverted to HEAD — see the frozen-test steer below.)
  - **W2 TabPanelColumns** — new `ui/ui-kit/TabPanelColumns/` (untracked: `TabPanelColumns.tsx`,
    `index.ts`, `TabPanelColumns.test.tsx`), `ui/ui-kit/SimTabPane/SimTabPane.tsx`,
    `ui/app/tabs/{Gear,Settings,Rotation,Bulk,Talents}TabBody.tsx`,
    `ui/app/tabs/{RotationTabBody,SettingsTabBody}.test.tsx`,
    `ui/features/bulk/components/BulkSettings/BulkSettings.tsx`,
    `ui/features/gear/components/GearPicker/GearPicker.tsx`, `_sim_tab.scss` (deleted, staged) and
    `individual_sim_ui/_gear_tab.scss` (deleted, staged) with their `@import` lines dropped by the
    orchestrator from `core/sim_ui/index.scss` and `components/individual_sim_ui/index.scss`,
    `individual_sim_ui/{_bulk_tab,_rotation_tab,_settings_tab}.scss` (their
    `.tab-pane-content-container` blocks only).
  - **W3 ContentBlock flush + sticky toolbar + `_shared`** — `ui/ui-kit/ContentBlock/{ContentBlock,
    ContentBlock.test}.tsx`, `ui/scss/core/components/{_content_block,_sticky_toolbar}.scss` (both
    shrunk to contested residue), `ui/ui-kit/hooks/useStickyToolbar.ts` (exports
    `STICKY_TOOLBAR_CLASSES`), `ui/features/apl/components/AplNavbar/AplNavbar.tsx`,
    `ui/features/results/components/DetailedResults/DetailedResults.tsx`,
    `ui/features/bulk/components/BulkItemSearch/{BulkItemSearch.tsx,BulkItemSearch.scss}`,
    `ui/features/bulk/components/BulkPickerGroups/{BulkItemPickerGroup.tsx,BulkPickerGroups.scss}`,
    `ui/features/settings/components/ConsumesPicker/ConsumesPicker.tsx`,
    `ui/features/settings/components/CustomSection/CustomSection.test.tsx`,
    `ui/scss/core/individual_sim_ui/_shared.scss` (deleted) + its import in
    `ui/scss/core/individual_sim_ui/index.scss`.
  - Orchestrator-only: `tools/react-migration/TAILWIND-DIVERGENCE.md` (the A-U-shell entry and the
    second parked question are already written and uncommitted).
  **Verifier history for wave B** (all on the dirty tree):
  - Round 1: type-check 0 · vitest 1723/1728 (3 files red: `RotationTabBody.test` exact-string on the
    navbar, `SettingsTabBody.test` `blocks()` positional class, the frozen
    `ui/specs/mage/fire/calculate_combustion_thresholds.test.tsx` seeing `relative` on the sidebar
    action button) · lint 0/252 · css clean · locales 8/8 · build OK · **tw-probe 63/63 spec
    sections** (landing clean): 126 buttons `relative→static` + 126 spans `none→inline`,
    `absolute→static`, `top/left 50%→auto` (the `.sim-sidebar-action-button`/`-loading-icon` rules
    deleted while `ReforgePanel.tsx:170-198` still copies that markup), icon buttons 39→60 px tall as
    a consequence; ContentBlock `gap` groups (3.5→10.5, 10.5→28, 0→10.5, 4→12, 12→32, 0→12 px —
    `gap-stack` beating `GlyphsPicker.scss:17` and `SummaryTable.scss:26`); rotation-tab
    `min-width/min-height 0→auto` on 34 hidden divs (a `Root` `flex` utility beating the
    `#rotation-tab.rotation-type-X .rotation-tab-Y { display: none }` toggles), columns losing
    `gap`/`grid-template-columns` · a11y 2× clean · tabs-behaviour 6/6 · header-toolbar +
    sidebar-loading pass · sidebar-reference/tabs-a11y blocked (master `dist` from Jul 5) ·
    mount-once PASS. Bundles spec 191,885 · home 98,973 · shared 67,815.
  - Fixes applied after round 1: `SidebarActionButton.tsx` reverted + both `_sidebar.scss` blocks
    restored verbatim (W1); ContentBlock `gap` back into `_content_block.scss` on root and body,
    class order `content-block, <site>, mb-0?, flex flex-col` (W3); `Root externalDisplay` +
    `.rotation-tab { display: flex }` restored in `_rotation_tab.scss`, `Left` gains
    `gap-(--spacing-section)`, `stacked` carries the inert grid template, the two tests rewritten
    (W2).
  - Round 2: vitest **1728/1728** · lint 0/252 · css clean · locales 8/8 · build OK · master built
    (build only) · **tw-probe 63/63** but a single property: two always-hidden divs per page `gap
    10.5→28 px` (12→32 at 2200) = `GearPicker.tsx`'s two `Col`s where `_gear_picker.scss:16-21`
    sets `gap: var(--spacing-stack)` · a11y 2× clean · tabs-behaviour 6/6 · header-toolbar +
    sidebar-loading pass · **sidebar-reference exit 1** (`TypeError … getAttribute` of null in
    `page.evaluate`, side not attributed) · tabs-a11y 6/6 · **mount-once FAIL** (module-MIME error:
    the vite dev server was started from the wrong checkout — start it from the worktree). Bundles
    spec 192,378 · home 98,973 · shared 67,579.
  - Fix after round 2: `Col externalGap` on GearPicker's two columns, SCSS override kept (W2).
  - **Round 3 (this tree, 10:28): GREEN.** type-check 0 · vitest **1728 / 215** · lint:js 0/252 ·
    lint:css clean · locales 8/8 · build OK · **tw-probe 0 diffs** vs baseline-2 (no tree change) ·
    a11y warrior/arms + mage/fire PASS · tabs-behaviour 6/6 · tabs-a11y vs master 6/6 · mount-once
    PASS (dev server started from the worktree) · header-toolbar + sidebar-loading pass ·
    sidebar-reference exit 1 on **both** the Phase-1 baseline build (3406) and ours (3404), crashing
    on the *base* (master, 3401) side before any output — pre-existing, not wave B's. Bundles: spec
    **192,378 B** · home **98,973 B** · shared **67,579 B**. The tree is ready to commit as one
    A-U-shell commit (`git add -A -- <the paths above>` + `git add -f tools/react-migration/
    TAILWIND-DIVERGENCE.md`); `test:snapshots` is still due once this phase (not run since wave A).
  **Frozen-test steer (user, via main):** never edit `ui/specs/**` to make a test pass; a frozen
  exact-class-list assertion is a *reader* under the per-rule override check, so the sidebar action
  button keeps its declarations in SCSS and the question is parked (parked count now **2**).
  **Master `dist`:** rebuilt today under the lock, build only — never clean that `dist/`, it is the
  user's main checkout; `tabs-a11y.mjs`/`sidebar-reference.mjs` need it on 3401.
- **Phase 2 partition (orchestrator's, disjoint file sets):** wave A = **B-U3a**
  `TabNav`/`TabPanel` (SimTabs, AplNavbar, DetailedResultsTabs, SelectorModal, BulkTabBody,
  DetailedResultsPane; deletes `tab_pane_class.ts`, `SimTabs.scss`,
  `_bootstrap_style_overrides.scss:198-228`; `SimShell.tsx:100-101` `.nav` → `flex flex-wrap`;
  Bootstrap `nav`+`transitions` die) · **B-U3b** `Menu`/`MenuItem` (DropdownMenu/DropdownMenuItems,
  ImportExportMenu + .scss, SimTitleDropdown + .scss + `_sim_title_dropdown.scss`, the two landing
  menus, `DropdownPicker.scss`; Bootstrap `dropdown` dies; NOT IconEnumPicker/MultiIconPicker/
  BulkItemSearch) — both must run the per-rule override check before converting any declaration;
  then wave B = **A-U-shell** alone (`core/sim_ui/{_shared,_sidebar,_header,_main}`, `_sim_tab` + the
  five tab files incl. `_rotation_tab.scss:28 @extend`, `_content_block` + `flush` prop,
  `_sticky_toolbar`, `individual_sim_ui/_shared`; SimTabPane layout prop = the plan's
  `TabPanelColumns`) → **C-U3.2** → A-U-icon → A-U-list. Phase 2 → 3 → merge `feature/ui-react`
  `a215eead5` → 4 → 5 → 6; end only after Phase 6 is gated. Then Phase 2: **A-U-shell + B-U3** (TabNav/TabPanel replacing
  `tab_pane_class.ts`, Menu/MenuItem, TabPanelColumns; `core/sim_ui/*`, `_sim_tab` + five tab files,
  `_content_block` + `flush`, `_sticky_toolbar`, `_sim_title_dropdown`; Bootstrap nav/transitions/
  dropdown die) → C-U3.2 → A-U-icon (before the two ladders) → A-U-list.

## Lessons from wave A (Phase 2)

- **A `border: 0` shorthand resets the colour to `currentColor`; `border-0` sets only widths.** Add
  `border-current` when the SCSS used the shorthand and a surviving rule (Bootstrap `.nav-tabs
  .nav-link { border: 1px solid transparent }`) would otherwise colour the edges.
- **`border-border` colours all four sides; `border-b-border` only the bottom.** Bootstrap's
  `.nav-tabs` set only `border-bottom`, so top/left computed `currentColor`.
- **`text-base`/`text-sm` emit a line-height too**; SCSS that set only `font-size` becomes
  `text-[length:var(--x)]`.
- **`fade-in-out` is enter+exit.** Where the SCSS was enter-only (`SimTabs.scss`, deliberately —
  `keepMounted` uses a real `hidden`) write `[transition:var(--transition-fade)]
  data-[starting-style]:opacity-0`; the exit fade kept the outgoing pane laid out 150 ms and a
  sticky observer inside it computed `stuck` (one section at 700px, reproducible).
- **A Bootstrap partial import dies only with its last reader**, and the census must include TSX
  outside the unit (landing) and `_bootstrap_style_overrides.scss` blocks. The plan's "dies in U3"
  rows are targets, not orders.
- **A prop that "adds a class when true" is not a whole-string variant**: `bordered={false}` must
  emit `border-b-0`, not nothing, or the surviving partial's declaration shows through.
- `ui/scss/index.scss` is a single-writer file (orchestrator only).
- `a11y.mjs` takes **one spec** as `argv[2]` (a comma list 404s → sidebar timeout) and reads
  `PORT`/`REACT_PORT`; run it once per spec. Verifier briefs: step 0 `ss -ltnp | grep ':340[1-6] '`
  and kill strays; the empty `ss` line is the report's last line or the report is rejected; probes
  must run in the foreground with a 600 s Bash timeout (two verifiers paused on a backgrounded
  probe). Servers are the verifier's own if `ss` shows them mid-run.

## Deferred between units (not user questions)

- `ResultsFilter.tsx` `hidden` via `UnitPicker`'s `className` array → still open (A-U-input part 1
  shipped small; take it with U8a).
- **Picker SCSS left unconverted by A-U-input part 1** (rule: a declaration converts only if no
  SCSS rule overrides it, checked per rule; never bridge with `!important`; the contested property
  converts in the same commit as its overrider): root `display` → U5 (`_encounter_picker.scss:46,73`);
  root `flex-direction`/`align-items`/`justify-content` → U5 (`_talents_picker.scss:10`), U6
  (`_apl_rotation_picker.scss`, `_list_picker.scss`), U7 (`EpWeightsDialog.scss:62`); the md `gap`
  → U6; every label rule incl. the inline/icon `overflow: unset !important` cancel → U6; inline
  `input, select { width: 5rem }` → the `specs.css` step (`sims/mage_fire.scss:3`);
  `.boolean-picker-root` max-xl block → the Checkbox commit; `.enum-picker-selector` → U7
  (`_suggest_reforges_action.scss:83`); `.picker-group` → U5. `_input.scss`, `_boolean_picker.scss`,
  `_enum_picker.scss` therefore still exist; `_input.scss` must stay imported AFTER `list_picker`
  (`.input-root { align-items }` wins over `.list-picker-root` by source order).
- C-U2.2 can drop only classes with zero SCSS readers now (`input-description`,
  `number-list-picker-root`, `list-picker-item-actions`, `dropdown-picker-list`, `unit-picker-root`,
  `unit-picker-item-icon`, `saved-data-set-name`, `pet-spec-picker-root`); the rest drop with the
  unit that deletes their SCSS.
- Feature wrappers `picker-group`/`icon-group` keep class locators until `PickerGroup` (U5); ui-kit
  classes outside the C-U2.1 contract keep class locators until C-U2.2.
- `ItemListRow` gained a required `active` prop — keep.
- Tooltip piggyback residue re-rooted in feature `.scss` → each feature's unit.
- `EpWeightsDialog.scss` tank block minus `.sim-dialog-footer` → B-U8.
- `sim-dialog-popup` (SelectorModal.scss:11) and `sim-dialog-header` (_selector_modal.scss) classes
  stay on Dialog until U7; `sim-confirm-popover*`/`virtual-list*` until their tests move;
  `progress-tracker-modal-cancel-btn` (frozen spec test) stays.
- `.link-*` overrides in `_bootstrap_style_overrides.scss` stay until the `link-*` classes drop
  (CooldownRow `link-danger`, CombinationsCount `link-warning` → U5).
- WowheadIcon's equipped-item sites (ItemDetailCell, SlotRailIcon, ItemSwapIcon, GearChangeIcon,
  EnchantLabel, GemSummary, ItemListRow, GlyphPicker, TalentPicker, PetSpecPicker, the picker
  anchors) → U4/U-talents; the `wowhead-background-icon` mixin stays until its last carrier.
- `_bulk_tab.scss:45`'s `.loader { --loader-width: 60px }` still resolves through Spinner's `var()`
  reads — converts with `_bulk_tab.scss` (U4).
- `Spinner`/`Skeleton` literal colours (`#f3f3f3`, `#3498db`, the skeleton gradient) have no token —
  kept as arbitrary values; a token is a user question only if the palette is meant to cover them.

## Parked for the user

Count: **2** — (1) landing page +10 KB shared chunk since A-S4 (default: plan as written); (2) may the
frozen mage/fire spec test's exact class-list assertion on the sidebar action button be relaxed so
the button can carry utilities (default: its three rules stay in `_sidebar.scss`). Full text under
`## Parked for the user` in `tools/react-migration/TAILWIND-DIVERGENCE.md` (uncommitted edit).

## Latest verifier numbers (wave A close, tree at 37f4d469c)

type-check clean · vitest **1720 / 214** · lint:js **0 errors, 252 warnings** · lint:css clean ·
test:locales 8/8 · build OK · tw-probe **0 diffs** vs baseline-2 (197,373 elements) · a11y
warrior/arms + mage/fire 39 PASS each · tabs-behaviour 6/6 · tabs-a11y vs master 6/6 · mount-once
PASS · test:snapshots not yet run this phase (due at the phase close). Bundles: spec **202,230 B** ·
home **98,973 B** · shared **58,349 B**.

## Verifier numbers at the Phase 1 close (tree at 44074d539)

type-check clean · vitest **1710 / 211** · lint:js **0 errors, 252 warnings** (ceiling 280) ·
lint:css clean · test:locales 8/8 · test:snapshots **34/34** (Phase-1 close; per phase, and per
commit when `ui/sim/**` or `ui/features/*/model/**` changes) · vite build OK · tw-probe CONFINE run
**0 unconfined sections, no shifts** (counts arms 1823→1850, fire 1957→1966, protection 5382→5527
for 25/7/75 checkbox roots; landing 390 identical) · a11y.mjs clean (warrior/arms, mage/fire) ·
mount-once, tabs-behaviour PASS · settings-tab.mjs identical on both builds (warrior/protection).
Bundles (files the built HTML links): spec `spec_entry-*.style.css` **205,960 B** (start 383,069) ·
home `index-*.style.css` **99,352 B** (start 115,972) · shared Tailwind/theme chunk
(`colors-*.style.css`) **54,033 B**. `dist/` is never cleaned — grep
`bundle/[A-Za-z0-9_.-]+\.css` in `dist/mop/index.html` and `dist/mop/mage/frost/index.html`.

## Environment facts

- **Two probe baselines.** `/tmp/claude-1000/tailwind-baseline-dist` = `dist/` at `ea0f92e69`,
  used by every Phase 0–1 gate up to and including the Checkbox CONFINE run; never delete it.
  `/tmp/claude-1000/tailwind-baseline-dist-2` = `dist/` built from the tree of `44074d539`
  (Checkbox + C-U2.2 + tooling, the Phase-1 close verifier's build), **used from Phase 2 on** —
  serve it on 3406 (`REACT_PORT=3406`). A tree-changing commit is proved with
  `CONFINE='<selector>'` (see README) and re-takes the baseline to a new numbered directory,
  recorded here. Never use the `wowsims-mop-react` worktree as baseline. `tw-probe.mjs` normalises `color(srgb …)` to
  `rgb()`/`rgba()` with a 1e-4 channel epsilon. Its stdout truncates when piped; read its own
  `report.txt` under the scratchpad `tw/probe/` (the path the script prints) and check its mtime —
  a stale report from the previous run looks like a pass. The probe's property string is
  `display|position|top|right|bottom|left|float|clear|width|height|…` — read diffs by that order.
- `tools/react-migration/` is tracked but matched by an ignore rule: stage with `git add -f`.
- **No standing servers, and servers never hold the lock.** Per gate run:
  `flock -o -w 3000 /tmp/claude-1000/e2e.lock npx vite build` → start the servers **outside any
  lock, with the lock fd closed**: `setsid nohup npx http-server dist -p 3404 -s 3>&- < /dev/null
  > /tmp/claude-1000/srv3404.log 2>&1 &` and the same for
  `/tmp/claude-1000/tailwind-baseline-dist -p 3406` → confirm `ss -ltnp | grep -E ':340[46] '` and
  `fuser /tmp/claude-1000/e2e.lock` empty → `flock -o -w 3000 /tmp/claude-1000/e2e.lock env
  REACT_PORT=3406 TW_PORT=3404 node tools/react-migration/tw-probe.mjs` → `kill -9` the PIDs
  `ss -ltnp` shows → `ss -ltnp | grep -E ':340[1-6] '` empty. A server started from a shell holding
  the lock inherits fd 3 and keeps it; the next `flock` deadlocks on its own servers (happened once).
  Master (`/home/lutz/personal/wowsims-mop`, `npx vite build` there first) on 3401 only for
  `tabs-a11y.mjs`, `parity.mjs`, `panes-parity.mjs`. `a11y.mjs` reads `REACT_PORT`; `tabs-a11y.mjs`
  reads `BASE_PORT`/`REACT_PORT`.
- Only the build, vitest/snapshots and probe/test runs go under `flock -o -w 3000
  /tmp/claude-1000/e2e.lock`; one browser, one build.
- Constraints: `RTK_DISABLED=1` on every command · `/usr/bin/grep` · graphify stale, never use ·
  never `npm install`/`npm ci` · never `git stash` · never touch fixtures/goldens/`ui/specs/**` ·
  never `rm -rf dist` · no comments added in `ui/` `.ts`/`.tsx`/`.css`, no pre-existing comment
  removed (`.scss`/`.mjs`/`.md` comment-safe) · `npx oxfmt` every touched `.ts`/`.tsx` · 1rem =
  14px below 1921px, 16px at ≥1921 (the 2200 probe width) · `@theme static` emits nothing for a
  missing token (the five primary-derived tokens must stay in `@theme` AND on `.sim-ui`) ·
  **no `--spacing-*` token named after a static display keyword** (block, flex, grid, table, inline,
  contents, hidden, flow-root, list-item — `inline-<x>` becomes a functional inline-size utility) ·
  utilities `important` + unlayered · no tree change in a style commit · a B unit never removes a
  class (C-Un.2 does) · one kit property is varied by a prop selecting a whole string, never by a
  second utility on the same element · **class strings are static literals, never template
  literals** (the scanner reads source text) · source `px` stays `[Npx]` · a converted bundle must
  reproduce the *compiled cascade's* computed values (later rules such as `.badge` override `.btn`;
  inert declarations like `right: 0` on `position: static` count too) · no jest-dom matchers exist.
- Operating model: Sonnet workers do edits (one unit each, cheap gates only under the lock:
  type-check, lint:js, own-dir vitest); waves of ≤5 disjoint workers; single-writer files
  (`theme.css`, `tailwind.css`, `vendor.css`, `shell_classes.ts`, `browser/intended/tw-probe.mjs`,
  `README.md`, this file) go to exactly one worker per wave; `TAILWIND-DIVERGENCE.md` is appended
  by workers **only via shell heredoc `>>`**; same-file edits across workers are Edit-only with a
  re-read first. A Sonnet verifier runs the full gate set per wave (report-only); the orchestrator
  reviews diffs (`git diff -- <files>`; dropped `className=` strings, added comments, JSX tag
  balance — type lines match `<[A-Za-z]` too), commits per unit with `git add -A -- <existing
  paths>`, sends a short `main` update after every commit, and briefs the next wave in the same
  turn. Commit trailer: `Claude-Session: https://claude.ai/code/session_014Qxt6yChJpLi78oNZJ7jFq`.
  Nothing pushes.
- Before U8b (Timeline): merge `feature/ui-react` (`a215eead5`) into `wt/tailwind` at the end of
  Phase 3, resolve toward this branch's Tailwind form keeping `feature/ui-react` behaviour, full
  gates, report the merge to `main` as its own message.
- **Per-rule override check before any conversion** (the A-U-input lesson, ~3 h): for every
  declaration about to become a utility, grep every SCSS selector outside `ui/specs/**` that sets
  the same property on that element or its descendants (feature files override kit roots by
  specificity), plus TSX arbitrary variants (`[&_.x]`); if any exists, leave the declaration in
  SCSS and log the unit that converts both sides; never add `!important`, never bridge. Equal
  specificity resolves by source order — moving an `@import` is itself a cascade change (the
  `_input`/`_list_picker` `align-items` flip). Base UI `Checkbox.Root` is a `<span role="checkbox">`
  and puts the `id` on its hidden native input (label `for` works; probes click the label).
  Verifier briefs end with "kill servers and paste the empty `ss` output before reporting" and say
  "foreground only, never background" — one verifier paused itself waiting on a backgrounded probe.
- Measured facts a worker must not re-derive: Chrome computes `color-mix()` to `color(srgb …)` and
  `rgb(r g b / a)` to `rgba()`; Base UI treats explicit `container={null}` as "wait" — portal
  defaults are `container ?? ctx ?? undefined`; `host.rootElem` ≡ `SimShell.rootEl`;
  `$btn-hover-bg-shade-amount: 30%`; `data-base-ui-inert` is Base UI `markOthers` on elements
  outside an open modal (inline variant at U3); `_global_old.scss` styles `.safe` green; only
  holy-power of the six secondary resources has a colour token; Toast's `$tooltip-bg` `#212329` is
  `--color-overlay`, `#373d57` is `--color-surface-border`; Base UI `Toast.Title` renders an `h2`;
  Bootstrap `.form-label` is `margin-bottom: .25rem; font-weight: 400`, `.form-text` colour is
  `#6c757d` (`--color-gray-600`); `.loader` was `120px`, border `calc(width/7.5)`, radius 50%.
