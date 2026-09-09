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
- `rotation-swap-timing.mjs` — the same protocol as a plain node script, parameterised by port
  (`PORT=3402 node tools/browser-perf/rotation-swap-timing.mjs warrior/arms`), so a branch and its
  baseline can be timed in one session against the two static servers `tools/react-migration` uses.
  Reports the same per-swap figures plus the mounted row and item counts.
- `rotation-scroll-counts.mjs` — precise-coverage call counts for scrolling the rotation timeline,
  parameterised by port (`PORT=3402 node tools/browser-perf/rotation-scroll-counts.mjs warrior/arms`).
  Seeds the sim the way `tools/react-migration/timeline.mjs` does — two builds must run the same fight
  or every count is noise — then drives three sequences of a fixed number of animation frames:
  `scroll-h` (a 37px/frame horizontal pan, where the ruler moves), `scroll-v` (a 3px/frame page scroll,
  where it must not) and `zoom` (eight ladder steps, where every tick is re-placed). `SEQ=` picks the
  sequences; `ALL=1` dumps every function's delta as `name@offset`, and since two builds of the same
  tree share most bundle offsets, those dumps diff line for line. Per sequence it reports total calls,
  the top functions with their minified source, ruler-track and `.rotation-content` mutation counts,
  the page's own `requestAnimationFrame` count and a native-event histogram — identical frames,
  commits and events across two builds are what make a call-count delta attributable to the change.
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

Re-run after gear units 2 and 5 (the tab body, the three summaries, `ItemCell` and `GearPicker` in
React), master re-recorded in the same session: every count above is reproduced to the unit — 636
modal mutations on the open, 382 on the favourite toggle, 93 per keystroke, 178 on the tab switch,
443 on the scroll, pool 1658 / 29 mounted / 56 px rows — and every timing falls inside the recorded
range. Those units do not touch the item list, which is what the counts confirm.

## Rotation ruler — the port that was measured and thrown away, 2026-09-09

Recorded with `rotation-scroll-counts.mjs` while deciding whether
`features/results/view/timeline/rotation/ruler.ts` should become a React component. Both sides are
static builds of `feature/ui-react` @ `470dc186c`, frozen and served on their own ports, warrior/arms,
seed 1337, 100 iterations, headless Chromium. **Counts, not timings** — wall clock on this host spans
several times the effect being measured. The table is one paired run of the finished script; the
spreads below it are the earlier interleaved runs, which carried less instrumentation and so sit a
little lower in absolute terms while giving the same ratio.

| sequence | imperative `Ruler` | React `RotationRuler` |
|---|---|---|
| `scroll-h`, 60 frames — total JS calls | 266,771 | 299,258 (**+12.2%**) |
| `scroll-h` — ruler-track mutations / node insertions | 315 / 105 | 242 / 91 (**−23%**) |
| `scroll-v`, 60 frames — total JS calls | 156,524 | 147,581 (−5.7%) |
| `scroll-v` — ruler-track mutations | 0 | 0 |
| `zoom`, 8 steps — total JS calls | 74,838 | 70,123 (−6.3%) |
| frames driven / `.rotation-content` mutations — `scroll-h` | 211 / 263 | 211 / 263 |
| frames driven / `.rotation-content` mutations — `scroll-v` | 187 / 18 | 187 / 18 |
| frames driven / `.rotation-content` mutations — `zoom` | 28 / 320 | 28 / 320 |
| native events — `scroll-v` | scroll 60, scrollend 60, transitionend 4 | identical |
| ticks / labels in the DOM | 21 / 7 | 21 / 7 |

Across five interleaved runs of the earlier instrumentation, `scroll-h` was 267,589–268,788 against
298,406–303,220 — the same +12.2%, and each build stable to under 0.5%. `SEQ=scroll-v` in isolation
(no preceding pan) was 138,165–138,305 against 127,148–128,245, so the vertical figure is not an
artefact of what the horizontal sequence left behind.

**Load-bearing for the decision**: `scroll-h`'s total, because the frame count, the committed row
mutations, the native events and the layout are identical between the two builds, so the 32.5k is the
ruler alone — ~540 calls per frame for 28 elements. The mechanism is density: minor ticks are 50px
apart at the default zoom and the pan moves 37px per frame, so the tick window changes ~1.1×/frame and
`memo` never bails. The verdict was to keep the imperative pool; see the 2026-09-09 entry in
`.github/skills/wowsims-react/SKILL.md`.

**Unexplained**: `scroll-v` and `zoom` moved the other way, reproducibly and order-independently, on
sequences where neither build's ruler does anything. The drop is spread flat across React's reconciler
with identical frames, commits, events and layout; `getEventTarget` fell 348 → 96 without the native
event count moving. Re-derive it before quoting either row for anything but this decision.

**Noise**: totals are stable to ~0.5% per build across runs; every DOM, frame and event count above is
stable to the unit. Adding an observer changes the totals it measures, so compare only runs of the
same script revision. `ALL=1` output diffs cleanly only between two builds of the same tree — offsets
above the vendor region shift with any change to `ui/`.
