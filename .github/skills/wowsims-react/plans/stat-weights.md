# Stat-weights port plan — read-only investigation, 2026-09-06

Worktree `~/personal/wowsims-mop-react`, branch `feature/ui-react`. Nothing was modified.
All line numbers are the working tree as read (comment-stripping applied).

## Verdict on "no body seam"

**Half right, and the half that is right does not block the port.**

Right: there is no *body-island* seam. The Calculate handler
(`ui/features/stat-weights/view/stat_weights_panel.tsx:242-318`) reaches `this.container`
(`:262-263`), `this.resultsViewer` (`:264,268,310`), the sibling `pendingDiv` (`:260,308`),
`this.simUI.rootElem` (`:259,307`), the button itself, and `this.updateTable()` (`:317`).
There is no "build the body into this element" function to hand a `useLegacyMount`
ref to, so option (a) — React `Dialog` shell hosting a still-vanilla body — would require
refactoring a vanilla view first, which the dual-stack rule forbids.

Wrong: the SKILL entry (`.github/skills/wowsims-react/SKILL.md:910-921`) concludes from that
"no seam". The `AdvancedEncounterModal` shape (React shell + vanilla islands) is not the only
shape available. The applicable shape is the **talents/settings** one — port the whole view to
React, delete `EpWeightsMenu`, and keep as `useLegacyMount` islands only the two things that
are genuinely shared or belong to an un-ported feature:

- `renderSavedEPWeights` (`view/saved_ep_weights.ts:9`) — **second consumer**
  `ui/features/reforge/view/reforge_panel.tsx:792`. By the skill's own rule
  (`SKILL.md:883-885`) it does not port with this tab.
- `ResultsViewer` (`ui/features/results/view/results_viewer.tsx:25`) — results feature,
  Phase 3's last cluster. Island only.

Everything else has a React twin already: `BooleanPicker`, `NumberPicker`, `EnumPicker`,
`Button`, `Icon`, `Tooltip` (4 tippy sites: `:339,342,389`), `Dialog`. `Toast` is called
imperatively from a handler, exactly as `Importer` does.

**And there is a clean model seam (option b).** ~200 of the 841 lines are DOM-free:

| What | Lines |
|---|---|
| `calculateEp` + `normaliseEpValue` | `:591-620` |
| `getPrevSimResult` (the zero-filled `StatWeightsResult`) | `:634-676` |
| `setEpWeightsWithoutExcluded` merge | `:430-440` |
| `epUnitStats` | `:678-692` |
| row-visibility filter | `:473-478` |
| ratio combination behind "Update EP" | `:394-419` |
| `buildStatsTable`, minus its `ref`s | `:698-828` |
| `isEpStat` | `:447-450` |

`scaledEpValue` (`ui/domain/proto_utils/stats.ts:567`) and `stDevToConf90` are already in domain.
`ui/features/stat-weights/model/` is lint-enforced DOM-free (`.oxlintrc.json:160-172`), precedent
`ui/features/settings/model/apply_build.ts`.

## Map

### `stat_weights_panel.tsx` (841 lines)

- `addStatWeightsAction(simUI, settings)` `:26-34` — constructs the modal, registers the sidebar
  button via `simUI.addAction` (`ui/app/sim_ui.tsx:137`), returns the instance.
  Called from `ui/app/individual_sim_ui.tsx:294`, inside `sim.waitForInit().then(...)`.
- `getModalConfig` `:39-43` — reads `sim.getShowThreatMetrics()` **once**; picks `size: 'xl'`.
- Constructor `:60-424` builds body (`:94-172`), footer (`:174-181`) and inserts an extra
  `<h5 class="modal-title">` into `this.header` (`:62`).
- Table: one `<table class="results-ep-table">` `:133`, `<thead>` with a column row `:135-149`
  and an `.ep-ratios` row `:150-164`; `<tbody>` rebuilt wholesale by `updateTable()` `:469-483`
  (`replaceChildren`), rows from `makeTableRow` `:485-530` / `makeTableRowCells` `:532-576` /
  `makeTableCellContents` `:578-589`. 13 column entries from `buildStatsTable` `:698-828`.
- **Result write-back**: `sim.statWeights` (`ui/domain/sim.ts:815`) via
  `player.computeStatWeights` (`ui/domain/player.ts:602`) →
  `simUI.prevEpIterations` / `simUI.prevEpSimResult` (`:315-316`) → `updateTable()` (`:317`).
  `prevEpSimResult` is also written by the ref-stat selects (`:210`).
- **Progress**: `setSimProgress` `:452-467` → `resultsViewer.setContent(<div class="results-sim">…)`.
  Per tick, direct DOM. Never touches the store — matching `SKILL.md:1127`.
