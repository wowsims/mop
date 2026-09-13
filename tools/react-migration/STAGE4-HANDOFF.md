# Stage 4 handoff — Tailwind migration on `wt/tailwind`

Read this first when relaunching the orchestrator. The plan is the source of truth:
`/home/lutz/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md` (Decisions, Master
sequence of 29 steps in 6 phases, workstreams A/B/C, censuses). This file only records where the
chain is and what a fresh orchestrator needs to keep it moving without the user.

## Where the chain is

- **LIVE STATE — main session orchestrates directly, one worktree per unit** (read this bullet first).
  **Phase 2 COMPLETE** — A-U-list landed `42142c5d1` (probe 0 after three fixes: missing root gap, `_input.scss` narrow-width gap contest, over-broad `data-[layout=inline]` variant; `test:snapshots` 34/34 on it as the Phase-2 close). A-U-icon landed `b8cae69bc` (probe 0, a11y/tabs/settings-tab clean); C-U3.2 `249309630` ( before it `33d01a51d` handoff, `47012afa4` A-U-shell).
  Unit worktrees `/home/lutz/personal/wowsims-mop-tw-<unit>` on `wt/tw-<unit>`, created by
  `/home/lutz/personal/.tw-stage4/mkunit.sh <unit>` (node_modules = per-entry symlinks, never a symlink; copies
  `ui/generated/`, `*_auto_gen.ts`, `tools/state-snapshots/` — the tailwind branch's vitest still needs
  `tools/state-snapshots/stub-i18n.js`), removed by `rmunit.sh <unit>` (kills 3401–3406 too). Workers
  edit + cheap gates + **commit on their own branch**; main reviews, rebases onto the tip, a Sonnet
  verifier runs `/home/lutz/personal/.tw-stage4/VERIFIER.md` on that worktree (serial — one at a time, ports
  shared), then `git merge --ff-only wt/tw-<unit>` on `wt/tailwind`. Single-writer files stay with main:
  `ui/styles/{theme,tailwind,vendor}.css`, `ui/scss/index.scss` (Bootstrap partial imports are
  deleted by main at integration once the worker reports no readers), probe `.mjs`, this file.
  In flight: **A-U-list** (`wt/tw-list`, verifying `c817dba2d`, runs test:snapshots as the Phase 2
  close) → **A-U-icon** (`wt/tw-icon`, `e1382aa91`, queued) → Phase 2 done. Phase 3 started early in
  parallel: **B-U5 buttons part 1** (`wt/tw-buttons`: Button variant strings, ButtonGroup, `as="label"`,
  DropdownMenu/SearchBar bypasses; part 2 = the 31 raw sites incl. SearchBar/LogSearchGroup/Importer/
  AplNameDialog wholesale; part 3 = Bootstrap `buttons` import, `.btn-reset`, the two theme
  residual rules) and **B-forms** (`wt/tw-forms`, excludes those four files). Before merging
  `feature/ui-react` after Phase 3: copy `node_modules/react-chartjs-2` from the react worktree into
  this worktree (not installed here). Known test smell for C-8: `SettingsTabBody.test.tsx` locates
  columns by `.tab-panel-left/-right/-col` (TabPanelColumns' structural classes).

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

## Lessons from Phase 2 (main-session orchestration)

- **A media-query or variant-scoped override is a reader too.** A-U-list's `gap-(--spacing-stack)` on
  `.list-picker-root` was clean at 1600/2200 and red only at 700: a narrow-width rule on the encounter
  picker's `list-picker-compact` list gave it 7px, and the important utility now beat it. The per-rule
  override check must include `@media`/`@include media-breakpoint-*` blocks and modifier classes
  (`.x-compact`, `.horizontal`) that set the same property — grep the property name, not just the class.
- **A utility on a kit component must land on the element the class is on.** `ListPicker`'s root is
  PickerShell's `Field.Root`, which takes `className` as a prop — the utility went nowhere at first,
  and the SCSS it replaced had already been deleted (`row-gap: normal`).
- **A Bootstrap class left on an element keeps its state rules alive, and those are readers.** B-forms
  put important `bg-surface border-surface-border` on inputs that still carry `form-control`, so
  Bootstrap's non-important `.form-control:focus { border-color }` and `:disabled { background-color }`
  silently lost. The probe captures elements at rest only: hover/focus/active/disabled regressions are
  invisible to it. Either reproduce every state as a variant (same literal or `color-mix(in srgb, …)`
  expression the SCSS emits) or leave the property out of the base; the unit's tests must assert the
  variant strings, since they are the only guard.
- **Input `gap` below 768px** comes from `_input.scss:14-18` (`.input-root:not(.input-inline):not(.icon-picker)`
  under `media-breakpoint-down(md)`) — it contests `.list-picker-root`'s gap; owner: the unit that
  converts the rest of `_input.scss` (not U5 as the A-U-list commit says).
- **Tailwind's filter utilities never compute `none`.** `grayscale-0` goes through the composed
  `--tw-*` filter chain and serialises `grayscale(0)` where the SCSS said `filter: none` — 63 probe
  sections on A-U-icon. Write filters as arbitrary properties (`[filter:none]`, `[filter:grayscale(1)]`,
  `[filter:opacity(0.7)]`) so they serialise exactly as the SCSS did.
- **`item-swap.mjs` fails identically on the baseline build** (`page.click` timeout on
  `#enable-item-swap`, "outside of the viewport") — a pre-existing harness issue, not a regression.
- **Frozen sidebar action button (parked #2) and the Bootstrap `buttons` import:** `SidebarActionButton`
  keeps rendering the baseline class list (`btn btn-primary` + site classes, no variant utilities) so
  the frozen mage/fire class-list assertion stays green. When B-U5 part 3 deletes the `buttons` import,
  the `.btn`/`.btn-primary` declarations that element computes get copied into `_sidebar.scss` under
  its own class; `btn`/`btn-primary` stay on it as inert markers.
- **A variant keyed on a state attribute can match more than the selector it replaces.**
  `.list-picker-root .list-picker-items .list-picker-item-container.inline { display: flex }` → the
  flat `data-[layout=inline]:flex` also hit 20 zero-size item containers (protection gear tab @2200)
  that the nested selector never reached, because C-2 emits `data-layout` more widely than the old
  scope. Before replacing a nested SCSS selector with an attribute variant, confirm the attribute's
  carriers are exactly the old selector's matches; otherwise keep the rule in SCSS.
- **Measure a state on the baseline before reproducing it; never derive it from Bootstrap's source.**
  Reasoning from `_forms.scss` said `.form-control:focus` changes border-color and adds a box-shadow;
  the baseline build, measured, shows neither (a project rule neutralises it). Reproducing the source
  added a visible focus ring that was never there. For hover/focus/active/disabled/placeholder, have
  the verifier read the computed value on 3406 (baseline) and 3404 in the same state, and match 3406.
- **User direction: shared style bundles are private to their component.** `INPUT_CLASSES`/`SELECT_CLASSES`
  are not exported; `<Input>`/`<Select>` (Base UI Field; native `<select>`) and `<TextArea>` in
  `ui/ui-kit/FormControl/` own them (unit `wt/tw-inputs`). Every later unit uses the components —
  never imports a `*_CLASSES` constant. The three buttons-unit files that still use `INPUT_CLASSES`
  (`LogSearchGroup`, `Importer`, `AplNameDialog`) move to `<Input>` right after buttons lands.
- **Tailwind rules digest:** `/home/lutz/personal/.tw-stage4/TAILWIND-DOCS.md` (docs + 4.3.3 source, applied to this repo).
- **In flight (Phase 3 close):** buttons unit `wt/tw-buttons` @ `ad3f4d568` (6 commits: Button variants, 31 raw sites,
  Bootstrap `buttons` partial deleted, IconButton → `Button iconOnly`, two inputs → `<Input>`, `--shadow-focus-*`
  tokens + `@theme static inline` `--shadow-focus-theme`) — in verification. Unit `wt/tw-merge-react` cut at
  `ad3f4d568`, merged `feature/ui-react` `a215eead5` as `59c40e52d` + `31d280c53` (9 conflicts toward the Tailwind form; WowheadIcon onto
  the spreadable dataset props; Base UI checkbox tests assert `aria-checked`; vitest 1757/1757) — reviewed, awaiting verification
  against a `/home/lutz/personal/.tw-stage4/baseline-dist-3-pre` copy of the buttons build; if buttons
  needs a fix, merge the fixed `wt/tailwind` into it before landing. Tokens T1 (`wt/tw-tokens`) also cut at `ad3f4d568` (theme.css + renames + ui-kit sweep; rebases onto the merged tip before
  verification). Then: baseline-3 rebuild (merged tip), T1 verify + land, T2 (app/features), Phase 4 wave 1 (U4a, U5, U6, U7, kit-tail).
- **Two lock lanes (2026-09-13):** cheap gates run under `/tmp/claude-1000/gates.lock`; builds, servers and probes under `/tmp/claude-1000/e2e.lock`.
- **Next-step briefs in `/home/lutz/personal/.tw-stage4/`:** `BRIEF-merge-catchup.md`, `BRIEF-t1-rebase.md`, `BRIEF-unit-rebase.md`
  (per-unit notes: apl `size-4`; statweights duplicate `--text-2xs`, the Suggest Reforges rules, the `showThreatMetrics` gate; gear stripe-vs-hover),
  `VERIFY-units.md` (per-unit state checks), `KIT-CLASSES.md`, and `PHASE4.md` (U6 part 2, forms-tail after kit-classes (a), the ledger). Probe summariser:
  `probe-summarize.py`.
- **LANDED 2026-09-13 ~18:30: `wt/tailwind` fast-forwarded `dec10c7cf` → `cc09e785c`.** That brings buttons (16 commits through `2f35ceed4`), the `feature/ui-react`
  merge (`59c40e52d`, `31d280c53`), the catch-up `5a638c030`, and T1 (`d6da50953`, `7b6360126`, `7912a5da1`, `01032a29c`, `94e87321f`, `cc09e785c`). The final buttons
  verifier (on the buttons worktree) is still running; the tip-verify → `baseline-dist-3` step is next. Then lintcss, then the unit rebases.
- **Merge catch-up `5a638c030`** (an amended `b600e8b16` with an identical tree): merges buttons `2f35ceed4` into merge-react. No conflicts; collision scan 0; vitest 1758;
  lint 249. **Landing order:** ff `wt/tailwind` to `2f35ceed4` (after the final verifier), then to `5a638c030`, then to T1's final tip (rebased onto `5a638c030`), then tip-verify
  (`BRIEF-tip-verify.md`, which creates `baseline-dist-3`), then lintcss, then the units.
- **Buttons fix rounds 4–5 reached probe 0** at `2f35ceed4` (after the self-probe): `e08c5d55a` centring split per site, `f9ff51d33` the FAB toggles
  back to default size, `6e7883f86` outline active uses the plain colour, `2f35ceed4` the trigger default `py-4 px-0`, ChartViewPicker labels become unstyled, and
  the NameDisplay rename line-height. A final fresh verifier is running. The merge catch-up already merged `wt/tw-buttons` (`b600e8b16`).
- **T1 toolbar fix `a5f783904`** (on `46f756085`): the socials wrapper no longer carries `[&_a]:my-4`. probe-t1-2 against the merge build shows **only the accepted
  rows** (the ResultsFilter icon font-size and line-height; the `50%`/`9999px` radius). **T1 is verified.** Its second rebase onto the landed buttons plus the catch-up is mechanical.
- **Stack verification (2026-09-13):** baseline `/home/lutz/personal/.tw-stage4/baseline-dist-ad3f4d568`.
  - **merge-react `31d280c53` vs `ad3f4d568`: 0 diffs over 68 sections.** Gates green (1757 tests, lint 248, snapshots 34/34). **The merge is verified.**
  - **T1 `46f756085` vs the merge: 819 rows.** The ResultsFilter icon going 20px → `text-lg` (review list), a harmless `50%`/`9999px` radius, and **one regression**: the sim-toolbar social-link margin doubles because `[&_a]:my-2` and `[&_a]:my-4` collide. The fix is specified in `BRIEF-t1-rebase.md`. **Review list:** that ResultsFilter icon rule came from my generalisation of the user's metrics answer.
- **lintcss** `e444b10b8` (on `46f756085`): `lint:css` = `stylelint "./ui/**/*.scss" "./ui/**/*.css"`, with a CSS override for the Tailwind at-rules and functions.
  It lands right after T1. The `vite-plugin-stylelint` include is still `ui/**/*.scss`; retarget it in Phase 5 (S6).
- **kit-classes (b) `dc8bf35aa` and (c) `72c3d2224`** on `wt/tw-kit`: the overlays, Chip, TabNav, TabPanelColumns, Spinner, Skeleton, UnitIcon and the sticky toolbar are
  now co-located `ui-*` `@apply` classes; `badge` has no emitters left; the nav-* classes are dropped. (a) and (d) come after buttons lands. **Gap:** `lint:css` doesn't lint
  `.css` files yet.
- **Probe-reader cross-check (2026-09-13):** `timeline.mjs` (`.rotation-item`, `.rotation-scroller`) and `stat-weights.mjs` (`.ep-reference-options`,
  `.not-tiny`) still read hooks their units dropped; follow-up workers on `wt/tw-timeline` and `wt/tw-statweights` are fixing them. specs,
  bulk and apl are clean. `WORKER.md` now requires a grep of `tools/react-migration/*.mjs` before dropping any hook.
- **U8b timeline** `998438b40` (cherry-pick), `715d97d1e`, `da3120d16`, `5cf6ef241`: `Timeline.scss` 82–670 deleted; `ui-timeline-*` classes; `data-outcome`,
  `data-density` (`group/scroller`), `data-first`; the `rotation-item`, `outcome-*` and `is-first` hooks were dropped. `timeline.mjs` still read `.rotation-item`, so a follow-up worker is fixing the probe readers. **All nine
  feature units have finished their first pass.**
- **U8d replay** `c2350b014`, `b621a0fba`, `a253e337c`, `bf6ea3852`: all of `CombatReplay.scss` converted except `.replay-content.dr-tab-content`
  (→ U8a part 2); `ui-combat-replay-*`; the perf toggles are attribute-only; a white/black alpha token scale (dedupe with U8a at rebase).
- **U8c logrunner** `7c379a14d` (cherry-pick), `f1b3b57f2`, `9871ff10c`: `LogRunner.scss` deleted; `Timeline.scss` lines 3–77 removed; `ui-log-row`,
  `ui-fab-*` (shared Log/Rotation FAB), `ui-log-inline-picker`; hooks become test ids; `log-runner.mjs` uses `q()`. The rebase needs a token-policy sweep
  (`--spacer-*`, arbitrary values). **kit-classes (b)+(c) started early** on `46f756085` (`wt/tw-kit`); (a) and (d) come after buttons lands.
- **U5 settings** `85e720d9c`..`e713bb333` (8 commits): 8 SCSS files deleted incl. `_talents_picker`; `.link-danger`/`.link-warning` overrides removed;
  hooks kept with companion utilities (the Phase 6 sweep drops them). **U5 part 2** (with forms-tail): PickerGroup, picker-group `:has()`, WowheadIcon
  sites, PetSpecPicker inversion. **Stack verification started** (ports 3401/3402): merge-react `31d280c53` vs a new `baseline-dist-ad3f4d568`,
  and T1 `46f756085` vs merge-react; only the accepted font diffs are expected for T1.
- **U4b bulk** `c07b8fcbb` (`--radius-md`), `49b5f3b7d`: all 4 bulk SCSS files deleted; the bulk dropdown is **off Bootstrap `dropdown`** (via `data-open`);
  `ui-bulk-*` classes. Rebase after gear; the literal red becomes a token. **U8d replay** started on `46f756085`.
- **U8a results** `f34123a75` (tree change: a single caret; verify or revert), `e49852fdf`, `37ce88110`, `2c95df5c8`. Six SCSS files deleted;
  `ui-metrics-table-*` and `ui-character-stats-*` composition classes; `--color-white-5/20/80`. About half the scope is left for **U8a part 2**
  (PHASE4.md). **U8b timeline** started on `46f756085` plus a cherry-pick of `a69e067be`.
- **U4a gear** `d372a0d8c`: all 9 gear SCSS files deleted; `ui-*` classes in `ItemCell.css`, `FiltersMenu.css`, `SlotRail.css`, `GearChangeIcon.css`,
  `SelectorModal.css` and `SummaryTable.css`; new tokens `--text-md` and `--text-ep-delta`; a `NameDescriptionLabel` `flush` prop. **Deferred item resolved:**
  the equipped-item icon sites keep `ItemCellAnchor` (its keyboard activation) instead of `<WowheadIcon>`. To verify: the stripe-versus-hover
  variant order. **U4b bulk** started on `d372a0d8c`.
- **U7 statweights** `1f852dc77`, `66bfdc251`, `5d854402e` (the tank block becomes `isTank`), `c34b2e135` (**Bootstrap `grid` import deleted**). Deleted
  `Importer.scss`, `ReforgePanel.scss` and `_exporters.scss`. Added `NumberPicker.inputClassName`/`EnumPicker.selectClassName`. **Review-list deviation**
  from "pickers get no className". Open at rebase (BRIEF-unit-rebase): the duplicate `--text-2xs`, the Suggest Reforges rules, and verifying the
  `showThreatMetrics` gate against the baseline. **U8c logrunner** started on `46f756085` plus a cherry-pick of U6's `a69e067be`.
- **U6 apl** `a69e067be` (`useStickyBottom` + FloatingActionBar), `4c9277c27` (partial conversion: 3 partials deleted, `ui-apl-editor-row`
  `@apply` class, 10 hooks dropped). The ListPicker/DropdownPicker/PickerShell-internal rules are left for **U6 part 2 after kit-classes**
  (PHASE4.md). Bug to fix in its rebase: `ActionIdIcon.tsx:22` `size-icon-sm` → `size-4` (a retired token emits nothing). **U8a results**
  started on `46f756085` (`wt/tw-results`).
- **Buttons fix round 3** (after the reboot): `dd89ddd46` centring on ICON_BASE plus 17 unstyled sites, `edf60e21c` trigger/TooltipButton `flex`,
  `747941179` floating-bar toggles `py-4`, `01d162ee1` ChartViewPicker named peers, `5b5a69d64` ListItemAction class order. Collision scan 0,
  lint 252 (at the cap), vitest 1660. In verification against the rebuilt `baseline-dist-2`.
- **specs unit** `23164bb27` (on `3d4b27f4a`): the combustion table and `positive`/`negative` become utilities; the totem SCSS is deleted (inert);
  `table-responsive` and `combustion-threshold-results` are dropped. **Deferred:** `mage_fire.scss` keeps only
  `.fire-mage-sim-ui .number-picker-input[id^='combust'] { width: 7rem; text-align: right }`. NumberPicker takes no
  className, so it needs a kit decision (an `inputClassName` config prop, or an `@apply` rule) before Phase 5 deletes the last SCSS. Also,
  `.safe`/`.danger` stay in `_global_old.scss` until U-base.
- **T1 integration landed on its branch:** `wt/tw-tokens` = `6dd1f44f8`, `bd733e75b`, `00986bc5f`, `46f756085` on merge-react `31d280c53`.
  The rebase had zero conflicts; the re-sweep covered 35 uses; the metrics font is now `text-xs`; the fixed-px font tokens are removed. **Open: lint:js exited 1**
  (the worker called it warnings-only; the cap is 252). Check the count before T1 is verified. It is the base for U4a/U5/U8 (U4a started: `wt/tw-gear`).
- **Subagents launch by role (user):** `sonnet-worker` (Bash/Read/Edit/Write/WebFetch), `sonnet-verifier` (Bash/Read/Write, report-only), `sonnet-research` (Bash/Read/Grep/Glob, read-only), all Sonnet at effort high in `~/.claude/agents/`; `sonnet-high` (all tools) only as a fallback.
  **They load only on a Claude Code restart.** They were created mid-session, and `Agent` rejected `sonnet-worker`. Until a restart at a
  quiet point with no agents running, launch `general-purpose` + `model: sonnet`. After the restart, switch every launch to the role types.
- **Composition rule (user, 2026-09-13):** `@apply` is for *shared, reusable compositions* (e.g. the Dialog sizes). Prop maps
  and bundles at 2+ JSX sites become co-located `ui-<component>-<part>` classes; single-site styling stays utilities.
  **Parallel run (user):** up to 4 workers plus 1 verifier. T2 is folded into the units; kit-tail is folded into kit-classes. Specs, U6 and U7
  started early off `3d4b27f4a`; the T1 integration rebases onto merge-react `31d280c53` as the base for U4a, U5 and U8.
  The user wants no go-aheads: work autonomously, and ask only when fully stuck.
- **Reboot 2026-09-13 15:17 wiped `/tmp`.** All orchestration files now live in **`/home/lutz/personal/.tw-stage4/`**:
  the contracts, digest, briefs, `mkunit.sh`/`rmunit.sh`, baselines (`baseline-dist-2`, rebuilt from `44074d539`) and probe
  output (`OUT=/home/lutz/personal/.tw-stage4/probe-<unit>`). The docs were recovered by replaying their writes from the
  session transcript. Lost for good: the buttons probe reports, the annotated diff map, and the collision-scan script (to be
  rewritten). Commits now carry the trailer `Claude-Session: https://claude.ai/code/session_01KrgvxekDT75BMsWuAqYP4Z`.
- **User decision (2026-09-13): kit style bundles become `@apply` component classes.** Co-located
  `ui/ui-kit/<C>/<C>.css`, `ui-` prefix, `@import`ed from `tailwind.css`, **unlayered** until Phase 5, then
  `@layer components`. Call-site utilities override (important vs non-important `@apply`, verified by compile).
  Source order in the file is base → variant → size. A **kit-classes** unit runs after T1 lands. Brief: `/home/lutz/personal/.tw-stage4/KIT-CLASSES.md` (19 components,
  18 CSS files, commits a–d). Census risks to handle: (1) legacy SCSS and react-tooltip CSS win specificity ties against
  unlayered `.ui-*`; (2) call-site `!important` utilities now beat `.ui-*` **state** rules, which needs a state-shadow scan;
  (3) Menu, the DropdownMenuItems submenu and SimTitleDropdown portal to `<body>`, outside `.sim-ui`, so they lose the spec
  primary. A fallback gets its own commit. Kit tests may assert their own `ui-*` class, which the C-8 lint must exempt;
  feature tests may not.
  Buttons lands first with its TS maps, and kit-classes converts it with probe 0 expected.
- **User answers (2026-09-13, interactive):**
  1. **Metrics font:** `text-[12px]` → `text-xs`, accepting 1.5px smaller below 1921px. Generalised: a px font size maps
     to the rem step equal to it at the 16px root (12px → `text-xs`, 20px → `text-lg`). Drop T1's `--text-metrics`
     and `--text-results-filter-icon`.
  2. **Landing +10 KB** from the shared spec-theme chunk: accepted. Closed.
  3. **Frozen sidebar-button assertion** (`calculate_combustion_thresholds.test.tsx:55`): relax it to role or test id.
     `SidebarActionButton` becomes a normal `<Button>`, and `_sidebar.scss`'s copied `.btn` declarations are deleted.
     Handled in the buttons fix round.
  4. **className-only edits in `ui/specs/**` are allowed.** `table-responsive`, `positive`/`negative`, the `combustion-*`
     hooks and the totem inputs become utilities, and `mage_fire.scss` and `_totem_inputs.scss` are deleted. **No `specs.css`.**
     A small `specs` unit does this after T1 lands. Logic and tests stay frozen except the one sanctioned assertion.
- **User directive (2026-09-13): the Bootstrap-name shim goes.** `.d-flex/.flex-column/.align-items-end/
  .justify-content-end/.w-100/.gap-3` in `tailwind.css` are replaced by built-ins. The user sanctioned editing
  the three className strings in the frozen `ui/specs/mage/fire/calculate_combustion_thresholds.tsx:373,374,399`,
  className strings only. Bootstrap `gap-3` (1rem) becomes `gap-4`. Assigned to tokens T1.
- **Buttons verification RED (ad3f4d568):** (1) the `--shadow-focus-*` tokens landed in `:root`, not `@theme`, so no utility is
  generated and the focus rings are gone. The brief said "near `--focus-ring`", which lives in `:root`; my error. (2) BASE `border-transparent`
  collides with VARIANT border colours: two utilities for one property resolve by stylesheet order. (3) SCSS
  overriders of `.btn` now lose to important BASE: Suggest Reforges padding 48px→12px, dropdown trigger
  padding/border. Fix worker on `wt/tw-buttons`; the full probe report is `/home/lutz/personal/.tw-stage4/buttons-probe-report-full.txt`.
  **Lesson:** a component's bundles must never set the same property twice for one state. Prove it with a
  compile-and-check script, not by eye.
- **Landed `ca7a28e63` inputs (Phase 3):** `<Input>` (Base UI Input) + `<Select>` (`Field.Control render=<select/>`)
  in `@ui-kit/FormControl`; `INPUT_CLASSES`/`SELECT_CLASSES` module-private (only `Input`/`Select`/`TextArea`
  import them). Verifier: probe 0 (197,373 elements), vitest 1731/1731, snapshots 34/34, a11y + tabs PASS,
  state check equal. CSS: shared 68,366 B, home 98,973 B, spec entry 190,773 B.
- **User token policy (2026-09-13).** `@theme` in `ui/styles/theme.css` is the Tailwind config and must be
  complete: every colour, overlay, font size (a v4 `text-X` emits `line-height` only if a `--text-X--line-height`
  companion exists — we define none, so plain `text-sm` is exact and `[length:…]` is never needed), shadow, z-index and spacing extension is a named token; the spec themes re-declare
  tokens under `.sim-ui`. **TSX uses named utilities only** — no arbitrary colour/size values, no
  `(--var)` for a value that should be a token. **Spacing = Tailwind's default scale** (`gap-3`,
  `p-2`); named spacing only where a value is responsive (`--spacing-page`, `--spacing-section`) or
  off the scale. A dedicated tokens unit sweeps the existing arbitrary values after buttons + inputs
  land and before Phase 4 fans out. `IconButton` is folded into `Button` (`iconOnly`) — user-approved.
- **Parked (user):** metrics tables use `text-[12px]` ×17 (fixed px). Default taken: a fixed `--text-metrics: 12px`
  token (parity). Alternative: `text-xs` (0.75rem — equal at ≥1921px, 1.5px smaller below). Tokens unit brief:
  `/home/lutz/personal/.tw-stage4/TOKENS-UNIT.md`; census traps (`.gap-3` shim, bare `rounded` no-op, three broken
  `transition-(--x)`) in `/home/lutz/personal/.tw-stage4/TAILWIND-DOCS.md` "Repo traps".
- **`-[var(--x)]` is never written (user).** Tailwind v4's `-(--x)` is the shorthand for `-[var(--x)]`
  (`text-(length:--x)`, `w-(--x,60px)`). A `@theme` token gets its named utility instead; `var()` stays
  only inside real `calc()`/`min()`/gradient expressions and `[prop:…]` arbitrary properties.
- **`bg-black/50` is not `rgba(0,0,0,.5)`** to the probe (oklab `color-mix`); static alphas are
  literal `bg-[rgb(0_0_0/0.5)]`.

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

- **Bootstrap tail drift (audit 2026-09-13):** `nav`, `transitions`, `dropdown` and `badge` are still imported
  (`index.scss:50-54`) although steps 10/12 said they die. TSX still emits `nav-link` (TabNav), `dropdown-*`
  (DropdownPicker, BulkItemSearch) and `badge` (Chip). Owners are in the ledger at the end of
  `/home/lutz/personal/.tw-stage4/PHASE4.md`: a **kit-tail** unit in Phase 4 wave 1, U4b, forms-tail, U7 (grid) and
  Phase 5 landing (nav/dropdown/navbar/containers/alert). Phase 4 briefs are in the same file.

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

Count: **0** — all four answered 2026-09-13 (see \"User answers\" above).

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

- **Two probe baselines.** `baseline-dist` (lost in the 15:17 reboot; superseded by `/home/lutz/personal/.tw-stage4/baseline-dist-2`) = `dist/` at `ea0f92e69`,
  used by every Phase 0–1 gate up to and including the Checkbox CONFINE run; never delete it.
  `/home/lutz/personal/.tw-stage4/baseline-dist-2` = `dist/` built from the tree of `44074d539`
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
  `/home/lutz/personal/.tw-stage4/baseline-dist-2 -p 3406` → confirm `ss -ltnp | grep -E ':340[46] '` and
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
