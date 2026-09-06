# Results metrics tables — clean-rebuild plan, read-only investigation, 2026-09-07

Worktree `~/personal/wowsims-mop-react`, branch `feature/ui-react`. Nothing was modified.

**Line numbers.** The six table files and the four `metrics_table/` files are unconflicted and are
cited as they sit in the working tree. `detailed_results.tsx` and `ui/domain/proto_utils/sim_result.ts`
carry live `<<<<<<<` conflict markers right now (`git status`: `UU`), so **every cite to those two is
against `git show HEAD:<path>`**, and is marked `@HEAD`.

**The merge in flight.** `origin/master` is being merged and the merge is mid-conflict. Fifteen paths
are unmerged; of the results feature, `combat_replay.tsx`, `detailed_results.tsx`, `log_runner.tsx`,
`proto_utils/logs.ts` and eight `timeline/**` files are among them. **None of the six table files and
none of `metrics_table/**` is conflicted or touched.** The one merge-touched file this plan reads is
`sim_result.ts`, and its whole HEAD↔master delta is the log-type rename — `SimLog`→`CombatLog`,
`DamageDealtLog`→`DamageLog`, `ResourceChangedLogGroup`→`ResourceGroupLog`,
`MajorCooldownUsedLog`→`MajorCooldownLog`, and the four `X.fromLogs` statics becoming free functions
(`buildDpsLogs`, `buildCastLogs`, `buildThreatGroups`, `buildAuraUptimes`, `buildResourceGroups`).
`ActionMetrics`, `AuraMetrics`, `ResourceMetrics` and `UnitMetrics` — everything the tables read — are
**byte-identical on both sides**. Verified by diffing `git show HEAD:ui/domain/proto_utils/sim_result.ts`
against `git show origin/master:ui/core/proto_utils/sim_result.ts` below the import block: 103 diff
lines, every one a log type.

**So the tables are merge-safe, and exactly one unit in this plan is not.** Unit 1 edits
`detailed_results.tsx`, which is conflicted. It must land after the merge resolves. Everything from
unit 3 onward touches only unconflicted files.