- **Abort**: `signalManager.abortType(RequestTypes.StatWeights)` at `:252` (pre-run),
  `:272` (Stop button), `:321` (on hide).
- **Subscriptions**: `subscribePlayerField(player,'epRatios')` `:372` (per ratio picker) and
  `:383` (whole-table refresh); `subscribeStatWeightsChange(settings)` `:511` (per exclude
  toggle). No `subscribePlayerField(player,'epWeights')` at panel level — only inside the
  per-row `NumberPicker` (`:521`).
- **Store writes**: `player.setEpWeights` `:439`, `:525`; `player.setEpRatios` `:377`;
  `settings.setStatExcluded` `:510` (→ `statWeights[storeKey]` slice,
  `ui/domain/stat_weight_settings.ts:110-118`); `simUI.dps/heal/tankRefStat` setters
  `:217,226,234` which are getters/setters over `player.setRefStat`
  (`ui/app/individual_sim_ui.tsx:90-107` → `ui/domain/player.ts:410-413`,
  version field `'epRefStat'`, `ui/domain/state/sim_store.ts:154`).
- UI-local, not store: `statsType` `:54`, `showAllStats` `:58` (the source-less `useInput`
  case named in `SKILL.md:594`).

### `saved_ep_weights.ts` (50 lines)

`renderSavedEPWeights(container, simUI, options?)` `:9` — one `SavedDataManager`, storage key
`simUI.getSavedEPWeightsStorageKey()`, presets loaded inside `sim.waitForInit().then(...)` `:34`.
Two callers: `stat_weights_panel.tsx:695` and `reforge_panel.tsx:792` (with `loadOnly`,
`presetsOnly`, `container: null`).

### Reach-ins from other features (`/usr/bin/grep -rn`, from repo root)

| Site | What it needs |
|---|---|
| `ui/app/individual_sim_ui.tsx:294` | `addStatWeightsAction(this, settings)`, assigns `this.epWeightsModal` |
| `ui/app/individual_sim_ui.tsx:86` / `ui/features/sim_host.ts:53` | `epWeightsModal: EpWeightsMenu \| null` |
| **`ui/features/reforge/view/reforge_panel.tsx:776,780`** | `simUI.epWeightsModal && …epWeightsModal?.open()` — the only external behavioural consumer. Built lazily inside a tippy `onShow` (`reforge_panel.tsx:537`), so there is **no** ordering race with `waitForInit` |
| `ui/features/sim_host.ts:54-58`, `individual_sim_ui.tsx:88-89,132-133` | `prevEpIterations`, `prevEpSimResult`, `dps/heal/tankRefStat` |
| `ui/domain/state/persistence.ts:41`, `subscriptions.ts:172` | `StatWeightActionSettings` — domain, untouched |
| `tools/state-snapshots/store-contract-test.ts:230,308-310` | `StatWeightActionSettings`, `setRefStat` — untouched |

`prevEpIterations` / `prevEpSimResult` have **no reader outside the panel**. They are host fields
only because the vanilla modal is constructed after the shell. In React they become component state.

## Recommended units, smallest first

### Unit 1 — model extraction. No React, no markup change. *(recommended first)*

Move the eight DOM-free items above into `ui/features/stat-weights/model/`
(`ep_math.ts`, `stats_table.ts` — the 13 entries as data, `refs` split out and left in the view).
This is `SKILL.md:1258` item 8's shape ("extract the store writes … with no React in the change").

**One decision the user must make first.** Item 8's precedent extracted from
`ui/app/tabs/settings_tab.tsx`, which `SKILL.md:966` explicitly lists as an editable *shell* file.
`stat_weights_panel.tsx` is an un-ported **feature view** — the category `SKILL.md:970` says not to
rewrite, and the exact objection the `:910-921` entry raised. Two variants:

- **(i) edit the vanilla view** to import from `model/`. Smallest total work, defended by
  `parity.mjs` being byte-identical (no DOM moves) and by the new unit tests.
- **(ii) land `model/` + its tests with `stat_weights_panel.tsx` untouched**, and switch the
  consumers only in unit 3, where the view is being deleted anyway. Costs one duplicated copy of
  the math for the length of the port; violates nothing.

Pin **current** behaviour, including the quirks below — do not fix them here.

- Gate: new vitest suite; `npm run test:unit`; type-check; oxlint (the `no-restricted-globals`
  override on `ui/features/*/model/**` is what proves it is DOM-free);
  `parity.mjs` / `panes-parity.mjs` byte-identical, since no DOM moved.
- Dialog: not needed.

