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
- Next: **A-U-input part 2: BooleanPicker → Base UI Checkbox** (own commit; a tree change, so
  verify everything except probe zero-diff, confirm the probe diffs are confined to the
  `boolean-picker-root` subtrees plus later siblings shifting by exactly the height delta, screenshot
  pair of a settings tab, then **re-take the probe baseline to a NEW path**
  `/tmp/claude-1000/tailwind-baseline-dist-2` — keep the old one — and record here which commit each
  baseline was built from and which steps use which) → **C-U2.2** (drop only the class hooks with
  zero SCSS readers, see "Deferred") → Phase 2: **A-U-shell + B-U3** (TabNav/TabPanel replacing
  `tab_pane_class.ts`, Menu/MenuItem, TabPanelColumns; `core/sim_ui/*`, `_sim_tab` + five tab files,
  `_content_block` + `flush`, `_sticky_toolbar`, `_sim_title_dropdown`; Bootstrap nav/transitions/
  dropdown die) → C-U3.2 → A-U-icon (before the two ladders) → A-U-list.

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

Count: **1** — landing page +10 KB shared chunk since A-S4 (full text under `## Parked for the
user` in `tools/react-migration/TAILWIND-DIVERGENCE.md`; default taken: plan as written).

## Latest verifier numbers (wave 3, tree at b03885473)

type-check clean · vitest **1709 / 211** · lint:js **0 errors, 251 warnings** (ceiling 280) ·
lint:css clean · test:locales 8/8 · test:snapshots 34/34 (Phase-0 close; per phase, and per commit
when `ui/sim/**` or `ui/features/*/model/**` changes) · vite build OK · tw-probe **193,572
elements, zero diffs** · a11y.mjs clean (warrior/arms, mage/fire) · tabs-a11y PASS vs master
(C-2 run).
Bundles (files the built HTML links): spec `spec_entry-*.style.css` **205,856 B** (start 383,069) ·
home `index-*.style.css` **99,248 B** (start 115,972) · shared Tailwind/theme chunk
(`colors-*.style.css`) **53,960 B**. `dist/` is never cleaned — grep
`bundle/[A-Za-z0-9_.-]+\.css` in `dist/mop/index.html` and `dist/mop/mage/frost/index.html`.

## Environment facts

- Probe baseline: `/tmp/claude-1000/tailwind-baseline-dist` (a `dist/` copy at `ea0f92e69`; to be
  re-taken after the first tree-changing commit, BooleanPicker → Checkbox). Never use the
  `wowsims-mop-react` worktree as baseline. `tw-probe.mjs` normalises `color(srgb …)` to
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
- Measured facts a worker must not re-derive: Chrome computes `color-mix()` to `color(srgb …)` and
  `rgb(r g b / a)` to `rgba()`; Base UI treats explicit `container={null}` as "wait" — portal
  defaults are `container ?? ctx ?? undefined`; `host.rootElem` ≡ `SimShell.rootEl`;
  `$btn-hover-bg-shade-amount: 30%`; `data-base-ui-inert` is Base UI `markOthers` on elements
  outside an open modal (inline variant at U3); `_global_old.scss` styles `.safe` green; only
  holy-power of the six secondary resources has a colour token; Toast's `$tooltip-bg` `#212329` is
  `--color-overlay`, `#373d57` is `--color-surface-border`; Base UI `Toast.Title` renders an `h2`;
  Bootstrap `.form-label` is `margin-bottom: .25rem; font-weight: 400`, `.form-text` colour is
  `#6c757d` (`--color-gray-600`); `.loader` was `120px`, border `calc(width/7.5)`, radius 50%.
