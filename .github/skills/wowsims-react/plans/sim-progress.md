# Sidebar sim progress and warnings — clean-rebuild plan, read-only investigation, 2026-09-07

Worktree `~/personal/wowsims-mop-react`, branch `feature/ui-react`. Nothing was modified except this
file.

**Working-tree snapshot, and what moved under it while this was written.** The investigation was done
against a tree with no `ui/` changes; by the time it was finished, the concurrent results-tables work
had landed its first unit — `ui/features/results/model/result_channel.ts` (+ its test),
`tools/react-migration/results-tables.mjs`, and edits to `detailed_results.tsx`,
`individual_sim_ui.tsx`, `sim_host.ts` and `tools/react-migration/README.md`. **Every file this plan
reads in anger is still clean at HEAD** — `results_viewer.tsx`, `results_action.tsx` and
`sim_ui.tsx` are untouched by that work — so all line numbers below are HEAD as read, and only the
four cites into `sim_host.ts` / `individual_sim_ui.tsx` need re-checking against the working tree.
The exact hunks and what they collide with are in §6, Merge exposure.

**The pragma.** `results_viewer.tsx:1`, `results_action.tsx:1` and `sim_ui.tsx:1` all carry
`/** @jsxImportSource @jsx-vanilla */`. They render real DOM through `tsx-vanilla`; none of them is
React. `sim_ui.tsx` is an editable *shell* file (`SKILL.md:989-1001`); the other two are feature
views, and only the one that is deleted outright gets rewritten.

---

## 0. The parity surface — verified, and it decides the plan's shape

### What the gates can see

**The sidebar results panel is inside the strict half of `parity.mjs`.** `parity.mjs:121` serialises
`.sim-ui` whole; `:122` prunes only the tab strip, `.sim-main` and every modal (`:35`, `:44`). The
sidebar is none of those, so `div.results-viewer` and all four of its zone divs are compared
**byte for byte, at load, on all six specs**. This is the opposite of the results-tables situation —
there the pane is pruned per id and normalised; here nothing is.

**But `SERIALIZE` is tag + sorted classes + depth, and nothing else.** `browser.mjs:43-55`, with the
prose at `:38-42`. Concretely, at load it records exactly this and no more:

```
div.results-viewer
  div.results-pending
    div.loader
  div.results-content
  div.button-zone.text-center
  div.warning-zone.text-center
    div.sim-toolbar-item          <- div.hide.sim-toolbar-item when no warning is active
      button.link-warning.warning
        i.fa-3x.fa-exclamation-triangle.fas
```

(Class lists are emitted sorted, which is why `hide` lands *first*, not last.)

Nine lines. It cannot see:

- the three inline `display: none` writes `hideAll()` makes in the constructor
  (`results_viewer.tsx:121-125`) — `style` is an attribute;
- `type`, `id`, `aria-*`, `data-tooltip-id`, or the absence of any of them;
- the tippy instance, its content, or the `<ul class="text-start ps-3 mb-0">` inside it
  (`results_viewer.tsx:23`), because tippy's content node is not in the document until shown;
- any text.