**The in-flight merge brings the log rewrite, and the skill is out of date about it.**
`SKILL.md:959-965` still says
*"Do not port, touch or plan around those files"*; the merge (still unresolved — `log_runner.tsx` is
`UD`, `log/**` is staged) replaces `log_runner.tsx` with
`ui/features/results/view/log/**` (`log_view.tsx`, `components/`, `search/`) and `proto_utils/logs.ts`
with `proto_utils/combat_log/`. Those files, and `timeline/rotation/rotation_view.tsx`, are now
**proper-port targets on `@tanstack/react-virtual`**, not Phase-4 islands. This plan still does not
touch them — but it says how the tables compose with them (§1, "How the tables compose with the log
and rotation ports") rather than treating them as permanently out of bounds. `SKILL.md:32,81` and
`:959-965` both need updating when the first of the three ports lands.

---

## 0. The parity surface — verified, and it decides the plan's shape

The claim under test: the detailed-results pane serialises to a small, sim-free tree because no gate
runs a sim. **Confirmed, and it is stronger than "empty".**

**No gate runs a sim before serialising the pane.**

- `parity.mjs:128-141` serialises `#<id>` for every tab id at load, immediately after
  `openSpec(...)` waits on `.sim-sidebar, .sim-ui` (`:118`). The results pane's id is
  `detailed-results-tab` — `sim_ui.tsx:172` builds it as `cssClass.replace(/\s+/g,'-') + '-tab'` from
  `individual_sim_ui.tsx:334`'s `'detailed-results-tab'`… which makes the actual id
  `detailed-results-tab-tab`. Either way it is in `window.simTabsProbe.ids()` and is compared.
- `panes-parity.mjs:44-53` clicks each tab by position, waits `SETTLE = 1000` ms, and serialises the
  pane. No Simulate click anywhere in the file.
- `/usr/bin/grep -rn "simulate\|runSim" tools/react-migration/*.mjs` returns **nothing** outside
  `stat-weights.mjs`, which drives the EP-weights dialog and never opens the results tab.

**And `SERIALIZE` is structure only.** `browser.mjs:43-55` emits `tag` + sorted class list + depth.
`browser.mjs:39` says so in prose: *"Structure only: tag + sorted class list + depth… Text and
attributes"* are excluded. `tabs-a11y.mjs` covers attributes; nothing covers text in this pane.

**What that means concretely — and the correction to "the tables are empty".** The tables are *not*
empty at load. `MetricsTable`'s constructor builds the whole shell eagerly (`metrics_table.tsx:49-81`):
the `<table class="metrics-table tablesorter">`, `<thead class="metrics-table-header">`, the
`<tr class="metrics-table-header-row">`, one `<th class="metrics-table-header-cell …">` per column
carrying its `columnClass` and `headerCellClass` tokens, a `<span>` inside each, and an empty
`<tbody class="metrics-table-body">`. Only `<tbody>`'s rows wait for a sim.

Counting the shell from the source: damage 10 columns, healing 12, dtps 9, buffs 4, debuffs 4, casts 3,
and **15** resource sub-tables of 6 columns each (`orderedResourceTypes`, `utils.ts:82-98`), each
wrapped in a `.resource-metrics-table-container` + title span (`resource_metrics.tsx:31-35`). Table
shells alone are ~385 serialised lines; the `dr-root` scaffolding (10 nav items, 11 panes, the
`dr-row` divs, the two control buttons) is another ~67; the filter's `UnitPicker` and the
timeline/replay/log constructors make up the rest. **~585 is consistent with the source**, and the
number is spec-independent because every column count, every class token and the 15-entry resource
list are constants — only text varies (the secondary-resource title,
`resource_metrics.tsx:26-30`), and text is not serialised.

### The real exposure, stated as a rule

> At load, both parity gates compare **tag + sorted class list + depth** for the full table shell:
> the table element, the header row, every `<th>` with its exact class tokens, the `<span>` inside it,
> and an empty `<tbody>`. They compare **nothing** about rows, values, sort order, tooltips or text.
> After a sim, nothing compares anything at all.

**Fork A — the plan's spine. Must be decided before unit 3.**

- **(a) Faithful empty shell.** React renders the same shell unconditionally: same tags, same class
  tokens including `columnClass` on the `<th>`, an always-present empty `<tbody>`. Both gates stay
  byte-identical, every unit lands independently, and no gate file changes. Cost: the header must be
  built from column defs even with no data — trivial with TanStack, whose `getHeaderGroups()` is
  derived from the column defs, not from rows. **Recommended.**
- **(b) Conditional render.** `result && <table>` — the React idiom. Deletes ~385 lines from the pane
  at load and fails both gates on all six specs. It needs a `dropSubtrees` entry per table root on the
  baseline with a count guard, the `IMPORT_EXPORT` / `DROPDOWN_MENU` pattern (`parity.mjs:87-100`) —
  one gate change per table, six times, each an assertion that the baseline had exactly N shells.

Take (a). It is the same call `SKILL.md` already records for `showWhen`: *"the `hide` class survives
only as long as the parity gate does… when Phase 5 retires the vanilla comparison, the idiom becomes a
conditional render as the plan always said."* The empty shell is that rule applied to a table.

One consequence of (a): **`.tablesorter` is a dead class** — `/usr/bin/grep -rn tablesorter` over
`ui/` and `assets/` returns only `metrics_table.tsx:50` (the class) and `:146` (a comment about the
jQuery plugin it replaced); no stylesheet, no script. Under (a) it must still be emitted, or it needs
an `INTENDED` entry. Emitting it is one word; deleting it is a separate cleanup with a gate change.
Recommend emitting it and recording the deletion for unit 8.

---

## 1. Map

`SimResult` reaches every one of these through one `Emitter<SimResultData | null>` owned privately by
`DetailedResults` (`detailed_results.tsx@HEAD:90`), fanned out at `:418` / `:421-424` after
`SimResult.fromProto` resolves. `ResultComponent` (`result_component.ts:16-74`) is the base: it
subscribes at `:29-38`, stores `lastSimResult`, and — for `deferUntilShown` components — replays on
`onTabShown()` (`:40-46`).

`MetricsTable<T>` (`metrics_table.tsx:36`) extends `ResultComponent` and is the shared core. Six
subclasses; **21 live instances** (damage 1, healing 1, dtps 1, casts 1, aura 2, resource 15).
Nothing outside `ui/features/results/` imports `metrics_table` — verified.

| File | Renders | Columns | Sort | Grouping / expansion | Tooltips | Total bar | Data source |
|---|---|---|---|---|---|---|---|
| `metrics_table/metrics_table.tsx` (240) | the shared shell: `table.metrics-table.tablesorter > thead > tr > th×N > span`, `tbody` | — | header `<th>` click → `TableSorter`; default from the one column with `sort` (`:83-92`) | `addGroup` (`:136-163`) merges a group into a parent row + child rows, click toggles `.expand` / `.hide` | one tippy per `<th>` with `tooltip` (`:74-77`) | — | `getGroupedMetrics(SimResultData)` (abstract, `:206`) |
| `metrics_table/table_sorter.ts` (104) | — (mutates `tbody`) | — | the whole sort: parse `dataset.text ?? innerText` (`:74-84`), sort parents, sort each parent's children by the **same** column, `replaceChildren` (`:46-61`) | reads `.child-metric` to build the parent/child tree (`:87-102`) | — | — | the DOM |
| `metrics_table/metrics_total_bar.tsx` (41) | `.metrics-total` — percentage, a `--percentage`-driven fill bar, an optional darkened overlay, a compact total | — | — | — | — | **is** the bar | props |
| `metrics_table/metrics_combined_tooltip_table.tsx` (105) | a tippy whose content is a nested `.metrics-table` of groups × rows, each row a `MetricsTotalBar` | Type / Count / (Average) | rows sorted by value desc (`:78`) | group header rows | **is** the tooltip | nested | props |
| `damage_metrics.tsx` (460) | the damage tab's table | 10: Name, Damage Done, Casts, Avg Cast, Hits, Avg Hit, Crit %, Miss %, DPET, **DPS** | DPS desc (`:386`) | player action groups + one group per pet name (`:429-448`); `shouldCollapse` false for pets (`:457`) | 7 combined tooltips: damage breakdown, hit/miss, threat ×3 (`:181,306,397` gated on `.hide-threat-metrics`), hits breakdown, miss breakdown | primary-metric cell | `player.getDamageActions().forTarget(filter)` → `ActionMetrics.groupById`; pets via `ActionMetrics.joinById` |
| `healing_metrics.tsx` (332) | the healing tab's table | 12: Name, Healing Done, Casts, CPM, Cast Time, Avg Cast, Hits, Avg Hit, HPM, Crit %, HPET, **HPS** | HPS desc (`:262`) | same shape (`:306-331`) | 5, incl. 3 threat-gated (`:104,221,274`) | primary-metric cell, **with `overlayValue={metric.shielding}`** (`:44`) — the only overlay user | healing actions |
| `dtps_metrics.tsx` (342) | the damage-taken tab's table | 9: Name, Damage Taken, Casts, Avg Cast, Hits, Avg Hit, Miss %, Crit %, **DTPS** | DTPS desc (`:312`) | **targets**, not the player: `getTargets(filter).getDamageActions().forTarget({player})` (`:321-330`); no `shouldCollapse` override | 5, **none** threat-gated | primary-metric cell | target actions |
| `cast_metrics.ts` (57) | the casts tab's table | 3: Name, Casts, CPM | Casts desc (`:20`) | player + one group per pet (`:33-46`) | none | none | `player.actions.filter(casts != 0)` |
| `aura_metrics.ts` (75) | the buffs and the debuffs tabs (two instances, `useDebuffs` flag) | 4: Name, Procs, PPM, Uptime | Uptime desc (`:36`) | debuffs: `getDebuffMetrics(filter)`; buffs: player auras (pets filtered out, `:71-73`) + one group per pet | none | none | `AuraMetrics.groupById` |
| `resource_metrics.tsx` (113) | `ResourceMetricsTable` is a plain `ResultComponent` that builds **15** `.resource-metrics-table-container`s, each holding a `TypedResourceMetricsTable`; each container's `hide` follows its table's `onUpdate` (`:38-45`) | 6: Name, Casts, Gain, Gain/s, Avg Gain, Wasted Gain | Gain desc (`:72`) | `ResourceMetrics.groupById`; **no `shouldCollapse` override** | none | none | `player.getResourceMetrics(type)` |

Two behaviours in the map that are easy to miss:

- **`maxDamageAmount` is computed by a second, earlier subscription.** `damage_metrics.tsx:16-23`
  (and `:15-21` in healing and dtps) registers `config.resultsEmitter.on(...)` **before** calling
  `super(config, …)` at `:24`. It works only because `Emitter` fires listeners in registration order,
  so the max is in place by the time `MetricsTable.onSimResult` renders the bars.
- **`onUpdate`** (`metrics_table.tsx:41`, emitted at `:174,181`) exists for exactly one consumer:
  the resource containers' hide/show.

### Scope boundary

**In — "the metrics tables":**

```
ui/features/results/view/metrics_table/metrics_table.tsx
ui/features/results/view/metrics_table/table_sorter.ts
ui/features/results/view/metrics_table/metrics_total_bar.tsx
ui/features/results/view/metrics_table/metrics_combined_tooltip_table.tsx
ui/features/results/view/damage_metrics.tsx
ui/features/results/view/healing_metrics.tsx
ui/features/results/view/dtps_metrics.tsx
ui/features/results/view/cast_metrics.ts
ui/features/results/view/aura_metrics.ts
ui/features/results/view/resource_metrics.tsx
                                                     1,769 lines
+ the construction block in detailed_results.tsx@HEAD:231-274 (six `new XMetricsTable`)
+ ui/scss/core/components/_detailed_results.scss:119-278 and
  ui/scss/core/components/detailed_results/_resource_metrics.scss
```

**Out — untouched, and why:**

| File | Why |
|---|---|
| `result_component.ts` | Timeline, CombatReplay, LogView, DpsHistogram, ToplineResults and ResultsFilter all extend it. Bypass it; do **not** delete or modify it. |
| `combat_replay.tsx` (1,086, rAF) and `timeline/chart/**` (Chart.js), `dps_histogram.ts` (Chart.js) | Canvas. Not virtualisation targets, no instruction has changed for them, and `combat_replay.tsx` is conflicted right now. |
| `results_action.tsx` (648), `results_viewer.tsx`, `topline_results.ts` | The sidebar results panel and the run manager. `topline_results.ts:23` calls `SimResultsManager.makeToplineResultsContent` — a static on `results_action.tsx`. Out. |
| `results_filter.ts` | **A seam, not out of scope — see Risk 3.** The tables need its `getFilter()` output; the filter itself does not port. |
| `ui/sims/**`, `ui/features/spec_config.ts` | Frozen (`SKILL.md:301-306`). The tables read neither. Verified: no import of either in any in-scope file. |

**Out of *this plan*, but no longer permanently out of bounds:** `log/log_view.tsx` and
`timeline/rotation/rotation_view.tsx`. The Phase-4 island framing (`SKILL.md:32,81`) is out of date for
those two — they are proper-port targets on `@tanstack/react-virtual`. The next subsection is how the
tables compose with them.

### How the tables compose with the log and rotation ports

The three views live in the same pane and share one base class, so "port them in any order" is not
free. What they actually share, measured:

| Shared | Evidence | Consequence for order |
|---|---|---|
| **The `SimResult` subscription path** | `MetricsTable`, `LogView` (`log/log_view.tsx:30`) and `Timeline` all `extends ResultComponent`, all fed by the one private `Emitter` in `detailed_results.tsx@HEAD:90`. `LogView` also reads `resultData.filter` exactly as the tables do (`log/log_view.tsx:23-28`). | **This is the argument for tables first.** Unit 1's `ResultChannel` is the seam all three need, and it is the only way any of them reaches React. Building it for the tables *hands it to* the log and rotation ports; building it for the log first would hand it to the tables. Either way it must be built once, as a general seam — which is why unit 1 is written as "the result seam", not "the tables' data source". |
| **`deferUntilShown` and the nested Bootstrap tab strip** | `detailed_results.tsx@HEAD:275-313` hooks `shown.bs.tab` / `hide.bs.tab` for Timeline, CombatReplay and LogView. `SKILL.md:133-136` says the three inner strips stay. | **The metrics tables do not use it** — they render eagerly. So the tables port without touching that machinery, and nothing about them forces the log or rotation to undo anything. The constraint runs the other way: unit 3 onward must portal into the existing `.cast-metrics` / `.damage-metrics` / … divs and leave `detailed_results.tsx` owning `dr-root` and the panes. **React must not take over the pane shell while the log, replay and timeline still depend on `shown.bs.tab`.** That shell port is the last unit across all three views, not part of this one. |
| **The `ActionId` DOM writers** | 8 files call `setActionIdBackgroundAndHref` / `setActionIdWowheadDataset` / `setActionIdBackground` / `setActionIdWowheadHref`: `metrics_table.tsx:220-236`, `log/components/action_link.tsx:3,17-19`, `rotation_view.tsx:2`, `combat_replay.tsx`, plus gear ×2 and apl. `SKILL.md:357` already lists `ActionIcon` as not-yet-built. | **Do not build a shared `ActionIcon` in unit 3.** The markup genuinely differs — the table's name cell is a bare `a.metrics-action-icon` with a background image, while `ActionLink` is a labelled anchor wrapping a `span.icon.icon-sm` — and `SKILL.md:395-414` says an abstraction that fixes the axis which actually varies is the one that gets bypassed. Build the name cell on the existing `useActionId` hook (`ui/ui-kit/hooks/useActionId.ts`, registry row `SKILL.md:319`), which returns `{ iconUrl, name, href }` — data, not a node. Extract `ActionIcon` when the log port becomes its second consumer, per the rule every other primitive here follows. |
| **The icon cache** | `cachedMetricsTableIcon` (`metrics_table.tsx:34,221,235`) `cloneNode()`s a resolved `<a>` keyed on `actionId.toString()`. | Dissolves under React: `useActionId` yields a URL, and rendering a `background-image` from a memoised URL needs no node cloning. Nothing here to hand forward or to undo — but see Risk 8, the key must stay `toString()`. |
| **Virtualisation** | `ui-kit/virtual_list.ts` has exactly **two** importers in the whole tree: `log/log_view.tsx:6,31,125` and `gear/view/item_list.tsx:19,83,237`. Not rotation (not virtualised today), not any table. | Independent. The tables neither need `@tanstack/react-virtual` nor block it — see the virtualisation subsection in §3. |
| **SCSS** | **Zero overlap.** `/usr/bin/grep -rn "metrics-table\|metrics-action\|metrics-total\|parent-metric\|child-metric\|expand-toggle"` over `view/log/` and `view/timeline/` returns nothing, and the log and rotation own separate partials (`_log_runner.scss`, `_timeline_rotation.scss`, `_rotation_floating_action_bar.scss`). | Unit 8's co-location of `_detailed_results.scss:119-278` cannot disturb either. |

**Recommended order: tables → log → rotation → the pane shell.** Not because the tables are more
important, but because (i) the seam has to be built once and the tables are the cheapest place to prove
it, (ii) the tables are the only one of the three that the in-flight merge does not touch, and (iii)
the tables are the only one that does not depend on `shown.bs.tab`, so they can land while that
machinery is still Bootstrap's. The one thing that *would* force an undo is porting the pane shell
early; this plan defers it to after all three views are React, and unit 8 explicitly does not touch it.

**And the `@tanstack/react-table` verdict does not lean on any of this.** It stands on the recursive
sub-row sort in §3 alone, and would stand if the log and rotation were never ported.

---

## 2. What a rebuild must reproduce, and what it may drop

### Must reproduce

1. **The empty shell at load**, tag- and class-identical (fork A(a) above). Including `.tablesorter`.
2. **The sort.** `TableSorter` (`table_sorter.ts:35-62`): numeric if both values parse as floats, else
   `localeCompare`; parents sorted, then **each parent's children sorted by the same column and
   direction and kept adjacent to their parent**. This is the single behaviour a table library either
   has or does not — see §3.
3. **The sort's toggle semantics.** `sortDesc` starts all-`true` (`:27`), the configured default column
   is overwritten with its `ColumnSortType` (`:28`), and `setSort` **flips before applying** (`:68-70`).
   So: the default column opens descending; a first click on any other column gives **ascending**; a
   third click never clears the sort; there is no multi-column sort.
4. **`addGroup` expand/collapse** (`metrics_table.tsx:136-163`): a group of >1 renders a merged parent
   row (`.parent-metric.expand`) plus N `.child-metric` rows, **expanded by default on every new
   result**; clicking the parent toggles `.expand` on it and hides the children — vanilla does that
   with a `.hide` class, React will do it by unmounting (§3). What must be reproduced is *"collapsed
   children are not visible and the parent's caret flips"*, not the class. A group of exactly 1
   collapses to a plain row
   **unless** `shouldCollapse` says otherwise — which is how a single-pet group keeps its parent row
   (`damage_metrics.tsx:457`, `healing:329`, `cast_metrics.ts:53`, `aura_metrics.ts:69`).
5. **The four class contracts the stylesheet reads** (`_detailed_results.scss:210,223,227,231,235-236`):
   `.parent-metric` (cursor), `.parent-metric.expand` (which caret shows), `.child-metric > :first-child`
   (indent), `tr:not(.parent-metric) .expand-toggle` (hidden). Both carets are always in the DOM
   (`metrics_table.tsx:230-231`); CSS picks one.
6. **`MetricsTotalBar`** verbatim, `--percentage` custom property and all — including the shielding
   overlay, whose only user is healing.
7. **The combined tooltips.** Nine distinct shapes across three files.
8. **The threat veto.** `damage_metrics.tsx:181,306,397` and `healing_metrics.tsx:104,221,274` pass
   `tooltipConfig.onShow` returning `false` when `document.querySelector('.hide-threat-metrics')`
   matches. That class is set on `DetailedResults`' root from `sim.getShowThreatMetrics()`
   (`detailed_results.tsx@HEAD:315,384`).
9. **`customizeRowElem`'s `threat-metrics` row class** — `damage_metrics.tsx:423-427` adds it when
   `hitAttempts == 0 && dps == 0`, so the `hide-threat-metrics` root class hides those rows.
10. **The icon resolution, not the node cache.** `MetricsTable.nameCellConfig` (`:208-239`) keys a
    `CacheHandler` on `actionId.toString()` and `cloneNode()`s the cached `<a>` rather than
    re-resolving. What must survive is that ~40 rows do not each re-resolve an `ActionId` per sim;
    what may go is the DOM-node cloning, which exists only because vanilla had no other way to reuse
    the work. `useActionId` (`ui/ui-kit/hooks/useActionId.ts`, `SKILL.md:319`) returns
    `{ iconUrl, name, href }` — data — so a memo on the same `toString()` key does the job. Recorded
    trap: `ActionId.toString() ≠ equals()`, so keep that exact key (Risk 8).
11. **The resource containers' hide/show** driven by whether the sub-table has rows.
12. **`ResourceMetricsTable`'s ordering** — 15 containers in `orderedResourceTypes` order, always all
    15 in the DOM.

### May deliberately drop

| Drop | Evidence |
|---|---|
| `TableSorter`'s DOM round-trip — sorting by re-reading `dataset.text ?? innerText` and `replaceChildren`ing `<tr>` elements | `table_sorter.ts:74-84,60`. A React table sorts the model. |
| `ColumnSortType.None` and `.Ascending` | Zero uses. All six tables use `Descending` (`cast_metrics.ts:20`, `dtps:312`, `healing:262`, `resource:72`, `damage:386`, `aura:36`). `None` is `0`, so `!!v.sort` treats it as unset anyway. |
| The `isChildRow` parameter, threaded through `getValue`, `getDisplayString`, `fillCell` and `customizeRowElem` | Passed at `metrics_table.tsx:117,123,125,132`, **read by no column in any of the six files**. |
| `fillCell(metric, cellElem, rowElem, isChildRow)` as an imperative escape hatch | Replaced by a `cell` render function. The `rowElem` argument is used by nobody — `customizeRowElem` does the row work. |
| `onUpdate: Emitter<void>` | One consumer (`resource_metrics.tsx:38-45`), which becomes "render the container only when the child table has rows". |
| `.tablesorter` | Dead — but see fork A. Drop it in unit 8 with an `INTENDED` entry, not earlier. |
| `MetricsCombinedTooltipTable` returning `<></>` while calling `tippy()` as a side effect | `metrics_combined_tooltip_table.tsx:44-104`. Not a component; must be rebuilt as one. |
| The pre-`super()` `resultsEmitter.on` for `max*Amount` | `damage:16-23`, `healing:15-21`, `dtps:15-21`. In React the max is derived from the same rows the table renders. |

---

## 3. TanStack Table — **adopt it**

**Not installed.** No `tanstack` string in `package.json`; no `node_modules/@tanstack`. Latest is
`@tanstack/react-table` **9.2.4**; the last v8 is **8.21.3** (peer `react >=16.8`, v9 peer `react >=18`
— both fine on React 19).

### The discriminating check

There is exactly one behaviour that decides this, because it is the one thing hand-rolled here that a
generic table library usually does *not* do: **sorting must recurse into child rows with the same
column and direction, and expansion must keep children adjacent to their parent.** That is
`table_sorter.ts:53-59` and `metrics_table.tsx:149-163`.

Read off the published source (`@tanstack/table-core@8.21.3/src/utils/getSortedRowModel.ts`):

```ts
// If there are sub-rows, sort them
sortedData.forEach(row => {
  sortedFlatRows.push(row)
  if (row.subRows?.length) {
    row.subRows = sortData(row.subRows)
  }
})
```

`sortData` closes over the same `availableSorting` / `columnInfoById`, so a sub-row list is sorted by
the same column and the same `desc` flag as its parents. That is `table_sorter.ts:53-59` exactly, and
it is the strongest single piece of evidence in this section.

And `@tanstack/table-core@8.21.3/src/utils/getExpandedRowModel.ts`:

```ts
const handleRow = (row: Row<TData>) => {
  expandedRows.push(row)
  if (row.subRows?.length && row.getIsExpanded()) {
    row.subRows.forEach(handleRow)
  }
}
```

Children are interleaved immediately after their parent, and only while expanded — `addGroup`'s
`.hide` toggle, expressed as a model. Note `getExpandedRowModel` returns the un-expanded model unless
`paginateExpandedRows` (default `true`); with no pagination row model in play, the default is what we
want and nothing needs setting.

**One implementation choice this forces, decided here.** `expandRows` *omits* a collapsed row's
children from `rows`, so they **unmount** — vanilla keeps them in the DOM with `.hide`
(`metrics_table.tsx:158-162`). Two options: (a) use `getExpandedRowModel` and let collapsed children
unmount; (b) render all of `row.subRows` unconditionally and toggle a `hide` class off
`row.getIsExpanded()`, keeping vanilla's DOM. **Take (a)** — it is the React idiom, it happens only
after a sim where no gate compares trees, and `.hide` on a `<tr>` was never a contract anything else
reads (`_detailed_results.scss` styles `.child-metric` and `.parent-metric.expand`, never
`.child-metric.hide`). The consequence is that unit 2's gate must assert *visibility*, not the class —
which is why it is written that way.

**So `TableSorter` (104 lines) + `addGroup` (28 lines) + `sortMetrics` (13 lines) — 145 lines of
hand-rolled model code — are replaced by four imports and two config flags.** That is the whole case.

### Why this is not the react-query verdict

`SKILL.md:454-479` declined TanStack Query on four structural grounds. Three of them invert here:

| react-query's reason | Here |
|---|---|
| "The React surface is two call sites" | **21 live table instances across 6 table types.** All of them port; none is vanilla-only. |
| "A sim run is a promise racing a stream, not a query" — wrong shape | Sorting recursive sub-rows and interleaving expanded children is *bit-for-bit* the shape TanStack ships. Verified above, not recalled. |
| "The configuration would be all-off" — every option overriding a default | Three overrides (below), not "every one". The two row models we import *are* the feature. |
| "`computeStats` output is store state" — a cache would fork it | No cache. `useReactTable` holds sorting and expansion state, which is UI-local by definition. |

The one honest cost that carries over: this is a **new dependency for a feature we already have
working**. The answer is that we do not have it working *in React* — `TableSorter` reads
`cell.innerText`, `replaceChildren`es `<tr>` nodes and rebuilds a parent/child tree by scanning class
names. None of that survives a React rewrite, so the choice is not "keep 145 lines" but "rewrite 145
lines of model code against a virtual DOM, or import them".

### What we use, and what we do not

**Used:** `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getExpandedRowModel`, `getSubRows`,
`createColumnHelper` / `ColumnDef`, `flexRender`, `header.column.getToggleSortingHandler()`,
`row.getToggleExpandedHandler()`, `row.getIsExpanded()`, `row.depth`, `columnDef.meta` (for
`columnClass` / `headerCellClass`).

**Not used, and why:** filtering (the target filter is a *data* filter applied before the rows are
built — `results_filter.ts:41-45`); pagination; column grouping (TanStack's is aggregate-by-column;
ours is merge-a-group-of-metrics, which happens in the model *before* the table sees it); column
visibility (`hide-threat-metrics` is a CSS class on the root, not a column toggle); column resizing;
row selection; faceting; global filter.

**No provider.** `useReactTable` is a plain hook; nothing is required at the app root. That matters —
it means a single table can port on its own, which is what makes the units below independently
landable.

**Bundle.** bundlephobia reports `@tanstack/react-table@8.21.3` at **14,116 bytes min+gzip** including
its one dependency (`@tanstack/table-core`). Row models are separate exports and tree-shake; the four
we import are a subset. Confirm the real figure off the installed `dist` in unit 3 rather than
trusting the headline.

**Version.** Everything above is verified against **8.21.3**. v9.2.4 has shipped and is a restructure —
`src/utils/getSortedRowModel.ts` does not exist at that path any more. **Verify both row models again
before pinning v9**; if the recursion is not there, pin 8.21.3.

### Six behaviour deltas that need explicit configuration

Not defects in TanStack — differences from `TableSorter` / `addGroup`, each of which would ship
silently:

1. **`enableSortingRemoval` defaults to `true`** — a third header click clears the sort. `TableSorter`
   never clears (`:67-71`). Set `enableSortingRemoval: false`.
2. **`enableMultiSort` defaults to `true`** — shift-click adds a second sort column. `TableSorter` has
   no such thing. Set `enableMultiSort: false`.
3. **`sortDescFirst` defaults per column by inferred value type** (descending-first for numeric
   columns in v8). `TableSorter`'s first click on a non-default column gives **ascending** for every
   column, numeric included (`sortDesc` starts `true`, `setSort` flips it to `false` — `:27,68-69`).
   Set `sortDescFirst: false` on every column, and `sortDescFirst: true` on the one default column, or
   seed `state.sorting` with `{ id, desc: true }` and let the flip fall out.

4. **`expanded` defaults to `{}` — everything collapsed.** `addGroup` sets `expand = true` on every
   parent (`metrics_table.tsx:154-155`). Set `initialState.expanded: true` (the boolean form means
   *all*).
5. **`expanded` persists across `data` changes; vanilla's does not.** Vanilla rebuilds every row on
   every result (`metrics_table.tsx:169,178`), so a new sim always comes back fully expanded. TanStack
   keeps its `expanded` state. Row ids are index-based by default, so persisted per-row expansion
   would re-attach to the *wrong* rows after a re-sim. Use the boolean `true` form and reset it on
   each snapshot, or verify `autoResetExpanded`'s default on install — do not leave it to chance.
6. **`data` must be referentially stable.** `useReactTable` re-initialises when `data`'s identity
   changes, which is the documented v8 footgun (state loss, render loops). The channel's
   `getSnapshot()` must return the same object until the next `emit` — `SKILL.md:425` records
   `useSyncExternalStore` treating a new snapshot identity as a change — and the table's rows must be
   `useMemo(() => buildGroups(snapshot), [snapshot])`.

Also: `TableSorter` sorts the **Name** column by the cell's `innerText` (no `getValue` on
`nameCellConfig`, so `parseRowValues` falls through to `innerText` — `:78`), which includes whatever
the caret spans contribute. A TanStack `accessorFn: m => m.name` sorts the actual name. That is an
improvement and therefore a **delta to declare**, not a silent change.