### Unit 2 — the opener seam. Still no React in the panel.

- `ui/features/sim_host.ts:53` → `epWeightsModal: { open(): void } | null`.
  `reforge_panel.tsx:776,780` calls only `.open()`, so it compiles and behaves unchanged. This is
  the whole "other consumers keep working" requirement.
- Delete `prevEpIterations` / `prevEpSimResult` from the host surface
  (`sim_host.ts:54-55`, `individual_sim_ui.tsx:88-89,132-133`) and make them private fields of
  `EpWeightsMenu`. Keeps unit 3 from having to do it while also changing markup.
- Gate: type-check; goldens byte-identical (`tools/state-snapshots`) — these fields are not
  serialised, so a golden diff means something leaked; browser smoke on the reforge popover's
  "Edit weights" button.
- Dialog: not needed.

### Unit 3 — the React dialog. **`Dialog` as-is or extended, depending on Risk 1's fork.**

`ui/features/stat-weights/components/EpWeightsDialog/` + `EpWeightsTable/`, `EpWeightsHeader/`,
`EpRatiosRow/`, `StatWeightRow/` (one component per file, per `SKILL.md:725-728`).
`view/stat_weights_panel.tsx` is deleted; `view/saved_ep_weights.ts` stays.

Mapping onto the adapter (`ui/ui-kit/Dialog/Dialog.tsx`):

| Vanilla | Dialog prop |
|---|---|
| `<h5 class="modal-title">` inserted at `:62` | `title` |
| `footer: true` + the Calculate button `:174-181` | `footer` |
| `scrollContents: true` (`:40`) | `scrollContents` |
| `size:'xl'` when `getShowThreatMetrics()` (`:41`) | `size` — bind it through `useStoreSubscribe` and defect 8 is fixed by accident; either freeze it at mount to preserve, or record an `INTENDED` entry |
| `disposeOnClose: false` (`:61`) | `keepMounted` |
| `'ep-weights-menu'` (`:61`) | `cssClass` |
| `addOnHideCallback` → abort (`:320-322`) | `onOpenChange(false)` |
| parent `simUI.rootElem` (`:61`) | `container={host.rootElem}` |

Opening from vanilla: a small controller with `subscribe` / `open()` / `isOpen()`, the
`ImportExportRegistry` shape (`ui/app/header/import_export_registry.ts:19-42`), read in React with
`useSyncExternalStore` (`ImportExportMenu.tsx:21-25`). `individual_sim_ui.tsx:294` registers the
sidebar button against it (`addAction` stays imperative), assigns it to `epWeightsModal` (which is
now `{ open() }`), and `SimApp.tsx` renders `<EpWeightsDialog/>` beside the other portals.

**Whether `Dialog` needs extending is Risk 1's fork, below.** Under fork (a) the adapter is used
as-is; under fork (b) it needs a dismiss-suppressing prop, because today's only lever,
`preventClose`, also deletes the close button (`Dialog.tsx:66-69`). That would be a `ui-kit` change
with a registry row and a change-log entry, per `SKILL.md:359-363`.

Behavioural sub-decisions to make explicit in the PR:
- Progress stays out of React. `ResultsViewer` is a `useLegacyMount` island; the tick handler
  calls `viewer.setContent(...)` off a ref. **A React file cannot author vanilla JSX**, so the
  `.results-sim` markup (`:452-467`) needs its own `@jsxImportSource @jsx-vanilla` file
  (`view/progress_content.tsx`) or a `document.createElement` builder. Only *completion* is a
  `setState`. This is `SKILL.md:1127` verbatim.
- The three ref-stat `<select>`s: vanilla sets `.value` once (`:220,229,237`) and never
  re-reads. A React `EnumPicker` bound with `storeSubscribe: p => subscribePlayerField(p,'epRefStat')`
  would additionally follow external writes — an improvement, so it needs an `INTENDED`
  entry or an explicit decision, not a silent change.
- `showAllStats` / `statsType` are the source-less `useInput` case.

- Gate: `parity.mjs` — add `['ep-weights-menu', 1]` to `PORTED_DIALOGS`
  (`tools/react-migration/parity.mjs:60-64`) and bump `PORTED_DIALOG_REACT`
  (`:67`) from 9 to 10; new `tools/react-migration/stat-weights.mjs` in the `encounter.mjs` mould
  (opens the modal from the sidebar button *and* from the reforge popover, asserts the table's
  column order and row ids, runs a 100-iteration calculation, clicks Stop, asserts the modal is
  still open); `npm run test:unit`; goldens byte-identical.

### Unit 4 — SCSS co-location. `.modal-*` casualties are the point.

