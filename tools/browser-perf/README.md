# Browser perf protocols (Playwright)

Repeatable timings for the two interactions users notice most: switching between saved
references (Timeline tab open) and editing a large APL. Each script is an `async (page) => {...}`
function for the Playwright MCP `browser_run_code_unsafe` tool (pass it via `filename`) or for
a plain Playwright `page` in a node script.

Prerequisites: a Go host serving a built `dist/` (see `.github/skills/wowsims-ui/SKILL.md`,
"Running REAL sims locally"). Edit the URL constant at the top of each script.

- `reference-swap-timing.js` — simulate, save as reference, simulate again, open Results →
  Timeline, then swap 4×. Reports per swap: sync click cost, settle time (last DOM mutation),
  mutation count, long tasks, live tippy tooltip count in the timeline, and whether a
  timeline tooltip can still open after the swaps.
- `spec-sweep.js` — smoke every DPS/tank spec: load, picker count, Simulate, real result, console +
  page errors. Known noise: `Empty action id!` x2 on the hunter specs and elemental shaman (present on
  master too; comes from result data with no spell/item id).
- `apl-edit-timing.js` — open Rotation, apply the Unholy DK "Festerblight" preset (317 list
  items), then bump a visible numeric APL input 4×. Reports sync/settle/mutations/long tasks.
- `gear-selector-timing.js` — the gear selector, warrior/arms main hand (the largest pool in the
  tree). Five open/close cycles each with one favourite toggle, then one open carrying a 4-keystroke
  search, an Items→Enchants tab switch and a ten-viewport scroll. Reports per interaction:
  sync cost, `firstRow` (first `li.selector-modal-list-item` added), settle, whole-page and
  modal-scoped mutation counts, long tasks, and the pool / mounted-row / row-height counts.

Wrap `console.error` with `page.addInitScript` (as in the swap script's history) when you
want batch-listener errors surfaced with stacks; `vite build --sourcemap` plus
`source-map-js` maps minified frames back to `ui/` source.

Measured 2026-09-02 (headless Chromium, arms warrior 250 iterations / unholy Festerblight):

| interaction | master | fix/apl-timeline-cleanup | feature/state-ui-separation |
|---|---|---|---|
| reference swap, cached (sync / settle) | 284–313 ms / 710–778 ms, **0 live tooltips** | 105–116 ms / 570–577 ms, tooltips alive | 103–105 ms / 385–438 ms, tooltips alive |
| reference swap, cold (first view of that result) | 654 ms / 1.29 s | 515 ms / 1.19 s | 470 ms / 0.97 s |
| APL numeric edit (sync / DOM mutations) | 137–144 ms / 30,357 | 8–10 ms / 3,109 | 8–10 ms / 3,109 |

Provenance: the migration-branch reference-swap row was timed on a dist that still contained the (gated-off) `__perf` instrumentation; the APL rows and the fix-branch rows were timed on clean builds. Re-run the swap script on the current build before quoting that row externally.

## Gear selector — pre-port baseline, 2026-09-07

Recorded before any of the gear rebuild (plans/gear.md units 2–6d), so the port has a number to be
judged against. `master` = `267551035`, `feature/ui-react` = `75d037afd`, both static-served builds,
headless Chromium 150.0.7871.24, 1280×720, warrior/arms main hand, search string `blad`, three runs
per build. Ranges are min–max across those three runs; a single figure means all three agreed.

| measurement | master | feature/ui-react |
|---|---|---|
| open #1 — sync / firstRow / settle | 464–468 / 465–470 / 651–658 ms | 458–508 / 459–511 / 636–688 ms |
| open #2–5 — sync / firstRow | 31–43 / 37–44 ms | 33–38 / 36–40 ms |
| open — modal mutations | 607–609 | 636–638 |
| favourite toggle, sync, after open #1 → #5 | 40 → 63 → 87 → 108 → 130 ms | 38 → 62 → 85 → 110 → 130 ms |
| favourite toggle — modal mutations | 292 | 382 |
| search keystroke 1 / 2–4, sync | 15–16 / 9–15 ms | 15–17 / 10–18 ms |
| search — modal mutations per keystroke | 64 | 93 |
| Items → Enchants tab switch — sync / settle / mutations | 7–9 ms / 158–161 ms / 149 | 7–9 ms / 158–161 ms / 178 |
| ten-viewport scroll — mutations / peak mounted rows | 376 / 29 | 443 / 29 |
| pool / mounted rows / row height / tabs / pane nodes | 1658 / 29 / 56 px / 6 / 628 | identical |

**Load-bearing for the port decision**: `firstRow` on the open (a React list renders after the click
returns, so this is where a regression would show and `sync` would not); the favourite toggle's
growth from open #1 to open #5 — that is defect 4's leak measured, `setFilters` fanning out to every
ItemList any previous open left subscribed, and killing it is the rebuild's clearest win; search
keystroke 1 (the only one over the full 1,658-row pool); and every count, which is stable to the
unit across runs.

**Noise**: `settle` waits out the async `ActionId.fill()` icon writes and moves with the icon cache,
not with the list; `longTasks` tracks host load. Millisecond figures cannot be pinned on a shared
WSL2 host — quote the range, and re-record master alongside any comparison rather than against the
numbers above.

**Row height is a uniform 56 px** on the Items tab at this viewport, matching `estimatedRowHeight`.
That answers the plan's open measurement question for this tab: `estimateSize: () => 56` is enough
and `measureElement` buys nothing. Re-check on the Random Suffix and Reforging tabs, whose names are
two-line.

**The two builds' timings are equal; only the mutation counts differ**, by exactly one per mounted
row on every render pass (64 → 93, 149 → 178, 607 → 636). It is `setExternalAwareHref` writing
`rel="noopener noreferrer"` beside every row anchor's `href` — cross-origin hardening the branch has
and master does not. Not a regression, and not a number to "recover" in the port.