### Virtualisation — **no metrics table needs it**

`@tanstack/react-table` does not virtualise; `@tanstack/react-virtual` is the sibling package and
TanStack documents composing them. Checked, and the answer for **these tables** is no:

- `ui-kit/virtual_list.ts` has exactly **two** importers in the whole tree —
  `ui/features/results/view/log/log_view.tsx:6,31,125` and `ui/features/gear/view/item_list.tsx:19,83,237`.
  Nothing under `metrics_table/` and none of the six table files references it, and neither does
  `rotation_view.tsx`.
- Row count is bounded by *distinct spells a spec casts*, not by fight length: damage rows are
  `ActionMetrics.groupById(player.getDamageActions())` plus one per pet name
  (`damage_metrics.tsx:429-448`) — tens, not thousands. Only the log is unbounded (one row per
  combat-log line), which is exactly why only the log virtualises.
- The rows are also the wrong shape for a fixed-row-height virtualiser: the primary-metric cell
  contains a `MetricsTotalBar`, and `_detailed_results.scss:132-135` lets cells wrap below the 1080p
  breakpoint, so row height is not constant. `ui-kit/virtual_list.ts:4` is explicitly *"A
  fixed-row-height virtual list."*

**Three separate decisions, kept separate.** `item_list.tsx` (810 lines) and `log/log_view.tsx` are
genuinely virtualised today and earn `@tanstack/react-virtual` on their own evidence;
`rotation_view.tsx` is not virtualised today and would gain it as a new capability. **The metrics
tables must not borrow any of those justifications, and none of them is a reason to reject
`react-table` here.** The one joint consideration, noted and *not* leaned on: if `item_list` and the
log adopt `@tanstack/react-virtual` anyway, a second package from the same vendor is a smaller
marginal cost than a first. That is worth a sentence in the PR and nothing more — `react-table` is
adopted here on the sub-row sorting evidence alone, and would be adopted if the other three chose a
different virtualiser entirely.