`ui/scss/core/components/_stat_weights_action.scss` (203 lines) → `EpWeightsDialog.scss`.
Three rules die silently under the Dialog's markup and must be re-keyed in the same commit:

1. `ui/scss/core/sim_ui/_shared.scss:161-174` — `.sim-type--tank .ep-weights-menu .modal-footer`
   (and `.ep-ratios`, `.ep-reference-options`, `.damage-metrics`…). `Dialog` renders
   `.sim-dialog-footer`. **Screenshot `warrior/protection`** — it is in the gate spec list
   (`SKILL.md:831-832`).
2. `ui/scss/shared/_modal.scss:21-30` — `.modal .modal-scroll-table` gives the EP table its
   `overflow-y: auto` and its **sticky `<th>`**. The popup is `.sim-dialog-popup`, not `.modal`,
   so both are lost. `stat_weights_panel.tsx:132` is the only consumer of that class.
3. `ui/scss/shared/_modal.scss:32-34` — global `.modal-body { gap }`; the Dialog body is
   `.sim-dialog-body`.

Squatter check done: `results-ep-table`, `results-pending-overlay`, `unused-ep` and
`ep-weights-*` are used only by this feature. **`results-sim` is NOT** — `bulk_tab.tsx:1397`,
`bulk_sim_results_renderer.tsx:46`, `results_action.tsx:100` and
`results/model/sim_results.ts:47-55` all use it. Do not co-locate `.results-sim` rules.

- Gate: `panes-parity.mjs`, a computed-style diff on the table header (sticky/scroll), and the
  tank screenshot.

## Risks and constraint violations

**Risk 1 — the Stop button sits outside the popup. Biggest risk, and it decides unit 3's shape.**
`pendingDiv` is inserted `afterend` of `simUI.rootElem` (`:260`), i.e. a **sibling** of the whole
app — deliberately, because `.blurred` is `filter: blur(2px)` + `pointer-events: none`
(`ui/scss/shared/_global.scss:251-255`) and the modal is *inside* `rootElem`, so during a run the
modal itself is blurred and inert while the overlay stays live. Bootstrap only dismissed on a click
landing on its own `.modal` element; Base UI dismisses on any outside pointer-down. So clicking Stop
plausibly fires `onOpenChange(false)` → close → abort-on-hide, where vanilla kept the modal open.
The sibling Stop is also outside Base UI's modal focus trap, so under fork (b) it is
keyboard-unreachable regardless. Not verifiable here (no browser) — make it the first assertion in
`stat-weights.mjs`.

Risk 2 is the same decision seen from the other side, so the two resolve together as one fork:
`simUI.rootElem === dom.root` (`ui/app/sim_ui.tsx:64`, `ui/app/SimShell.tsx:69-70,83`), and
`SKILL.md:817-821` says that element's class list is React's **wholesale**; `:259/:307` add and
remove `blurred` on it with `classList`, which survives today only because `SimShell` renders once
(`SimApp.tsx:30-42`, the `useMemo`).

- **Fork (a) — `Dialog` as-is.** Re-home `blurred` from `rootElem` to `.sim-root`
  (`SimShell.tsx:84`) as shell state in `ui/app/shell_classes.ts`, and render the overlay **inside**
  `.sim-dialog-popup`. The Dialog portals into `rootElem` (`container={host.rootElem}`), so
  `.sim-root` is its *sibling*: the app blurs, the dialog does not, and Stop is inside the popup and
  therefore clickable and focus-trapped. Costs one `INTENDED` entry — the dialog is interactive
  during a run where vanilla blurred it. The delta is small, since vanilla's Escape handler
  (`base_modal.tsx:181-185`, bound on `document` at `:115`) already made close-during-run
  reachable. **Recommended.**
- **Fork (b) — `Dialog` extended.** Keep the sibling overlay and the blur on `rootElem`; add a
  prop that suppresses outside-press/Escape dismissal while keeping the close button, or forward
  Base UI's close *reason* to `onOpenChange`. Keeps vanilla's visuals exactly, but leaves the
  `classList` write on a React-owned className and leaves Stop outside the focus trap.

Note that fork (a) is *not* "render the overlay in the popup" on its own: the popup is inside
`rootElem`, so without moving the blur, `pointer-events: none` would make Stop unclickable.

**Constraint checks**
- Progress must not drive per-tick React state — satisfied by keeping `ResultsViewer` an island.
- `ui/sims/**` and `ui/features/spec_config.ts` are untouched. The panel reads
  `individualConfig.epStats` / `epPseudoStats` / `epReferenceStat` / `defaults.epWeights`
  (`:66-68,824`) and `presets.epWeights` (`saved_ep_weights.ts:36`) — all reads.