The one thing it *does* see that is state rather than structure is **`hide` on the warning item**
(`results_viewer.tsx:117`, toggled on `warningsLink.parentElement`, which is
`SimToolbarItem`'s `div.sim-toolbar-item` at `sim_toolbar_item.tsx:25`). Whether that class is there
at load depends on the spec's default gear and talents, and it is compared. That is the whole of the
warnings surface any tree gate has.

### What no gate can see

**Progress is transient state that a load-time snapshot never observes.** The two tree gates open a
page and serialise; neither ever clicks Simulate. Verified:

- `parity.mjs:119` waits on `.sim-sidebar, .sim-ui` and serialises immediately.
- `panes-parity.mjs:56` serialises `#<pane id>` only — the sidebar is **not in its scope at all**.
- `tabs-a11y.mjs:20` scopes to `.sim-tabs`. Also not the sidebar.
- `sidebar-popover.mjs` is the sidebar's behaviour gate, but it drives the character-stats popover
  and deliberately avoids the worker (`sidebar-popover.mjs:19-25`).
- `/usr/bin/grep -rn "dps-action\|runSim" tools/react-migration/*.mjs` returns nothing.

So the running states — `.results-pending` visible, `.results-sim` filled, the Stop button rendered,
a warning appearing because gear changed — are observed by **zero** existing checks.

**What `intended.mjs` can and cannot express.** An entry is a fixed `base`/`react` line pair or a
`match(base, react)` predicate over one line, plus a `max` (`intended.mjs:9-11`). So there are
exactly **three** mechanisms for a divergence here, and the port has to fit into one of them:

1. **Invisible at load** — an attribute, a style, text, or anything that only exists during a run.
   This is where almost all of this port lands, and it is why unit 1 exists at all.
2. **An `INTENDED` changed line** — one line whose tag or class list differs, capped by `max`. This
   is the migration's primary mechanism (`intended.mjs:12-44` is five of them), and this port needs
   exactly one; see the Icon note below.
3. **`collapseWrappers`** for an element the port *deletes* — `parity.mjs`'s comparison is
   index-aligned, so a deletion shifts every line below it and the trees stop being comparable
   (`browser.mjs:88-102`). This port deletes nothing, so it is not needed.

What none of the three can do is describe an **insertion** or a **subtree move**. That is what rules
out fork A(c) in §3.

**The one `INTENDED` entry this port needs, and it is line 9.** `Icon` resolves FA5 aliases to FA6
canonical names — `ui/ui-kit/Icon/types.ts:56` maps `'exclamation-triangle' → 'triangle-exclamation'`,
pinned by `Icon.test.tsx:21`. So `<Icon name="exclamation-triangle" size="3x" />` emits
`fas fa-triangle-exclamation fa-3x` where the vanilla button hardcodes
`fas fa-exclamation-triangle fa-3x` (`results_viewer.tsx:88`):

```
base : i.fa-3x.fa-exclamation-triangle.fas
react: i.fa-3x.fa-triangle-exclamation.fas
```

This is the identical situation `intended.mjs:31-36` already records for `fa-question-circle` →
`fa-circle-question`, down to the `why`: same glyph in the pinned FontAwesome 6.0.0 CSS. Add a
second entry in that exact shape with `max: 1` (one warning icon per sidebar, and the sidebar is in
`parity.mjs`'s shell region, so the cap is per-region and exact). Unit 4's job; §8 question 6 is
whether to take it or dodge it with a raw `<i>`.

`Icon` also adds `aria-hidden={true}` when no `title` is given (`Icon.tsx:25`) — an attribute, so
invisible to `SERIALIZE`, and the correct treatment for a decorative glyph inside a button that
defect 2 is about to name.

### The rule this yields, and the fork it forces

> At load, `parity.mjs` compares the nine lines above byte for byte on six specs, including `hide` on
> the warning item. It compares **nothing** about the pending spinner's visibility, the progress
> numbers, the Stop button, or the tooltip's contents. From the moment Simulate is clicked, nothing
> compares anything at all.

**Therefore: the port must emit eight of those nine lines unchanged at load, account for the ninth
with the `INTENDED` entry above, and is otherwise unobserved.** Which means a behaviour gate has to
be written, and it has to be written *first* — see unit 1. The
closest existing precedent is `tools/react-migration/stat-weights.mjs`, and it is worth reading in
full before writing the new one, because it already solves four of the problems:

| `stat-weights.mjs` | Reusable here |
|---|---|
| `PORT` env picks a build, `IS_BASE` decides which assertions are expected to fail (`:17-19`) | Yes — the same shape. Most assertions here hold on **both** builds, as in `talents.mjs` / `sidebar-popover.mjs` |
| Runs a real sim from a button and waits for progress with `waitForFunction`, not a sleep, *because* the Go sim reports at most once per 100 ms and the pool decimates (`:307-319`) | Directly, verbatim reasoning |
| Asserts a running progress popup, clicks Cancel, waits for the run to unwind rather than sleeping (`:337-356`) | Directly |
| Reads finished values back off the DOM after `waitForFunction` (`:362-371`) | Directly |

It does **not** cover this region. `PROGRESS()` (`:90-104`) is scoped to
`.progress-tracker-dialog`, and its `.results-pending-overlay` reads are the *baseline's*
stat-weights overlay — a different element, in a different feature, that exists only on `:3401`
(`~/personal/wowsims-mop`: `ui/core/components/stat_weights_action.tsx:310` and
`ui/scss/core/components/_stat_weights_action.scss:206`) and has zero occurrences on this branch.
`stat-weights.mjs` never clicks `.dps-action` and never looks at `.results-viewer`,
`.warning-zone` or `.button-zone`.

---

## 1. Map

### The four files

| File | Lines | What it owns |
|---|---|---|
| `ui/features/results/view/results_viewer.tsx` | 165 | The whole sidebar panel: four zone divs, the warning link + its tippy, the show/hide primitives, the abort button |
| `ui/features/results/view/results_action.tsx` | 648 | `addSimResultsAction` (the Simulate button + the progress callback), and `SimResultsManager` (progress content, result content, reference handling, the topline builders) |
| `ui/app/sim_ui.tsx` | 330 | Constructs the viewer (`:103`), delegates `addWarning` (`:183-185`), and drives pending/hide from `runSim` (`:200-217`) and `runSimOnce` (`:230-238`) |
| `ui/app/individual_sim_ui.tsx` | — | Registers the five built-in warnings (`:136,156,169,189,205`) and the spec's own (`:220`); calls `addSimResultsAction` (`:289`) |

### `results_viewer.tsx`, member by member

| Member | Lines | Notes |
|---|---|---|
| `SimWarning` interface | `:9-12` | **A duplicate** of `sim_host.ts:19-22`. Structurally identical; the two are never checked against each other |
| `TOOLTIP_HTML_BASE` | `:23` | Module-level `<ul class="text-start ps-3 mb-0">`, used once as tippy's initial content |
| markup | `:43-52` | The four zone divs, built in one fragment with four `ref`s |
| `pendingElem` / `contentElem` / `warningElem` / `buttonWrapperElem` | `:26-29` | Public `readonly`. **Only `contentElem` has an external reader** (`results_action.tsx`, nine sites). The other three are dead public surface |
| `addWarningLink` / `addWarningsLink` | `:64-92` | Builds one `SimToolbarItem` into `warningElem` and one tippy on it (`appendTo: 'parent'`, `placement: 'bottom'`, `inlinePositioning`) |
| `addWarning(w)` | `:94-99` | Pushes, subscribes `w.updateOn`, registers the unsubscribe on dispose, re-renders |
| `updateWarnings()` | `:101-119` | Maps `getContent()`, flattens, drops `''`; clones tippy's *current* content, empties it, refills with `<li>`s; toggles `hide` on the item; `setContent` |
| `hideAll()` | `:121-125` | `display:none` on content, pending **and** buttons |
| `setPending()` | `:127-130` | pending `block`, content `none`. **Does not touch buttons** |
| `setContent(html)` | `:132-140` | `replaceChildren` (or `innerHTML` for a string), content `block`, pending `none`. **Does not touch buttons** |
| `addAbortButton(cb)` | `:142-159` | Replaces the button zone with `<button class="sim-abort-button">`, shows the zone. Clicking disables the button and sets `innerText = 'Stopping...'` |
| `removeAbortButton()` | `:161-164` | Empties and hides the zone |

### Who calls what — the complete list (`/usr/bin/grep -rn`, repo root)

| Call site | Method |
|---|---|
| `sim_ui.tsx:103` | `new ResultsViewer(dom.sidebarResults)` |
| `sim_ui.tsx:184` | `addWarning` — the only caller, itself called from `individual_sim_ui.tsx` ×6 |
| `sim_ui.tsx:201`, `:231` | `setPending` — `runSim` and `runSimOnce` |
| `sim_ui.tsx:210`, `:214`, `:235` | `hideAll` — abort outcome, `runSim` throw, `runSimOnce` throw |
| `results_action.tsx:37`, `:55` | `addAbortButton` / `removeAbortButton` |
| `results_action.tsx:96` | `hideAll` — the progress-error branch |
| `results_action.tsx:99` | `setContent` — **the progress content** |
| `results_action.tsx:132` | `setContent` — the finished-result content |
| `results_action.tsx:155,186,201,229,254,255,259,260,285` | `contentElem` — nine reads, all inside `setSimResult` / `updateReference`, all **lazy** (post-render, in handlers or after a run) |
| `sim_host.ts:33` | `readonly resultsViewer: ResultsViewer` — the type the whole features layer sees |

Indirect drivers of the pending path: `detailed_results.tsx:326` and `:346` call
`simUI.runSimOnce()` (the "Sim 1 Iteration" and "Sim Until Death" buttons in the results toolbar).
Those go through `sim_ui.tsx:231`'s `setPending()` and produce **no progress at all** —
`runRaidSimWithLogs` passes `noop` (`sim.ts:711`) — so the spinner stays up until
`simResultEmitter` fires and `setSimResult` replaces it.

`mage/fire/calculate_combustion_thresholds.tsx:134` calls `runSimLightweight`, which touches the
viewer not at all (`sim_ui.tsx:221-228` has no `setPending`). Frozen file; no exposure.

### Who owns what today, and what the store already carries

**Nothing here is in the store.** Not one field. The panel's entire state is:

- four DOM `style.display` strings,
- one `hide` class,
- a `warnings: Array<SimWarning>` array private to the instance (`:32`),
- `isRunning` / `waitAbort`, two closure variables in `addSimResultsAction` (`:22-23`),
- and the `ProgressMetrics` proto that arrives on the callback and is never retained.

What the store *does* carry, and what the warnings therefore read through: `warning.updateOn` is a
`StoreSubscribe` (`sim_host.ts:20`), and the five built-ins subscribe to `player.gear`,
`player.profession1/2` and `player.talentsString` (`individual_sim_ui.tsx:137-141,157,170,190,206`).
So warnings are **already** a pure projection of store state — the derivation is a function, the
subscription is a store subscription, and only the delivery is imperative. `SKILL.md:848-856` says
exactly this.

The progress numbers are the opposite: they never touch the store, deliberately
(`SKILL.md:789-790`, `:1153-1163`).

### The throttle chain — verified against the files, as instructed

The prior research is **confirmed on every leg**, with two line corrections and one addition:

| Leg | File | What it does |
|---|---|---|
| The sim itself | `sim/core/sim.go:336-345` | `if sim.ProgressReport != nil && time.Since(st) > time.Millisecond*100` — **≤10 reports/second per sim**. `st` is the zero `time.Time` on the first pass, so the first report is immediate |
| Native concurrency | `sim/core/sim_concurrent.go:560-565` | `progressCounter % int(threads) == 0`, `threads = runtime.NumCPU()` (`:493`). The Go host aggregates N sims back to ~10/s before it ever reaches the wire |
| wasm concurrency | `ui/domain/wasm/sim.ts:119-120` | `progressCounter++; if (progressCounter % running == 0)`. **The claim cited `:118`; the increment is `:119` and the modulo `:120`** (`:117` is `csp.updateProgress`). `running` decrements as workers finish (`:125`), so the divisor shrinks to 1 near the end of a run — the decimation is weakest exactly when it matters least |
| The native transport | `ui/worker/worker_http.ts:37-48` | The async handler polls `asyncProgress` in a `while` loop with `await sleep(500)` — **~2 reports/second**, and this is where the "2/s on the native host" figure comes from. Confirmed from source, not measured (no browser was launched for this plan) |

One thing the original claim does not say and the plan depends on: **the wasm decimation is on the
concurrent path only.** `sim.ts:309-313` branches on `shouldUseWasmConcurrency()`
(`:230-232`: wasm **and** `getWasmConcurrency() >= 2` **and** `getNumWorkers() >= 2`). Single-worker
wasm goes straight to `workerPool.raidSimAsync` and gets no JS-side decimation — but it is then one
sim, so `sim.go:336` alone still caps it at 10/s.

**Ceiling on every path: ≤10 reports/second. `requestAnimationFrame` caps at ~60/s and would
coalesce nothing.** The design that follows is the one `ProgressTrackerDialog` already implements
and `SKILL.md:1153-1163` already records: refs plus direct DOM writes for continuous values, React
state for discrete stage transitions. This plan adopts it and does not re-litigate it.

Note for the implementer: the sidebar has **no progress bar**, only three text values, so the CSS
custom-property channel is not needed here. `ProgressTrackerBar.tsx:29`
(`bar.style.setProperty('--progress', …)`) is where it exists if one is ever added; §8 recommends
not adding one.

### SCSS

Four of the six class names this panel emits have **no rule anywhere**. Checked with
`/usr/bin/grep -rn` over `ui/` and `assets/`:

| Class | Rules |
|---|---|
| `results-viewer` | none — only `results_viewer.tsx:36` |
| `results-content` | none — only `results_viewer.tsx:48` |
| `button-zone` | none — only `results_viewer.tsx:49` |
| `sim-abort-button` | none — only `results_viewer.tsx:153`. The Stop button is an **unstyled bare `<button>`** |
| `results-pending` | `ui/scss/core/components/_sim_action.scss:1-3` — `.results-pending .loader { margin: auto }`, and that is all |
| `warning-zone` | `ui/scss/core/sim_ui/_sidebar.scss:108-112` — `[data-tippy-root] { width: 100% }` |
| `results-sim` and `results-sim-*` | `_sim_action.scss:5-56`. **`results-sim` is a squatter class**: `bulk_tab.tsx:1397`, `bulk_sim_results_renderer.tsx:46`, `results_action.tsx:100` and `:133` all use it. Do **not** co-locate `.results-sim` rules (the stat-weights plan's unit 4 found the same and says so) |
| `damage-metrics` / `healing-metrics` on the progress lines | `_shared.scss:124-143` — `.hide-damage-metrics .damage-metrics { display: none !important }` and the healing twin. The two progress rows follow the sim's metric toggles, and that must survive |
| `hide` | `ui/scss/shared/_global.scss:135` |

So only two rules are in scope for a co-location unit, and one of them (`[data-tippy-root]`) **dies
silently** under a `Tooltip` port — see unit 5.

---

## 2. What a rebuild must reproduce, and what it may deliberately drop

### Must reproduce

1. **The nine serialised lines at load, exactly**, including class order-insensitivity (SERIALIZE
   sorts) and including `hide` on the warning item when no warning is active.
2. **The five visibility transitions**, as a table. This is the contract; nothing below may be
   invented:

   | Trigger | Today | Zones after |
   |---|---|---|
   | construction (`hideAll`) | `:121-125` | pending hidden, content hidden, buttons hidden |
   | `setPending()` (`runSim`, `runSimOnce`) | `:127-130` | pending **shown**, content hidden, buttons **untouched** |
   | first progress tick (`setContent(.results-sim)`) | `:132-140` via `results_action.tsx:99` | pending hidden, content **shown**, buttons untouched |
   | `setSimResult` (`setContent(topline)`) | `results_action.tsx:132` | pending hidden, content **shown**, buttons untouched |
   | `hideAll()` (abort outcome, throw, progress-error) | `sim_ui.tsx:210,214,235`; `results_action.tsx:96` | all three hidden — **including the Stop button, which disappears before `removeAbortButton` runs** |
   | `addAbortButton(cb)` / `removeAbortButton()` | `:142-164` | buttons shown / hidden + emptied. Independent of the pending/content axis |

3. **The progress content**: `div.results-sim` > `div.results-sim-dps.damage-metrics >
   span.topline-result-avg` (dps, `toFixed(2)`), the `healing-metrics` twin (hps), and a third
   `div` holding either `sidebar.results.progress.presim_running` or `"${completed} / ${total}"`,
   a `<br/>`, and `sidebar.results.progress.iterations_complete`
   (`results_action.tsx:99-115`). Both i18n keys exist in `en` and `fr`.
4. **`this.reset()` on every progress tick** (`results_action.tsx:94`) — it is what tears down the
   tippy instances and click listeners the previous `setSimResult` installed
   (`:158,195-198,224-227,242-245`). Dropping it leaks a tooltip per result.
5. **The progress-error branch** (`:95-98`): a `ProgressMetrics` carrying
   `finalRaidResult.error` hides everything and returns without rendering. On the success path
   `finalRaidResult` is set with `errorResult === undefined` (`wasm/sim.ts:139`), so the branch is
   falsy and does not fire.
6. **The Stop button's click behaviour** (`:144-150`): disable itself, change its own label, then
   call the handler — and the handler's own `waitAbort` re-entrancy guard
   (`results_action.tsx:38,40,46`) and the `button.disabled` bookkeeping on the Simulate button
   (`:33,47,56`).
7. **Warnings**: registration, the `updateOn` subscription, `''`-means-off, flattening an array
   return, `hide` when the list is empty, and the tooltip listing one `<li>` per active warning.
8. **`contentElem` stays readable** by `SimResultsManager` at all nine sites, and stays the same
   element across a run.
9. **The unlaunched block** (`sim_ui.tsx:107-130`) still renders, after the panel, for a disabled
   spec.

### May deliberately drop

1. **`pendingElem`, `warningElem`, `buttonWrapperElem` as public fields.** No external reader.
2. **The duplicate `SimWarning` interface** at `results_viewer.tsx:9-12`. Import `sim_host.ts`'s.
3. **`setContent`'s string branch** (`:133-134`). Both callers pass an `Element`; nothing in the
   tree passes a string.
4. **The clone-and-empty dance in `updateWarnings`** (`:107-108`): `props.content` is the *previous*
   list after the first `setContent`, so it clones a node purely to throw its children away, and
   `if (list)` is always true. In React the list is just rendered.
5. **The `.results-sim` block's position inside `.results-content`** — this is the fork in §3, and
   it is the one deliberate divergence the plan proposes.
6. **`inlinePositioning`** on the warnings tooltip (`:77-78`). react-tooltip has no equivalent; the
   anchor is a block-level icon button, not wrapped inline text, so the plugin has nothing to do.
7. **A rAF coalescer.** Explicitly not built — see §0's throttle table.

---

## 3. The design: two halves, and the one invariant everything rests on

### The split, by frequency

| Half | Frequency | Mechanism |
|---|---|---|
| Stage — idle / pending / running / result, and whether the Stop button exists | a handful per run | React state, through an external store read with `useSyncExternalStore` |
| Whether a warning is active, and its text | on a store notification (gear, professions, talents) | React state, `useStoreSubscribe` over the warnings' own `updateOn` |
| dps, hps, `completed / total` | ≤10/s | **refs + `textContent` writes**, off a handle, never a render |

`ProgressTrackerDialog` is the worked example for the third row: `ProgressTrackerBar.tsx:16-33` is a
`useImperativeHandle` exposing `setProgress`, writing `textContent` and one custom property, with
`ProgressTrackerDialog.tsx:36-44` taking the discrete `stage` as a prop. The change log
(`SKILL.md:1394-1400`) records the measurement that justified it: 100 progress ticks, zero renders.

**The first tick has a race, and no browser gate can see it.** Tick 1 does two things at once: it
moves the stage `pending → running` (a `setState`, so `SimProgress` does not exist yet) *and* it
carries the first dps/hps/counter values. A handle written the obvious way — call `setProgress` from
the same callback — writes into refs that are still `null`, so vanilla shows numbers on tick 1 and
the port shows an empty `.results-sim` until tick 2. That is up to **500 ms** on the native host
(`worker_http.ts:47`) and ~100 ms on wasm. `ProgressTrackerBar.tsx:37-39` has the same shape but is
unaffected, because its mount effect only *clears*.

The fix, and unit 4 must name it: the run-state store keeps `latestProgress` as a **mutable field
outside the `useSyncExternalStore` snapshot** — writing it must not notify, or the split collapses —
and `SimProgress` reads it in a `useLayoutEffect` on mount, before the first paint. `sim-progress.mjs`
step 5 waits for text to appear, so it passes on tick 2 and can never catch this; it needs a unit
test of its own ("the first tick's values are on screen in the same commit that mounts the block"),
mutation-checked by removing the layout effect.

### Fork A — where the running `.results-sim` block lives. **Decide this before unit 4.**

The problem: `.results-content` is written by **two** producers, and only one of them is in scope.
`setSimProgress` writes progress into it (`results_action.tsx:99`), and `setSimResult` writes the
finished topline list into it (`:132`). The finished list is built by
`SimResultsManager.makeToplineResultsContent` (`:380-528`), which has **three consumers** —
`results_action.tsx:134`, `topline_results.ts:22`, and (for `applyZTestTooltip`)
`bulk_sim_results_renderer.tsx:79`. By the skill's own rule (`SKILL.md:886-888`) a component with
consumers in other features does not port with this unit.

- **(a) React owns `.results-content`'s children.** Then the finished-result content must become
  React too, which drags `makeToplineResultsContent` and its three consumers in, or forks its markup
  and with it its CSS class names — the exact failure `SKILL.md:412-415` warns about. **Rejected.**
- **(b) `.results-content` keeps zero React children, forever; the running block renders inside
  `.results-pending`, which React owns outright.** **Recommended.**
- **(c) Add a fifth zone div for progress.** Changes the nine lines at load, fails `parity.mjs` on
  all six specs, and `intended.mjs` cannot express an insertion. Would need a `dropSubtrees` entry
  with a count guard, the `IMPORT_EXPORT` pattern (`parity.mjs:104-106`), for one div. **Rejected.**

**Under (b) the invariant is: React renders `div.results-content` and never gives it a React child.**
React's reconciler leaves foreign children alone while its own child list stays `null`, so
`SimResultsManager`'s `replaceChildren` is safe — *until someone puts one React child there*, at
which point React's next commit and vanilla's `replaceChildren` start fighting over the same node.
State it in the component's header comment and in its test. This is Risk 1.

What (b) changes, precisely: during a run the visible zone is `.results-pending` (holding
`div.results-sim`) rather than `.results-content`. Both are plain block divs inside the same
`div.results-viewer`, itself the single flex item of `.sim-sidebar-results`
(`_sidebar.scss:86-90`), so the box is the same. `.results-sim`'s rules (`_sim_action.scss:5-56`)
are not scoped to `.results-content` and still apply. No gate observes it; the new gate in unit 1
asserts it deliberately.

One second-order consequence, harmless but confusing in devtools: vanilla's first tick did
`replaceChildren` on `.results-content` (`results_viewer.tsx:136`), which removed the *previous*
run's topline nodes. Under (b) nothing touches that node until the next `setSimResult`, so the
previous result's markup sits there, hidden, for the length of the run. It is inert —
`SimResultsManager.reset()` still runs per tick (`results_action.tsx:94`) and has already destroyed
every tippy and listener attached to it. Say so in the component comment; otherwise someone reads
stale nodes in the inspector as a leak.

**One clean consequence worth writing down.** Inside `.results-pending`, the swap between the
spinner and the progress block can be a **plain conditional render** rather than the `hide` class.
`SKILL.md:970-974` says `showWhen` renders `hide` instead of unmounting only because
`panes-parity.mjs` compares element for element against a build that keeps those elements — and
neither gate ever sees this subtree in its running state. This is one of the few places in the
migration where that constraint genuinely does not apply. Do not add `hide` reflexively.

### Fork B — how a hidden zone is hidden

Vanilla writes `style.display`. Both candidates are invisible to `SERIALIZE`:

- **`hidden`** — also removes the zone from the accessibility tree, which `display: none` does too,
  so no behavioural delta. Relies on `[hidden] { display: none !important }` from Bootstrap's
  reboot (`node_modules/bootstrap/scss/_reboot.scss:615`, imported at `ui/scss/index.scss:16`).
  That import is on the migration's removal list (`SKILL.md:659`). **Recommended, with the
  dependency named in the component's comment.**
- **inline `style={{ display: 'none' }}`** — byte-faithful to vanilla and depends on no stylesheet.
  Take this if the Bootstrap dependency is judged not worth carrying.

### The seam: how vanilla drives a React panel

The established pattern in this tree for "vanilla opens/drives a React thing" is a small external
store read with `useSyncExternalStore` — `ImportExportRegistry`
(`ui/app/header/import_export_registry.ts:19-42`, read at `ImportExportMenu.tsx:21-25`) and the EP
dialog's `opener` (`SimApp.tsx:69`). Follow it.

`ui/features/results/model/` is already lint-enforced DOM-free
(`.oxlintrc.json:160-174`, `ui/features/*/model/**` under `no-restricted-globals`), and already
holds `sim_results.ts` and `color_settings.ts`. Both new modules go there.

`SimHost.resultsViewer` (`sim_host.ts:33`) narrows from the concrete class to a handle interface —
the same move stat-weights unit 2 made for `epWeightsModal` (`sim_host.ts:52`). The handle keeps
today's method names so the call sites barely change:

```
contentElem: HTMLElement | null   // nine lazy reads in results_action.tsx
setContent(html: Element): void
setProgress(progress: ProgressMetrics): void   // new — replaces setContent(<div class="results-sim">)
setPending(): void
hideAll(): void
addAbortButton(onAbort: (event: MouseEvent) => void): void
removeAbortButton(): void
```

---

## 4. The warnings half, specifically

**Where they come from.** Six registrations, all through `SimUI.addWarning`
(`sim_ui.tsx:183-185`) → `ResultsViewer.addWarning` (`results_viewer.tsx:94-99`):

| Warning | Site | `updateOn` |
|---|---|---|
| failed profession requirements | `individual_sim_ui.tsx:136-155` | `subscribeAll([gear, profession1, profession2])` |
| more than two JC gems | `:156-168` | `gear` |
| unspent / missing required talents | `:169-188` | `talentsString` |
| armor specialization | `:189-204` | `gear` |
| dual-wielding 2H without Titan's Grip | `:205-219` | `subscribeAll([gear, talentsString])` |
| the spec's own | `:220` — `(config.warnings \|\| []).forEach(w => this.addWarning(w(this)))` | per spec |

The spec surface is **frozen** (`SKILL.md:302-307`): `spec_config.ts:87` declares
`warnings?: Array<(simUI: IndividualSimHost<SpecType>) => SimWarning>` and exactly two specs use it
— `ui/sims/shaman/elemental/spec.ts:24-34` and `ui/sims/shaman/enhancement/spec.ts:24-34`, both the
Fire Elemental autocast warning. Five more specs declare `warnings: []`. **Whatever replaces the
plumbing must keep accepting that exact callback shape** (`SKILL.md:861-863`).

**Lifetime.** Registration is once, at construction, inside `IndividualSimUI`'s constructor body
(`:136-220`) — which runs inside `SimApp`'s layout effect (`SimApp.tsx:46-51`), i.e. **before**
React renders any portal. So a React panel is guaranteed to see the complete list on its first
render; no `useSimReady` gymnastics are needed. There is no `removeWarning`, nothing ever
unregisters, and the array is instance-private (`results_viewer.tsx:32`).

**They do not accumulate across runs, and they have nothing to do with runs.** `getContent()` is
re-evaluated on every notification and `''` means "off" (`:105`), so the list is a pure projection
of current store state. The JC-gems warning appears the moment a third JC gem is socketed and
disappears when it is removed. No run ever adds or removes one.

**How `hideAll` interacts with them: it does not.** `hideAll()` (`:121-125`) touches
`contentElem`, `pendingElem` and `buttonWrapperElem`. `warningElem` is not among them, and no
run-related method touches the warning zone at all. The warning triangle stays visible through a
whole run. This is correct and must be preserved: a warning is a statement about the character, not
about the run.

**What the port changes.** `SKILL.md:858-864` already says where this goes: a registry, because
today only something holding a `simUI` can call `addWarning`, so a ported feature component has no
way to contribute one. `ui/features/results/model/warnings.ts`:

```
add(warning: SimWarning): () => void     // returns the unsubscribe, which ResultsViewer/React registers
subscribe: StoreSubscribe                // fires when any warning's updateOn fires, or one is added
getContents(): string[]                  // the flattened, ''-filtered list — the read
```

**`subscribe` must be a `StoreSubscribe`, and the component must read it with
`useStoreSubscribe(subscribe, getContents)` — not `useSyncExternalStore` directly.** `getContents()`
builds a fresh array per call, which fails `useSyncExternalStore`'s referential-equality check;
React warns "getSnapshot should be cached" and re-renders in a loop. `useStoreSubscribe` exists
precisely because every consumer here reads back through a *facade* rather than off a store slice,
and it carries the `useMemo(() => read(), [version])` snapshot cache for exactly this
(`SKILL.md:762-773`). Keeping the cache in the hook rather than in the registry also keeps
`warnings.ts` a plain object with no memoisation to get wrong. §3's design table and this API agree
on that reading; do not substitute one for the other.

`SimUI.addWarning`'s **signature does not change**, so `sim_ui.tsx:183-185` becomes a one-line
delegation to the registry instead of to the viewer, and `individual_sim_ui.tsx` and the two spec
files are untouched.

**The sequencing note in the skill, and why it does not block this.** `SKILL.md:863-864` says to do
the registry "after the shell's C3, since `addWarning` is one of the five imperative APIs C2
deliberately leaves untouched." **`C2` and `C3` are defined nowhere in the repository** —
`/usr/bin/grep -rn "\bC1\b\|\bC2\b\|\bC3\b" .github/ docs/` returns only those two lines. They are a
dangling reference to a plan document that no longer exists. The constraint as written is about not
*changing* the imperative API; this unit does not change it, so the recommendation is to proceed and
to fix the dangling reference in the same commit. §8, question 2.

**The rendered shape, and the one rule that dies.** The React `SimWarnings` must emit
`div.warning-zone.text-center > div.sim-toolbar-item` (`div.hide.sim-toolbar-item` when the list is
empty) `> button.link-warning.warning > i`, because those four lines are compared. Three of them are
byte-identical; the `<i>`'s glyph class is the one `INTENDED` entry (§0). The tooltip becomes a
`Tooltip` (`ui/ui-kit/Tooltip/`), and **react-tooltip renders in place, not in a portal**
(`SKILL.md:1145-1147`) — so `_sidebar.scss:108-112`'s `.warning-zone [data-tippy-root] { width:
100% }` matches nothing any more and must be re-keyed to `.warning-zone .sim-tooltip` in the same
commit. tippy's `appendTo: 'parent'` (`results_viewer.tsx:74`) means both libraries mount into the
same container, which is what makes the re-key a one-liner rather than a redesign.

**And it needs the one screenshot the skill prescribes.** `SKILL.md:1119-1120`: do the clipping
check once per *new container* a `Tooltip` lands in. `.warning-zone` is a new container. The
sidebar's escape is known (`SKILL.md:620-626`: `position: absolute` resolves against
`aside.sim-sidebar`, which is `position: sticky` and outside `.sim-sidebar-content`'s scroller), and
`.warning-zone` sits inside that same scroller with nothing positioned between — so the answer is
almost certainly "not clipped". Verify it rather than reasoning it, and if it is clipped the fix is
`positionStrategy="fixed"` (`SKILL.md:1121`).

---

## 5. Recommended units, smallest first

### Unit 1 — `tools/react-migration/sim-progress.mjs`, landed green on today's vanilla build

Nothing here is observable, so the gate comes first — and it must pass on `:3401` (master) *before*
a line of this port is written, or it is measuring the port rather than gating it. Model it on
`talents.mjs` / `sidebar-popover.mjs`: `PORT`-selectable, and **the whole output identical on both
builds** except the entries §7 turns into fixes.

What it drives, in order:

1. **At load**: serialise `.results-viewer`'s subtree (tag + sorted classes) and print it; record
   which of the four zones is visible via `getComputedStyle(...).display`; record `hide` on
   `.warning-zone .sim-toolbar-item`.
2. **Warnings**: turn one on and off and assert `hide` follows in both directions. The cheapest
   driver is the talent warning — `talents.mjs:90` already clicks `.talent-tree-reset`, and
   `individual_sim_ui.tsx:169-188` fires `sidebar.warnings.unspent_talent_points` when
   `hasRequiredTalents` fails. **Check on a real spec before committing to it**: the guard at
   `:176` returns `''` when the spec has no required rows *and* no points are spent, so a spec with
   no required talents never trips it. Fall back to socketing a third JC gem if so. Assert the
   tooltip's `<li>` count with it open, since that is the other half no tree gate can reach.
3. **Set iterations low** (`#simui-iterations`, the pattern at `stat-weights.mjs:140-143`) and click
   `.sim-sidebar-actions .dps-action`.
4. **Pending**: assert the spinner is up before the first tick.
5. **Running**: `waitForFunction` on `.results-viewer .results-sim` having text — **not a sleep**,
   for the reason spelled out at `stat-weights.mjs:307-319`. Assert dps/hps parse as numbers, the
   counter matches `/\d+ \/ \d+/` or the presim string, `.results-sim-dps.damage-metrics` is present,
   and `.button-zone button` exists. Keep the selector `.results-viewer .results-sim` — the *parent*
   differs between the builds under fork (b), so nothing may key on `.results-content .results-sim`.
6. **Stop**: click it, assert its label changed and it is disabled, then `waitForFunction` until all
   three zones are hidden (the `hideAll` on abort), with the timeout-then-report pattern from
   `stat-weights.mjs:343-352`.
7. **Completion**: re-run, `waitForFunction` until `.results-content .results-metric` exists, assert
   the Stop button is gone and the Simulate button is enabled again.
8. **Console errors**: the `errors` / `emptyErrors` split from `stat-weights.mjs:121-130`.

- Gate: `PORT=3401 node tools/react-migration/sim-progress.mjs` and
  `PORT=3402 node tools/react-migration/sim-progress.mjs` — identical output, exit 0 on both.
  Add it to `tools/react-migration/README.md`'s table and command list in the same commit.
- Touches no `ui/` file. **Zero merge exposure.**

### Unit 2 — the seam: a handle type, and `setProgress` moved off `results_action.tsx`

Type-level and one small method move; no markup changes, no React.

1. Delete `results_viewer.tsx:9-12` and import `SimWarning` from `@features/sim_host`.
2. `ui/features/results/view/results_panel_handle.ts` (or `model/types.ts`): the interface from §3.
   `sim_host.ts:33` becomes `readonly resultsViewer: ResultsPanelHandle`. `ResultsViewer` already
   satisfies it once (3) lands, so nothing else compiles differently.
3. **Move the `.results-sim` builder from `SimResultsManager.setSimProgress`
   (`results_action.tsx:99-115`) into `ResultsViewer.setProgress(progress)`** — vanilla to vanilla,
   same JSX, same file family. `setSimProgress` shrinks to:
   `this.reset(); if (progress.finalRaidResult?.error) { viewer.hideAll(); return; } viewer.setProgress(progress);`
4. `SimUI` gains `get sidebarResultsContainer(): HTMLElement { return this.dom.sidebarResults; }` —
   `dom` is `protected` (`sim_ui.tsx:61`), so React cannot reach it otherwise. Model it on
   `individual_sim_ui.tsx:304-306`'s `sidebarStatsContainer`.

**This is the only unit that edits `results_action.tsx`, and it is ~20 lines.** After it, unit 4
touches that file zero times. That is the merge-exposure mitigation, and it is why this unit is
second rather than folded into the port.

- Gate: `parity.mjs` and `panes-parity.mjs` byte-identical (no markup moved — the progress JSX is
  identical and is not rendered at load anyway); `npx tsc --noEmit`; oxlint on the touched files;
  `npm run test:unit`; goldens byte-identical; `sim-progress.mjs` output unchanged on `:3402`.

### Unit 3 — `features/results/model/warnings.ts`, DOM-free, with a suite

The registry from §4. `ResultsViewer.addWarning` delegates to it and `updateWarnings` reads
`getContents()`; `SimUI.addWarning` (`sim_ui.tsx:184`) points at the registry instead of the viewer.
Still vanilla, still the same markup.

- Tests: `''` turns a warning off; an array return flattens; a mixed array with an `''` element
  drops only that element; `subscribe` fires on an `updateOn` notification; `add` after a subscriber
  exists notifies it; the unsubscribe is returned and works.
- Gate: `npm run test:unit`; oxlint (the `no-restricted-globals` override on
  `ui/features/*/model/**` is what proves it is DOM-free); `parity.mjs` byte-identical;
  `sim-progress.mjs` identical on both builds.

### Unit 4 — the React panel; `results_viewer.tsx` deleted

`ui/features/results/components/SimResultsPanel/`, one component per file
(`SKILL.md:729-731`, `:1067-1074`):

```
SimResultsPanel.tsx      the four zones, the visibility table, the handle
SimProgress.tsx          div.results-sim; three refs; useImperativeHandle
SimWarnings.tsx          the warning zone, the item, the Tooltip
AbortButton.tsx          the Stop button
SimResultsPanel.scss     unit 5
types.ts                 ResultsPanelHandle, the stage union
index.ts
```

- `results_viewer.tsx` is **deleted**, not kept dual-stack: one consumer, and it is a feature view.
  Same call as `CharacterStats` and `EpWeightsDialog` (`SKILL.md:332`, `:341`).
- `SimApp.tsx` renders `{createPortal(<SimResultsPanel />, simUI.sidebarResultsContainer)}` beside
  the `CharacterStats` portal at `:66`. The container is built by `SimShell.tsx:94`, so
  `useSimReady` is not needed — but the construction order is: `IndividualSimUI` runs in `SimApp`'s
  layout effect and registers all six warnings before the portal renders (§4).
- **Fold the unlaunched block in.** `sim_ui.tsx:107-130` appends
  `.sim-ui-unlaunched-container` into the *same* container, after the viewer. A portal renders after
  construction, so leaving it imperative would reverse the two at load — a real (if unlaunched-only,
  so gate-spec-invisible) divergence. Render it from `SimResultsPanel` gated on `host.disabled`,
  after the four zones, and delete the imperative append. `disabled` is already on `SimHost`
  (`sim_host.ts:31`).
- `AbortButton` uses `Button` with `variant="unstyled"` (`SKILL.md:328` — emits no `btn` at all)
  plus `className="sim-abort-button"`, which keeps the zero styling the class has today and gets
  `type="button"` for free. See §7 defects 1 and 2.
- Nothing renders a React child into `div.results-content`. Ever. Comment it; test it.
- Registry row + change-log entry **in the same commit** (`SKILL.md:362-366`).

- Add the **`INTENDED` entry** for the warning icon's FA5→FA6 rename (§0), in the same commit, in
  the shape of `intended.mjs:31-36`, `max: 1`.
- Tests (`SimResultsPanel.test.tsx`): the visibility table from §2 driven through the handle, one
  case per row; a `Profiler` assertion that **N progress ticks produce zero renders** and one stage
  transition produces exactly one (`SKILL.md:1396-1398`'s pattern, and mutation-check it by making
  `setProgress` a `setState`); **the first tick's values are on screen in the commit that mounts
  `.results-sim`** (§3's race, mutation-checked by deleting the layout effect); the `hide` toggle
  over a fake registry; tooltip cleanup on unmount (`SKILL.md:1192-1193`).
- Gate: `parity.mjs` + `panes-parity.mjs` — eight of the nine lines byte-identical on all six specs
  and the ninth folded by the new `INTENDED` entry, which `parity.mjs:238-241` then requires to be
  *observed*. **This is the real assertion of the unit**: if the eight survive and the ninth is
  accounted for, the load-time surface is provably unchanged;
  `sim-progress.mjs` on both builds, whose diff is now the deliberate list (the
  `.results-sim` parent, plus the §7 fixes); `tabs-a11y.mjs`; `mount-once.mjs` against `:3403`;
  `npm run test:unit`; goldens byte-identical; `git status --short` clean outside the new folder,
  the four known files and the gate (`SKILL.md:387`).

### Unit 5 — SCSS co-location and the two re-keys

`SimResultsPanel.scss` takes:

- `_sim_action.scss:1-3` — `.results-pending .loader { margin: auto }`, moved as-is.
- `_sidebar.scss:108-112` — **re-keyed** from `.warning-zone [data-tippy-root]` to
  `.warning-zone .sim-tooltip`, because react-tooltip creates no `[data-tippy-root]`.

It does **not** take `_sim_action.scss:5-56` (`.results-sim` and `.results-sim-*`): three other
files use those class names (§1, SCSS table), so co-locating them breaks the bulk renderer. Leave
them where they are and say so in a comment.

- Gate: `parity.mjs`; a computed-style probe in `sim-progress.mjs` asserting the loader's `margin`
  and the open tooltip's width, on both builds; the tooltip screenshot from §4.

---

## 6. Risks

**Risk 1 — the `.results-content` ownership invariant. Biggest risk, and the one to write into the
code.** React renders the node; vanilla writes its children. It holds only while React's child list
for that node stays `null`. Anything that puts a React child there — a loading placeholder, an
`&&`-guarded empty state, a `<Tooltip>` declared for convenience — makes React and
`SimResultsManager.setContent`'s `replaceChildren` fight, and the failure mode is a node that
silently loses content mid-run rather than an error. Put it in the component's header comment, in
its test, and in the change-log entry.

**Merge exposure — measured against the working tree, not assumed.**

The results-tables work's unit 1 (`ResultChannel`) has landed in the tree. Overlap, file by file:

| File | Theirs | Mine | Collision |
|---|---|---|---|
| `ui/features/results/view/results_action.tsx` | **untouched** | unit 2, `:93-116` only | none today. This is the whole mitigation |
| `ui/features/results/view/results_viewer.tsx` | untouched | units 2-4 (deleted in 4) | none |
| `ui/app/sim_ui.tsx` | untouched | units 2-4 (`:52,61,103,107-130,183-185,201,210,214,231,235`) | none |
| `ui/features/sim_host.ts` | import at `:12-13`, `resultChannel` on **`IndividualSimHost`** at `:51-52` | `resultsViewer`'s type on **`SimHost`** at `:33`, plus one import | same file, different hunks ~18 lines apart. Textually clean; re-read before editing |
| `ui/app/individual_sim_ui.tsx` | imports, `:85`, `:336-343` | **nothing** — `addWarning`'s signature does not change | none |
| `ui/features/results/model/` | `result_channel.ts` + test | `warnings.ts`, run-state | none — same directory, different files, and their landing confirms it is the right home |
| `tools/react-migration/README.md` | +2 lines (the results-tables row) | +1 row, +1 command | same table, adjacent lines. Trivial, but rebase rather than merge |
| `ui/features/results/view/detailed_results.tsx` | `:336-343` constructor arity | **read-only** (`:326,346`) | none, but see below |

- `results_action.tsx` is edited by **unit 2 only**, at `:93-116` (`setSimProgress`) and nowhere
  else. This plan does **not** touch `addSimResultsAction` (`:20-66`) beyond leaving it as-is, and
  does not touch the manager's data surface at all: `currentChangeEmitter` / `referenceChangeEmitter`
  (`:76-77`), `currentData` / `referenceData` (`:84-85`), `getRunData` / `getCurrentData` /
  `getReferenceData` (`:341-378`), `makeToplineResultsContent` (`:380-528`) and the two static
  builders (`:537-625`). If the concurrent agent's diff lands in that region, unit 2 is a clean
  merge; if it lands in `setSimProgress`, the two collide on ~20 lines.
- `detailed_results.tsx` is a **read-only dependency**: `:326` and `:346` call `runSimOnce()`, which
  is this plan's only non-progress pending path (§1). If the other agent moves or removes those
  buttons, the claim "the spinner is the whole pending UI for run-once" goes stale and unit 1's
  step 4 needs re-checking. Nothing in this plan writes to that file.
- **The trigger that reopens fork A**: if the concurrent results work makes `setSimResult` render
  React into `.results-content`, fork (b)'s invariant is broken and the two must be reconciled — at
  which point (a) becomes the right answer and `makeToplineResultsContent`'s three consumers have to
  be dealt with. Ask before assuming; do not discover it at merge time.
- Unit 1 touches no `ui/` file. Units 3, 4 and 5 touch no file the other agent is in.

**Risk 2 — the warnings tooltip's container.** react-tooltip renders in place
(`SKILL.md:1145-1147`), and `.warning-zone` is a container no `Tooltip` has landed in before. The
sidebar's known escape (`SKILL.md:620-626`) says it should be fine, and none of `getBoundingClientRect`,
`getComputedStyle().visibility` or `elementFromPoint` can tell you (`SKILL.md:1116-1118`). It needs
the one screenshot. Low probability, cheap check, and if it fails the fix is one prop.

**Risk 3 — the `hide` class at load is spec-dependent and is compared.** If a default gear set on
any of the six gate specs happens to trip a warning, `parity.mjs` compares
`div.sim-toolbar-item.hide` against `div.sim-toolbar-item` — and a React implementation that
computes the list slightly differently (say, treating a whitespace-only string as active) fails on
that spec and no other. Pin the exact filter: `content !== ''`, strict, after `.flat()`
(`results_viewer.tsx:105`). Do not "improve" it to `.trim()`.

**Risk 4 — `contentElem` becomes `HTMLElement | null`.** All nine reads are lazy and post-render
(§1), so in practice it is never null when read — but the type changes, and **all nine**
(`results_action.tsx:155,186,201,229,254,255,259,260,285`) dereference it directly
(`this.simUI.resultsViewer.contentElem.querySelector(…)`), so all nine need an optional chain. Unit
2's job; the type-checker finds every one, which is the argument for making the narrowing a
type-only unit rather than discovering them inside the React port.

**Risk 5 — `runSimOnce` has no exit from `pending` on the silent path.** `sim_ui.tsx:230-238` sets
pending and relies on `simResultEmitter` → `setSimResult` to clear it. `runRaidSimWithLogs` skips
the emit when `options.silent` (`sim.ts:716`). No live caller passes `silent`
(`detailed_results.tsx:326,346` pass nothing), so this is latent — but the stage machine inherits
it, and a stage that can never leave `pending` is a worse bug than a spinner that never stops. §7
defect 7.

**Constraint checks**

- Progress must not drive per-tick React state — satisfied by the handle, and asserted by the
  `Profiler` test in unit 4.
- `ui/sims/**` and `ui/features/spec_config.ts` untouched. `spec_config.ts:87`'s `warnings` callback
  shape is preserved exactly; the two shaman spec files are read, never written.
- `SimUI.addWarning`'s signature is unchanged, so `individual_sim_ui.tsx` needs no edit at all.
- `makeToplineResultsContent` does not port (three consumers) — fork A(b) is what makes that
  possible.
- `ui/features/results/view/log/**` and `timeline/**` are untouched; this plan never opens the
  results tab.

---

## 7. Defects found, recorded and **not** fixed

Batch into one `AskUserQuestion` with options, per `SKILL.md:1003-1010`. Each is a real change with
a parity consequence, and the standing rule is not to carry them forward silently just because the
gate would lock them in.

**HTML5 / a11y**

1. `results_viewer.tsx:153` — `<button class="sim-abort-button">` with **no `type`**. Defaults to
   `submit`; harmless outside a form, but it is the named case in `SKILL.md:1006`.
   *Options:* (a) `Button variant="unstyled"` supplies `type="button"` for free — recommended, zero
   visual change, invisible to `SERIALIZE`; (b) leave it.
2. `results_viewer.tsx:86-91` — the warning trigger is **an icon-only button with no accessible
   name**: `button.warning.link-warning` containing only `<i class="fas fa-exclamation-triangle
   fa-3x">`, no text, no `aria-label`, and its tippy content is not an accessible name. Screen
   readers announce "button".
   *Options:* (a) `aria-label` from a new i18n key (needs `en`, `fr` **and**
   `schemas/translation.schema.json` — three files, per `SKILL.md:984-987`); (b) `aria-label` from
   the existing warning strings, joined; (c) leave it. Recommend (a).
3. `results_viewer.tsx:147` — `buttonRef.value.innerText = 'Stopping...'` is **hardcoded English**
   in a fully localised app. There is no key for it.
   *Options:* (a) new key `sidebar.results.stopping` in three files; (b) reuse
   `sidebar.results.reference.cancel`, which is wrong ("Cancel", not "Stopping…"); (c) leave it.
   Recommend (a).

**Dead or inert**

4. `results_viewer.tsx:26-29` — `pendingElem`, `warningElem` and `buttonWrapperElem` are public
   `readonly` with **no external reader**. Only `contentElem` is read outside the class.
5. `results_viewer.tsx:9-12` — `SimWarning` is **declared twice**, here and at `sim_host.ts:19-22`,
   with no structural check between them. Nothing enforces that they stay in step.
6. `results_viewer.tsx:107-108` — `((this.warningsTooltip?.props.content as Element)?.cloneNode(true)
   || <></>)` then `if (list) list.innerHTML = ''`. `list` is always truthy, so the guard is dead;
   after the first `setContent`, `props.content` is the *previous* list, so the clone exists only to
   have its children thrown away; and on the `<></>` branch `list` is a `DocumentFragment`, where
   `innerHTML = ''` sets an expando property rather than clearing anything.
7. `sim_ui.tsx:230-238` + `sim.ts:716` — `runSimOnce({ silent: true })` would set pending and never
   clear it, because the emit that clears it is skipped. No live caller passes `silent`. *Options:*
   (a) leave latent and note it in the stage machine's comment — recommended, since fixing it means
   deciding what `silent` should mean; (b) have `runSimOnce` clear the stage in a `finally`.
8. `results_viewer.tsx:132-134` — `setContent`'s string branch (`innerHTML =`) has no caller and is
   an XSS-shaped API on a method that is otherwise given nodes.

**Naming, in a file this plan does not touch**

9. `ui/domain/player.ts:1268-1284` — `hasArmorSpecializationBonus()` returns `true` when **some**
   slot has the *wrong* armor type, i.e. when the bonus is **missing**. The warning at
   `individual_sim_ui.tsx:196` reads correctly ("Equip {{armorType}} gear in each slot…") only
   because the method is inverted relative to its name. Behaviour is right; the name is a trap.
   *Options:* (a) rename to `isMissingArmorSpecializationBonus()` — two call sites, `ui/domain`,
   outside this plan's scope; (b) leave it and record it. Recommend (b) here, (a) whenever
   `player.ts` is next opened.

**Not a defect — checked and cleared**

- `SimResultsManager.setSimProgress` calling `this.reset()` on **every** tick (`:94`) looks wasteful
  but is load-bearing: it is the only teardown for the tippy instances and click listeners the
  previous `setSimResult` installed. Keep it, and keep it per-tick — moving it to run-start changes
  when a stale result's tooltips die.
- `warnings` never being cleared is fine: registration is once per page, at construction, and there
  is no path that re-registers.
- The `hide` toggle reading `warningsLink.parentElement` (`:117`) rather than a stored ref survives
  only because `SimToolbarItem` always wraps in a `div.sim-toolbar-item` (`sim_toolbar_item.tsx:25`).
  Fragile, but correct today, and the React version has the element in hand anyway.

---

## 8. Open questions for the user

**1. Fork A — the running progress block moves from `.results-content` into `.results-pending`.**
*Recommendation: yes, option (b).* It is the only option that keeps `.results-content` vanilla-owned,
and keeping it vanilla-owned is what lets `makeToplineResultsContent` — three consumers, two of them
in other features — stay out of this port entirely. The cost is one divergence that no load-time
gate can see and that unit 1's new gate asserts deliberately. The alternative is porting the finished
topline list too, which triples the unit and forks a stylesheet vocabulary.

**2. The warnings registry versus `SKILL.md:863-864`'s "after the shell's C3".**
*Recommendation: proceed now, and fix the dangling reference.* `C2` and `C3` are defined nowhere in
the repo, and the constraint they express is "do not change the imperative `addWarning` API" — which
this plan does not: `SimUI.addWarning(warning: SimWarning)` keeps its exact signature and
`individual_sim_ui.tsx` is not edited. Rewrite that sentence to name what it actually depends on, or
delete it, in unit 3's commit.

**3. Fork B — `hidden` attribute or inline `style="display:none"` for a hidden zone.**
*Recommendation: `hidden`.* Both are invisible to `SERIALIZE`, both remove the zone from the
accessibility tree, and `hidden` is the declarative one. It borrows
`[hidden]{display:none!important}` from Bootstrap's reboot (`_reboot.scss:615`, imported at
`ui/scss/index.scss:16`), which the migration eventually removes — so name the dependency in the
component comment. Say so and take inline `style` instead if you would rather not add a Bootstrap
consumer at this stage.

**4. Do the four HTML5/a11y defects (§7 items 1-3) get fixed in this port?**
*Recommendation: yes, all three.* Every one is invisible to `parity.mjs` (a `type`, an `aria-label`
and a text string), so none needs an `INTENDED` entry; they need assertions in `sim-progress.mjs`
instead — which is exactly the arrangement `stat-weights.mjs:1-14` describes and why that gate
exists. Items 2 and 3 need one new i18n key each in three files.

**5. Should the sidebar gain a progress bar?**
*Recommendation: no.* It has never had one, `ProgressTrackerBar`'s `--progress` custom property
already exists if one is ever wanted, and adding one is a feature, not a port. Recorded only because
the technique came up.

**6. The warning icon: take the `INTENDED` entry, or dodge the rename with a raw `<i>`?**
*Recommendation: take the entry.* `Icon` maps `exclamation-triangle` → `triangle-exclamation`
(`ui/ui-kit/Icon/types.ts:56`), so line 9 of the nine changes on all six specs. A raw
`<i className="fas fa-exclamation-triangle fa-3x">` would keep parity byte-identical and break the
house rule that every glyph goes through `Icon` (`SKILL.md:330`), and it would also give up the
`aria-hidden` that `Icon` adds for free. The entry costs four lines in `intended.mjs`, is the
migration's normal mechanism, and — because `parity.mjs:238-241` requires every entry to still be
*observed* — it is an assertion rather than an allowance. The precedent entry
(`intended.mjs:31-36`) already carries the argument that the two names are the same glyph in the
pinned FA 6.0.0 CSS.

**7. Does the plan delete the dead public surface (§7 items 4, 6, 8) as it goes?**
*Recommendation: yes, in unit 4, because `results_viewer.tsx` is deleted there anyway* — the React
component simply never exposes `pendingElem`/`warningElem`/`buttonWrapperElem`, never grows a string
branch on `setContent`, and renders the tooltip list instead of cloning it. Nothing is "removed"; it
is not rebuilt. Item 5 (the duplicate `SimWarning`) is deleted in unit 2, where it is a one-line
import change.
