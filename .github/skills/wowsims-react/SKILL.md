---
name: wowsims-react
description: "Work on the React migration of the wowsims MoP frontend (ui/). Use this whenever you are writing, porting or reviewing a UI component, adding a shared primitive, touching JSX or the tsx-vanilla/React boundary, moving SCSS next to a component, or wondering why part of ui/ is React and part is not. Also use it before building any new widget, because the component registry below likely already has one. Self-documenting: update the registry and the Change log in the same commit as any shared-component change."
---

# wowsims-react

The view layer of `ui/`, mid-migration from `tsx-vanilla` to React.

For everything below the view layer — the layer map, the Zustand store contract, the
state-vs-events rule, persistence, the QA recipes — read `wowsims-ui`. This skill does not
restate them; it assumes them.

## Where the migration currently is

**Phase 1 is complete.** React owns the page root and the top-level tab behaviour; every tab body
is still a vanilla `Component`, and nothing in `features/` has been ported.

Branch `feature/ui-react`, worktree `~/personal/wowsims-mop-react`, stacked on
`feature/ui-restructure`.

| Phase | State |
|---|---|
| 0 — JSX coexistence, React 19, store hooks, LegacyHost, vitest, hook lint rules | **done** |
| 1 — React root, React-owned top-level tabs (same DOM) | **done** |
| 2 — ui-kit primitives land *beside* the vanilla ones | next |
| 3 — features port inward, easiest first | not started |
| 4 — island wrappers (combat replay, Chart.js, VirtualList) | not started |
| 5 — delete tsx-vanilla, the shim, the vanilla Component/Input stack, Bootstrap JS, tippy | not started |

Full plan, including the duplication inventory that drives Phase 2:
`~/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md`.

### What React owns today

| File | Role |
|---|---|
| `ui/app/spec_entry.tsx` | `createRoot(#root).render(<StrictMode><SimApp/></StrictMode>)` — the only `react-dom/client` import |
| `ui/app/sim_app.tsx` | Constructs `IndividualSimUI` exactly once into a ref'd `<div>`, then renders `<SimTabs>` |
| `ui/app/sim_tabs.tsx` | Order, click handling and `active`/`show` for the top-level tabs. Renders `null` |
| `ui/ui-kit/tab_registry.ts` | `SimTabRegistry` — the tab set and which one is open, as a `useSyncExternalStore` source |

The plan called for a DOM-free `IndividualSimHost` constructed before `createRoot`. That is not
possible as written: `SimHost` requires `rootElem`, `resultsViewer`, `simTabContentsContainer` and
`addAction()`, and the `features:` behaviour slots add sidebar buttons during construction. The
construct-once problem it was meant to solve is solved instead by a `useRef` gate in `SimApp`,
which is what makes StrictMode's double-invoked effect safe. A test asserts the gate (it fails
without it).

### Phase 3's unit is the tab plus what it constructs — ACCEPTED 2026-09-05

The user accepted this order over the plan's, and accepted deferring the rest of Phase 2 —
`Toast`, `Dialog`, `Menu` and the three dropdown pickers — until the tab that needs each one ports.
Do not build them speculatively.

The plan orders Phase 3 by **view files per feature**, and file count turns out to have no
relationship to size: `encounter` is one file of 996 lines, the third-heaviest view in the tree,
while `import-export` is four files of 168 lines. The features also do not assemble themselves —
`ui/app/tabs/*` does, in thin dispatchers (`settings_tab.tsx` 492 lines, `rotation_tab.tsx` 299,
`talents_tab.tsx` 112, `gear_tab.ts` 107) that construct the feature components. So the unit is a
tab **and** the components it builds, sized in lines.

Feature view totals, measured: results 4,477 · gear 3,477 · apl 2,925 · bulk 2,371 · reforge 1,003 ·
encounter 996 · stat-weights 890 · talents 661 · character-stats 476 · settings 434 ·
import-export 168 · item-swap 105.

| Unit | Tab | Constructs | Still missing |
|---|---|---|---|
| **Sidebar** | in `individual_sim_ui` | `CharacterStats` 476 | nothing — `NumberPicker` and `Tooltip openOnClick` are built |
| **Talents** | 112 | `TalentsPicker` 265, `GlyphsPicker` 335, `PetSpecPicker` 76 | `GlyphSelectorModal` as an island |
| **Settings** | 492 | `EncounterPicker` 996, settings views 434, `ItemSwapPicker` 105 | `MultiIconPicker` ×2 (`Menu`, or an island), `ListPicker` island, `AdvancedEncounterModal` island |
| **Rotation** | 299 | apl 2,925, `CooldownsPicker`, `TextDropdownPicker` | `Menu`; the APL pickers are `ListPicker`-based, so islands |
| **Gear** | 107 | gear 3,477 — `GearPicker`, three summaries | `Dialog` for `SelectorModal`; `item_list` is a Phase 4 island |
| **Results** | via `addTab` | results 4,477 | the Phase 4 island cluster |

The sidebar is the smallest real unit and needs no new primitive; talents is next. Settings is not
the sixth-easiest feature the plan makes it — it is ~2,000 lines of construction, most of it the
encounter picker.

**Rule 3 is smaller than the plan feared.** `IndividualSimUI` has ten private methods that each do
`new XTab(this)`, and every tab constructor already hands its elements to `SimTabRegistry.attach`
(Phase 1b). Making a tab body React-owned is: React renders the pane's `<div class="…-tab">`, and a
`LegacyHost` inside it runs the same `new XTab(host)`. The 518-line file loses about forty lines,
and the ordering that matters — `addSidebarComponents` before the tabs, `waitForInit` before the
stat-weights action — stays imperative. That is Phase 3's opening move, and it is why no Phase 2
component has a consumer yet: every call site sits inside a body `IndividualSimUI` still builds.