### Tooltips — a second decision the rebuild must make

`MetricsCombinedTooltipTable` is not portable: it returns `<></>` and calls `tippy()` during JSX
evaluation as a side effect (`metrics_combined_tooltip_table.tsx:44-104`). Two sub-decisions:

- **One `<Tooltip>` per cell vs. one shared `<Tooltip id render={…}>` with `data-tooltip-id` on the
  cells.** The damage table alone carries 7 tooltip columns × ~40 rows ≈ 280 anchors. `SKILL.md:522`
  records that react-tooltip *"is `children`, and not rendered until the tooltip first opens"*, so
  per-cell is probably affordable — but 280 mounted `<Tooltip>` components is 280 floating-ui
  instances. **Recommend the shared-id shape**: one `<Tooltip>` per column, `render={({activeAnchor}) =>
  …}` reading the row from a `data-row-index` on the cell. Measure before committing.
- **The threat veto has no react-tooltip equivalent.** tippy's `onShow → return false` is gone. It
  becomes a read of `sim.getShowThreatMetrics()` through `useStoreSubscribe`, which also deletes the
  document-wide `querySelector('.hide-threat-metrics')` from six places. An improvement, so it needs a
  declared delta.
- **`placement: 'auto'` (`:46`) is not a react-tooltip `place`.** `SKILL.md:520-534` maps
  `placement → place`, but react-tooltip's `place` is a fixed side. The nearest equivalent is a fixed
  `place` plus its own flip behaviour. Note the gap; pick a side and check it in the browser.