- `renderSavedEPWeights` must not port (reforge is its second consumer) — it stays vanilla behind
  `useLegacyMount`, and its `SavedDataManager` is already on the deferred list (`SKILL.md:883-885`).
- `reforge_panel.tsx:776,780` keeps working through unit 2's type widening alone.
- `parity.mjs` compares modals as an order-free set (`:36-39`), so moving construction from the
  shell constructor into a React effect is already absorbed.

## Defects noticed — recorded, not fixed

Batch into one `AskUserQuestion` per `SKILL.md:977-984`.

**Certainly wrong**
1. `_stat_weights_action.scss:128` — `.ep-weights-menu:not(.hide-threat-metrics)` is **always
   true**: `.ep-weights-menu` is on the `.modal-dialog` (`base_modal.tsx:67`) while
   `hide-threat-metrics` is on the sim root (`ui/app/shell_classes.ts:28`). The whole "tank mode"
   compact block (`:128-203`) therefore applies to every spec.
2. `stat_weights_panel.tsx:249-256` — `isRunning = true` then `return` inside the catch without
   resetting it. After one `abortType` rejection the Calculate button is permanently inert
   (`:248` returns early forever) and is never even disabled, so it looks live.
3. `:370` + `:382`/`:386` — `makeEpRatioCell` is applied to the 6 `type:'ep'` cells **and** the 6
   `type:'weight'` cells, both indexed 0-5, so `ep-ratio-0`…`ep-ratio-5` are **duplicate ids** and
   each `<label for>` matches the wrong control. Under `PickerShell`/Base UI `Field`
   (`SKILL.md:1020-1022`) this becomes visible.
4. `:508` — BooleanPicker id is `'sw-stat-toggle-' + stat.getFullName(...)`, unsanitised, so ids
   contain ASCII spaces ("Spell Hit Percent"). `:519` right beside it uses `sanitizeId(...)`.
6. `:570-571` — `if (epDelta.toFixed(2) === '0.00') epAvgElem;` is a dead expression statement.
   (The `querySelector('.type-ep .results-avg')` above it does work — the selector is matched
   against the tree and then filtered to descendants, and the `<td>` itself carries `.type-ep`.)
7. `:263`/`:309` — `container.classList.add/remove('pending')`. **No `.pending` rule exists**
   anywhere in `ui/scss`. Dead.
8. `:39-43` — `getModalConfig` reads `sim.getShowThreatMetrics()` once at construction, so toggling
   threat metrics later never resizes the dialog.

**Asymmetric — confirm intent**
5. `:473-478` — the pseudo-stat clause is not gated on `showAllStats`, unlike the stat clause, so
   "Show all stats" reveals extra `Stat`s but never extra pseudo-stats. Possibly deliberate:
   `epUnitStats` (`:678-692`) already hard-filters pseudo-stats to seven, so "all stats" may mean
   `Stat` only.

**HTML5 / a11y**
9. `:143`, `:159`, `:176` — `<button>` with no `type` (also `results_viewer.tsx:150`).
10. `:108`, `:114`, `:120` — the three `<select>`s are named by an adjacent `<span>`, not a
    `<label for>`, so they have no accessible name.
11. `:88-90` — `<option>` elements carry no `value`; selection round-trips through the *translated*
    display string (`getStatFromName`, `:85`, which also does `Object.values()` on an array).
    Locale-fragile.

**Async / lifecycle hygiene**
12. `saved_ep_weights.ts:34` and `individual_sim_ui.tsx:293` — floating `waitForInit().then(...)`
    with no `.catch`.
13. `:242` — `async` click listener; only the sim call is inside the `try`.
14. `:383` — `subscribePlayerField(...)(...)` return value (the unsubscribe) discarded.
15. `ui/ui-kit/base_modal.tsx:105-113` — `open()` pushes four hide-callbacks per open and
    `onHideCallbacks` is never cleared, so it grows without bound across open/close cycles.
    Pre-existing base-class behaviour, not stat-weights'; it disappears with the port.

**Not a defect — checked and cleared**
- `updateTable()`'s `replaceChildren` (`:482`) discards per-row pickers without `dispose()`, but
  `Input`'s `onSourceChange` self-disposes on `existsInDOM` failure
  (`ui/ui-kit/input.tsx:71-79`), so it heals on the next notification. Not a leak.
- The `epWeightsModal`-null race in `reforge_panel.tsx:776` does not exist: `buildEPWeightsToggle`
  runs inside a tippy `onShow` (`reforge_panel.tsx:537`), long after `waitForInit`.