## The JSX boundary — the thing that surprises people

Both JSX dialects compile in this tree. Which one a file gets is decided per file:

- **React is the default.** `tsconfig.json` is `jsx: react-jsx` / `jsxImportSource: react`, and both
  vite configs use the automatic runtime. A new `.tsx` file with no pragma is a React file.
- **A file opts out** with `/** @jsxImportSource @jsx-vanilla */` on line 1. All 94 pre-existing
  `.tsx` files carry it. Their JSX still returns real DOM nodes.

The shim is `ui/shared/jsx-vanilla/jsx-runtime.ts` and it is a direct call through to
tsx-vanilla's `element`, because `element` already accepts children inside `props`: intrinsic tags
prefer `props.children` over the varargs, `children` is in the library's `specialProps` so it is
never assigned to the DOM node, and function components receive `props` unchanged. Its behaviour is
pinned by `jsx-runtime.test.tsx` — if you change the shim, that suite is what tells you whether you
broke `{cond && <x/>}`, `{0}`, or fragments.

Why the types do not collide: tsx-vanilla declares a **global** `JSX` namespace and `@types/react`
19 does not (React's lives in `React.JSX`, re-exported from `react/jsx-runtime`). React files
resolve the module-scoped namespace; opted-out files fall back to the global one. This is why the
migration needs React 19 specifically — React 18's types would collide.

When you port a file to React, **delete its pragma**. That is the whole switch.

## The dual-stack rule

Phase 2 is additive. React components land as new folders; the vanilla `Input` base class and the
12 existing pickers are **not modified and not deleted** until Phase 5.

The reason is mechanical: a still-vanilla view calls `new NumberPicker(parent, config)`. If the
vanilla class were converted in place, every un-ported caller would need a bridge that mounts React
*into* a vanilla parent — a `createRoot` per widget, which is the architecture this migration
rejected. So both stacks coexist, and a component is adopted by a feature only when that feature
ports.

If you find yourself editing a vanilla picker to make a React one work, stop — you are about to
break every caller that has not moved yet.

## Frozen for the whole migration

`ui/sims/**` (all 34 spec definitions) and the `defineSpec` schema in `ui/features/spec_config.ts`
— `IndividualSimUIConfig`, `InputConfig`, `IconInputConfig`, `CustomSection`, `SpecBehaviors` — are
the contract React renders against. A spec-file diff in a migration PR is a reject, not a nit. This
is the surface a mechanical port is most likely to "improve" in passing.

## Component registry

Every shared component lives here. **Check this table before building a widget** — the whole point
of the duplication sweep was to build each shape once.

| Component | Path | Replaces | Parameterises | Fixes |
|---|---|---|---|---|
| `IconPicker` | `ui/ui-kit/IconPicker/` | `ui-kit/pickers/icon_picker.tsx` (still live, dual-stack) | the `IconPickerConfig` it is given | the three-anchor markup, the click/mousedown event map, and the store-on-hide write |
| `ContentBlock` | `ui/ui-kit/ContentBlock/` | `ui-kit/content_block.tsx` (still live, dual-stack) — 18 sites, 9 in `settings_tab.tsx` | `cssClass`, the same `ContentBlockConfig`, `children`, `headerChildren`, `bodyRef`/`headerRef` | the header/body markup and the header-only-when-non-empty rule |
| `TooltipButton` | `ui/ui-kit/TooltipButton/` | `ui-kit/tooltip_button.tsx` (still live, dual-stack) | `icon`, `iconStyle`, `place`, `className` | the `btn btn-link tooltip-button` shape and one tooltip per button |
| `mountBoth` | `ui/ui-kit/react/picker_oracle.tsx` | — (test oracle) | a vanilla picker class + its React port + one config | the per-element attribute diff, and the two fixture traps below |
| `useActionId` | `ui/ui-kit/react/action_id.ts` | `fillAndSetActionId` and the `fill().then(set…)` hand-roll, ~9 sites / 6 files | an `ActionId` | the three fields every site reads — `iconUrl`, `name`, wowhead `href` — and nothing about the markup |
| `AdaptiveStringPicker` | `ui/ui-kit/AdaptiveStringPicker/` | `ui-kit/pickers/string_picker.ts` (still live, dual-stack) | the `StringPickerConfig` it is given | commit on native `change`, and a `size` that follows source changes too (vanilla's `setInputValue` calls `updateSize`) |
| `NumberListPicker` | `ui/ui-kit/NumberListPicker/` | `ui-kit/pickers/number_list_picker.ts` (still live, dual-stack) | the `NumberListPickerConfig` it is given | the comma-separated parse, and the equal-value guard that stops a rewrite mid-edit |
| `NumberPicker` | `ui/ui-kit/NumberPicker/` | `ui-kit/pickers/number_picker.ts` (still live, dual-stack) | the `NumberPickerConfig` it is given | commit on native `change`, the `size` rule, and the float/positive/showZeroes formats |
| `EnumPicker` | `ui/ui-kit/EnumPicker/` | `ui-kit/pickers/enum_picker.tsx` (still live, dual-stack) | the `EnumPickerConfig` it is given | the `select`/`option` markup and out-of-range selection |
| `PickerShell` | `ui/ui-kit/react/picker_shell.tsx` | `Input`'s constructor: root classes, label, description | the picker's own class and its input(s) | class order, `form-label`, tooltip and description handling |
| `BooleanPicker` | `ui/ui-kit/BooleanPicker/` | `ui-kit/pickers/boolean_picker.ts` (still live, dual-stack) | the `BooleanPickerConfig` it is given | the `input-root`/`form-check` markup and where the input sits |
| `useInput` | `ui/ui-kit/react/input.ts` | `Input`'s init/refresh/update cycle | a `ModObject` + an `InputConfig` | reading, writing, `showWhen`, `enableWhen`, `defaultValue` |
| `Button` | `ui/ui-kit/Button/` | 132 clickables — 91 `<button>`, 41 `<a>` — across 12 areas | the element (`as`), `variant`, `size`, any native props | the `btn` base class, `type="button"`, and that `as="a"` carries an `href` |
| `Tooltip` | `ui/ui-kit/Tooltip/` | `tippy()`, 62 call sites / 33 files | `content` (any node), `place`, `clickable`, `openOnClick`, the anchor (`data-tooltip-id`) | the theme, the close events of a popover, and that unmount removes it |
| `Icon` | `ui/ui-kit/Icon/` | hand-written `<i className="fas fa-…">`, 64 sites / 37 files / 11 features | `name` (closed union incl. FA5 aliases), `style`, `size`, `spin` | glyph identity, size validity, style spelling |
| `LegacyHost` | `ui/ui-kit/react/LegacyHost.tsx` | — (bridge) | `create`, `deps` | mounting an un-ported `Component` inside React |
| `useStoreSubscribe` | `ui/ui-kit/react/store.ts` | — (binding) | a `StoreSubscribe` + a read | binding existing subscriptions to a component |

Not yet built, in rough priority — see the plan for evidence and counts:
`ActionIcon`
(the `ActionId` dom writers), `FieldRow`, `PickerGroup`, `IconButton`; then the feature-shaped ones,
of which `SummaryTableRow` + `SummaryResetButton` is the cheapest and `ItemCell` the largest.

### Adding a component to the registry

Add its row **in the same commit** as the component, plus a Change log entry. A component with no
row is how the next person builds it a second time — that is the failure this table exists to
prevent, so treat a missing row as a failed review rather than a formatting nit.

### Reviewing a port — the six checks

A port of an existing vanilla component is not done when its tests pass. It is done when someone
who did not write it has run these, because each one has already caught a defect that every test in
the file passed straight through:

1. **Dump both DOM trees** and compare tag order, class names and attributes — including what the
   base class contributes and *when* it does. Run it, do not read it: `mountBoth` in
   `ui/ui-kit/react/picker_oracle.tsx` constructs the vanilla picker and renders the port over
   equivalent mod objects and diffs them per element, marking a class-order-only difference as such.
   `IconPicker.parity.test.tsx` is the worked example — a case list of configs, each at value 0 and
   at the top value, plus a walk through every value and an `enableWhen` flip. Reading instead of
   diffing is what let a port ship with one anchor where vanilla has three: the missing ones carry no
   `href`, and `.icon-input-improved:not([href])` hides them, so nothing looked wrong.
2. **Map both event sets.** Which DOM event commits in the vanilla component, which one commits in
   the React one? React's `onChange` is the *input* event; the vanilla pickers commit on the native
   `change`. That single mismatch produced three separate user-visible defects.
3. **Every config option handled**, each with a test that fails when the behaviour is removed. Name
   any test that would pass either way — several always exist.
4. **`git status --short`**: anything outside the new folder is a failed review. The dual-stack rule
   means the vanilla component is untouched.
5. **`showWhen` adds `hide`**, and the node stays in the DOM.
6. **Re-run the gates yourself** rather than trusting the report: type-check, oxlint on the new
   files, the new test file.

Check 1 is the porter's job before it is the reviewer's: a picker port is not ready for review
without its `*.parity.test.tsx`. The reviewer's dump is the second pass, not the first.

## Why abstractions here get bypassed — read this before designing one

Six existing abstractions in this tree are ignored by most of their potential callers. There are
exactly two causes, and both are avoidable.

**It fixes the axis that actually varies.** `ItemRenderer` fixes layout while its callers vary icon
tag, name row, sockets and ilvl — 7 of 9 hand-roll instead. `SimTab.buildColumn` does N equal
columns while 7 callers want a left/right pair. `fillAndSetActionId` assumes one anchor with a
background image, while callers have two elements, an `<img>`, or an `AbortSignal` — it is used
once out of ~9 sites. `TooltipButton` hardcodes its icon and classes, so three call sites that need
`d-inline` rewrote it.

**It exists but cannot be reached.** `Input.buildLabel` is private and every bypasser extends
`Component`, not `Input`. `TalentTreePicker` is module-scoped and unexported, so `pet_spec_picker`
retyped its markup *and its class names*.

So when you add a shared component, say in its header comment which axis it parameterises and which
it fixes, and export it from the feature's `index.ts`. If a caller cannot express what it needs
through props, widen the props — do not let it fork the markup, because a fork also forks the CSS
class names, and then the stylesheet has two owners.

## Pickers: how a React component consumes `InputConfig`

`InputConfig` is part of the frozen spec surface, so React fits itself to it, not the other way
round. `useInput(modObject, config)` is that fit, and every React picker is built on it. It returns
`{ value, setValue, hidden, disabled }`, and three of its rules are not obvious:

- **`getValue` is re-read only when the source notifies**, and the result is held in between — this
  lives in `useStoreSubscribe`, so it protects every binding, not just pickers. It is required, not
  an optimisation: configs such as the encounter target list return `getTargets().slice()` — a new
  array on every call — and `useSyncExternalStore` treats a new snapshot identity as a change, which
  React reports as *"The result of getSnapshot should be cached to avoid an infinite loop"*. The
  vanilla `Input` has the same behaviour: it re-reads in `refresh()`, on notification.
- **`description` and `labelTooltip` are `string | Element`, and the Element form is real**
  (`reforge_panel.tsx:527`). Render it with `adoptNode` from `ui-kit/react/dom.ts`; casting it to
  string produces `[object HTMLDivElement]` and nothing fails.
- **`showWhen` renders the `hide` class rather than unmounting.** The plan calls conditional
  rendering the idiom React deletes, and that holds for the hand-rolled container toggles — but a
  picker's own node has to stay while Phase 3 compares DOM against the vanilla build. Revisit in
  Phase 5, when there is no vanilla side to compare against.
- **`defaultValue` seeds the input and the source takes over at the first notification**, whether or
  not the value actually changed — `init()` then `refresh()` in the vanilla class. Vanilla tests it
  for *truthiness*, so a `defaultValue` of 0 is ignored; matched rather than corrected.
- **`revision` counts notifications**, and a picker holding text the user is editing re-syncs on it
  rather than on a value change. `Input.refresh()` runs on every notification, so half-typed input is
  reset by any store event, not only by one that changes this input's value.
- **Every bound picker re-renders on every notification from its own source**, whether or not its
  value changed, because `revision` is part of the snapshot. That is `Input.refresh()`'s behaviour,
  and it is what text pickers need — but it means the encounter tab's ~20 pickers each re-render on
  any `Encounter` change. Faithful, and a known cost: if a tab feels slow in Phase 3, this is the
  first thing to measure, not the last.
- **A text or select picker is uncontrolled and synced imperatively.** Not the usual React shape, and
  deliberate: the vanilla picker commits on the native `change` event — blur *after an edit*, and
  Enter — while React's `onChange` is the input event, which fires per keystroke. Committing on blur
  instead writes on a plain focus/blur, which with `defaultValue` or `positive` set writes a value the
  user never entered. A controlled `value` also renders a `value` attribute the vanilla DOM lacks and
  ties `size` to every render instead of to typing. `BooleanPicker` stays controlled: a checkbox's
  `change` and React's `onChange` are the same event.

### `ListPicker` stays vanilla for now — decided, do not re-open

It is not being ported in Phase 2, and the reasons are structural rather than "it is big":

- **Six of its seven callers are APL**, which is last in the Phase 3 order. The seventh is the
  encounter target list, which wraps as a `LegacyHost` island when encounter ports.
- **`newItemPicker` returns a vanilla `Input`** — the contract, and every caller, hands back an
  instance whose `refresh()`, `signal` and `addOnDisposeCallback` the list drives. A React shell
  hosting those through `LegacyHost` buys nothing over hosting the whole vanilla list that way.
- **Drag state is a module global** (`curDragData`) that crosses list instances, and a drop reads
  `curDragData.listPicker.config` directly. Two implementations sharing that is a real hazard, not a
  hypothetical one. Encounter's list never drags with an APL list (`invalidDropTarget` rejects a
  different `itemLabel`), so nothing is lost by waiting.

It ports when APL ports, with React children — which is also where hand-written list reconciliation
is actually worth deleting.

### The three dropdown pickers wait for the Base UI `Menu` adapter

`IconEnumPicker` and `MultiIconPicker` are dropdown widgets, not icon widgets: both put
`data-bs-toggle="dropdown"` on their button and let Bootstrap's JS open, close and position the
menu, and `multi_icon_picker.tsx:83` listens for `hide.bs.dropdown` — an event only Bootstrap
fires. Porting either before the `Menu` adapter exists means React rendering markup that Bootstrap
then mutates (`show`, `aria-expanded`, Popper's inline styles) — the tabs failure in reverse — or
porting them twice. So they move with `dropdown_picker.tsx` as one batch, after `Menu` lands, which
is the last Phase 2 item because it changes markup shape.

`IconPicker` is not one of them: no dropdown, no tippy, no `showWhen` override on its values. It
ports on its own.

### Tooltip: what the 62 tippy sites need, and what exists

Only the props with a consumer are built. The rest of the mapping is written down so the next port
reaches for the prop instead of inventing one:

The counts are occurrences of each key across `ui/`, a proxy — a few belong to other object
literals — but the ordering is the point. Every react-tooltip name below was read off
`react-tooltip.d.ts`, not recalled.

| tippy | keys in `ui/` | react-tooltip |
|---|---|---|
| `content` | 40 | `content` — it is `children`, and **not rendered until the tooltip first opens** |
| `duration` / `animation` | 20 | CSS in `Tooltip.scss`, not props |
| `placement` | 12 | `place` |
| `onShow` building content lazily | 10 | free, per the first row; drop the callback |
| `plugins`, `popperOptions`, `inlinePositioning`, `triggerTarget`, `onCreate` | 10 | no equivalent — decide at the call site |
| `delay` | 9 | `delayShow` / `delayHide` |
| `theme` | 7 | `className` — the rules become `.sim-tooltip.<theme>` |
| `interactive` | 5 | `clickable` |
| `allowHTML` | 5 | moot; content is JSX |
| `offset` / `maxWidth` | 5 | `offset`; width is CSS |
| `appendTo` | 3 | react-tooltip renders in place; reach for `positionStrategy="fixed"` |
| `trigger: 'click'` | 3 | `openOnClick` — **built** |
| `followCursor` | 1 | `float` |

`openOnClick` sets `globalCloseEvents: { clickOutsideAnchor: true, escape: true }`. The first is
tippy's `hideOnClick`. The second is **also parity, not an addition** — corrected after an audit:
`ui/shared/bootstrap_overrides.ts` binds a global `keydown` that calls tippy's `hideAll()`, so every
tooltip and popover in the tree already closes on Escape, and a React one that did not would be the
odd one out. (An earlier commit removed it on the reasoning that tippy's own dist has no Escape
handling. True, and irrelevant — the app adds it.) Clicking *inside* the tooltip is safe: the
handler returns early on `tooltipRef.contains(target)`, so the `NumberPicker` in the bonus-stat
popover stays open while it is used. Closing on Escape or an outside click **commits** whatever was
typed and not yet blurred, matching tippy — both unmount the content, and removing a user-edited
input fires `change`. Measured, not reasoned: `tools/react-migration/sidebar-popover.mjs`.

`Tooltip` forwards a ref to react-tooltip's `TooltipRefProps`, whose `close()` is the popover's
`instance.hide()` — `character_stats.tsx` hides its bonus-stat popover from inside the picker it
contains, and `reforge_panel.tsx` calls `hideAll()`.

**happy-dom cannot see a tooltip open.** The node keeps `react-tooltip__closing` and never reaches
the shown class, because the transition and floating-ui's measurements need a real layout. What is
testable there is that content *mounts* on the opening event — which is how the `openOnClick` test
tells a click from a hover. Anything about closing has to be checked in a browser.

**`allowHTML: true` — five sites.** Their content is a `translation.json` string carrying `<strong>`
or `<br>`, and React escapes it. Render those, and only those, as
`<span dangerouslySetInnerHTML={{ __html: text }} />`, the way `ContentBlock` does for its header
tooltip. Anything that is not a translation string stays escaped.

The one theme in the tree, `bonus-stats-popover`, is eight lines in
`ui/scss/core/components/_character_stats.scss` that lay out a `NumberPicker` inside the popover. It
belongs to character-stats, not to `Tooltip`: it co-locates when that feature ports, as
`.sim-tooltip.bonus-stats-popover .number-picker-root`.

### Phase 3 readiness — audited 2026-09-05, and unit 1 is not ready

Five read-only audits ran every Phase 2 component against its real call sites. Four gaps were real
enough to fix immediately, each now with a test that fails without it:

- **`useInput` did not re-read its own write when the config has no `storeSubscribe`.** The contract
  names UI-local toggles as the source-less case (`stat_weights_panel.tsx`'s show-all-stats
  checkbox is one), and nothing else tells those a write happened — so a controlled input reverted
  on its own click. `setValue` now rings the subscriber itself in that case, and only that case.
- **`Icon` dropped every unknown prop.** No rest spread, so a `data-tooltip-id` on the `<i>` — which
  `character_stats.tsx` needs, it anchors one tooltip on the icon and another on the button —
  vanished silently.
- **`Button` could not emit a bare `btn`.** `talents_picker.tsx`'s reset is `btn link-danger`;
  `variant={null}` is that shape.
- **`PickerShell` repeated a class.** `classList.add` drops a repeat and `clsx` does not, and two
  live configs pass `input-inline` in `extraCssClasses` *and* set `inline` — a duplicate that would
  have reached the parity harness.

**One prerequisite is left for the sidebar: a `createPortal` mount from `SimApp` into
`.sim-sidebar-stats`.** `sim_ui.tsx` builds that div as vanilla DOM, there is no React mount point
for it, and there is no `createPortal` anywhere in `ui/` yet. The `Tooltip` ref and the `Icon` rest
spread are both built. Carry the `bonus-stats-popover` rules with the port, re-keyed to
`.sim-tooltip.bonus-stats-popover` and with `text-align: left` (the cell is right-aligned).

The browser check that was open is done — `tools/react-migration/sidebar-popover.mjs`, and it
answered both questions against the vanilla build:

- **The popover is not clipped, and `positionStrategy` is not needed.** It overhangs
  `.sim-sidebar-content` by 123px and stays fully visible, hit-testable past the scroller's edge.
  `position: absolute` resolves against `aside.sim-sidebar`, which is `position: sticky` and sits
  *outside* the scroller, and a scroll container does not clip a descendant whose containing block
  is one of its own ancestors. react-tooltip renders in place, in the same cell tippy mounts into,
  so it inherits the same escape. The condition to keep in mind is `.sim-sidebar`'s `sticky`: give
  any element between the popover and it a `position`, and clipping starts.
- **Every close path commits the half-typed value** — Escape, outside click, Enter and a plain Tab
  all wrote `+123`, and nothing was committed while typing. The mechanism is worth knowing because
  it is not the hide: in Chrome, removing a focused input that the *user* edited fires `change`
  then `blur`, while hiding it (`visibility` or `display`) fires nothing and keeps focus. tippy
  unmounts its popper on hide, and react-tooltip unmounts its content on close (`setRendered(false)`),
  so both commit for the same reason. A port that switched to keeping the content mounted and
  hidden would silently discard the edit — and note that the flag is only set by real key events,
  so a test that writes `.value` and dispatches a synthetic `InputEvent` cannot see any of this.

**A React-owned tab pane has no path today, and it is not a `LegacyHost` problem.** `SimTab`'s
constructor takes `(simUI, config)`, calls `super(null, 'sim-tab')`, builds its own pane and nav item
and hands both to `SimTabRegistry.attach`, which appends them — and there is no detach. So
"React renders the pane, `LegacyHost` runs `new XTab(host)`" leaves the host div empty and a second
pane in the container. The smaller move is the same `createPortal` the sidebar needs, aimed at the
vanilla tab's own content container; widening `SimTab` to adopt an existing pane is only necessary
if a whole tab must live inside a `LegacyHost`, which nothing requires.

Three claims in this file were wrong and are corrected above or here: Escape (below), "the sidebar
needs nothing new", and the count of `ListPicker`'s encounter callers — there are two islands in
`encounter_picker.ts`, not one.

## Co-located SCSS, in practice

A component's stylesheet sits beside its TSX and is imported from it. Vite merges it into the same
stylesheet the `<link>` tags in `index_template.html` already produce, and `spec_pages.mts` copies
that page to all 34 spec URLs — nothing has to be registered anywhere.

- `@import 'shared/tokens';` is how a component reaches variables and mixins. It resolves through
  `css.preprocessorOptions.scss.loadPaths`, so the path is the same at any depth.
- `shared/variables` **cannot** be imported alone: it extends bootstrap's `$theme-colors` and uses
  bootstrap mixins, so `shared/_tokens.scss` loads bootstrap's functions, variables and mixins first.
  That costs about 30 ms of Sass per component stylesheet (measured: ten of them add 0.27 s to a
  1.8 s build), which is why one stylesheet per component is the unit, not one per file.
- A vendor stylesheet is imported from the TSX **before** the component's own, because in the
  emitted bundle import order is cascade order and most vendor rules are single-class.

## Component folder layout

```
ui/ui-kit/<Name>/{ <Name>.tsx, <Name>.scss, types.ts, index.ts }
ui/features/<feature>/components/<Name>/{ … }      # `view/` is renamed as each feature ports
ui/features/<feature>/model/                        # unchanged, DOM-free, lint-enforced
```

`types.ts` only when the prop surface earns its own file. `index.ts` is the public surface — a
component nobody can import is a component that gets rebuilt.

Use `tools/restructure/move.mjs` for moves; it repairs every import specifier across `ui/` and
`tools/`. `--dry-run` first.

## SCSS: co-located, still BEM, and a merge rather than a move

Styles move next to their component, but keep BEM — **not** CSS Modules. Scoping would break four
things this tree relies on: `@extend` of Bootstrap utilities and of `.tab-pane-content-container`
(shared by five tab files), tooltips and popups that portal to `<body>`, the `$sim-themes` body
class that themes all 34 specs, and the global utilities (`.hide`, `.icon-md`, `.p-gap`) used in
30+ files.

Two hazards when you move a component's styles:

**It is a merge, not a move.** Rules for one component are already split across files —
`.dropdown-menu` across 9, `.input-root` across 6, `.content-block-header` and `-body` across 5
each. Source order currently decides which wins, so gather them deliberately and check the result
rather than concatenating.

**Some class names have squatters.** `bulk_item_search` and `gear_change_icon` reuse
`item-picker-ilvl` / `item-picker-sockets-container` while building their own markup, and
`pet_spec_picker` reuses the entire `talent-tree-*` / `talent-picker-*` vocabulary to piggyback on
the talent tree's stylesheet. Co-locating those styles silently breaks the piggybacker. Grep the
class name across `ui/` before moving its rules.

## Things that will bite

- **StrictMode is a no-op in every build this app produces.** `vite build` — and
  `vite build --mode development`, and `NODE_ENV=development vite build` — all embed React's
  production bundle. Effects are double-invoked only under the dev server (`node_modules/.bin/vite`)
  and vitest, so that is where a construct-once or double-subscribe bug can be caught at all.
  Verified by removing `SimApp`'s gate: the dev server then renders two shells, a built page one.
- **Dropping a `data-bs-*` attribute drops behaviour you cannot see.** Bootstrap's tab plugin, on
  `window load`, gave every `.active[data-bs-toggle="tab"]` a roving `tabindex`, `role="tabpanel"`
  on its pane and arrow/Home/End keyboard navigation. Removing the attribute removed all of it
  silently: class-level DOM parity was green, the click sweep was green, and keyboard users had lost
  tab navigation. Before replacing any Bootstrap widget, read its `js/dist/*.js` for what its
  constructor stamps on the DOM, and diff *attributes and keyboard behaviour* against the parent
  branch — `tools/react-migration/tabs-a11y.mjs` is the pattern.
- **react-tooltip renders in place, not in a portal.** The tooltip element is a child of wherever
  the `<Tooltip>` sits in the React tree, so an anchor inside an `overflow: hidden` container needs
  `positionStrategy="fixed"` or a tooltip declared higher up. The plan assumed a body portal.
- **react-tooltip injects its stylesheet at runtime unless told not to.** `disableStyleInjection`
  alone only stops the *base* styles; `disableStyleInjection="core"` stops both, which is what the
  `Tooltip` component passes. The library's `REACT_TOOLTIP_DISABLE_*_STYLES` env vars are useless in
  a browser bundle — the guard around them tests `typeof process`, which is `undefined` there. An
  injected `<style>` lands in `<head>` after the bundle, so it silently outranks a component theme.
- **Sim progress bypasses the store.** The worker progress callback writes DOM directly, per tick,
  unbatched. Route it into a slice or hold it behind a ref and throttle — never `setState` per tick.
- **Goldens do not cover the shell.** `tools/state-snapshots/snapshot.ts` imports
  `IndividualSimUIConfig` as a *type* and hand-mirrors `applyDefaults`. They prove no state write
  leaked into a component. They say nothing about whether anything rendered.
- **`ListPicker` splices the array you give it.** `getValue` returns a `.slice()`. It also mutates
  what `getValue` returned, in place: `newList.splice(index, 1)` on delete and `newList[index] = …`
  in the per-item `setValue` (`list_picker.tsx` ~295-300 and ~511). A React picker rendered *inside*
  a vanilla list item reads from `useStoreSubscribe`'s cached snapshot, so if a sibling vanilla
  handler mutates that same array in place, the React picker shows stale data until the next
  notification. Bites in Phase 3, when APL ports.
- **A bound picker renders twice at mount, and runs its effects twice, in every build.** Measured:
  `useInput` gives 2 renders and 2 effect runs at mount with no StrictMode anywhere. The cause is
  `useStoreSubscribe` marking the snapshot stale when it subscribes, so React's post-subscribe read
  builds a fresh `{ value, revision }` and sees a change. An effect that must run once per
  notification therefore cannot use a one-shot ref — compare `revision` and act only when it moved.
  This is the same shape as the StrictMode trap and it is *not* limited to the dev server.
- **`IconEnumPicker` leaves a stale `href` behind.** Its button starts as
  `href="javascript:void(0)"`; `setImage` overwrites it with the wowhead URL when the selected value
  has an `actionId`, and `removeAttribute('href')`s it when that value's `showWhen` is false — but
  for a value carrying only `color` or `iconUrl` it writes neither, so the button keeps the previous
  value's wowhead link. A declarative port cannot reproduce that without tracking history, and
  should not: render the URL for an `actionId`, nothing for a hidden value, and
  `javascript:void(0)` otherwise, and say so in the port's test.
- **Some tab contents read the live document while being constructed.** `detailed_results.tsx`
  does `document.querySelector('.dr-toolbar')` (and the same for the sticky-toolbar root) inside its
  constructor, so its pane must already be in the page by then. This is why `SimTabRegistry.attach`
  appends both elements itself instead of leaving placement to React — React only reasserts order
  afterwards. Any React-rendered pane in Phase 2+ hits this: fix the lookups before moving the pane
  into a component's render, or they silently find nothing.
- **Tooltips portal to `<body>`**, so they outlive their component's subtree. Unmount cleanup is
  load-bearing; assert it in the component's test.
- **`localization.tsx` walks the DOM** for `[data-i18n]` and writes `textContent`. React
  reconciliation clobbers that — React components need `useTranslation`. Checked in Phase 1: the
  only page that depends on the walk is the landing page (`ui/index.html` + `ui/index.ts`, 132 nodes
  at runtime). `ui/index_template.html` carries only `data-i18n-lang` on `<html>`, which sets the
  lang attribute and touches no text. So the walk constrains the homepage only — and the homepage is
  the page React does not obviously improve.
- **`use` is a reserved prefix now.** `react-hooks/rules-of-hooks` keys on it, so a non-hook helper
  named `useX` is a lint error. Name factories `makeUseX` (this is why
  `makeUseDotBaseValueCheckbox` reads the way it does — the proto field is `useDotBaseValue`).
- **`rules-of-hooks` is not in the react plugin's default category.** It is listed explicitly in
  `.oxlintrc.json`; if you rebuild that config, it silently stops running.

## Verification

Run `wowsims-ui`'s gate list, plus `npm run test:unit` (vitest + happy-dom, config in
`vitest.config.mts`).

Two things specific to this migration:

- **Goldens must stay byte-identical.** The port touches `view/` only, so any golden diff means a
  state write leaked into a component. Never regenerate to make it pass.
- **DOM parity is the real gate for the shell**, and it lives in `tools/react-migration/` — four
  Playwright checks against a build of this branch and one of the parent branch, served on two
  ports. `parity.mjs` (structure at load, ~4,000 elements per spec), `panes-parity.mjs` (each tab's contents
  once opened), `tabs-a11y.mjs` (attributes + keyboard), `tabs-behaviour.mjs` (clicking every tab),
  `mount-once.mjs` (StrictMode — against a dev server, see above) and `landing.mjs` (the homepage,
  which every other check skips). Read its README for the
  two expected class diffs and the environmental console errors. Use Playwright, not the Chrome
  extension — the extension reports false "renderer frozen" on this app.

## Change log (keep current — this skill documents itself)

- 2026-09-05 Phase 2 opened. Groundwork first: `@base-ui/react` 1.7.0 and `react-tooltip` 6.0.8
  installed and proved to bundle under Vite 8's oxc, and the co-located SCSS pipeline proved end to
  end in dev and in the build (see the section above; `shared/_tokens.scss` is new). First component
  is `Tooltip` — react-tooltip with the app's tooltip theme, replacing tippy for React call sites as
  each feature ports — followed by `Button`, whose `as="a"` requires an `href` at the type level and
  whose `<button>` defaults to `type="button"`, both defects the hand-written markup allows. Then
  `useInput` and `BooleanPicker`: the first three features Phase 3 ports (character-stats, encounter,
  item-swap) are almost entirely pickers, so the `InputConfig` binding is the real critical path, and
  it is described in its own section above. Base UI is not involved in a checkbox — no Bootstrap JS
  drives one — so `BooleanPicker` emits the same markup as the vanilla picker and needs no new SCSS. Two things the library does that the plan did not predict are recorded under
  "Things that will bite". `vitest.setup.ts` now runs Testing Library's `cleanup` after each test,
  without which a second render finds the first one's DOM.

  The pickers were followed by `useActionId`, which is a hook and not a component on purpose: nine
  call sites read the same three fields off an `ActionId` and every one of them renders a different
  element (`<a>` with a background image, a button-shaped anchor, an `<img>`, a dropdown option, a
  text row), so a component would fix the axis that varies — the reason `fillAndSetActionId` is used
  once out of nine. It seeds synchronously from an id that already carries a name or icon, derives
  the href without filling at all, and aborts a fill in flight when the id changes, so a slow first
  id cannot paint over a second one that resolved sooner (vanilla passes one component-lifetime
  signal and does not guard that race).

  `IconPicker` followed it — the one icon picker that is not a Bootstrap dropdown. Three things the
  adversarial pass caught that a green suite did not: vanilla builds **both** improved anchors at
  every `states` and gates only the *fill*, so an unfilled one is an `<a>` with no href that
  `.icon-input-improved:not([href])` hides — mounting them conditionally changes the element count;
  the store-on-hide write runs from the source subscription, so it fires on **any** notification
  while hidden (a picker that mounts hidden over a non-zero source is zeroed by the first one) and
  never during construction, which a one-shot "skip the first effect" flag gets wrong in both
  directions — and which mounting alone defeats, because a bound picker renders and runs its effects
  **twice at mount in every build** (see the trap below); and `Input.update()` writes `disabled` on the input
  element as well as the class on the root, which React will not render from a typed anchor prop.
  Note that `getAllByRole('link')` cannot see an anchor without an href, so the structural tests
  query the DOM. Out of that came `mountBoth` (`ui/ui-kit/react/picker_oracle.tsx`): check 1 run
  rather than read, diffing the vanilla picker's tree against the port's per element and per
  attribute. Every picker port from here ships a `*.parity.test.tsx` using it —
  `IconPicker.parity.test.tsx` is the worked example, and the five pickers that predate the oracle
  were backfilled. That backfill found the oracle's own blind spot: it serialised attributes, and
  what a field *shows* lives in an IDL property that never reflects — so deleting `checked={value}`
  from `BooleanPicker` made an attribute-only parity file go green. `mountBoth` now serialises
  `value`, `checked` and `selectedIndex`. A checked checkbox does carry the `checked` attribute on
  the React side (React sets it through `defaultChecked`), which is inert here — nothing uses a
  `[checked]` selector and the two `:checked` rules read the property — so that one attribute is
  stripped by name in `BooleanPicker.parity.test.tsx`. `Tooltip` then gained `openOnClick`, the one
  prop the first three Phase 3 features need that it lacked — character-stats' bonus-stat popover is
  a click-triggered interactive tippy that builds a `NumberPicker` in `onShow`, and react-tooltip
  does not render its children until the tooltip first opens, so the laziness is free — and it
  renders **no DOM at all** before that, so a `<Tooltip>` beside an anchor costs nothing in a parity
  diff. `TooltipButton` followed, because `ContentBlock`'s header tooltip needs it: the vanilla one
  hardcodes the question mark, which is why three of its six potential call sites hand-rolled the
  same button, so the React one takes `icon`. Note that `Icon` normalises the FA5 spelling —
  `fa-question-circle` renders as `fa-circle-question` — and that a tooltip anchor carries a
  `data-tooltip-id` the vanilla element does not.

  Then `ContentBlock`, the most-constructed thing in the app layer. Two things the review caught,
  both invisible to the parity diff because they concern content the diff never sees: the header
  tooltip is **HTML** — the vanilla `TooltipButton` passes tippy `allowHTML: true`, and five of the
  eight shipped header tooltips are translation strings carrying `<strong>` or `<br>`, which React
  escapes — and the header needed a content axis, not only a ref, because four call sites append
  into `headerElement` after construction (a description paragraph, and the three gear summaries'
  reset button, which they `replaceChild` on every gear change). `children` is the body, and
  `headerChildren` is that. `config.rootElem` is ignored: it exists so the vanilla `Component` can
  adopt an existing element, and nothing passes one.

- 2026-09-05 Phase 1 complete: React renders the shell, in two steps. **1a** added
  `<div id="root">`, renamed `spec_entry.ts` → `.tsx`, and moved construction into `SimApp` behind a
  `useRef` gate — the shell is still built by `IndividualSimUI`, React just owns when. **1b**
  inverted the tabs: `SimTab` and `SimUI.addTab` hand their elements to `SimTabRegistry` instead of
  appending into the header and calling `data-bs-toggle="tab"`, and `SimTabs` decides order, clicks
  and `active`/`show`. Bootstrap's tab plugin no longer drives the top-level tabs; the tab sets
  *inside* detailed-results, bulk, rotation and the selector modal are still Bootstrap's, by design.
  `SimTabs` also re-implements what the plugin did beyond clicking — roving `tabindex`, arrow and
  Home/End navigation with wrap-around and focus following the selection — and panes carry
  `role="tabpanel"` in their markup, which the plugin used to stamp on load. Two behaviour notes:
  `SimHeader.activateTab` now calls `registry.activate` instead of `.click()`ing the nav-link, so a
  programmatic tab switch no longer fires `trackPageView` (user clicks still do); and the pane open
  on load gets `show` in the same frame as `active`, because only a *switch* needs to fade.
  `SimHeader.activateTab` now delegates to the registry, so the bulk results renderer's
  "back to gear" path is unchanged. Two deliberate DOM diffs against the parent branch, both
  pre-existing quirks removed rather than introduced: the gear nav-*link* no longer carries `show`
  (a pane class Bootstrap put there), and the literal class `false` from
  `${isFirstTab && 'active'}` is gone. Gate: DOM parity across 5 specs (element counts identical,
  only those two class diffs), a Playwright click sweep of all 6 tabs on those specs, goldens
  byte-identical, and 39 unit tests. The six checks are committed at `tools/react-migration/`.

- 2026-09-04 Phase 0 complete. React 19.2 alongside tsx-vanilla: tsconfig and both vite configs
  moved to the automatic runtime, the 94 existing `.tsx` files gained
  `/** @jsxImportSource @jsx-vanilla */`, and the shim landed at `ui/shared/jsx-vanilla/`. Both
  unknowns were verified rather than assumed — TypeScript 7 honours the per-file pragma, and Vite
  8's oxc transform does too (confirmed by inspecting the emitted bundle: React absent,
  tsx-vanilla's `element` present). DOM parity held across 5 specs. Added vitest + happy-dom
  (`npm run test:unit`), `LegacyHost`, `useStoreSubscribe`, and the typed `Icon`. Turned on
  `react-hooks/rules-of-hooks` (error) and `exhaustive-deps` (warn), which forced renaming two
  non-hook APL builders to `makeUse*`. Measured, resolving an open question: a `batch()` writing
  three slices produces exactly one React render with or without `subscribeGated`, so the gate is a
  vanilla-subscriber concern only.