---

## 4. Recommended units, smallest first

Each is independently landable and independently gated. **Units 1–2 must land after the merge
resolves** (unit 1 edits a conflicted file; unit 2's gate opens the results tab, whose contents the
merge changes). Units 3–8 touch only unconflicted files.

### Unit 1 — the result seam. No React, no markup.

React cannot reach the results today: `resultsEmitter` is a **private** field of `DetailedResults`
(`detailed_results.tsx@HEAD:90`), and `DetailedResults` is constructed inside
`individual_sim_ui.tsx:336` and never stored. Nothing else in the plan is possible until that changes.

Add `ui/features/results/model/result_channel.ts` — a `ResultChannel` with `emit(SimResultData | null)`,
`subscribe(cb): () => void` and `getSnapshot(): SimResultData | null`. That is the
`ImportExportRegistry` shape (`ui/app/header/import_export_registry.ts:19-42`) that the stat-weights
port already used for opening a React dialog from vanilla, read in React with `useSyncExternalStore`.
`DetailedResults` owns one, passes it where it passes the `Emitter` today (it is a superset of
`Emitter`'s `on`/`emit`, so `ResultComponentConfig` needs no change), and `individual_sim_ui`
assigns it to a host field alongside `epWeightsModal` (`sim_host.ts:53`).

**`getSnapshot` is not decoration** — it is the React equivalent of `ResultComponent`'s
`lastSimResult` replay (`result_component.ts:40-46`). Without it, a table that mounts after a sim has
already run shows nothing. **It must return the same object identity until the next `emit`**:
`useSyncExternalStore` treats a new snapshot identity as a change (`SKILL.md:425`), and
`useReactTable` re-initialises when `data`'s identity moves (§3, delta 6). Store the last emitted
value in a field and return it; never build one in the getter.

**A sim result stays an event, not store state** (`ui/domain/state/README.md:81-82`). The channel is
deliberately *not* a Zustand slice, for the reason `SKILL.md:787-789` gives: the sim store is written
constantly and everything in it re-renders every consumer. And the constraint that matters most:
**the worker progress callback must never drive per-tick React state** (`SKILL.md:1152-1156`,
`:1370-1378`) — the channel is fed once per completed run from
`detailed_results.tsx@HEAD:389-424`, after `SimResult.fromProto` resolves. It is never on the progress
path. Assert that in the unit test.

- Gate: `npm run test:unit` (a new suite for the channel); `npm run type-check`; `parity.mjs` and
  `panes-parity.mjs` **byte-identical** — no DOM moved; `npm run test:snapshots` byte-identical.

### Unit 2 — `tools/react-migration/results-tables.mjs`, landed green on today's vanilla build.

**Before any table ports.** `SKILL.md:138-146`: *"the gates are rewritten to shape-agnostic invariants
before the swap, against the current build, because a gate rewritten in the same commit as the change
it gates proves nothing."*

The `stat-weights.mjs` mould: one build per run (`PORT` env, `IS_BASE`), invariants rather than
cross-build equality. **That choice is forced here** — there is no page-global handle on `sim`
(`/usr/bin/grep -rn "window\.\(simUI\|sim\)\s*="` over `ui/` returns nothing), so the gate cannot set a
fixed RNG seed, so two builds sim different fights and no number can be compared across them. Assert
invariants instead:

- **Before the sim:** open the results tab; every table's `tbody` has 0 rows; every table's `thead`
  has the expected column count and class tokens, per table. *This is the fork-A(a) assertion.*
- **Run it:** click `.detailed-results-1-iteration-button` (`detailed_results.tsx@HEAD:205-207`) —
  one iteration, fast, and it is the pane's own control. It is `disabled={simUI.disabled}` at
  construction (`@HEAD:206`), so **wait for it to be enabled** before clicking.
  `waitForFunction(() => !document.querySelector('.dr-no-results'))` (set/cleared at `:417,420`).
- **After the sim, per tab:** `tbody` has ≥1 row; the default column's values are non-increasing
  down the parent rows; the first column is non-empty on every row.
- **Sorting:** click header *i*; assert column *i* is now non-decreasing (the first-click-ascending
  rule, `table_sorter.ts:68-69`); click again; assert non-increasing. **Column 0 is a string sort**
  (`localeCompare`, `table_sorter.ts:41`), so the comparison needs a string branch for it.
- **Sub-row adjacency — the contract §3 is bought for:** find a `.parent-metric`, record its
  `.child-metric` block, re-sort on another column, assert the same children still immediately follow
  the same parent and are themselves ordered by the new column.
- **Expansion — assert visibility, never a class.** Click a `.parent-metric`; assert it loses
  `.expand` and that its children are no longer visible (`offsetParent === null`, which is true both
  for vanilla's `.hide` and for React's unmount — count them rather than querying for `.hide`); click
  again; assert both revert. **This is the shape-agnostic form the whole gate depends on**: vanilla
  hides children with a class, the port unmounts them (§3), and a gate that asserts `.hide` would go
  red in unit 3 for the right implementation.
- **Tooltips:** hover a `.metrics-table-cell--primary-metric` cell; assert a tooltip containing a
  nested `.metrics-table` appears. Then toggle threat metrics off and assert a threat tooltip does
  **not** open (the `:181,306,397` veto).
- **Resources:** assert ≥1 `.resource-metrics-table-container:not(.hide)` and that every hidden one has
  an empty `tbody`.
- Gate on itself: green on `PORT=$BASE_PORT` **and** `PORT=$REACT_PORT` before unit 3 starts.

### Unit 3 — the casts table, and with it the shared React core.

Casts is the smallest table (57 lines, 3 columns) that still exercises **everything structural**:
sorting, grouping, expansion, `shouldCollapse`. It has no tooltips and no total bar, so the pilot
proves the TanStack wiring without also debugging react-tooltip.

Lands together (`SKILL.md`'s rule: a component lands when its first consumer ports):

```
ui/features/results/components/MetricsTable/          — the TanStack shell, one component per file
ui/features/results/components/MetricsTable/useMetricsTable.ts
ui/features/results/components/CastMetricsTable/
ui/features/results/model/grouping.ts                 — getGroupedMetrics/mergeMetrics/shouldCollapse
                                                        as pure functions (lint-enforced DOM-free by
                                                        the ui/features/*/model/** oxlint override)
```

`MetricsTotalBar` moves to `components/` and simply loses its `@jsxImportSource @jsx-vanilla` pragma —
it is already a pure function of props. `MetricsCombinedTooltip` is **not** in this unit.

The name cell is built on the existing `useActionId` hook. **Do not build a shared `ActionIcon`
here** — the log's `ActionLink` has different markup and is its second consumer; see "How the tables
compose with the log and rotation ports" in §1.

React portals into `.cast-metrics` (`detailed_results.tsx@HEAD:231-234`), the way `CharacterStats`
portals into `.sim-sidebar-stats` (`SKILL.md:571-575`), and **leaves `dr-root`, the nav strip and the
panes to the vanilla `DetailedResults`** — Risk 6. The vanilla `new CastMetricsTable(...)` call is
deleted; `cast_metrics.ts` is deleted (one consumer, not a dual-stack primitive).

**`useSimReady` is not needed** — checked. `individual_sim_ui.tsx:243` calls
`addDetailedResultsTab()` **synchronously in the constructor**, not inside any of the four
`waitForInit().then(...)` blocks (`:224,236,247,290`), so `.cast-metrics` exists as soon as `SimApp`
holds the constructed `simUI`, which is already the gate the other portals hang off.

Two TanStack wiring rules this unit establishes for every later table (§3, deltas 4–6):
`initialState.expanded: true`, and the rows passed as `data` must be
`useMemo(() => buildGroups(snapshot), [snapshot])` over a snapshot whose identity is stable between
emits.

- Gate: `results-tables.mjs` still green on both ports; `parity.mjs` / `panes-parity.mjs`
  byte-identical (fork A(a) — the shell is unchanged); `npm run test:unit` with a happy-dom suite on
  the sort/expand model (TanStack is headless, so this is genuinely testable there, unlike Base UI
  keyboard nav — `SKILL.md:162-163`); `npm run type-check`; `npx oxlint`; `npx oxfmt`.

### Unit 4 — buffs and debuffs (`aura_metrics.ts`, 75 lines, two instances).

Proves the shared core parameterises on a second metric type (`AuraMetrics`) and on a config axis
(`useDebuffs`). Still no tooltips, no bar.

- Gate: as unit 3.

### Unit 5 — resources (`resource_metrics.tsx`, 113 lines, 15 instances).

The container hide/show becomes "render the container's title and table only when the model has rows",
which deletes `onUpdate` (`metrics_table.tsx:41,174,181`) — its last consumer. Watch fork A: all 15
containers must still exist at load with their current classes, including `hide`.

- Gate: as unit 3, plus the resources assertions in `results-tables.mjs`.

### Unit 6 — damage (`damage_metrics.tsx`, 460 lines), and `MetricsCombinedTooltip`.

The heaviest unit and the one that decides the tooltip shape. Build
`buildAttackMetricsColumns(kind)` here, parameterised on the axis that actually varies — per
`SKILL.md:395-414`, say in its header comment which axis it fixes. From the map: the three attack
tables share Name / Casts / Avg Cast / Hits / Avg Hit / Crit % and differ on the primary-metric column
(damage vs damage-taken vs healing + the shielding overlay), the trailing rate column
(DPS / DTPS / HPS), the presence of Miss % / DPET / HPM / CPM / Cast Time, whether the threat veto
applies, and the grouping source. Parameterise all of that; do not let dtps or healing fork the markup.

- Gate: as unit 3, plus the tooltip and threat-veto assertions.

### Unit 7 — dtps + healing, adopting `buildAttackMetricsColumns`.

Landing them **together** is what proves the builder: three consumers is the count the duplication
survey measured (70–75% identical across 1,131 lines). Healing brings the only `overlayValue` user.

- Gate: as unit 6.

### Unit 8 — delete and co-locate.

`metrics_table.tsx`, `table_sorter.ts`, `metrics_total_bar.tsx`,
`metrics_combined_tooltip_table.tsx` and the six construction calls in `detailed_results.tsx@HEAD:231-274`
go. `_detailed_results.scss:119-278` and `_resource_metrics.scss` move beside the components. This is
also where `.tablesorter` is dropped, with an `INTENDED` entry — and `INTENDED` is not an allowlist
(`SKILL.md:895-899`): the entry fails if the divergence is *not* observed.

**Defect 9's fix belongs here too**, and only here: a `<button>` inside every `<th>` inserts N new
elements into the at-load shell on six tables, and neither `INTENDED` (changed lines only) nor
`collapseWrappers` (deletes a wrapper) can express an insertion. With every table already React's,
this is one baseline-side change made once rather than six times.

- Gate: `parity.mjs` with the `INTENDED` entry; `panes-parity.mjs`; a computed-style diff on a sorted
  header cell and on `.parent-metric.expand` before/after; `results-tables.mjs` on the React port;
  `npm run lint:css`.

---

## 5. Risks

**Risk 1 — the empty-shell finding is wrong.** Everything above rests on §0. If the pane at load is
*not* what the source says, fork A(a) fails on all six specs in unit 3 with ~385 differing lines and no
INTENDED entry can hold it (`INTENDED` cannot express a deletion — `SKILL.md:904-906`; that needs
`collapseWrappers`, which folds one wrapper, not a whole subtree). **Cheapest possible check, and it
should be the first thing unit 2 prints:** have `results-tables.mjs` dump the pane's `SERIALIZE`
line count before the sim, on both ports, and assert it is equal. That converts §0 from an inference
into an assertion, on the current build, before any code moves — and it costs four lines in a script
that has to open the tab anyway.

**Risk 2 — the emitter-not-store constraint.** Two ways to get this wrong, both recorded:
putting `SimResultData` into the Zustand store (it is an **event**, `state/README.md:81-82`; and the
store is written constantly, `SKILL.md:787-789`), or letting the worker progress callback reach React
(`SKILL.md:1152-1156` — 100 progress ticks must produce **zero** renders, measured with `Profiler` for
the stat-weights port at `:1374`). Unit 1's channel is fed once per completed run, from after
`SimResult.fromProto` resolves; nothing in this plan subscribes to progress. Assert it: a unit test
that pumps 100 progress messages and counts renders is the shape `SKILL.md:1374` already established.

**Risk 3 — `results_filter.ts` is a seam and is out of scope.** Every `getGroupedMetrics` takes
`resultData.filter` and passes it to `forTarget(...)` / `getTargets(...)`. The filter is a vanilla
`ResultComponent` with its own `changeEmitter` (`results_filter.ts:18,54`), and `DetailedResults` wires
it by **re-emitting the whole result** on every filter change (`detailed_results.tsx@HEAD:317`). That
means React tables need nothing from the filter directly — the channel already carries
`{ result, filter }` and re-fires. **Do not port the filter, do not subscribe to its emitter, and do
not lift it.** If a later unit is tempted to, that is the moment to re-read this line.

**Risk 4 — frozen surfaces.** `ui/sims/**` and `features/spec_config.ts` (`SKILL.md:301-306`). No
in-scope file imports either; the only spec-shaped input is
`(simUI as IndividualSimHost<any>)?.player?.secondaryResource` at `detailed_results.tsx@HEAD:247`,
which is a read. A spec-file diff in this PR is a reject.

**Risk 5 — the merge.** Unit 1 edits `detailed_results.tsx`, which has live conflict markers. Land
unit 1 only after the merge resolves, and re-derive its line numbers then. The six table files and
`metrics_table/**` are unconflicted and the `sim_result.ts` delta is log-types only (§0), so units 3–8
are insulated. If the merge changes `ResultComponentConfig` or `Emitter`, unit 1's channel is the one
thing that has to move.

**Risk 6 — taking the pane shell early is the one move that forces the log and rotation ports to undo
work.** `detailed_results.tsx@HEAD:122` carries `data-bs-toggle="tab"`, `SKILL.md:133-136` says none of
`.nav-link` / `.tab-pane` / `.fade` / `.show` / `_bootstrap_style_overrides.scss:198-226` may be
deleted, and `@HEAD:275-313` hooks `shown.bs.tab` / `hide.bs.tab` for Timeline, CombatReplay and
LogView. **If React takes over `dr-root` and the panes while those three still listen for
`shown.bs.tab`, their contents never render** — the merge-regression shape already recorded (*"all
gates green while two tabs were broken"*). Every unit here portals into an existing named div and
leaves the shell alone. The shell port is the last unit across all three views; anyone tempted to
"finish the job" during a table unit is starting a different, larger port and breaking two tabs.

**Risk 9 — `.dr-no-results` gates the whole pane, and the gate depends on it.** `detailed_results.tsx@HEAD:417,420`
adds and removes `dr-no-results` on `this.rootDiv`, which is what `results-tables.mjs` waits on
(unit 2). That element is in the merge-conflicted file. If the merge changes the class or moves it,
unit 2's wait condition has to move with it — re-check when the merge resolves, before unit 3 relies
on a green gate.

**Risk 7 — tooltips portal to `<body>` and outlive their subtree** (`SKILL.md:1191-1192`). With ~280
anchors on the damage table, unmount cleanup is not a detail. Assert it in the component test, and
prefer the shared-id shape (§3) which has one instance per column instead of one per cell.

**Risk 8 — `ActionId.toString() ≠ equals()`.** The icon cache keys on `toString()`
(`metrics_table.tsx:220-221,235`). Keep the same key; do not "improve" it to an identity check while
porting.

---

## 6. Defects noticed — recorded, not fixed

Batch into one `AskUserQuestion` (`SKILL.md:977-984`).

**Certainly wrong**

1. `metrics_table.tsx:50` — `.tablesorter` is dead. Only two references in the tree, both in this
   file (`:50`, and `:146` in a comment). No stylesheet, no script, no plugin. Vestigial from the
   jQuery tablesorter `TableSorter` replaced.
2. `damage_metrics.tsx:22`, `dtps_metrics.tsx:21`, `healing_metrics.tsx:21` — `Math.max(...[])` is
   `-Infinity` when a run yields no groups. It then divides in `MetricsTotalBar`
   (`metrics_total_bar.tsx:29`: `value / (max ?? 1)` — `-Infinity` is not nullish, so the `?? 1` does
   not fire) and renders `-0%`.
3. `damage_metrics.tsx:16-23`, `healing:15-21`, `dtps:15-21` — `config.resultsEmitter.on(...)` is
   registered **before** `super(config, …)`. It is correct only because `Emitter` dispatches in
   registration order; reorder the base class's subscription and every bar renders against the
   previous run's max, silently.
4. `metrics_table.tsx:95-107` — `sortMetrics` iterates **every** column carrying `sort` and sorts once
   per column, so two `sort`-bearing columns would fight and the last would win, while
   `:83` (`findIndex`) hands `TableSorter` only the **first**. Today exactly one column per table sets
   it, so the bug is latent.
5. `metrics_table.tsx:117,123,125,132` — `isChildRow` is threaded through four call sites and read by
   **no column and no `customizeRowElem` override** in any of the six tables. Dead parameter.
6. `metrics_combined_tooltip_table.tsx:78` — `data.sort((a,b) => b.value - a.value)` sorts the props
   array **in place**. The caller's literal is fresh each render today, so nothing is observed; it is
   still a mutation of an input.
7. `metrics_combined_tooltip_table.tsx:44-104` — a "component" that returns `<></>` and constructs a
   tippy as a side effect of being evaluated. Nothing disposes it: `MetricsTable.reset()`
   (`:184-187`) runs `addOnResetCallback`s and `replaceChildren`s the body, but these tippys were
   never registered (only the **header** tooltips are, `:74-77`). Every sim leaks one tippy instance
   per tooltip cell — hundreds per run.
8. `damage_metrics.tsx:450-455` uses `metrics[0]?.unit?.petActionId` while
   `healing:322`, `dtps:328`, `cast_metrics.ts:48`, `aura_metrics.ts:63` and `resource_metrics.tsx:107`
   all use `metrics[0].unit?.…`. `addGroup` guards `metrics.length == 0` (`:137-139`), so the
   inconsistent optional chain is harmless — and it is the only one of the six that is defensive.

**HTML5 / a11y — flag interactively per the standing feedback**

9. `table_sorter.ts:31` — a `click` listener on a bare `<th>`. No `role`, no `aria-sort`, no
   `tabindex`, no keyboard handler. The columns are **sortable only with a mouse**, and a screen
   reader is never told the sort changed. `_detailed_results.scss:174` puts `cursor: pointer` on every
   header cell including Name, which does sort — by `innerText` — so the affordance is at least honest.
   The fix is a `<button>` inside the `<th>` plus `aria-sort` on the `<th>`; TanStack's
   `header.column.getIsSorted()` gives the value directly. **Note the cost:** a `<button>` inside the
   `<th>` is a *new element in the at-load shell*, so both parity gates see it and `INTENDED` cannot
   express an insertion any more than a deletion (`SKILL.md:904-906`). Under fork A(a) this fix
   therefore belongs in **unit 8**, not in the table units. `aria-sort` alone is an attribute, which
   `SERIALIZE` ignores — that half is free at any time.
10. `metrics_table.tsx:156-162` — the expand/collapse affordance is a `click` listener on a `<tr>`.
    Same three omissions. `.parent-metric` gets `cursor: pointer` (`_detailed_results.scss:223-225`)
    and the caret is a decorative `<span class="fa">` with no accessible name. TanStack's
    `row.getToggleExpandedHandler()` on a real `<button>` in the first cell, with `aria-expanded`,
    is the shape. **Unlike defect 9 this one is free** — it lives in a `<td>` in the body, which only
    exists after a sim, where no gate compares trees. Fix it in unit 3.
11. `damage_metrics.tsx:181,306,397` and `healing_metrics.tsx:104,221,274` — six document-wide
    `document.querySelector('.hide-threat-metrics')` calls from inside a tooltip's `onShow`. A
    component reaching across the whole document for a setting it could read from the store.

**Asymmetric — confirm intent**

12. `dtps_metrics.tsx` has **no** `shouldCollapse` override, so a single-entry target group always
    collapses to a plain row, while damage/healing/casts/auras keep the parent row for pets
    (`damage:457`, `healing:329`, `cast_metrics.ts:53`, `aura_metrics.ts:69`). Its own TODO at
    `dtps_metrics.tsx:334` (*"Use NPC ID here instead of pet ID"*) suggests the target case was never
    finished rather than deliberately different.
13. `resource_metrics.tsx` likewise has no `shouldCollapse` override.
14. `dtps_metrics.tsx` applies **no** threat veto to any of its five tooltips, while damage and
    healing veto three each. Damage-taken tooltips are arguably threat-relevant by nature, so this may
    be right — but it is an asymmetry, not an obvious one.

---

## 7. Open questions for the user

1. **Fork A — empty shell or conditional render?** §0. Recommend (a), the faithful empty shell, so
   that no gate file changes and every unit lands on its own. (b) is the React idiom and costs six
   `dropSubtrees` entries.
2. **TanStack Table v8.21.3 or v9.2.4?** Everything in §3 is verified against 8.21.3. v9 has shipped
   and is restructured; the two row models must be re-verified before pinning it. Pin 8.21.3 now and
   move later, or spend the verification up front?
3. **Tooltip shape** — one `<Tooltip>` per cell (~280 on the damage table) or one per column with
   `data-tooltip-id`? §3. Recommend per column; it is a real architectural choice, not an
   implementation detail.
4. **Four declared deltas, or match vanilla exactly?** (i) the Name column sorting by `metric.name`
   instead of by rendered `innerText`; (ii) the threat veto reading the store instead of
   `document.querySelector`; (iii) the **expand toggle** becoming a real focusable `<button>` with
   `aria-expanded` — free, it lives in a `<td>`, recommend unit 3; (iv) the **sortable header**
   becoming a `<button>` inside the `<th>` with `aria-sort` — *not* free, it inserts an element into
   the at-load shell that neither `INTENDED` nor `collapseWrappers` can express, so it needs unit 8
   or fork A(b). All four are improvements; each needs an explicit decision, per the standing rule
   that a defect must not be ported faithfully just because the gate would lock it in.
5. **Defect 7 — the leaked tippy per tooltip cell.** Fix it in the port (it disappears by
   construction with react-tooltip) or file it separately against the vanilla build first, so the
   before/after is measurable?
6. **Defects 12–14** — are the dtps/resource `shouldCollapse` omissions and the missing dtps threat
   veto deliberate? The rebuild will make whichever answer is chosen explicit.
7. **Order across the three results views.** This plan recommends tables → log → rotation → pane
   shell (§1). The competing order is log first, on the grounds that it is the one with a real user
   complaint behind it and it would build the `ResultChannel` seam just as well. The argument for
   tables first is that they are the only one of the three the in-flight merge does not touch and the
   only one that does not depend on `shown.bs.tab`, so they can land while that machinery is still
   Bootstrap's. If the log is more urgent, swap them — unit 1 is unchanged either way, which is the
   point of writing it as a general seam.
