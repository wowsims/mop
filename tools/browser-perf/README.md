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
