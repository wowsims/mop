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
