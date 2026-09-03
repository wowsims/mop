# Browser perf protocols

Timing scripts for the detailed-results pipeline, driven through the Playwright MCP
(`browser_run_code_unsafe` with `filename` pointing at one of these files).

Use Playwright, **not** the Chrome extension. The extension times out at 45 s on any eval
containing a long await and reports it as a frozen renderer, which reads like a hang in the
app when it is not.

## Running

```sh
make dist
(setsid nohup ./wowsimmop --usefs=true --launch=false --host=":3333" > host.log 2>&1 < /dev/null &)
```

`setsid` matters: a plain `&` inside a Bash-tool command dies with that shell's session, and
the host disappears mid-run.

The Playwright profile is persistent, so after a rebuild it will serve the previous
`index.html` out of the HTTP cache and 404 on the new hashed chunks. Clear it via CDP
`Network.clearBrowserCache` at the start of every run against a fresh dist.

Point at another checkout by setting `WOWSIMS_URL`.

## Scripts

| script | what it measures |
|---|---|
| `log-pipeline-timing.js` | Simulate with the Damage tab active, Log tab first paint, one search keystroke, log scroll frames, Timeline tab build, node and tippy-instance counts |
| `reference-swap-timing.js` | Swapping between the current result and a saved reference, six times, so the steady state after both subtrees are cached is visible |

`sync` is the blocking main-thread cost of the click itself; `settle` is time until the DOM
stops mutating; `tippies` counts live tippy instances via the `_tippy` property tippy v6
stamps on each reference element.

## Baseline — master @ fd8335d2f, Unholy DK, chromium 1237 headless

One Simulate press with the **Damage** tab active — no log, no timeline on screen:

| metric | value |
|---|---|
| longest blocking task | **1,220 ms** (plus a 195 ms task) |
| DOM settle | 7.8 s |
| mutations | 2,925 |
| total nodes | 22,215 |
| live tippy instances | 8,623 |
| JS heap | 131 MB |

Built while the Timeline tab was **not** visible (`timelineTabVisible: false`):

| metric | value |
|---|---|
| rotation rows | 97 |
| rotation nodes | 14,833 |
| tippy instances inside `#timelineTab` | **8,197** |

95% of every tooltip instance on the page belongs to a tab nobody opened. `update()`
(`timeline.tsx:1313`) sets `rendered = true` and nothing clears it, so `render()` is a
permanent no-op and the `shown.bs.tab` deferral wired at `detailed_results.tsx:275` never fires
again. Opening the Timeline tab afterwards costs 5 ms, because the work already happened.

Log tab: 50 rows in the DOM (the hardcoded window at `log_runner.tsx:212`), while every log line
is held as a detached `<tr>` plus a serialised HTML string in the JS heap
(`log_runner.tsx:183-184`). Scrolling is smooth at this fixture size — 17 ms median frame, no
drops — so the log-runner rewrite is a memory and first-paint fix, not a scroll-jank fix.

## Result — full stack, Unholy DK, pinned seed

| metric | master | after |
|---|---|---|
| Simulate long task (Damage tab active) | 1,117 / 1,157 / 1,142 ms | **176 / 216 / 208 ms** |
| Rotation built while the Timeline tab is hidden | 96 rows, 13,326 nodes, 7,376 tippies | **0 / 0 / 0** |
| Log rows built at Simulate | 50 in the DOM, ~20k detached `<tr>` + strings | **0** |
| Opening the Log tab | — | 9 ms |
| Search keystroke | 65–84 ms long task | **no long task** |
| Opening the Log tab | — | 2 ms |
| Opening the Timeline tab | 5 ms (already built) | 40 ms (builds everything) |
| Rotation nodes once open | 13,326 | **763** |
| tippy instances once open | 7,802 | **667** |
| JS heap | 131 MB | **93 MB** |

The Timeline figure moved from Simulate to tab-open on purpose: master built it on every
result whether or not anyone looked. Opening it now costs 40 ms against the ~1.1 s it used to
add to every single Simulate press.

Counts are exactly reproducible between runs; the millisecond figures are not, and the first
Simulate after a page load carries worker warm-up. Compare counts, sample timings.

### A correction

The `logRowsBuilt` figure above was briefly wrong. The protocol kept counting
`.log-runner-logs tr` after the log table became a grid of divs, so it read 0 for a state
that was really 22 — the Log tab still rebuilt its window on every result. The selector is
fixed, `LogRunner` now genuinely defers via `ResultComponent`'s `deferUntilShown`, and the 0
is measured rather than an artefact of a stale selector.

Worth generalising: a metric that reads 0 because its selector matches nothing looks
identical to a metric that reads 0 because the work stopped. Prefer assertions that fail
loudly (a non-zero "before" in the same run) over bare counts.

## Reference swap — master `fd8335d2f` vs the perf stack

Swapping current ↔ saved reference is what the live-subtree slot cache exists for, so it is
the case most at risk from these changes. Both sides measured with the same protocol and the
same pinned seed, master served from a worktree on :3334.

| steady state (swaps 3-6) | master | perf stack |
|---|---|---|
| sync | 79-90 ms | 78-82 ms |
| settle | 700-870 ms | 422-441 ms |
| mutations | 5,292 | 5,289 |
| rotation nodes | 13,326 | 1,452 |
| live tippy instances | 7,376 | 236 |
| JS heap | 205-265 MB | 163-206 MB |
| first swap (cold) | 355 ms | 354 ms |

The cache still hits: a per-target mutation breakdown shows 96 rows added and 96 removed on
`.rotation-timeline` with **zero** child mutations inside any row, i.e. rows are moved, and
horizontal windowing adds no churn to a swap.

**The swap's remaining cost is the chart, not the rotation.** Mutation counts are identical
across both sides because they are dominated by the ApexCharts `updateOptions` redraw and the
hidden-row emitter, neither of which this stack touches. That is where a future swap
optimisation would have to go; there is nothing left to win in the rotation DOM.

Swapping while scrolled was checked separately: `scrollLeft` is preserved (12,000 and 24,000),
the correct window is mounted on the newly attached slot, nothing is mounted more than the
padding outside it, and swapping back restores identical mounted/in-view counts.

To A/B against another checkout: `git worktree add ../wowsims-mop-master master`, symlink
`node_modules`, `make dist/mop/.dirstamp`, serve it on another port, and pass that port to
`run.cjs` — the protocol's `localhost:3333` is substituted.
