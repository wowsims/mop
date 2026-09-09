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

**React owns the shell.** `SimShell.tsx` renders everything parent to the tabs — the sidebar, the
header, the content column — and the vanilla `SimUI`/`SimHeader` adopt those elements instead of
building them. React also owns the top-level tab behaviour, the header toolbar, both sets of social
links, the sidebar's character-stats table and five of the six tab bodies. The header is
finished: the import/export dropdowns are Base UI `Menu`s, and no Bootstrap JS is left in it. **Every
tab body is React**, and no feature holds a whole un-ported tab.

`/usr/bin/grep -rl "jsxImportSource @jsx-vanilla" ui/` is the running count: **28**, down from 52
before the APL port. One of the 28 is `ui/README.md`, which documents the pragma and matches its own
prose, so 27 are source files — 15 in `ui-kit/`, 5 in `app/`, 3 in `ui/specs/**`, 2 in the shim
itself, and one apiece in import-export and i18n. `ui/features/apl/`, `ui/features/bulk/`,
`ui/features/gear/` and `ui/features/results/` have none.

Branch `feature/ui-react`, worktree `~/personal/wowsims-mop-react`, targeting `master`. It carries
`feature/ui-restructure` inside it: that branch is never merged on its own, so every gate compares
against master.

| Phase | State |
|---|---|
| 0 — JSX coexistence, React 19, store hooks, LegacyHost, vitest, hook lint rules | **done** |
| 1 — React root, React-owned top-level tabs (same DOM) | **done** |
| 2 — ui-kit primitives land *beside* the vanilla ones | done for everything Phase 3 needs so far; `Menu` landed with the header dropdowns, `Dialog` with the exporters and `ProgressTrackerDialog` with stat-weights; the three dropdown pickers landed once `results_filter` gave them a consumer, and `Toast` is the only primitive still waiting for one |
| 3 — features port inward, easiest first | **done:** sidebar/character-stats, shell sequence C0–C6, encounter, item-swap, header dropdowns and sim title on Base UI `Menu`, settings, import-export, stat-weights, all six saved-data slots, and apl — the whole rotation tab, navbar included. **Partly done:** gear (everything but `glyphs_picker`'s island and the vanilla `ItemNotice` the shell builds) and talents (tab body, `GlyphsPicker`). **Remaining:** `log_runner`'s vanilla half and the Phase 5 sweep. The results feature has no `@jsx-vanilla` file left: `results_action.ts` is the Simulate button's wiring and nothing else |
| 4 — island wrappers (combat replay, Chart.js, VirtualList) | `VirtualList` is built on `@tanstack/react-virtual` and has both its consumers (`SelectorModal/ItemList`, `results/LogRunner`); the combat replay is React, and `DpsHistogram` keeps its Chart.js canvas imperative inside the effect rather than islanding it |
| 5 — delete tsx-vanilla, the shim, the vanilla Component/Input stack, Bootstrap JS, tippy | not started |

Full plan, including the duplication inventory that drives Phase 2:
`~/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md`.

### What React owns today

| File | Role |
|---|---|
| `ui/app/spec_entry.tsx` | `createRoot(#root).render(<StrictMode><SimApp/></StrictMode>)` — the only `react-dom/client` import |
| `ui/app/SimApp.tsx` | Constructs `IndividualSimUI` exactly once into a ref'd `<div>`, then renders `<SimTabs>` and portals the React-owned pieces in |
| `ui/app/SimTabs.tsx` | The Base UI `Tabs` strip and one panel per tab; each panel adopts the pane its `SimTab` registered |
| `ui/ui-kit/tab_registry.ts` | `SimTabRegistry` — the tab set and which one is open, as a `useSyncExternalStore` source |
| `ui/app/SimShell.tsx` | The skeleton — everything parent to the tabs. Renders once, fills the `ShellDom` bundle in a layout effect |
| `ui/app/header/SimToolbar/` | The header's right-hand end: known issues, bug report, download binary, the cog, the socials |
| `ui/app/known_issues.ts` | `knownIssuesFor(simStatus, knownIssues)` — the status notice and the spec's own list, derived rather than accumulated |

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
| **Talents** — **done** | 19 | `TalentsPicker` + `PetSpecPicker` are React; `GlyphsPicker`, `CopyButton`, `PresetConfigurationPicker` and two `SavedDataManager`s stay vanilla behind `useLegacyMount` | `GlyphSelectorModal` needs `Dialog`; the shared four need their other consumers |
| **Settings** | 492 | most of it — see the queue | every content block is React now; the preset picker and the saved-data managers are deferred to their other tabs |
| **Rotation** — **done** | 299 | apl 2,925, `CooldownsPicker`, `TextDropdownPicker` | nothing. The navbar was the last `useLegacyMount` of the seven the tab started with and it ported 2026-09-09, which took `ui-kit/sticky_toolbar.ts` and the tree's last `new TextDropdownPicker(...)` with it |
| **Gear** | 107 | gear 3,477 — `GearPicker`, three summaries | `Dialog` for `SelectorModal`; `item_list` is a Phase 4 island |
| **Results** | via `addTab` | results 4,477 | the Phase 4 island cluster |

The sidebar is the smallest real unit and needs no new primitive; talents is next — and the table
understated it. `PresetConfigurationPicker` is built by **four** tabs (talents, settings, rotation,
gear) and `SavedDataManager` by more, so neither ports with talents: they stay vanilla behind
`LegacyHost`, which nothing has used yet, until their other consumers port. What talents actually
ports is `TalentsPicker`, `GlyphsPicker` and `PetSpecPicker`.

The body itself uses the pattern the sidebar proved rather than the plan's: the vanilla `SimTab`
stays as the thing that registers with the registry and owns an empty `contentContainer`, and
`SimApp` portals the React content into it. `tools/react-migration/talents.mjs` is the baseline —
18 talents in one tree for MoP, a six-digit string with one digit per tier, left click to spend and
right click to clear, and reset zeroing all six. Settings is not
the sixth-easiest feature the plan makes it — it is ~2,000 lines of construction, most of it the
encounter picker.

**Rule 3 is smaller than the plan feared.** `IndividualSimUI` has ten private methods that each do
`new XTab(this)`, and every tab constructor already hands its elements to `SimTabRegistry.attach`
(Phase 1b). Making a tab body React-owned is: React renders the pane's `<div class="…-tab">`, and a
`LegacyHost` inside it runs the same `new XTab(host)`. The 518-line file loses about forty lines,
and the ordering that matters — `addSidebarComponents` before the tabs, `waitForInit` before the
stat-weights action — stays imperative. That is Phase 3's opening move, and it is why no Phase 2
component has a consumer yet: every call site sits inside a body `IndividualSimUI` still builds.

## Base UI `Tabs` — decided 2026-09-05, in progress

Phase 1 kept Bootstrap's tab markup so a class-for-class parity gate could pass. That was too
conservative: mimicking Bootstrap's DOM forever is what would prevent finishing the migration, and
Bootstrap-DOM selectors are *supposed* to die as each component ports. Base UI `Tabs` takes over the
strip and the panes, and the styling is re-expressed on its markup.

Facts verified in `node_modules/@base-ui/react` 1.7.0 — check them again if the version moves:

- **`Tabs.Panel` supports `keepMounted`** (`tabs/panel/TabsPanel.d.ts:36`), and hidden panels get a
  real `hidden` attribute plus `inert`. That is load-bearing: every pane exists from construction
  today, and panes read the live document while building — `log_view.tsx:168` and
  `rotation_view.tsx:263` both do `closest('.dr-root')?.querySelector('.dr-toolbar')` at construction,
  which survives the React pane because a ref callback runs after React has inserted the tree.
- **The state attribute is `data-active`, not `data-selected`** (`tabs/tab/TabsTabDataAttributes.mjs:19`).
- **`Tabs.Panel` ignores a passed `id`.** `TabsPanel.mjs:41` calls `useBaseUiId()` with no argument
  where `TabsTab.mjs:53` calls `useBaseUiId(idProp)`, and `registerMountedTabPanel(value, id)` then
  registers the generated one — so every tab's `aria-controls` would dangle. This decides the
  design: **React renders an empty `<Tabs.Panel keepMounted>` and its ref callback adopts the
  vanilla pane**, rather than the panel *being* the pane. The pane keeps its id, which four
  stylesheets select on (`#gear-tab`, `#bulk-tab`, `#rotation-tab`), and `SimTab`'s signature does
  not change.
- **`activateOnFocus` defaults to `false`** (`tabs/list/TabsList.mjs:21`) and must be set: focus
  follows selection today.
- **Do not add `[hidden] { display: none }`** — `bootstrap/scss/_reboot.scss:615` already ships it
  with `!important`.
- **`@extend` of a missing target is a hard Sass error**, not a silent no-op — proved with the
  repo's own compiler. A dropped class name fails the build rather than quietly changing layout.
  **But "missing" means missing from the whole compilation unit**, which is a weaker condition than it
  sounds: `_list_picker.scss:92`'s `@extend .tippy-content` was recorded as at risk from deleting the
  dropdown-picker tippy theme, and measurement says otherwise — `.tippy-content` is also defined at
  `shared/_tippy_style_overrides.scss:25` and both reach the same unit, so deleting the theme block
  compiles fine and only drops one selector that could never match. Check every definition before
  believing an `@extend` is load-bearing.

**No nested Bootstrap tab strip is left.** All four drive the same classes from React state rather
than adopting Base UI: detailed results on 2026-09-08, the APL sub-tabs and then the batch's
Setup/Results strip and the selector modal's on 2026-09-09. **Bootstrap's tab plugin now has zero
consumers**, which is a Phase 5 deletion, not this one. They still need
`.nav-link`, `.tab-pane`, `.fade`, `.show` and `_bootstrap_style_overrides.scss:198-226`, so none of
that may be deleted.

Commit sequence, and the ordering call that matters — **the gates are rewritten to shape-agnostic
invariants *before* the swap, against the current build**, because a gate rewritten in the same
commit as the change it gates proves nothing:

1. React authors the strip, markup byte-identical. **Done** (`afbc55015`), plus `96dd84aba`, which
   took the markup out of `bulk_tab.title` and gave `SimTabConfig` a typed `badge` field instead —
   a translation string is data, and rendering data as HTML was the wrong shape even though the
   vanilla nav item did it.
2. Gates move from baseline-equality to invariants, still green on today's markup. **Done** (`8324d654e`).
3. The swap — `Tabs.Root/List/Tab/Panel`, the SCSS, and the unit tests. **Done** (`838991da1`).
4. `trackPageView` — **absorbed into 1 and 3**, since it hung off elements those commits deleted.
   Its three behaviour deltas are live and are all improvements, but they are deltas: keyboard
   navigation is now tracked, the detailed-results tab is now tracked at all (`addTab` never
   attached the listener that `SimTab`'s constructor did), and re-clicking the open tab no longer
   fires an event, because `onValueChange` only fires on a change.
5. `Tabs.Indicator` — **declined**, not deferred. The underline is a `::after` on the selected tab
   and is pixel-identical to Bootstrap's; an Indicator is a separate element that slides between
   tabs, which is a visual change, not a port. Raise it as a design choice or not at all.

**What the swap is worth knowing for the next Base UI adoption.** `activateOnFocus` is not the
default and focus-follows-selection needs it. `height: 100%` on a control Bootstrap wrapped in an
`<li>` resolved against that `<li>`, whose height was the control's — against a real parent it is
not a no-op. The `:focus-visible` ring is Bootstrap's `$focus-ring-box-shadow` and it is easy to
miss, because measuring the `<li>` instead of the button shows no ring at all. And Base UI's
composite keyboard navigation does not drive under happy-dom, so that half of a tab port's tests
belongs in the browser gate.

### Animating the panes — read `docs/react/handbook/animation.md` in the package

Base UI documents three routes: CSS transitions via `[data-starting-style]` / `[data-ending-style]`,
CSS animations via `[data-open]` / `[data-closed]`, and JS libraries through the `render` prop. It
recommends transitions over animations, because a transition cancels smoothly mid-flight — which is
the case here, since tabs get switched fast.

**The pane fade is enter-only, and that decides it.** Bootstrap's rules are
`.tab-content > .tab-pane { display: none }`, `> .active { display: block }`
(`bootstrap/scss/_nav.scss:189-196`) and `.fade:not(.show) { opacity: 0 }` over
`$transition-fade: opacity .15s linear`. So the *outgoing* pane is hidden instantly — there is no
exit animation to preserve, and the "outgoing panel still laid out in `.sim-main`'s flex row" blip
only appears if one is added. `keepMounted` puts a real `hidden` attribute on the closed panel, and
Bootstrap's reboot already ships `[hidden] { display: none !important }`, so the instant hide comes
for free and `[data-starting-style] { opacity: 0 }` plus a 150 ms transition reproduces the rest.
That is the faithful port, it needs no dependency, and it deletes the `active`-before-`show` rAF
dance in `SimTabs.tsx`.

**Decided 2026-09-05: use Base UI's CSS transitions wherever they reach.** No animation dependency
is being added. `motion` stays a design choice for later, and if it is ever wanted the docs'
kept-mounted recipe applies — note it is the *second* pattern, not the first:

```tsx
<Tabs.Panel value={id} keepMounted render={(props, state) => (
  <motion.div {...(props as HTMLMotionProps<'div'>)} initial={false} animate={{ opacity: state.hidden ? 0 : 1 }} />
)} />
```

`AnimatePresence` is for components unmounted when closed; these panes stay mounted, because their
content is built once by a vanilla constructor and three of them read the live document. Two API
details worth not rediscovering: `TabsPanelState` exposes **`hidden` and `transitionStatus`, not
`open`** (`tabs/panel/TabsPanel.d.ts:17-26`), and Base UI detects animation completion through
`element.getAnimations()`, so any Motion animation must include `opacity` — the docs suggest
`opacity: 0.9999` when opacity is not otherwise part of it.

Not for tooltips either way: react-tooltip owns its own fade, and its node only unmounts on that
transition's `transitionend` — overriding the opacity is precisely the defect recorded under "Things
that will bite".

`tabs-behaviour.mjs` reads computed opacity, so it works against CSS transitions and inline-animated
values alike.

### The swap's design, settled and measured

- **Where `Tabs.Root` lives.** `sim_header.tsx` emits `<div class="sim-tabs-mount">` where the
  `<ul class="sim-tabs">` is today; React portals `Tabs.Root` into it and renders `Tabs.List` as its
  child, so only the panels are portalled onward into `.sim-main`. `PRUNED` in `parity.mjs` already
  matches `sim-tabs-mount`, so the pruned-subtree count stays 2. Both wrappers need
  `display: contents`: `.sim-header-container` is `display: flex` (`_header.scss:40-42`) and
  `.sim-tabs` is one of its flex items, so a wrapper that participates in layout moves the strip.
- **The panel wraps the pane, it does not replace it.** `Tabs.Panel keepMounted` renders an empty
  div whose ref callback `appendChild`s the vanilla pane — the `TabsPanel` id defect above rules out
  making the panel *be* the pane. `#<id>` therefore stays on the `SimTab` root one level deeper,
  which is exactly why `parity.mjs` compares each `#<id>` subtree separately and normalises line 0.
- **`.sim-main` is `display: flex`** (`_main.scss:6-9`) and today `.tab-pane` is the flex item, so
  the `.tab-pane` rules move to the panel, which becomes the item.
- **What `sim_tab.ts` drops from the pane:** `tab-pane`, `fade` and `role="tabpanel"`. `fade` is the
  dangerous one — `.fade:not(.show) { opacity: 0 }` is global and would hide every pane.
  `.sim-main` also drops `tab-content`.

The strip's computed styles on the parent branch, so the replacement can be written against Base
UI's own attributes rather than `.nav-link` (measured, not read off the Sass):

| | strip | tab | active tab |
|---|---|---|---|
| display / align | `flex`, `nowrap`, `align-items: flex-end` | `flex`, `align-items: center` | — |
| padding | `0` | `14px` | — |
| font | 14px / 700 / SimDefaultFont | 12.25px, line-height 15.3125px | — |
| colour | — | `rgb(165, 177, 214)` | `rgb(255, 255, 255)` |
| transition | — | `color 0.15s ease-in-out` | — |
| underline | — | none | `::after`, 2px, white, `position: absolute; bottom/left/right: 0`, parent `position: relative` |

Those map to the existing `--bs-nav-link-padding-*`, `--bs-nav-link-font-size`,
`--nav-link-transition`, `$nav-link-color` and `$nav-tabs-link-active-color`, which is what the new
rules should use — the numbers above are the check, not the source. `.nav-tabs .nav-item .nav-link`
in `_bootstrap_style_overrides.scss:198-226` stays, because the three nested Bootstrap strips still
need it.

### What the swap must satisfy

The gates went shape-agnostic in commit 2, and in doing so they placed contracts on the swap. Each
fails loudly — an unresolved-identifier or count guard — rather than silently:

- The tab identifier stays a **class token** on the `[role=tab]` element or an ancestor `<li>`.
  `Tabs.Tab` emits no `data-value`, so `className={`sim-tab-link ${entry.id}`}` is what carries it.
- `#<id>` stays on the `SimTab` root, `.sim-tabs` on the `Tabs.List` element, `.sim-main` on the
  pane container, and the Base UI panel is a **direct child** of `.sim-main` carrying
  `role=tabpanel`.
- **`parity.mjs` will fail on the plan as written.** Portalling `Tabs.Root` to keep `#root` at one
  child gives it a host `<div style="display:contents">` with no class, so `PRUNED` will not match
  it and it lands as a third direct child of `.sim-content`. Either give that div a class and add it
  to `PRUNED` (and bump the `pruned !== 2` guard), or portal into `.sim-main`, which is already
  inside a pruned subtree.
- `activateOnFocus` must be `true`, and `tabs-a11y.mjs`'s keyboard comparison is what catches its
  absence.

Full plan, with the SCSS inventory and the risk register:
`scratchpad/base-ui-tabs-plan.md`.

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

`ui/specs/**` (all 34 spec definitions) and the `defineSpec` schema in `ui/features/spec_config.ts`
— `IndividualSimUIConfig`, `InputConfig`, `IconInputConfig`, `CustomSection`, `SpecBehaviors` — are
the contract React renders against. A spec-file diff in a migration PR is a reject, not a nit. This
is the surface a mechanical port is most likely to "improve" in passing.

## Component registry

Every shared component lives here. **Check this table before building a widget** — the whole point
of the duplication sweep was to build each shape once.

| Component | Path | Replaces | Parameterises | Fixes |
|---|---|---|---|---|
| `IconPicker` | `ui/ui-kit/IconPicker/` | `ui-kit/pickers/icon_picker.tsx` (still live, dual-stack) | the `IconPickerConfig` it is given | the three-anchor markup with the level container un-nested out of the picker's anchor, the click/mousedown event map, and the store-on-hide write |
| `ContentBlock` | `ui/ui-kit/ContentBlock/` | `ui-kit/content_block.tsx` (still live, dual-stack) — one importer left, `ui-kit/saved_data_manager.tsx`, and it is not a tab body | `className` (a clsx `ClassValue`, so array notation works), its own `ContentBlockConfigProps` — `header` (`title`, `className`, `titleTag`, `tooltip`) and `bodyClassName` — `children`, `headerChildren`, `bodyRef`/`headerRef` | the header/body markup and the header-only-when-non-empty rule |
| `TooltipButton` | `ui/ui-kit/TooltipButton/` | `ui-kit/tooltip_button.tsx` (still live, dual-stack) | `icon`, `iconStyle`, `place`, `className` | the `btn btn-link tooltip-button` shape and one tooltip per button |
| `mountBoth` | `ui/ui-kit/testing/PickerOracle.tsx` | — (test oracle) | a vanilla picker class + its React port + one config | the per-element attribute diff, and the two fixture traps below |
| `useActionId` | `ui/ui-kit/hooks/useActionId.ts` | `fillAndSetActionId` and the `fill().then(set…)` hand-roll, ~9 sites / 6 files | an `ActionId` | the three fields every site reads — `iconUrl`, `name`, wowhead `href` — and nothing about the markup |
| `AdaptiveStringPicker` | `ui/ui-kit/AdaptiveStringPicker/` | `ui-kit/pickers/string_picker.ts` (still live, dual-stack) | the `StringPickerConfig` it is given | commit on native `change`, and a `size` that follows source changes too (vanilla's `setInputValue` calls `updateSize`) |
| `NumberListPicker` | `ui/ui-kit/NumberListPicker/` | `ui-kit/pickers/number_list_picker.ts` (still live, dual-stack) | the `NumberListPickerConfig` it is given | the comma-separated parse, and the equal-value guard that stops a rewrite mid-edit |
| `NumberPicker` | `ui/ui-kit/NumberPicker/` | `ui-kit/pickers/number_picker.ts` (still live, dual-stack) | the `NumberPickerConfig` it is given | commit on native `change`, the `size` rule, and the float/positive/showZeroes formats |
| `EnumPicker` | `ui/ui-kit/EnumPicker/` | `ui-kit/pickers/enum_picker.tsx` (still live, dual-stack) | the `EnumPickerConfig` it is given | the `select`/`option` markup and out-of-range selection |
| `PickerShell` | `ui/ui-kit/PickerShell/` | `Input`'s constructor: root classes, label, description | the picker's own class, its input(s), and the root `ref` — so a picker whose vanilla constructor appended into its own root can mount that with `useLegacyMount` | class order, `form-label`, tooltip and description handling |
| `BooleanPicker` | `ui/ui-kit/BooleanPicker/` | `ui-kit/pickers/boolean_picker.ts` (still live, dual-stack) | the `BooleanPickerConfig` it is given | the `input-root`/`form-check` markup and where the input sits |
| `useInput` | `ui/ui-kit/hooks/useInput.ts` | `Input`'s init/refresh/update cycle | a `ModObject` + an `InputConfig` | reading, writing, `showWhen`, `enableWhen`, `defaultValue` |
| `Button` | `ui/ui-kit/Button/` | 132 clickables — 91 `<button>`, 41 `<a>` — across 12 areas | the element (`as`), `variant` (incl. `unstyled`, which emits no `btn` at all), `size`, any native props | `type="button"`, and that `as="a"` carries an `href`. The `<button>` branch is Base UI's `Button`; the `<a>` branch is **deliberately not** |
| `Tooltip` | `ui/ui-kit/Tooltip/` | `tippy()`, 62 call sites / 33 files | `content` (any node), `render` (per-anchor content, for one Tooltip serving many anchors — return nothing and no tooltip is drawn at all, which is how tippy's `onShow: () => false` is expressed), `place`, `clickable`, `openOnClick`, the anchor (`data-tooltip-id`) | the theme, the close events of a popover, and that unmount removes it |
| `Icon` | `ui/ui-kit/Icon/` | hand-written `<i className="fas fa-…">`, 64 sites / 37 files / 11 features | `name` (closed union incl. FA5 aliases), `style`, `size`, `spin` | glyph identity, size validity, style spelling |
| `TalentsPicker` | `ui/features/talents/components/TalentsPicker/` | `features/talents/view/talents_picker.tsx` (**deleted** — one consumer, so not dual-stack) | the `TalentsPickerConfig` it is given | the tree/row/talent markup, and left-click-to-spend / right-click-to-clear |
| `CharacterStats` | `ui/features/character-stats/components/CharacterStats/` | `features/character-stats/view/character_stats.tsx` (**deleted** — a feature view, not a dual-stack primitive) | `statList`, `epReferenceStat`, `modifyDisplayStats`, `overwriteDisplayStats` | the group order, the crit-cap row, and the two tooltips per bonus-stat cell |
| `SimHostProvider` / `useSimHost` | `ui/features/sim_host_context.tsx` | threading `host` and `player` down every level | nothing — the value is three stable references | that context carries **identity, never state** |
| `useStoreSubscribe` | `ui/sim/hooks/useStoreSubscribe.ts` | — (binding) | a `StoreSubscribe` + a read | binding existing subscriptions to a component |
| `SocialLink` | `ui/app/SocialLink/` | `app/header/social_links.tsx` (**deleted** — both consumers ported) | one `Social` from `SOCIALS` (`@sim/constants/other`) | the anchor, its tooltip and its accessible name. It renders the link and **nothing around it**, which is the axis that varies: the toolbar wraps each in `div.sim-toolbar-item`, the sidebar does not |
| `EncounterPicker` | `ui/features/encounter/components/EncounterPicker/` | the `EncounterPicker` class in `features/encounter/view/encounter_picker.ts` (**deleted** — one consumer) | `showExecuteProportion`; everything else comes from the host | the block's field order, and that the target-input list and the advanced modal are still vanilla |
| `ItemSwapPicker` | `ui/features/item-swap/components/ItemSwapPicker/` | `features/item-swap/view/item_swap_picker.tsx` (**deleted** — one consumer) | `itemSlots`, `note` | the toggle, the swap button, and that the icon pickers are the group's own children |
| `ImportExportMenu` | `ui/app/header/ImportExportMenu/` | Bootstrap's dropdown plugin + `SimHeader.addImportExportLink` | `kind`, `icon`, `title`, and the registry it reads — whose entries are *either* a vanilla `open()` or a React dialog it renders | the popup's markup and styling, that the contents arrive asynchronously, and which dialog is open |
| `Dialog` | `ui/ui-kit/Dialog/` | `ui-kit/base_modal.tsx` (still live, dual-stack — ~15 subclasses) | `size`, `title`, `header`, `footer`, `preventClose`, `scrollContents`, `cssClass`, `container`, and `elevated` | the header/body/footer stack, the close button, and that the popup is the merge of `.modal-dialog` and `.modal-content` |
| `Popover` | `ui/ui-kit/Popover/` | `tippy({ interactive: true, trigger: 'click' })` — the reforge settings panel's `buildContextMenu`, **deleted**; `ReforgePanel` is the consumer | `trigger`, `triggerClassName` and `triggerProps` (the trigger is the only element the popover puts in the page's flow); `open`/`onOpenChange`, both optional, so omitting them gives an uncontrolled popover the trigger drives; `className` on the popup, `container`, `side`/`align`/`sideOffset`, and `initialFocus` | that it is `Popover` and not `Menu` — the content is a form, not items — `modal={false}`, the tooltip-token box tippy drew, and that closing unmounts the children |
| `CopyButton` | `ui/ui-kit/CopyButton/` | `ui-kit/copy_button.tsx` (still live, dual-stack — `import-export/view/exporter.tsx` is the un-ported caller) | `getContent`, `className` (a clsx `ClassValue`), `text`, `tooltip`, `onCopied` (vanilla's `postClickEvent`) | the `copy-button` class the vanilla `Component` root carried, the `btn`-with-no-variant shape (`variant={null}`, so a caller's `btn-outline-primary` is not doubled), and the no-clipboard branch the hook does not carry: `navigator.clipboard == undefined` alerts the payload, never enters the copied window, and alerts again on a second click. Composes `useCopyToClipboard` |
| `GearChangeIcon` | `ui/features/gear/components/GearChangeIcon/` | `features/gear/view/gear_change_icon.tsx` (**deleted** — the batch's results renderer was its second caller and it has ported) | `slot`, `item`, `previousItem` | the frame markup, the reforge marker's `d-none` rule, and `gearChangeSockets`, which walks the **previous** item's sockets so a slot that gained one reports it unchanged. Reuses `useActionId`, `useWowheadDataset` and `Tooltip`; deliberately not `GemSocket`, whose anchor-plus-two-`<img>` shape shows gems where this shows empty sockets with an exclamation marker. Owns `GearChangeIcon.scss`, co-located once the vanilla twin was gone — its two consumers, the reforge panel and the batch results, both render this |
| `ReforgePanel` | `ui/features/reforge/components/ReforgePanel/` | `features/reforge/view/reforge_panel.tsx`, **deleted** (1,019 lines) | nothing — it is the feature's own shell, portalled from `SimApp` into `simUI.reforgeActionsContainer` | the sidebar button, the `Popover` and its five sections, and the run outcome (toast, `ProgressTrackerDialog`, gear change icons). `simUI.reforger` is now `ReforgeOptimizerModel`, which is what its four readers always wanted |
| `DetailedResults` | `ui/features/results/components/DetailedResults/` | `features/results/view/detailed_results.tsx`, **deleted** (400 lines) — its one consumer was the shell | `resultsManager` (the `SimResultsManager` the sidebar built) and `makeLogExporter` (the shell's factory, because `features/results` may not import another feature's view). Everything else comes from the host | the pane, its ten-tab strip, and the containers the seven metrics tables used to be portalled into — they are ordinary children now, so `SimApp` portals one thing instead of seven. The strip is React state rather than `data-bs-toggle`: `active` on the click and `show` a frame later, so Bootstrap's `.15s` fade still runs. `deferUntilShown` is a state effect where it was `shown.bs.tab`/`hide.bs.tab`, and `CombatReplay.stopPlayback()` rides the same switch. Roving tabindex with arrow/Home/End wrap-around **from the focused tab, not the selected one** — Bootstrap's `_keydown` did that, the two coincide under a roving tabindex, and only a probe caught the difference. Fixes: the damage→healing switch now moves the nav link too (`toolbar.querySelector('.damage-metrics')` never matched `li.damage-metrics-tab`, so pane and highlight disagreed); `type="button"` on all twelve buttons; ids on the tab buttons so each pane can carry `aria-labelledby`; and the sticky-toolbar `IntersectionObserver` finally gets a cleanup. **No co-located stylesheet** — `_detailed_results.scss` also imports the nine partials the six vanilla islands wear, and two of them key on the toolbar's `.stuck`; it stays global until those port. Four islands remain under `useLegacyMount`, each mounted into the div the vanilla JSX already had: `ResultsFilter`, `Timeline`, `CombatReplay`, `LogView` — the topline rows and the histogram are React as of the same day |
| `SelectorModal` | `ui/features/gear/components/SelectorModal/` | `features/gear/view/selector_modal.tsx` (568), `item_list.tsx` (647) and `filters_menu.tsx` (310), **all three deleted** — the gear tab, the batch and item swap are its three consumers now | `id`, which prefixes the pane and tab ids so three instances can be told apart, and `rail`, which the two railless consumers omit — the rail opens each slot with the *equipped* item, so an instance editing anything else must not offer it. Everything else comes from the host-held `GearSelectorModalOpener` it subscribes to | the dialog, the slot rail, the data-derived tab set, the filter row and the virtual row list. Beside it: `ItemList`, `ItemListRow`, `ItemSource`, `SlotRail`, `SlotRailIcon`, `TabGemIcon`, `utils.tsx`. **Ownership is pull, not push** — `IndividualSimUI` holds `readonly gearSelectorModal = new GearSelectorModalOpener()` and the component subscribes, the `EpWeightsOpener` shape, so an `openTab` arriving before React mounts is kept rather than dropped, and `gear_tab.ts` shrank to 12 lines. **The rail hangs off the popup, not inside it**: it goes in `headerChildren` and is `position:absolute; right:100%`, because `.sim-dialog-header` is unpositioned and `.sim-dialog-body` is, so the header is the only child slot that anchors to the popup; the popup's `max-width` reserves the gutter or `.sim-dialog-viewport{overflow-x:hidden}` clips it. **Not `ItemCell`** — that is the equipped-cell layout (icon wrapper, labels container, sockets); a row is a flat six-cell flex line with no wrappers. It reuses `ItemCellAnchor`, `NameDescriptionLabel` and `ItemNoticeIcon` |
| `ResultMetricList` | `ui/features/results/components/ResultMetricList/` | `SimResultsManager.buildResultsTable` and `buildResultsList` (**both deleted** — the sidebar ported on 2026-09-09 and `results_action` kept nothing), plus the eight `setResultTooltip` calls' worth of after-the-fact tippy attachment | `metrics` (a `ResultMetric[]` from `model/topline_metrics.ts`), `layout` — `row` is the detailed-results one-row table, `list` is the sidebar's stacked column — and `referenceDiffs`, which only the sidebar passes | one model, two renderers, built once. Tooltips ride on the metric through `Tooltip` + `useId` (three lists mount at once) with `data-metric` read off `activeAnchor`, instead of `querySelector`-ing eight class names after `replaceChildren`. Keys the tooltip on `metric` rather than round-tripping the localized label through `backendMetricI18nKeys` (now **deleted**, with its two `localization.tsx` readers), **which fixes the French `hps` and `cod` header tooltips** — the map misses there, so master shows the label as its own tooltip. Beside it: `ResultReferenceDiff`, the `.results-reference` slot both layouts render — `hide` while `referenceDiffs` carries nothing for that metric, and when it does, the delta text, its `positive`/`negative` tone and a second `Tooltip` anchored on the span carrying the z score. **Keying on `metric` is also what revived a dead branch**: master's `'% '` label prefix for TMI and CoD compared the *localized* label to `'tmi'`, so it never once fired, and `metricLabelPrefix` reinstated it where the model made the key available. Invisible until the sidebar became its first `list` consumer, which is the `unused.mjs` rule stated as a defect |
| `ToplineResults` | `ui/features/results/components/ToplineResults/` | `features/results/view/topline_results.ts`, **deleted** (28 lines) | nothing — and that is the finding: all three panes render it with no distinguishing prop, because they never had one. Same constructor, same emitter, same filter; column visibility is the manager root's `hide-*-metrics`, not per-pane | the `showOutOfMana` rule moved to `model/topline_metrics.ts` as `showsOutOfMana`, so the whole derivation is unit-testable without a DOM. Renders an empty root before the first run and clears on `emit(null)`, where the island kept stale content behind a hidden row |
| `DpsHistogram` | `ui/features/results/components/DpsHistogram/` | `features/results/view/dps_histogram.ts`, **deleted** (75 lines) | nothing — reads `useSimResult()` | the wrapper is React and the canvas stays imperative, built into the ref'd root inside the effect exactly as vanilla did. One `chart.destroy()` per result instead of a dispose callback accumulated per run |
| `FiltersMenu` | `ui/features/gear/components/FiltersMenu/` | `features/gear/view/filters_menu.tsx` (**deleted** — `view/item_list.tsx` was its only importer and went with the selector modal) | `slot`, `open`, `onOpenChange`; player, sim and container come from the host | the section set a slot earns — armor types only when the class has more than one, weapon types and speeds with the off-hand pair only on `canDualWield`, ranged sections only for a class with ranged weapons, which vanilla expressed as a bare `return` mid-constructor. **It nests under the selector modal through the React tree, not the DOM**: the popup portals to `host.rootElem` as a *sibling* of the parent's portal, Base UI stamps `data-nested` from the React position, `elevated` gives it 1060/1065 over the parent's 1050/1055, and a press inside it is still not an outside press for the parent — which is why it renders inside `ItemList`'s JSX rather than behind an opener at `GearTabBody`. `keepMounted` is deliberately omitted: the pane remounts per request, nothing reads a closed menu, and no `ItemList` exists at load for `parity.mjs` to see. `Sim.ALL_SOURCES.sort()` no longer sorts the shared static array in place |
| `DropdownPicker` | `ui/ui-kit/DropdownPicker/` | `ui-kit/pickers/dropdown_picker.tsx` (still live, but **nothing constructs it any more** — the last `new TextDropdownPicker(...)` went with the APL navbar on 2026-09-09. It is not deletable and is not a Phase 5 sweep either: `ui-kit/pickers/unit_picker.tsx:23` still `extends DropdownPicker`, and `apl/model/action_id_sets.ts:6` imports the `DropdownValueConfig` *type*. Those two are what keep the file, so it goes when `unit_picker.tsx` does) | `options` (each `value`/`label`/`icon`/`className`/`itemClassName`), `equals`, `defaultLabel`, `id`, `className`. `DropdownField` carries vanilla's third type parameter, `<ModObject, T, V = T>`, for a config whose stored type is not its option type — the APL action-id field stores an `ActionID` and offers `ActionId` objects, its unit field stores a `UnitReference` and offers a `UnitValue` | the trigger and menu markup, that picking closes the menu, and `aria-checked` on the selection — a `Menu.RadioGroup` keyed on the option **index**, because a value here is a proto message and Base UI matches by identity. **Not** an `InputConfig` picker: `value`/`onChange` are the whole binding, so a UI-local selection needs no store, and a bound caller wraps it in `useInput` + `PickerShell` — the same split as `CopyButton`/`useCopyToClipboard` and `SavedDataPanel`/`useSavedData`. Submenus, `headerText`, per-option tooltips and `hideLabelWhenDefaultSelected` are deliberately absent, all four being apl-only. `Menu` over Base UI's `Select` because `Select`'s `alignItemWithTrigger` overlays the popup on the trigger where Bootstrap dropped below, and over `EnumPicker` because that is a native `<select>` in a `Field` and an `<option>` cannot hold an `<img>` or a `text-<class>` colour. **`className` and `itemClassName` are not interchangeable** and the APL is why: `className` lands on the trigger as well as the row, and `_apl_rotation_picker.scss:80` makes `.apl-list-item-picker .apl-prepull-actions-only` `display: none`, so a pre-pull-only spell carrying that class on the trigger would hide the whole picker the moment it was selected. `itemClassName` is vanilla's `DropdownValueConfig.extraCssClasses`, which it wrote onto the `<li>`. **Nothing under the trigger is kept mounted**: the portal, the option list and the one `react-tooltip` the options share all live behind `open`, because a closed menu has no anchor for any of them and the rotation pane holds 716 of these pickers, every one of which re-renders on every rotation change. At rest the picker is its button and the empty `div.dropdown-picker-slot`, which is the line `PORTED_MENUS` matches against vanilla's `<ul>` |
| `UnitPicker` | `ui/ui-kit/UnitPicker/` | `ui-kit/pickers/unit_picker.tsx` — its last consumer was `apl_helpers.tsx`, so **nothing constructs it any more**; the file survives for its `UnitValue` type alone, imported by three files outside this folder (`apl/model/unit_values.ts`, `apl/.../UnitField.tsx`, `results/.../ResultsFilter/utils.ts`) and by the folder's own three. `APLUnitPicker` is gone with it | `options` (a `UnitValue[]`), `value`, `onChange`, `id`, `className` | the mapping and nothing else — the three icon shapes a `UnitValue` allows, `text-<color>` on the option **and** the trigger, and reference equality that ignores the display fields around it. Vanilla was a subclass writing into the option `<button>` through `setOptionContent(button, config, isSelectButton)`; composition restates nothing about the menu. Adds the `alt=""` the vanilla `<img>` lacked. **The mapping itself lives in `utils.tsx`, not in the component**: `unitOption(unit, submenu?)` and `sameUnit` are exported because APL's `UnitField` binds the same options through `DropdownField` instead — a bound picker's root has to *be* the `PickerShell`, and `UnitPicker` renders a plain `div`, so wrapping it would add an element the baseline does not have. `submenu` is the caller's; only the APL sets it, filing a pet under its owner |
| `ResultsFilter` | `ui/features/results/components/ResultsFilter/` | `features/results/view/results_filter.ts`, **deleted** (116 lines) | `target` and `onTargetChange` — the selection belongs to `DetailedResults`, because the pane is what re-emits the result every table reads | the option list (all targets, plus one per target of the run), that the picker is `d-none` until a run produces one, and that a selection the next run cannot hold is dropped **before** that run is emitted rather than re-entrantly during it, which is what let the tables briefly filter on a target that no longer existed |
| `useDisplayMetrics` · `useShowExperimental` | `ui/sim/hooks/` | the same four-line `useStoreSubscribe(subscribeUiField(...))` block in `SimShell`, `DetailedResults`, both metrics tables and `EpWeightsDialog` | `sim` — they take it rather than reading the host, because `SimShell` renders before `IndividualSimUI` adopts its DOM and has no provider above it | one subscription over the three ui fields, and **a bitmask snapshot rather than the object**: `useStoreSubscribe` re-reads whenever the *subscription* identity changes, so returning a fresh object there re-renders, and a caller holding an unstable `sim` loops. The mask makes the object rebuild only when a flag changes, which also makes it a stable memo dependency. `epRatios` is not among them — `showsEpRatios` owns that rule in `shell_classes.ts` and derives from the returned object |
| `ProgressTrackerDialog` | `ui/ui-kit/ProgressTrackerDialog/` | `ui-kit/progress_tracker_modal.tsx` (still live, dual-stack — three vanilla consumers, one of them in frozen `ui/specs/**`) | `title`, `className`, `warning`, `hasProgressBar`, `onCancel`, `container`, and the discrete `state` (`stage`, `message`) | that it cannot be closed, the elapsed-time readout, and the split the twin exists for: `stage` is React state, and what a worker message moves goes through `ProgressTrackerHandle.setProgress` — the clock stays a DOM write, the bar is now local state in `ProgressTrackerBar` (Base UI `Progress`), so a tick commits that leaf and never the dialog |
| `EpWeightsDialog` | `ui/features/stat-weights/components/EpWeightsDialog/` | `EpWeightsMenu` in `features/stat-weights/view/stat_weights_panel.tsx` (**deleted** — a feature view, not a dual-stack primitive) | `opener` and `settings`; everything else comes from the host | the 13-column table, the EP-ratio row, the reference selects, and that the saved-EP-weights manager is a vanilla island because the reforge panel is its second consumer |
| `useCopyToClipboard` | `ui/ui-kit/hooks/useCopyToClipboard.ts` | the copy half of `ui-kit/copy_button.tsx` (still live — the log exporter view and the reforge panel keep it) | **nothing about the button** — each caller renders its own `Button` with its own class, label and tooltip, which is the only axis its three consumers varied on. `CopyButton` now wraps this hook rather than competing with it — reach for the hook when a caller renders its own button, and for the component when it wants the vanilla one's shape | the copy and its feedback: `getContent` read at click time (one caller lazily re-exports and fires analytics inside it), the vanilla 1.5s copied window, and a re-entrancy guard held in a **ref** — state has not flushed when a second click lands in the same task, so a state guard copies twice. Wraps `react-use`'s hook |
| `useWowheadDataset` | `ui/ui-kit/hooks/useWowheadDataset.ts` | the `data-wowhead` effect in `GlyphPicker` (converted); all five call sites converted | the target ref and a resolver returning the url, `null` when nothing is selected | clearing the attribute before each resolve, and dropping a resolution that lost the race. `resolve`'s identity is what says the selection moved, so an inline arrow re-clears every render |
| `SearchBar` | `ui/ui-kit/SearchBar/` | the search `<input>` hand-rolled in `gear/view/item_list.tsx`, `bulk/view/bulk_item_search.tsx` and `results/view/log/search/search_bar.tsx` — the first two are **deleted**; the log's is the one that has not ported. Consumers: `GlyphSelectorDialog`, the gear selector's filter row, the log runner and the batch's item search | `value`/`onChange`, `label`, `debounceMs` (0 by default — bulk, gear and glyph never debounced, the log hand-rolled 150 ms), `clearable`/`clearLabel`/`clearClassName` (bulk's), `children` (rendered inside the field after the input group, for the batch's results dropdown, which is absolutely positioned against the box outside it), `placeholder`, `id`, `autoComplete`, `autoFocus`, and `className` — applied to the `<input>` itself so a caller's squatting global class (`.selector-modal-search`) still targets the real control; `clearClassName` is the same rule one element over | `Field.Root`/`Field.Label` wrapping via Base UI, the native `form-control` input, and — when `clearable` — that the clear button lives inside the input group and clears through one call. The clear button is **rendered present-but-hidden** rather than mounted on demand, which is the idiom every `showWhen` in this tree uses and what keeps a caller's adoption a changed line rather than an inserted one |
| `useReadyStoreSubscribe` | `ui/sim/hooks/useReadyStoreSubscribe.ts` | the hand-rolled gate in `SavedSettings`, written the night the un-gated version crashed the app | `subscribe`, `read`, and `ready`; returns `T \| null` | **both halves of the guard**, which is the point — gating the read alone leaves `useStoreSubscribe`'s cached `null` in place until something else changes the subscription, so `ready` is folded into the subscription's identity too. Reach for it whenever a snapshot touches `sim.db`, which is null until init: `useSyncExternalStore` calls `getSnapshot` on the first render, long before any `useSimReady` gate |
| `useTypedLocalStorage` | `ui/ui-kit/hooks/useTypedLocalStorage.ts` | the raw `react-use` `useLocalStorage<T>()` call in `SavedEpWeights` | a storage `key` and a **required** `parse: (value: unknown) => T \| undefined` | the deserializer only — `react-use` still owns read/write/remove. `parse` is required because react-use's generic types the deserialized value as `T` with no proof, so a stale key from an old schema comes back typed as the new shape. Anything `parse` rejects folds into the same `undefined` react-use already returns for an absent key, so callers keep one falsy state instead of two. Its one consumer is now `useSavedData`, which is what components reach for |
| `useSavedData` + six named proxies | `ui/ui-kit/hooks/useSavedData.ts`; `use{SavedEpWeights,SavedGear,SavedTalents,SavedRotation,SavedSettings,SavedEncounter}` under each feature's `hooks/` | the storage half of `ui-kit/saved_data_manager.tsx` (still live, dual-stack — five of the six slots are its vanilla islands) | **the key and the codec, and nothing else.** Every generated `MessageType` satisfies `SavedDataCodec` structurally, so a named proxy is one line: `useSavedData(host.getSavedGearStorageKey(), SavedGearSet)` | the record shape (`Record<name, toJson(data)>`, what `SavedDataManager` has always written), per-entry parse with warn-and-skip, the `json` string entries are compared by, and `save`/`remove`. **Not** presets, which come from config, and **not** identity — `SavedDataManager`'s optional `equals` exists because rotations cannot be compared by their JSON, so a rotation consumer will need that axis back |
| `SimRuns` / `useSimRun` / `useStatWeights` | `ui/sim/sim_runs.ts`, `ui/sim/hooks/` | the abort-then-run preamble copied at each entry point, and `EpWeightsDialog`'s `running` state plus its two guard refs | `useSimRun(kind)` takes only the kind and returns `isRunning`/`isAborting`/`abort` — **no `start`**, so a run can only be begun through a named hook that knows its arguments; `useStatWeights({ onProgress })` binds `computeStatWeights`'s three arguments and its progress shape | that a run is one user-visible operation rather than one worker request, that its two flags live in the store beside every other piece of sim state (so vanilla reads them through `subscribeRunState` and React through `useSyncExternalStore`), and that progress never touches the store — it stays a callback, with `lastProgress` for a consumer that mounts mid-run |
| `VirtualList` | `ui/ui-kit/VirtualList/` | `ui-kit/virtual_list.ts` (still live, dual-stack — `log_view.tsx` is its one remaining caller; `item_list.tsx` is deleted) | `count`, `rowHeight`, `overscan`, `getScrollElement`, `scrollMargin`, `rowClassName` and a `renderRow` render prop | that rows are a **fixed height and never measured** — `measureElement` re-renders on every row reporting a different height, which is an easy infinite loop and something the vanilla list never did either. **The DOM is deliberately different from the vanilla list**: `@tanstack/react-virtual` positions rows absolutely and moves them with `transform`, so there are no spacer rows and a row's sibling position is its position in the *window*, not the list. `:nth-child` striping therefore does not work — every row carries `data-index` and `data-stripe`, and stripes are styled off `[data-stripe='odd']`. **The predicted normaliser turned out to be unnecessary**, and the reason generalises: the modal is a *taken* dialog, compared by count rather than by line, and its rows exist only after a click no tree gate makes. The `:nth-child(2n)` rules in `_item_list.scss` are **gone** with the vanilla list they were for — bulk and item swap render the React one now — and the `[data-stripe]` rules live in the consumer's own stylesheet |
| `PresetConfigurationPicker` | `ui/app/PresetConfigurationPicker/` | the vanilla `app/preset_configuration_picker.tsx` (still live, dual-stack — `rotation_tab.tsx` is its fourth consumer and has not ported) | `categories`, and only that; the builds, the active check and the tooltip all come from the host | the chip markup, which is **not** `SavedDataPanel`'s: a `<button class="saved-data-set-chip">` wrapping a `<span class="saved-data-set-name" role="button">`, versus the panel's div-and-`Button`. Same class vocabulary, different elements, so it is a separate component rather than a `loadOnly` panel. Both share `preset_build_state.ts`, which is where `isBuildActive` and `buildCategories` live so the two stacks cannot drift. One `Tooltip` serves every chip through `render` + `activeAnchor`, replacing a `tippy()` per chip. Uses `useReadyStoreSubscribe`, because vanilla built its chips inside `waitForInit` and the active check has never run against an uninitialised sim |
| `SavedRotation` | `ui/features/apl/components/SavedRotation/` | the `SavedDataManager` in `rotation_tab.tsx`'s `buildSavedDataPickers` | nothing — key, codec, presets and subject all come from the host and `useSavedRotation` | the sixth and last saved-data slot, and the one that needed `SavedDataPanel`'s `isActive` override: an Auto and an APL rotation can serialise differently and still be the same rotation, which is why `SavedDataManager` carried an optional `equals`. It passes `isEqualAPLRotation` instead of relying on the JSON comparison |
| `SavedDataPanel` | `ui/ui-kit/SavedDataPanel/` | the rendering half of `ui-kit/saved_data_manager.tsx` (still live, dual-stack), extracted out of `SavedEpWeights` rather than written fresh | the strings (`title`, `label`, `nameLabel`, `saveButtonText`, and the four alert/confirm messages), the two entry lists, the subject's `currentJson`, and `loadOnly` | the chip rows, the presets/custom split and their `hide` toggles, the create row, the active-entry rule (last match wins, unless the user loaded one by name), and the confirm-before-delete. Deliberately sim-agnostic: a preset's `enableWhen`/`onLoad` arrive already resolved as `disabled` and `afterLoad`, so ui-kit never sees a `Player`. `SavedEpWeights` is now a ~70-line wrapper over it, and its parity test against the vanilla `SavedDataManager` still passes unchanged — which is what proves the extraction kept the markup |
| `SavedEpWeights` | `ui/features/stat-weights/components/SavedEpWeights/` | the `renderSavedEPWeights` call in `EpWeightsDialog` only — that helper **and** `ui-kit/saved_data_manager.tsx` both stay, because `reforge_panel.tsx` calls the helper with three options this component deliberately does not grow | nothing — storage key, presets and player all come from the host | the chip sections and their `hide` rule, the create row, and the active-check. Storage is `react-use`'s `useLocalStorage` on the shared key **the still-vanilla reforge widget also reads**, so its tests drive the real vanilla manager in both directions rather than hand-building JSON. Its focus rings are keyed on `.ep-weights-sidebar`, not a class of its own: the modal subtree is compared by tag plus sorted class list, so a stack-specific root class is a tree diff |
| `GlyphsPicker` | `ui/features/talents/components/GlyphsPicker/` | `features/talents/view/glyphs_picker.tsx` (**deleted** — one consumer) | nothing — the class comes from the host | the two blocks of three slots, the one dialog all six share, and that it **still wears** gear's `item-picker-*` and `selector-modal-*` class names to inherit those stylesheets, which stay global. Only the `.glyph*` rules co-located, checked by a before/after build rule-stream diff rather than by reading specificity |
| `AdvancedEncounterModal` | `ui/features/encounter/components/AdvancedEncounterModal/` | the `AdvancedEncounterModal` class in `features/encounter/view/encounter_picker.ts` (**deleted**) | nothing — `open`/`onOpenChange` only | the header's preset picker, and that its two halves are vanilla islands |
| `Exporter` | `ui/features/import-export/components/Exporter/` | `IndividualExporter` and its six subclasses (**deleted**); `view/exporter.tsx` stays for `LogExporter`, whose opener is in the un-ported log runner | `title`, `allowDownload`, `selectCategories`, `getData` — an `ExporterDefinition` from `features/import-export/exporters/` | the textarea, the copy button, the download button and the category row. `exporterDialog(def)` binds one for the registry, because `individual_sim_ui` cannot write JSX |
| `Importer` | `ui/features/import-export/components/Importer/` | the four header importers and `BulkGearJsonImporter` (**all deleted**, with `view/importer.tsx` and `view/importers/`) | `title`, `allowFileUpload`, `onImport` — an `ImporterDefinition` from `features/import-export/importers/` — plus the description, which is `children` | the description block, the textarea, the upload label and its hidden input, the import button, that a rejected `onImport` is an error toast with the dialog left open, and that a resolved one closes it. The five `*ImporterDialog.tsx` beside it bind one definition each and are not shared components: the description is JSX, so there is no `importerDialog(def)` binder to write. Owns `Importer.scss`, co-located from `scss/core/components/_importers.scss` once no `.importer` was a Bootstrap `.modal` any more — its `.modal-footer` half went with them. **`BulkGearImporterDialog` is the one mounted on demand**, `{open && …}` rather than `keepMounted`: master builds that modal on click, so a portal held at load would be a shell line `parity.mjs` has no baseline twin for |
| `ImportWarning` | `ui/features/import-export/components/Importer/ImportWarning.tsx` | `showImportWarning` in `view/importer.tsx` (**deleted**) | `titleKey`, `messageKey` | the pinned, undismissable warning toast, that its body is a real `<div>`, and its teardown — `Toast` is not a `Component`, so this is `useLegacyMount`'s shape written by hand |
| `MultiIconPicker` | `ui/ui-kit/MultiIconPicker/` | `ui-kit/pickers/multi_icon_picker.tsx` (still live, dual-stack) | the `MultiIconPickerConfig` it is given, plus `subscribe` and `onClear` as props — ui-kit can reach neither `useSimHost` nor `features/` | the option-list markup, hover-open at delay 0, and that clicking inside keeps the menu open |
| `IconEnumPicker` | `ui/ui-kit/IconEnumPicker/` | `ui-kit/pickers/icon_enum_picker.tsx` — the cooldowns picker was its last consumer and `features/settings/view/cooldowns_picker.ts` is **deleted**, so the only `new IconEnumPicker(...)` left is the `iconEnum` branch of `ui-kit/icon_inputs.ts:29`'s `buildIconInput`, which now has no callers at all. `stat_options.ts` still names the class in a `typeof` type position, which is why a naive grep reads as live | the `IconEnumPickerConfig` it is given | the button-and-menu markup, that choosing an option closes the menu, and the button's `href`, which vanilla only ever overwrote. `iconEnumPickerShown(config, modObject)` is its `showWhen()` override, exported because a caller can need the answer without the picker |
| `PlayerSettings` | `ui/features/settings/components/PlayerSettings/` | `buildPlayerSettings` in `app/tabs/settings_tab.tsx`, and with it `configureIconSection`, `configureInputSection` and `buildInputPickers` (**deleted** — no caller left) | the spec's `playerIconInputs` and `playerInputs.inputs` | the block's order, the hand-rolled race and profession configs, and the icon group's inline `gridTemplateColumns` |
| `RaidBuffs` | `ui/features/settings/components/RaidBuffs/` | the buffs block's `relevantStatOptions` walk plus its misc bundle | the option list | that the misc bundle is a `MultiIconPickerConfig` assembled from `IconPickerConfig`s, as the vanilla builder did |
| `InputPicker` | `ui/features/settings/components/InputPicker/` | `buildInputPickers` in `app/tabs/settings_tab.tsx` (**deleted** — the player block was its last caller) | one `InputConfig`, dispatched on its own `type` | that the modObject is the player, and `reverse` on the boolean branch — both fixed in the vanilla helper too |
| `OtherSettings` | `ui/features/settings/components/OtherSettings/` | `buildOtherSettings`' input half, plus the `ItemSwapPicker` portal it used to order against | the spec's `inputs` and `itemSlots` | that item swap comes after the inputs — which is now the order they are written in, not an append |
| `StatOptionIcons` | `ui/features/settings/components/StatOptionIcons/` | the `options.map(o => new o.picker(...))` in the two cooldown blocks | a `relevantStatOptions` list | that every entry is an `IconPicker` — typed, so Buffs and Debuffs cannot be wired up half-working before `MultiIconPicker` ports |
| `CustomSection` | `ui/features/settings/components/CustomSection/` | `buildCustomSection` in `app/tabs/settings_tab.tsx` (**deleted** — one caller) | a `CustomSection` config — its block, its icon row and its inputs | that `inline` is forced, matching the walk the builder did afterwards, and that `when` toggles `hide` on the block's root rather than on the body |
| `ConsumesPicker` | `ui/features/settings/components/ConsumesPicker/` | the `ConsumesPicker` class in `features/settings/view/consumes_picker.tsx` (**deleted** — one consumer) | `consumableStats`, the two stat-option lists and `petInputs` | the five rows, which consumables field each picker writes, and that a row's `hide` is decided by its children's visibility |
| `useSimReady` | `ui/app/hooks/useSimReady.ts` | — (binding) | a `Sim` | that a portal target built inside a `waitForInit` callback does not exist before it. In `app/`, not `ui-kit/`: it encodes this shell's init order, not domain state |
| `useSimResult` | `ui/features/results/hooks/useSimResult.ts` | — (binding) | nothing — it reads `useSimHost().resultChannel` | that the channel replays its last value, so a component mounting after a run still sees it |
| `MetricsTable` | `ui/features/results/components/MetricsTable/` | `features/results/view/metrics_table/metrics_table.tsx` + `table_sorter.ts` (**deleted**) | `rootClassName`, `columns` (TanStack column defs, `meta.columnClass` / `meta.headerCellClass` / `meta.tooltipId` / `meta.headerTooltipId` + `meta.headerTooltip`), `rows`, `sortColumnId`, `hasResult`, `rowClassName` (`customizeRowElem`) | the whole shell — `table.metrics-table`, the header row, a `<button class="metrics-table-sort">` wrapping a `<span>` in every `<th>`, `.parent-metric.expand` / `.child-metric`, `data-text` on every cell — and the six ways TanStack's defaults differ from `TableSorter`. **The sort handler stays on the `<th>`** and the button carries none of its own: activating it by mouse, Enter or Space raises a click that reaches the cell's, so the whole cell is still the hit area and `aria-sort` on the `<th>` reports the direction. `parity.mjs` folds the button back out with `normaliseSortButtons`, counted against the pane's own header-cell count. Owns `MetricsTable.scss` — `.metrics-action*`, `.parent-metric`, `.child-metric`, the caret and expand-toggle rules, co-located from `_detailed_results.scss`, plus `@import 'shared/tokens'` for `wowhead-background-icon`. A column carrying `meta.tooltipId` turns each of its `<td>`s into that column's one tooltip anchor, with `data-row-id` for the row, keyed by `getRowId`, which is `model/grouping.ts`'s `metricRowId` so `indexMetricRows` cannot drift from it. `MetricsActionCell` beside it is the Name cell: icon anchor — `aria-label` from the metric name, because the anchor has no text of its own — the name, and the expand toggle as a real `<button>`; `metricForAnchor(byRowId)` beside it is the reader for that `data-row-id`, so the writer and the reader of the attribute ship together |
| `MetricsTotalBar` | `ui/features/results/components/MetricsTotalBar/` | `features/results/view/metrics_table/metrics_total_bar.tsx` (**deleted**) | `percentage`, `max`, `total`, `value`, `overlayValue` (shielding, healing's only), `spellSchool`, `classColor` | the `--percentage` custom property both fills are driven by, and that a null `max` divides by 1. Owns `MetricsTotalBar.scss` — the five `.metrics-total*` rules, co-located from `_detailed_results.scss` |
| `MetricsCombinedTooltip` | `ui/features/results/components/MetricsCombinedTooltip/` | `MetricsCombinedTooltipTable` in `features/results/view/metrics_table/metrics_combined_tooltip_table.tsx` (**deleted**, and with it the `.tippy-box[data-theme='metrics-table']` rules it was the only setter of) | `groups`, `headerValues` (Type / Count / Average overrides, by position), `hasMetricBars` | the tooltip **body** only — the nested `table.metrics-table`, the zero-value filter, the value-descending order, the average column appearing only when an entry has one, and the group header row only when more than one named group survives. The anchor, the opening and the veto are the column's one `<Tooltip>`, not this |
| `CastMetricsTable` | `ui/features/results/components/CastMetricsTable/` | `features/results/view/cast_metrics.ts` (**deleted** — one consumer, not a dual-stack primitive) | nothing — it takes the result from `useSimResult` | the three columns, the pet grouping and `shouldCollapse` |
| `attackMetricsColumns` | `ui/features/results/components/AttackMetricsColumns/` | the column and tooltip-group blocks the damage, damage-taken and healing tables would each hand-roll | **the column set, its order, and every column's bindings** — the caller composes its own array and passes each builder the metric fields, the header key and the tooltip ids. `name`, `primary` (`total` / `value` / `percentage` / `max` / `overlay` / `tooltipId`), `casts`, `withTicks` (`value` / `tick` / `format` / `zeroWhen` / `dashWhen`) and `rate`, plus `damageBreakdownGroup` / `castsGroup` / `hitGroups` / `missGroup` / `threatGroup` / `threatTooltip` and `useMetricMax` | **only how one named shape renders**: the Name cell's markup, the primary cell's bar and its two class tokens, the `value (tick)` pair, and the rate column's `text-success` / `text-body`. Deliberately *not* the layout — the three consumers already disagree on order (damage puts Crit % before Miss %, dtps after) and healing shares four of its twelve columns, so a builder keyed on a table *kind* would have been bypassed. A shape none of these covers is written inline with `createMetricsColumnHelper` and dropped into the same array: an entry added, never a fork |
| `DamageMetricsTable` | `ui/features/results/components/DamageMetricsTable/` | `features/results/view/damage_metrics.tsx` (**deleted** — one consumer) | nothing — the result comes from `useSimResult` and the threat flag from the store | the ten columns in their order, the pet grouping through `ActionMetrics.joinById`, the `threat-metrics` row class, and the seven column tooltips plus the Avg Cast header's. Composed from `attackMetricsColumns`; only Miss %, DPET and the tooltip bodies are its own |
| `HealingMetricsTable` | `ui/features/results/components/HealingMetricsTable/` | `features/results/view/healing_metrics.tsx` (**deleted** — one consumer) | nothing — the result comes from `useSimResult` and the threat flag from the store | the twelve columns, the `hps > 0` filter, the shielding overlay (the only `overlayValue` user), the `threat-metrics` row class, and five column tooltips of which three are threat-vetoed, plus three header tooltips |
| `DtpsMetricsTable` | `ui/features/results/components/DtpsMetricsTable/` | `features/results/view/dtps_metrics.tsx` (**deleted** — one consumer) | nothing — the result comes from `useSimResult`; it reads **no** threat flag, because it shows no threat | the nine columns (Miss % before Crit %, the reverse of damage), that the rows are the *targets'* damage actions and not the player's, `shouldCollapse: () => true` because a target is never a pet, and four column tooltips plus two header tooltips — none of them threat |
| `AuraMetricsTable` | `ui/features/results/components/AuraMetricsTable/` | `features/results/view/aura_metrics.ts` (**deleted** — both consumers ported) | `useDebuffs`, the one axis vanilla's constructor branched on — it picks the root class *and* the data source | the four columns, that a debuff run reads `getDebuffMetrics` while a buff run reads the player's own auras plus one group per pet, and that `useBuffAura` reaches the wowhead dataset |
| `ResourceMetricsTable` | `ui/features/results/components/ResourceMetricsTable/` | `features/results/view/resource_metrics.tsx` — both classes (**deleted** — one consumer) | nothing at the root; `ResourceMetricsSection` beside it takes `resourceType`, `title`, `columns` and `resultData`, so the six column defs are built once and shared by all 15 | that all 15 `orderedResourceTypes` containers are always in the DOM in order, that a container carries `hide` exactly while its table has no rows, and the generic-resource title coming from the spec's `secondaryResource`. Owns `ResourceMetricsTable.scss`, co-located from `scss/core/components/detailed_results/_resource_metrics.scss` |
| `SimResultsPanel` | `ui/features/results/components/SimResultsPanel/` | `features/results/view/results_viewer.tsx` (**deleted** — one consumer, a feature view), and with it the last importer of `ui-kit/sim_toolbar_item.tsx` (**deleted** too; `app/header/SimToolbar/ToolbarItem.tsx` had already superseded it everywhere else) | `panel` (the `ResultsPanelStore` the shell drives), `warnings` (the `WarningsRegistry`) and `results` (the `SimResultsManager`, nullable because the shell builds it after the base constructor); `disabled` and the healing flag come from the host | the four zones in order and the visibility table across them — `setPending` and `setContent` leave the button zone alone, `hideAll` takes it down without removing the button — plus the same split `ProgressTrackerDialog` exists for: the stage is React state, and dps, hps and the iteration counter are `textContent` writes off `ResultsPanelStore.onProgress`, never renders. **`.results-content` holds `SimResultSummary` as an ordinary child** since 2026-09-09: `setContent(html)` and `contentElem` are gone from the handle and the store, replaced by `showResult()`, which flips the stage and nothing else. The running block still renders inside `.results-pending`, so both zones hold a `.results-sim` once a run has completed, and the previous run's summary sits in the hidden content zone for the length of the next run. Two seams are load-bearing and neither is visible to a browser gate: the store's `notify` is `flushSync`, because the run action reads the panel back in the click's own task, and `latestProgress` is a mutable field **outside** the `useSyncExternalStore` snapshot that `SimProgress` reads in a mount layout effect, because tick one carries both the stage change and the first numbers. Beside it: `SimResultSummary` (the finished run — `ResultMetricList` at `layout="list"` plus the reference bar, returning `null` until the first result so the zone is empty at load, and reading the manager through `useStoreSubscribe` over both its emitters), `SimProgress` (the running block and its three refs), `SimWarnings` (the zone, the `hide` toggle and the tooltip — read through `useStoreSubscribe`, because `getContents()` builds a fresh array per call), `AbortButton` (Stop, which `flushSync`es its own relabel and disable before calling the handler) and `UnlaunchedNotice` (folded in from `sim_ui.tsx`, so it can no longer render before the panel it is supposed to follow). Owns `SimResultsPanel.scss` — `.results-pending .loader` from `_sim_action.scss` and `.warning-zone [data-tippy-root]` from `_sidebar.scss`, re-keyed to `.warning-zone .sim-tooltip`; `.results-sim*` deliberately stays global, the bulk renderer emits it |
| `ItemCell` | `ui/features/gear/components/ItemCell/` | the cell shape nine sites hand-roll; it absorbs gear's own — `GearPicker`'s sixteen. `view/item_renderer.tsx` is **deleted**: its two callers were bulk's picker and its results renderer, and `ItemDetailCell` beside this is what replaced it | the six axes the duplication survey found varying: the icon element and how its image is set, whether there is an item-level badge and whether it carries the `+N` upgrade span, what the name row holds, the enchant/tinker/reforge stack, whether there are sockets and what they do, and a trailing action slot. `ilvl` and `sockets` are three-state on purpose — omitted drops the element, `null` keeps the empty one an unfilled gear slot renders | the class vocabulary (`item-picker-root`, `-icon-wrapper`, `-ilvl`, `-sockets-container`, `-name-row`, `-name-container`, `-labels-container`) and the nesting order, and nothing else. That is the whole lesson of `ItemRenderer`, which fixed the icon, the badge, the name row, the sockets and the labels as well and was bypassed by seven of its nine callers. Beside it: `ItemCellAnchor`, which is how `href="javascript:void(0)"` ports — React refuses that URL, and an `<a>` with no `href` is not tabbable, so the anchor takes `tabIndex` and Enter/Space instead; and `GemSocket`, the socket anchor with its gem icon, its empty-socket icon and its Wowhead link. **No co-located stylesheet**: `.item-picker-*` is still worn by `glyphs_picker` and `_suggest_reforges_action.scss`, so `_gear_picker.scss` stays global until those port |
| `ItemDetailCell` | `ui/features/gear/components/ItemCell/` | the `ItemRenderer` shape itself — `features/gear/view/item_renderer.tsx` is **deleted** (253 lines), its two bulk callers having ported | the item, the slot, what activating each part does (`onOpen`, omitted for a read-only cell), an `action` slot, and the three anchors the gear picker hangs its quick-swap popovers on (`enchantTooltipId`, `socketTooltipId`, `extraLabels`) | the whole `item-picker-*` cell — icon, ilvl, sockets, name, notice, enchant, tinker, reforge — and the empty state a slot holding nothing renders. `ItemCell` stays the layout below it; this is the layout *filled in*. Its three consumers are `ItemPickerCell`, `BulkItemPicker` and the batch results' read-only cells, and `ItemPickerCell` is now ~70 lines that add only the quick-swap tooltips |
| `GearPicker` | `ui/features/gear/components/GearPicker/` | `features/gear/view/gear_picker.tsx` (**deleted** — with `quick_swap.tsx`, `quick_enchant_popover.ts` and `quick_gem_popover.ts`) | `ready`, and only that: the shell's init order is the one thing a cell cannot read for itself, and `useSimReady` lives in `app/`, which features may not import | the two columns and their slot lists, and what each cell does — open the selector modal at the right tab, and the two favourites popovers. Beside it: `ItemPickerCell` (one slot), `EnchantLabel`, `ItemNoticeIcon`, and `QuickSwapList` / `QuickEnchantList` / `QuickGemList`. **The popovers read the store themselves**, inside `Tooltip`'s children, which react-tooltip does not build until the tooltip first opens: that is what keeps 16–64 `filters` subscribers off the pane, and it is also how the recorded stale-closure bug stays fixed — no `EquippedItem` is captured at all, `active` is derived at render and the click reads the slot again. Owns `GearPicker.scss`: the cells' `:focus-visible` rings, and `_quick_swap.scss` re-keyed from `.tippy-box[data-theme='tooltip-quick-swap']` to `.sim-tooltip.tooltip-quick-swap` — which needs `max-width: none`, because `Tooltip.scss` caps every tooltip at 192px and tippy capped nothing. The popovers render **inside** the cell, not beside it: react-tooltip's box lives in the React tree, and a sibling would take a child index in the column and move the `:nth-child(6)` weapon separator |
| `ItemSwapIcon` | `ui/features/item-swap/components/ItemSwapIcon/` | `features/gear/view/icon_item_swap_picker.tsx` (**deleted** — one consumer, and the last one) | `slot`, and only that: everything else is read from the host, and the picker renders only under `SettingsTabBody`'s `ready` gate, which is what replaces the vanilla `waitForInit` the click was wired inside | that a swap slot is a picker root with an icon button and a sockets container — **not** an `ItemCell`; that vocabulary is the gear cell's and the swap icon wears none of it beyond `item-picker-sockets-container`. Reuses `useActionId` (the `(setHref, setBackground) = (true, true)` pair the vanilla `fillAndSetActionId` passed, as `href` and `iconUrl`), `useWowheadDataset`, `GemSocket` and `getEmptySlotIconUrl`. Fixes four defects: the modal is the shell's one `itemSwapSelectorModal`, not one `new SelectorModal(simUI.rootElem, …)` per icon appended to an element React does not own; the `itemSwap` subscription's unsubscribe is no longer discarded; the last profession subscription is no longer stranded; and the icons paint their loaded state, which vanilla never did because `update()` only ever ran from an `itemSwap` change. And it un-nests, the way `IconPicker` did — vanilla built the sockets **inside** the icon anchor, so a gemmed swap set was anchors inside an anchor, which `a11y.mjs` allows none of on `.settings-tab`; `browser.mjs` carries the matching `LIFTED_SUBTREES` entry. Owns `ItemSwapPicker.scss`: the two `:focus-visible` rings and `position: relative` on the picker root, which is where the lifted sockets container now takes its containing block from. `_item_swap_picker.scss` **stays global** — `.item-swap-picker-root .icon-picker-button` and `.icon-picker .icon-picker-button` are both (0,2,0) and only source order separates them |
| `SummaryTable` | `ui/features/gear/components/SummaryTable/` | `features/gear/view/{gem,reforge,upgrade_costs}_summary.tsx` (**all three deleted** — one consumer each) | `title`, `className` (the block's modifier class), `headerClassName` (whether the header carries it too), `empty`, and what resetting means | the hidden-when-empty root, the `ContentBlock`, and the reset button's place in its header — the three-class vocabulary all three blocks agreed on. `SummaryTableRow` beside it fixes the row's own three classes. `GemSummary`, `ReforgeSummary` and `UpgradeCostsSummary` sit in the same folder and read `model/summary_totals.ts`. Owns `SummaryTable.scss`, co-located from `scss/core/components/individual_sim_ui/_summary_table.scss` — every class in it was gear's alone. **They render from state on the first paint**, where the vanilla blocks filled themselves only from a `gear` notification and so painted empty until one arrived |
| `BulkTabBody` · bulk components | `ui/app/tabs/BulkTabBody.tsx`; `ui/features/bulk/components/{BulkItemSearch,BulkPickerGroups,BulkResults,BulkSettings,BulkProgress}/` | `features/bulk/view/` (**all five files deleted**, 2,187 lines) | nothing — every one reads the tab through `useBulkTab()` and the bulk store slice | the whole tab: the inner Setup/Results strip, the batch's item search, one group per bulk slot, the batch settings column and the results rows. `BulkTab` stays as the feature's **model** and as the `SimTab` that registers the pane (`ui/features/bulk/bulk_tab.ts`, `buildTabContent()` empty), because `host.bt` is read by `ItemListRow` and by the JSON importer and its state is not the player's. What used to be `Map<slot, BulkItemPickerGroup>` — DOM-owning components the tab reached into for `getSlotOptions` — is `model/picker_groups.ts`, plain arrays with the same insertion order and the same duplicate rule, so nothing races a mount. The strip is hand-rolled `.nav-link` on `useTabFade`, not Base UI `Tabs`, for the recorded reason: `Tabs.Panel` ignores a passed `id` and `#bulkSetupTab` / `#bulkResultsTab` are what `_bulk_tab.scss` and `bulk-tab.mjs` select on. Beside them: `model/{progress,search,gear_data}.ts` and `hooks/{useBulkTab,useBulkRevision,useBulkVersion}.ts`. Owns `BulkPickerGroups.scss`, `BulkItemSearch.scss` and `BulkResults.scss`; `_bulk_tab.scss` **stays global**, its rules being scoped under `#bulk-tab` and `#bulkSetupTab`, ids `SimTab` owns |
| `ListPicker` | `ui/ui-kit/ListPicker/` | `ui-kit/pickers/list_picker.tsx` (**deleted**, 703 lines — all ten of its importers were APL view files, so the moment APL ported it had no consumer left to be dual-stack for). `ListPicker.parity.test.tsx` went with it, the vanilla half of the oracle being gone; its two React-only assertions moved into `ListPicker.test.tsx` | the `ListPickerConfig`: `itemLabel`, `allowedActions`, `actions.create.useIcon`, `inlineMenuBar` / `horizontalLayout`, `dragGroup` + `sameGroupOnly`, `extraActions`, and a `copyItem`-or-`onCopyItem` pair that now also has a **neither** arm, for a list whose `allowedActions` omits `copy` — plus the `renderItem(index, itemConfig)` and `renderItemHeader(index)` render props | the list, item and action markup and the drag protocol, and nothing about what a row contains. `renderItemHeader` replaces `getItemHeaderElem`'s sibling-walk DOM contract; `makeActionElem` is the exported `ListItemAction` component, so the class list, the glyph and `type="button"` live in one place and the tooltip rides on the anchor instead of a `tippy()` per button — the vanilla `ListItemAction` *type* is `ListItemActionName` now, because the name belongs to the component. **Two cross-list drag rules, easy to confuse, both live:** a drag whose `itemLabel` differs is still refused, which is why a sequence's action list keeps vanilla's lowercase literal `'action'` and so never mixes with the priority list's translated label; and `sameGroupOnly` + `dragGroup` is the second, replacing vanilla's `itemLabel !== 'Action'` — a comparison against an English literal that vanished under any locale that translated it. It still **splices the array `getValue` returned, in place** (`ListPicker.tsx:57` and `:111`), deliberately: the APL tree is built on reading the live proto. No co-located stylesheet — `_list_picker.scss` is still global |
| `ValuePicker` | `ui/features/apl/components/ValuePicker/` | `APLValuePicker` in `features/apl/view/apl_values.ts` (**deleted** with the whole of `features/apl/view/` — 11 files, 2,932 lines) | nothing beyond its `InputConfig<Player, APLValue \| undefined>`; the kind list is `model/value_kinds.ts` and the pre-pull/group filter arrives through `useApl` rather than as a prop | the kind dropdown and the fields that kind has — **and holding no copy of the value.** Vanilla rebuilt the whole message from its child pickers in `getInputValue()` and pushed it back down through `setInputValue()`; each field here writes its own property of the live message and `touchRotation()` is what re-renders. Two carried-over behaviours: a value arriving from a preset or an import with no uuid is minted one in an effect, silently and with no notification, because the sim keys its per-value validations on one; and the kind list leads with an explicit `undefined`-valued "none" entry, so an empty value *matches an option* and the trigger shows that option's label rather than `defaultLabel` |
| `ActionPicker` | `ui/features/apl/components/ActionPicker/` | `APLActionPicker` in `features/apl/view/apl_actions.ts` (**deleted**) | nothing beyond its `InputConfig<Player, APLAction>` | the condition — a whole `ValuePicker` — then the kind dropdown and that kind's fields. Vanilla's kind picker had a "no kind" branch in `setValue` **the menu could not reach**, its options coming from the kind table alone with no empty entry unlike the value picker's; it is dropped rather than ported, and the non-nullable `ValidAPLActionKind` is what says so |
| `FieldGroup` · `AplField` | `ui/features/apl/components/FieldGroup/` (with `fields/` and `utils.ts`) | `APLPickerBuilder` and the field-config factories in `features/apl/view/apl_helpers.tsx` (**deleted**, 1,256 lines; the data went to `model/{field_specs,kind_options,placeholders,unit_values}.ts`) | the kind's field list, straight from `model/value_kinds.ts` or `model/action_kinds.ts`. `resolveField` collapses **29 descriptor types to 13 picker kinds** — the twelve fixed-enum types are one `enum`, the four alias descriptors (`minIcd`, `reactionTime`, `useDotBaseValue`, `useRuneRegenBaseValue`) are a `number` and three `boolean`s, and `variableName`/`groupName` are one `rotationName` over two sources | **this is where the value and action trees close their loop.** `ValuePicker` → `FieldGroup` → `AplField` → `ValuePicker` is a genuine ES module cycle, and it holds only because `AplField` dispatches with a `switch` **inside the component body**: the imported binding is resolved when the field renders, long after every module in the cycle has finished evaluating. A module-level lookup table — the mapped type this codebase otherwise prefers for a discriminated union — reads the imported component while the cycle is still initialising, and the first module in throws `Cannot access 'ValuePicker' before initialization`. That is the shape vanilla had, in `valueKindFactories` / `actionKindFactories`, and why its authors concluded the cluster could not be ported in halves; three `vi.resetModules()` cold-import tests hold the rule. Also `fieldInputConfig`, which fills an unset field with the spec's default **on the read path** — a mutation inside `getValue`, kept, because the whole tree reads the live proto — and the two class rules vanilla applied by hand: `input-inline` on the three leaf kinds, `apl-picker-builder-multi` on `vals` and `actions` |
| `AplListItem` | `ui/features/apl/components/AplListItem/` | three `Input` subclasses — `APLListItemPicker`, `APLGroupActionPicker` and `APLPrepullActionPicker` (**all deleted**) | `config`, and an optional `leading` node — the pre-pull list's "Do At" `ValuePicker` is the only caller that passes one | one row that can be hidden and holds one action. The three differed in exactly two things: whether a "Do At" picker came first, and where their validations were looked up. The second moved into `ListItemHeader`, so nothing is left to vary. A hidden row renders `disabled`, which is what `enableWhen: () => !item.hide` produced |
| `ListItemHeader` | `ui/features/apl/components/ListItemHeader/` | `ListPicker.makeListItemValidations`, a static on the deleted vanilla list, and `APLHidePicker` in `features/apl/view/hide_picker.ts` (**deleted**) | `getItem` and `getValidations`, both reading fresh off the player — a row's identity is its index, and an index goes stale | what an APL row adds to its header: its validations, then its eye, in that order, which is the order vanilla appended them and the only thing the three lists that build one agreed on. Beside it: `AplValidations`, whose button is present-but-hidden while a row has nothing to say (vanilla's `display: none`, which keeps the header's element count stable) and which formats asynchronously because a validation names spells by id and `ActionId.replaceAllInString` resolves them; `HidePicker`, which still has **no tooltip** — vanilla carried a commented-out `tippy(…, 'Enable/Disable')` and two TODOs, and the string was never translated, so adding it would put one English label into an otherwise localised header; and `uuidValidations`, which matches the sim's per-message validations **by the uuid on the message** where vanilla read it back off `rootElem.id`, so no APL picker needs a DOM id for the lookup to work. The level class is an explicit four-entry map, where vanilla walked `Object.entries(LogLevel)` and only half its entries — the name→number ones — could ever match |
| `AplNameDialog` | `ui/features/apl/components/AplNameDialog/` | `features/apl/view/apl_name_modal.tsx` (**deleted**) | `title`, `inputLabel`, `confirmLabel`, `placeholder`, `defaultValue`, `existingNames`, `onSubmit`, `onCancel`, `onClose` | the one "name this thing" dialog behind creating and renaming groups, variables and variable placeholders, and behind extracting a value to a variable — nine importers, the most-shared piece of the cluster. The name is component state rather than an uncontrolled input read on submit, because the confirm button's `disabled`, the `is-invalid` ring and the conflict message all derive from it and vanilla recomputed all three from an `input` listener anyway. `onCancel` is the separate seam a freshly created placeholder needs: dismissing the dialog deletes it again, which is the only way out of a nameless one |
| `FloatingActionBar` | `ui/features/apl/components/FloatingActionBar/` | `features/apl/view/apl_floating_action_bar.tsx` (**deleted**) | `itemName`, `onCreate`, and an optional `nameDialog` (`inputLabel` + `existingNames`) — with it the new button asks for a name first, which is what groups and variables need and the priority list does not. The dialog's title is the button's own label, because both callers built that string twice | the sticky new/reset bar, and reset going through `host.applyEmptyAplRotation()`. **`stuck` is still toggled on each observer delivery rather than set from `isIntersecting`** — vanilla's shape, kept because with the `-100%` top margin the element crosses the boundary once per direction so the parity tracks it. It is therefore the one `IntersectionObserver` in the tree that reads no entry at all, which the 2026-09-08 "every observer reads `entries[entries.length - 1]`" sweep does not cover, and it is worth replacing the day that class gains a second reader |
| `NameDisplay` | `ui/features/apl/components/NameDisplay/` | the same name-plus-pencil markup written out three times — `apl_group_editor.tsx`, `apl_variables_list_picker.tsx` and `APLPlaceholderNamePicker` in `apl_helpers.tsx` (**all deleted**) | `name` and `onRename`, and nothing else — the dialog is the caller's, because all three rename different things and re-point different references | the `apl-name-display` / `apl-name-value` / `apl-name-rename` vocabulary |
| `PriorityList` · `PrePullList` · `GroupList` · `VariablesList` | `ui/features/apl/components/{PriorityList,PrePullList,GroupList,VariablesList}/` | `features/apl/view/{priority_list_picker.ts,pre_pull_list_picker.ts,apl_group_list_picker.ts,apl_variables_list_picker.tsx}` and `apl_group_editor.tsx` (**all deleted** — one consumer each, `RotationTabBody`) | nothing: each *is* the whole list, and their axes are enumerable — which array of the rotation it reads, `copyItem` (clone in place) versus `onCopyItem` (ask for a name first, because a group and a variable are referenced **by name** and two entries sharing one are indistinguishable to the rotation), whether the floating bar carries a `nameDialog`, which `AplProvider` wraps it, and whether `sameGroupOnly` is set | which `ListPicker` config each list is, and what its rows render. `GroupEditor` is a separate component beside `GroupList` because a group's row holds a nested list: it carries the group's own action `ListPicker` (`dragGroup: 'action-group-actions'`), its `useVariableExtraction` and its rename dialog. The pre-pull and priority lists share one sub-tab, as they did in vanilla |
| `useAplInput` | `ui/features/apl/hooks/useAplInput.ts`, with `rotationSource` in `features/apl/utils.ts` | the `storeSubscribe`-less configs `APLPickerBuilder.makeFieldPicker` handed out | nothing — it takes the caller's config and fills in the two things every APL picker needs and none of them is given | **the change source, which is not optional.** `useStoreSubscribe` only re-reads `getValue` when its source notifies, so a bound leaf handed a config with no `storeSubscribe` renders once and then freezes at that value — silently, no error, no visual cue. Vanilla got away with it because the list cascaded `setInputValue` down the tree by hand. This is the carry-forward the 2026-09-08 `ListPicker` entry left, closed. It also fills in an id, because `PickerShell` puts one on the label's `htmlFor` and a nested picker is handed a config that has none |
| `useRenamedCopy` · `useVariableExtraction` | `ui/features/apl/hooks/` | the `copying` index and the extract-to-variable menu entry that the group, variable and priority lists each wrote out by hand around the same shape | `useRenamedCopy` takes `read` / `write` / `nameOf` / `copy` — the four things a by-name list differs on; `useVariableExtraction` takes the two accessors for the value at an index, because the priority list, a group's actions and a nested value list each reach theirs differently | copy-with-a-new-name — it returns the list's `onCopyItem` **and** the dialog props together, so a caller cannot wire one without the other — and the extract action's `shouldShow`: a value that is already a `variableRef`, or has no kind at all, has nothing to extract and the entry stays hidden |
| `AplProvider` / `useApl` | `ui/features/apl/context/AplContext.tsx` | `rootElem.closest('.apl-prepull-action-picker')` and `closest('.apl-groups-picker')`, evaluated once inside a vanilla picker's constructor | `isPrepull` and `isGroup`, both defaulting to false | which list the pickers below are rendered inside — a property of the **list**, not of the picker, and the thing that decides which action and value kinds the dropdowns offer. The DOM read only ever worked because a vanilla picker was built into a parent that already existed; a React component renders before it is in the document, so the answer has to travel down rather than be read up. Like `SimHostProvider`, it carries identity of place and never state |
| `AplNavbar` | `ui/features/apl/components/AplNavbar/` | `makeAplNavbar` in `app/tabs/rotation_inputs.tsx` (**deleted**, 80 lines) and with it `ui-kit/sticky_toolbar.ts` (**deleted** — this was its only consumer) | `activeId` and `onSelect`, and nothing else: the strip is the *view* of a selection the pane bodies also read, so it cannot own it | the APL pane's header — the rotation-type picker, then the sub-tab strip, in that order in one sticky row, which is the whole reason the navbar stayed imperative for as long as it did. The pane list is `apl/model/apl_panes.ts`, shared with `RotationTabBody`. It reuses `RotationTypePicker` rather than carrying a fourth copy of that config, and `useStickyToolbar` + `nextTabByKey` rather than a third copy of each. **Hand-rolled `.nav-link` markup, not Base UI `Tabs`** — two hard reasons, both above: `Tabs.Panel` ignores a passed `id`, and these panes' ids are what `aria-controls` names and what `_rotation_tab.scss` selects; and `Tabs.Root` has to be a common ancestor of the list and the panels, which here sit in two different subtrees of `.rotation-tab-apl` with a third between them, so it would add a wrapper the baseline has not got. Bootstrap's tab plugin lost a consumer here and, as of the bulk port, has none at all. No co-located stylesheet: `.sticky-toolbar-root` is worn by `DetailedResults` too, and the `.apl-rotation-navbar` rules are scoped under `#rotation-tab`, an ancestor this component does not own |
| `useStickyToolbar` | `ui/ui-kit/hooks/useStickyToolbar.ts` | the `IntersectionObserver` effect written out in `DetailedResults` and, as a vanilla `Component`, in `ui-kit/sticky_toolbar.ts` (**deleted**) | the header it sticks below and the element type; both consumers pass `host.simHeader.rootElem`, so the header is an argument rather than a `useSimHost` read — `ui-kit` may not reach the host | that the toolbar has stuck exactly when it stops fitting whole under the header (`rootMargin` = the header's height, `threshold: [1]`), that a delivery carrying several records is read at its **last**, and that a toolbar with no layout is never stuck. Not the bottom-sticky shape: `Timeline/rotation/RotationFloatingActionBar` needs `threshold: [0, 1]` because it is built inside a hidden tab and its ratio goes 0 → pinned without passing through 1, and `apl/components/FloatingActionBar` derives `stuck` by parity of deliveries |
| `useTabFade` | `ui/ui-kit/hooks/useTabFade.ts` | the `lastShown` ref and its rAF, written out in `DetailedResults` | nothing — it takes the active id and returns the one that may also carry `show` | Bootstrap's two-phase switch: `active` on the click and `show` a frame later so the `.15s` `.fade` runs, and **both at once on the first render**. The one-frame gap resolves to `null` rather than to the outgoing pane, so a caller writes `shownId === id` and cannot leave the pane it is leaving wearing `show` without `active` — the guard is in the hook, not in the two call sites |
| `nextTabByKey` | `ui/ui-kit/tab_keys.ts` | the copy in `features/results/.../DetailedResults/utils.ts` | the tab array's element type, so a caller with literal ids gets a literal id back and needs no cast | Bootstrap's `Tab._keydown`: arrows wrap in both axes, Home/End jump to the ends, and the landing tab is focused *and* activated. The `current` it is given is the **focused** tab, not the selected one — under a roving tabindex they coincide, and only a probe caught that they need not |
| `CooldownsPicker` | `ui/features/settings/components/CooldownsPicker/` | `features/settings/view/cooldowns_picker.ts` (**deleted** — one consumer, `RotationTabBody`, and the last *reachable* `new IconEnumPicker(...)` went with it) | nothing — the player comes from the host and `availableCooldowns(player)` derives the option list | the N-plus-one rows (every set cooldown, then a blank add row), one shared delete tooltip instead of one per row, and the `hide` it writes onto its own `.cooldown-settings` ancestor when the spec offers no major cooldowns — kept where vanilla had it, because moving that gate to the parent would duplicate the rotation-plus-metadata subscription there. Owns `CooldownsPicker.scss` |

Not yet built, in rough priority — see the plan for evidence and counts:
`ActionIcon`
(the `ActionId` dom writers), `FieldRow`, `PickerGroup`, `IconButton`. `ActionIcon`'s case is four
near-identical anchors now, not the three the combat-replay entry flagged:
`apl/components/FieldGroup/fields/ActionIdIcon.tsx` joins `CombatReplay/ReplayIcon`,
`Timeline/rotation/RotationRowIcon` and `ui-kit/IconPicker/ImprovedAnchor`.

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
   `ui/ui-kit/testing/PickerOracle.tsx` constructs the vanilla picker and renders the port over
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
  (`reforge_panel.tsx:527`). Render it with `adoptNode` from `ui-kit/dom_utils.ts`; casting it to
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

### Phase 5 open question: does `simUI.reforger` need to exist at all?

Raised with the owner 2026-09-08 and **deliberately deferred to Phase 5**, when `ui/specs/**` unfreezes.
Not a vague "revisit the reforger" — the question has a precise shape, and these are its five holders:

- `ui/specs/{druid/guardian,warrior/arms,warrior/fury}/spec.ts` read `ctx.reforger.preCapEPs`. That is a
  **pure derivation** over settings and player, and it lives in the reforge `utils.ts` now — a spec could
  import and call it directly, with no handle involved.
- `ui/specs/monk/windwalker/spec.ts:140` calls `host.reforger?.setUseSoftCapBreakpoints(false)`, with a
  comment explaining that `host.reforger` is still null while the preset runs. That is a **settings
  write**, and `ReforgeSettingsState` is already store-backed — the preset could write the store field
  through the same facade the panel uses, and the null window disappears with the handle.
- `ui/features/settings/model/apply_build.ts:66` calls `fromProto`, and the shell calls `applyDefaults()`
  and reads `.settings` for persistence and autosave. All three are the **settings object**, not the
  optimizer.
- Nothing outside the panel calls the **service** half (`optimizeReforges`), which the panel already owns.

So the likely Phase 5 answer is that `reforger` dissolves into three things that already exist
separately — the store-backed settings facade, a module of pure derivations, and a service the panel
owns — and `IndividualSimHost` loses the member. **Do not do this before Phase 5**: every one of the
five holders above is either a frozen spec file or reads a frozen type, and de-classing the model
(done 2026-09-08, a factory returning an object) already delivers the function-driven shape without
touching any of them.

### TanStack Query is not being adopted — decided 2026-09-06, do not re-open

Researched in full against every async boundary in `ui/` and declined, for reasons that are
structural rather than "not yet":

- **The React surface is two call sites.** `SimToolbar`'s `/version` fetch and `useActionId`.
  Every other async consumer carries the vanilla pragma — verified on all ten candidates
  (`sim_ui`, `results_action`, `stat_weights_panel`, `bulk_tab`, `gear_picker`, `item_renderer`,
  `glyphs_picker`, `consumes_picker`, `individual_addon_importer`, `multi_icon_picker`). A hook
  cannot serve any of them.
- **A sim run is a promise racing a stream, not a query.** `doAsyncRequest` races the final progress
  message against the request reply because the wasm path returns its payload on the progress
  channel. Cancellation is a protocol — an `AbortRequest` posted to the worker holding the task id —
  not an `AbortSignal`. And caching is actively wrong: people press Simulate to get a *different*
  answer.
- **`computeStats` output is store state.** `PLAYER_CHANGE_FIELDS` drops `currentStats` precisely so
  recomputation cannot re-trigger itself; a query cache rebuilds that loop across two systems.
- **The configuration would be all-off.** `staleTime: Infinity`, `gcTime: Infinity`, `retry: false`,
  no refetch on focus or reconnect — every one overriding a library default, leaving
  `isPending`/`isError` bookkeeping as the entire benefit.

The two defects it was supposed to fix were real, and were fixed in domain instead (below). Revisit
only when gear, import-export or results port and a query gains its *first* React consumer — the
same rule that governs every other primitive here. If it is ever adopted, the load-bearing rule is:
**a `queryFn` calls the existing domain function, never the fetch itself**, or the cache forks and
the vanilla side stops seeing the data.

### `ListPicker` is React as of 2026-09-08, and the vanilla one is gone as of 2026-09-09

The reasoning is kept because it explains *why* it waited, and because the drag hazard it names is
real and is now solved rather than avoided. Three corrections to it, all measured:

**The caller count was wrong.** It said "six of its seven callers are APL, the seventh is the encounter
target list". `/usr/bin/grep -rln "pickers/list_picker"` gave **ten importers, every one of them an APL
view file** — and encounter had already ported, so the vanilla `list_picker.tsx` never had a non-APL
consumer to be dual-stack for. It was a Phase 5 deletion the moment APL landed, and APL landed:
`ui/ui-kit/pickers/list_picker.tsx` is **deleted**. `unused.mjs` never could have caught it, because
the path is lowercase.

**The shared drag state is solved by construction, not by a guard** — and the construction is what let
the vanilla module global die quietly. `ui/ui-kit/ListPicker/drag_state.ts` is a React-owned module
store holding data plus a `take()` closure — never a component, so a stale entry cannot retain a tree.
While both stacks were live they could not collide, because a user cannot begin two drags at once: a
drag begun in vanilla wrote `curDragData` and left the React slot `null`, every React drop test then
failed, no handler called `preventDefault`, and the browser painted no-drop. Only the React slot is
left. `subscribeDragEnd` also replaces vanilla's document-wide `querySelectorAll('.dragfrom,.dragto')`
sweep: only the one or two items actually painting a cue hold a subscription.

**`sameGroupOnly` has its consumers.** It was put on the config with none, deliberately, replacing
vanilla's `itemLabel !== 'Action'` cross-list rule, which is **locale-dependent** — the label resolves
to `"Action"` only in English, and nested sequence lists use lowercase `'action'`. `PriorityList` and
`GroupEditor`'s action list set it now, the second with `dragGroup: 'action-group-actions'` so two
groups' lists exchange rows and the priority list stays out of both. Keeping it rather than deleting it
was the right call: the alternative was the next author re-deriving the broken comparison.

### The original reasoning — `ListPicker` stayed vanilla until APL

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

### The three dropdown pickers waited for the Base UI `Menu` adapter — RESOLVED 2026-09-08

All three are ported: `IconEnumPicker` and `MultiIconPicker` landed on `Menu` earlier, and
`DropdownPicker`/`UnitPicker` followed once `results_filter` gave them a React consumer. The reasoning
below is kept because it is why they moved as a batch, and because the Bootstrap-mutates-React-markup
failure it describes is general. `Toast` is now the only primitive still waiting for a first consumer.

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

`escape: true` goes on **every** tooltip, not only popovers, and `clickOutsideAnchor: true` only on
those opened by a click. The second is tippy's `hideOnClick`. The first is parity rather than an
addition — corrected twice: `ui/shared/bootstrap_overrides.ts` binds a global `keydown` that calls
tippy's `hideAll()`, which does not distinguish a hover tooltip from a popover. (An earlier commit
removed it on the reasoning that tippy's own dist has no Escape handling — true, and irrelevant,
the app adds it; a later one gated it on `openOnClick`, which left a hover tooltip open after
Escape where vanilla closed it.) Clicking *inside* the tooltip is safe: the
handler returns early on `tooltipRef.contains(target)`, so the `NumberPicker` in the bonus-stat
popover stays open while it is used. Closing on Escape or an outside click **commits** whatever was
typed and not yet blurred, matching tippy. Measured, not reasoned — see the readiness section below
and `tools/react-migration/sidebar-popover.mjs`.

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

### Unit 1 — the sidebar — landed 2026-09-05

`CharacterStats` is React, portalled from `SimApp` into the `.sim-sidebar-stats` div the vanilla
shell still builds, and the vanilla view is deleted. Four things are worth carrying forward:

- **`createPortal` targets a container the constructor produced,** so it cannot be rendered on the
  first pass. `SimApp` already held the constructed shell in state for `SimTabs`; the portal hangs
  off the same `simUI &&`. That is the shape every later tab will use — `IndividualSimUI` builds the
  DOM, React fills a named container inside it.
- **The vanilla component's `this` fields became explicit arguments.** `statDisplayString` read
  `this.player`, `this.hasRacialHitBonus` and `this.activeRacialExpertiseBonuses`, all set as a side
  effect of `updateStats`; in `utils/stat_display.ts` they are parameters, and `utils/rows.ts` holds the group
  order as data so the render is a map over it.
- **The bonus-stat cell owns two tooltips**, one on the icon (hover, the stat's name) and one on the
  button (click, the `NumberPicker`), which is why `Icon` needed its rest spread — the `data-tooltip-id`
  goes on the `<i>`, not the button.
- **`epReferenceStat` is the only thing the component wanted from `simUI`**, so it is a prop rather
  than a host reference. Per the design rule above, the axis that varies is what gets parameterised.

The vanilla button's inert `data-bs-toggle="popover"` is gone: nothing in the tree ever constructed
a Bootstrap popover (they are opt-in, unlike tabs and dropdowns, which auto-init from the data API),
so it carried no behaviour to lose. Verified before removing.

### Phase 3 readiness — audited 2026-09-05

Five read-only audits ran every Phase 2 component against its real call sites. Four gaps were real
enough to fix immediately, each now with a test that fails without it:

- **`useInput` did not re-read its own write when the config has no `storeSubscribe`.** The contract
  names UI-local toggles as the source-less case (`stat_weights_panel.tsx`'s show-all-stats
  checkbox is one), and nothing else tells those a write happened — so a controlled input reverted
  on its own click. `setValue` now rings the subscriber itself in that case, and only that case.
- **`Icon` dropped every unknown prop.** No rest spread, so a `data-tooltip-id` on the `<i>` — which
  `character_stats.tsx` needs, it anchors one tooltip on the icon and another on the button —
  vanished silently.
- **`Button` could not emit a bare `btn`.** the talents tree's reset is `btn link-danger`;
  `variant={null}` is that shape.
- **`PickerShell` repeated a class.** `classList.add` drops a repeat and `clsx` does not, and two
  live configs pass `input-inline` in `extraCssClasses` *and* set `inline` — a duplicate that would
  have reached the parity harness.

**The sidebar's prerequisites are all met** — the `createPortal` mount, the `Tooltip` ref and the
`Icon` rest spread — and the port landed (above). Carry the `bonus-stats-popover` rules with the port, re-keyed to
`.sim-tooltip.bonus-stats-popover` and with `text-align: left` (the cell is right-aligned).

`tools/react-migration/sidebar-popover.mjs` is the sidebar's behavioural gate. Its whole output is
identical on both builds, which is the point: it opens the popover, types into the picker, closes it
four ways, waits out the worker recompute to prove the table re-rendered, and hovers both stat-value
tooltips — the attribution breakdown and the crit-cap table, which are the component's largest block
of markup and exist only while a value is hovered, so nothing else here can see them. What it found
against the vanilla build:

- **The popover is not clipped, and `positionStrategy` is not needed.** It overhangs
  `.sim-sidebar-content` by 123px and stays fully visible, hit-testable past the scroller's edge.
  `position: absolute` resolves against `aside.sim-sidebar`, which is `position: sticky` and sits
  *outside* the scroller, and a scroll container does not clip a descendant whose containing block
  is one of its own ancestors. react-tooltip renders in place, in the same cell tippy mounts into,
  so it inherits the same escape. The condition to keep in mind is `.sim-sidebar`'s `sticky`: give
  any element between the popover and it a `position`, and clipping starts.
- **Every close path commits the half-typed value** — Escape, outside click, Enter and a plain Tab
  all wrote `+123`, and nothing was committed while typing. Chrome blurs a focused input that is
  removed *or* hidden, and blur fires `change` on a field the user edited, so tippy's unmount and
  react-tooltip's `setRendered(false)` both commit, and so would a close that only hid the content.
  Two things make this easy to measure wrongly. The user-edit flag is only set by real key events,
  so a test that writes `.value` and dispatches a synthetic `InputEvent` sees no `change` at all and
  concludes the opposite. And the blur that hiding causes is deferred to the next rendering update,
  so reading `document.activeElement` in the same task that wrote the style says the input still has
  focus — it does not a frame later.
- **React's unmount does not race the native listener, and its own `onBlur` never fires.** Measured
  with the real `Tooltip` under the dev server: Escape produced `native change`, `native blur`, then
  `effect cleanup`, in that order — React detaches the DOM in the mutation phase and flushes passive
  effect destroys afterwards, so a listener attached in `useEffect` is still live when its node is
  removed. React's `onBlur` on the same input produced nothing, because it is delegated from the
  root container and a detached node's event path never reaches it. That is a second reason
  `NumberPicker`'s field is uncontrolled with a native `change` listener, on top of the
  input-vs-change semantics its own comment gives: switching to `onBlur` would look equivalent and
  would silently discard the edit on every popover close. `NumberPicker.test.tsx` pins the half
  happy-dom can hold — typing alone commits nothing.

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

## CSS custom properties: what Bootstrap's removal takes with it

Bootstrap goes eventually, and it takes two things that a ported component may be leaning on
without anyone noticing:

- **Component-scoped custom properties.** `--bs-nav-link-*`, `--bs-btn-*`, `--bs-modal-*`,
  `--bs-toast-*`, `--bs-dropdown-link-color`, `--bs-progress-height`, `--bs-form-check-*-bg-image`
  and friends are emitted *inside* `.nav`, `.btn`, `.modal`… not at `:root`. A component that drops
  those classes stops resolving them **today**, silently — which is exactly what the first Base UI
  tab styles did, until the numbers came out wrong.
- **Sass variables.** `$nav-link-padding-y`, `$focus-ring-box-shadow`, `$transition-fade` are
  compile-time, so they do not degrade — they vanish with the dependency.

Re-measured on the running page 2026-09-06, and the earlier figures here were wrong in two ways:
this tree uses **117 distinct `--bs-*` names**, of which **87 resolve at `:root`** and **30 do
not**. The earlier "104" counted six *prose* prefixes (`--bs-btn-`, `--bs-modal-`… only ever written
as `--bs-btn-*` in a comment) as names, and missed nineteen real ones, because
`shared/_global.scss:192-219` builds them by interpolation — `var(--bs-#{$label})` inside five
`@each` loops, so `.item-quality-rare` compiles to `var(--bs-rare)`. A literal grep cannot see those;
expand the five maps. Drop the six and the literal set is 98 = 68 at `:root` + 30 not, so the old
**68 was right** and the old 35 was the 30 plus five prose prefixes.

Of the 30, 26 are Bootstrap's component-scoped set and **4 are declared nowhere at all** — and all
four turn out to appear only *inside comments* recording bugs already fixed, so there is no broken
`--bs-*` declaration in the tree today. Two of the four are also mis-spelled, here and in
`Dialog.tsx`: `shared/_mixins.scss:23-24` declares `--primary-dampened` and `--hover-color`
**without** the `--bs-` prefix, on `.<spec>-sim-ui`. The `--bs-`-prefixed spellings exist nowhere.

The full table — every name, its use sites, whether it resolves at `:root`, and which scope it
resolves in when it does not — plus the per-component recommendations for the 26, is the audit
deliverable. Reproduce it with a `getComputedStyle(documentElement)` sweep for the `:root` column and
a CSSOM walk of every `CSSStyleRule` for the declaring selector; do not reason about it from the
Sass. Read/write matters: most component-scoped hits are `.btn-primary { --bs-btn-hover-bg: … }`,
Bootstrap's intended theming hook, not a token we should own.

**The rule.** A ported component reads tokens we own, never a `--bs-*` and never a Bootstrap Sass
variable. They live in one `:root` block at the end of `ui/scss/shared/_variables.scss`, and the
right-hand sides still come from Bootstrap today *on purpose*: that block is the single seam, so
removing the dependency means changing those values and nothing else. Add what your component needs
there rather than reaching sideways. `--focus-ring`, `--transition-fade` and the `--tab-*` set were
the first entries, from the Base UI tab port; `--modal-*` and `--dropdown-*` followed with the
`Dialog` and `Menu` adapters.

**The `:root` half is now re-homed.** Every one of the 87 names that resolves at `:root` has an owned
twin in that block, spelled by stripping `--bs-` — `--bs-primary` → `--primary`, `--bs-junk` →
`--junk` — which is the convention to follow when adding more. 65 already existed; 22 were added
2026-09-06 (item qualities, spell schools, factions, `--chi`, the two balance-druid resources, and
the typography three). No consumer was switched: that is the next unit, together with the 26
component-scoped names. Three of the 22 **alias** (`--body-font-size: var(--bs-body-font-size)`)
rather than interpolate, because those three `--bs-*` names are the project's own — declared at
`:root` by `shared/_global.scss` and `shared/_bootstrap_style_overrides.scss`, one of them
responsively — so interpolating would freeze a value that is supposed to move.

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

## The delivery loop — run before reporting, every time

Three sweeps, in order. **If any sweep changes anything, start again from the top** — a simplification
often exposes a duplicate, and removing a duplicate often exposes something else to simplify. Stop only
when a full pass changes nothing.

1. **Normalisation.** Does this already exist? Search before writing — `/usr/bin/grep -rn` for the
   concept, not just the name. Today's sweep found `kebabCase` with eight users while three files
   hand-rolled it, `metricsClasses` being re-interpolated at five sites, and `sim_result.ts:441`
   re-implementing `PlayerClasses.getCssClass` inline. **Two of the three "new" helpers already
   existed and were being bypassed.** Then: is the same expression written twice in this diff? Two
   copies is a helper; the second copy is where drift starts (`crit` alone silently misses
   `critical-block`).
2. **Simplification.** Can it be smaller and still do the job? Dead branches (the `% ` prefix compared
   a localized label and never fired); props nothing passes; an abstraction with one caller; JSX built
   to answer a question; a wrapper element the baseline does not have. Prefer deleting to adding. If
   200 lines could be 50, rewrite it.
3. **Verification.** The full gate set, plus the browser gates the change can reach, plus a mutation
   check on every test whose failure is not obvious. A test that passes when you break the code it
   covers is worth less than no test, because it reads as coverage. Four vacuous gates were found this
   way in one day, one of which had been reporting a defect that did not exist.

The loop is what separates "it compiles" from "it is delivered".

## Conventions

- **A function that returns JSX is a component, and gets rendered — not called.** `{deleteButton(onRemove)}`
  becomes `<DeleteButton onClick={onRemove} />`. A called JSX function has no element identity, so React
  cannot reconcile it, memoise it, or show it in the devtools tree, and its props are positional. Two
  exceptions, both real: a **render prop**'s return value (react-tooltip's `render`, `VirtualList`'s
  `renderRow`) is a value the caller places, not an element in this tree; and a **`ComponentType` stored
  in data** is rendered by whoever holds it. Where a set of one-expression renderers covers a
  discriminated union, keep them private in the union's own file — `LogLine.tsx` holds eleven — and pick
  between them with a **mapped type**, which forces an entry per kind where a `switch` only warns about a
  missing `return`.
- **Never build JSX to ask a question.** `resultMetricTooltip(metric, layout) ? id : undefined` rendered a
  whole tooltip tree to test truthiness; the predicate is `hasMetricTooltip`, and the renderer stays
  separate.

- **One component per file**, named after the component, in the component's folder. A folder that
  holds `CharacterStats.tsx` also holds `StatRow.tsx`, `CritCapRow.tsx`, `BonusStatsLink.tsx`,
  `TooltipRow.tsx` and `TooltipNote.tsx` — not one file with six functions in it.
- **Arrow syntax for every function on the React side**, not only components:
  `export const StatRow = ({ … }: StatRowProps) => (…)`, and equally
  `export const buildRows = (…): RowGroup[] => {…}`. A `forwardRef` keeps its devtools name through
  an explicit `displayName`, not an inner named function. Two things this costs: arrows are not
  hoisted, so a helper used above its declaration has to move up, and a generic in a `.tsx` file
  needs the trailing comma (`<T,>`) that a `.ts` file must not have.
  This applies to `ui-kit`, `app` and ported feature components. `ui/sim/**` and un-ported
  `features/*/view/**` are model and vanilla code the migration does not own — leave them.
- **Props interfaces are exported** and named `<Component>Props`, declared in the same file.
- **Group a large feature into subfolders; do not flatten it.** A feature that lands a dozen components
  gets sub-directories along its real seams, not one directory holding all of them — `Timeline/`
  splits into `chart/` and `rotation/`, mirroring the vanilla tree's own structure. The top-level
  `index.ts` exports only what leaves the folder: `DetailedResults` reaches for `Timeline`, never for a
  rotation row. Each subfolder carries its own `utils.ts` and its own tests. Pure geometry and
  measurement modules are **not components** — `zoom`, `ruler`, `timeline_window`, `series` stay
  out of component folders even when the feature is their only caller. Candidate for the same treatment
  once the timeline lands: `components/LogRunner/`, whose seven components split cleanly into `search/`
  (`LogSearchBar`, `LogSearchGroup`) and `line/` (`LogLine`, `LogRow`, `ActionLink`, `EntityLabel`,
  `DamageResult`).
- **A component folder holds only components at its top level.** Everything else is a named
  companion: `types.ts` for types (`Icon/types.ts`), `utils.ts` for helpers — or `utils/` when there
  is more than one, as `CharacterStats/utils/{stat_display,rows}.ts` is. `index.ts` is the public
  surface. A reader scanning the folder should be able to tell what is a component from the
  filenames alone, which is the same reason the PascalCase rule exists.
- **PascalCase filenames for anything that renders JSX** — `PickerShell.tsx`, `SimTabs.tsx`,
  `SimHostContext.tsx`, and a co-located stylesheet follows its component (`SimTabs.scss`). Tests
  take their subject's name. Two things stay snake_case on purpose: hook modules that render nothing
  (`react/input.ts`, `react/store.ts`, `react/action_id.ts`) — their `.tsx` tests are only `.tsx`
  because the *fixtures* render — and `app/spec_entry.tsx`, which contains JSX but is the page entry
  script, named as one and referenced from `index_template.html` and `vite.config.mts`.

- **A class-list prop is `className`, never `cssClass` or `extraCssClasses`.** Type it as clsx's
  `ClassValue` and merge with `clsx`, which takes arrays, so a caller passing several classes writes
  `className={['summary-table-container', className]}` instead of a second prop. What keeps the old
  name is the frozen surface it belongs to: `IndividualSimUIConfig.cssClass` and
  `CustomSection.{cssClass,iconGroupCssClass}` in `ui/sim/spec_config.ts`, `InputConfig.extraCssClasses`
  (`ui-kit/input.tsx`, read by every React picker through `PickerShell`), `PlayerClasses.getCssClass`
  — called from 33 spec files — and the vanilla stack's own `rootCssClass`/`buildColumn` parameters.
  A React component that *reads* one of those fields still exposes `className` itself.
- **Every hook lives in a `hooks/` folder** — `sim/hooks/`, `ui-kit/hooks/`, `features/<x>/hooks/` —
  one hook per file, named after it. The single exception is a context's own accessors: `useSimHost`,
  `usePlayer` and `useSim` stay in `sim/context/SimHostContext.tsx` because moving them would mean
  exporting the context object, and the throw inside `useSimHost` is what makes a `null` host
  unreachable. Those three read a field; everything in a `hooks/` folder subscribes or derives.

## Which store hook to reach for

Two, and the choice is made by what you have in hand, not by preference:

- **A plain selector read** — use zustand's own `useStore(sim.store, selector)`, or
  `useStoreWithEqualityFn` from `zustand/traditional` if the selector needs custom equality (zustand
  5 dropped the third argument from `useStore`). There are no such call sites yet, which is why
  there is no wrapper for it: building one before a consumer exists is how you get an abstraction
  nobody fits.
- **A `StoreSubscribe` in hand** — `useStoreSubscribe(subscribe, read)`. Every consumer today is
  this case, because the domain layer hands out `subscribePlayerField` / `subscribeSimChange` /
  `subscribeAll`, and the value wanted is read back through a *facade* (`player.getBonusStats()`),
  not off a store slice.

**Could the second be zustand's `useStore` too?** Partly. A selector-built source carries
`.sel = { store, selector, equalityFn }`, and `subscribeAll` folds same-store sources into one tuple
selector, so the subscription itself is expressible. But `.sel` is optional — absent for a
hand-built source and when `subscribeAll` spans stores — so a hook that unwraps it needs a branch,
and hooks cannot be called conditionally. And the facade read still needs
`useMemo(() => read(), [version])`, so the snapshot cache does not disappear, it moves. It would
relocate code and add a branch rather than remove either.

**The batch gate is not a reason to prefer either — measured, and this time the file exists.** This
paragraph used to cite `store.test.tsx`, which was never written; the real measurement is
`ui/sim/hooks/useStoreSubscribe.gate.test.tsx`. A `batch()` writing three slices produces **exactly
one render — gated, ungated and through zustand's `useStore` alike** — because React coalesces
same-tick updates and the read happens at render time, after the batch has closed; no intermediate
value is ever painted. At the *store* level the gate still earns its keep, one listener fire against
three, which is what vanilla subscribers need. Nothing on the React side depends on it, and a
`batch()` spanning an `await` helps nobody: it closes at the end of its synchronous body, so three
`await`-separated writes are three renders under every binding.

## Ambient state: `useSimHost`, and the rule that keeps it cheap

`SimHostProvider` wraps everything React renders once the shell exists, and `useSimHost()` /
`usePlayer()` / `useSim()` read it. A feature component reaches for them instead of taking `host` or
`player` as a prop; `CharacterStats` takes **no** props because of it.

**The context value is identity, never state.** It holds the same three references for the life of
the page. Anything that changed in there would re-render every consumer on every store
notification, whatever that consumer actually reads — and this store is written constantly (sim
progress ticks bypass it entirely for that reason). Reactivity stays per-component:
`useStoreSubscribe(subscribe, read)` for a `StoreSubscribe` source, or zustand's
`useStore(useSim().store, selector)`.

Two boundaries:

- **`ui-kit` never uses it.** Lint already forbids `@features` there, and it is the design rule too:
  a generic picker's `modObject` is the sim, the encounter or an APL action as often as it is the
  player, so it stays a prop.
- **A feature component may drop props for it only where the axis does not vary.** `CharacterStats`
  has one call site and one player; a component that several callers configure differently keeps its
  props, or it gets bypassed the way the abstractions below did.

## The shell: what makes it hold together

`SimShell.tsx` is the skeleton and it renders **once** — `SimApp` holds the element in a `useMemo`.
Three separate things depend on that, which is why it is not an optimisation:

- Every container in it is filled imperatively afterwards. React must not own their children, and a
  re-render that recreated any node would discard the vanilla content inside it.
- Bootstrap rewrites `aria-expanded` on the dropdown toggles and `.show` on their menus. React diffs
  against its own last props rather than the DOM, so a same-props re-render is already safe — not
  re-rendering at all makes that independent of React's bail-out rules.
- `useStickyToolbar` measures `.sim-header`'s `offsetHeight` in the mount effect of whatever sticks
  below it, so the header must be laid out in the first render. A header that arrives one render
  later measures zero and the sticky offset is silently wrong. (This was `sticky_toolbar.ts`
  measuring the same thing *while the tabs were being constructed*, which was earlier still.)

`SimShell` fills a `RefObject<ShellDom>` in a layout effect, and `SimApp` constructs against it in
its own — a child's layout effect runs before its parent's, so both happen in one commit.

**The root's class list is React's, all of it** (`app/shell_classes.ts`, small pure functions with
their own suite). It has to be all or nothing: React writes `className` wholesale, so an element
cannot have half its list from React and half from `classList` without the next render dropping the
other half. `.sim-header` still takes its class from `Component`'s `rootCssClass`, which owns that
element's list outright.

**One class per subscription, over the fields that class depends on.** The vanilla shell ran five
updaters with five different field sets, and collapsing them into one subscription is a behaviour
change, not a tidy-up. It also surfaced a real bug: `Sim.getShowHealingMetrics()` is
`showHealingMetrics || (showThreatMetrics && <tank spec>)`, but vanilla only recomputed that class
on `showHealingMetrics` — so a tank whose saved settings turned threat on kept `hide-healing-metrics`
from construction and hid columns its own rule says to show. Fixed, and recorded as an asserted
`INTENDED` divergence.

**The gate's default spec list was all DPS**, which is why a tank-only class went unchecked by every
gate for the whole migration. `warrior/protection` is in it now.

`SimApp.test.tsx` guards the remount case directly — it appends a marker to a container after
construction and asserts it survives the render that sets `simUI`. Verified by mutation: forcing a
remount fails it and three others.

## Sim warnings are derived state, not notifications

Two things here are called warnings and they want opposite treatments, so decide which one you are
looking at before reaching for a component:

- **`ui-kit/toast.tsx`** — Bootstrap `Toast`, 11 sites, transient and dismissed. This is what Base
  UI's `Toast` replaces, and it is the deferred Phase 2 item.
- **Sim warnings** — `{ updateOn: StoreSubscribe, getContent: () => string | string[] }`, rendered
  as *one* triangle in the sidebar whose tooltip lists whatever is currently active, hidden when
  nothing is. `getContent()` returning `''` is how a warning turns itself off, so these re-evaluate
  continuously: the JC-gems warning appears the moment a third JC gem is socketed and disappears
  when it is removed.

**A toast is the wrong shape for the second.** Toasts are fire-and-forget; these are a live
projection of store state. Modelled as toasts you get either a pop on every gear change, or a
dismissed toast that should have come back and cannot.

**A store/context for registration is right, though**, and is the next step for them. Today only
something holding a `simUI` can call `addWarning`, which is why every warning lives in
`individual_sim_ui.tsx` or a spec file — a ported feature component has no way to contribute one.
The hard constraint is that `warnings: [simUI => SimWarning]` in `ui/specs/**/spec.ts` is part of the
**frozen** spec surface, so whatever replaces the plumbing keeps accepting that exact shape; only
the delivery mechanism changes. Do it after the shell's C3, since `addWarning` is one of the five
imperative APIs C2 deliberately leaves untouched.

## Porting a tab body: the pattern, and the two things it moves

The vanilla `SimTab` subclass stays — it is what attaches the pane, and attaching has to happen
where it always did, before the constructor reads the live document. What it loses is its contents:
`buildTabContent()` becomes empty and `SimApp` portals a React body into `contentContainer`, the way
it already portals `CharacterStats` into the sidebar. `TalentsTab` is 19 lines now.

**Mount surviving vanilla components with `useLegacyMount`, not `LegacyHost`.** `LegacyHost` renders
a wrapper div and builds into that, which is fine in isolation but changes the pane's DOM — and a
tab body is exactly where `panes-parity.mjs` compares this branch against the parent element for
element. `useLegacyMount` is a ref callback, so the React-rendered panel *is* the parent and the
tree keeps its vanilla shape. The element must have no React children.

**Two things move when a tab ports, and the second is not obvious:**

- Construction moves from the shell's constructor into a React effect. Anything appended to a
  *shared* container therefore lands in a different order — which is how this surfaced: 21 modals,
  identical content, dozens of differing lines in `parity.mjs`. Modals are now compared as a set
  (same count, same contents, order free); each is still byte-compared against its twin, only the
  sequence is given up. Expect this for every remaining tab.
- A component the tab shares with other tabs must **not** port with it. `PresetConfigurationPicker`
  is built by four tabs and `SavedDataManager` by several, so talents leaves both vanilla behind
  `useLegacyMount`. Porting them here would drag settings, rotation and gear along.

`PresetConfigurationPicker` was widened from `IndividualSimUI` to `IndividualSimHost` in the process
— it only ever read `individualConfig`, `player`, `reforger` and `sim`, and a body in `app/tabs`
cannot hand it the concrete shell.

## Intended divergences are asserted, not allowed

Phase 3 changes markup on purpose, so `parity.mjs` carries an `INTENDED` list — and it is **not** an
allowlist. An entry names the exact `base` and `react` lines, and the gate fails if that divergence
is *not observed*, as loudly as it would have failed for making the change unrecorded. Reverting the
markup is a failure; so is the markup moving out from under the entry. The old two-entry allowlist
this file used to carry could only subtract, which is why it was deleted rather than extended.

An entry may also carry a `match(base, react)` predicate instead of a fixed pair, for a line whose
text varies per spec — the root's class list carries the spec's own class, so the healing-metrics
entry could not be written as two literals.

`INTENDED` cannot express a port that **moves** an element, only one that changes a line in place, so
there are three tools for the three shapes of change: `INTENDED` for a changed line,
`collapseWrappers` for a deleted one, and `liftSubtrees` (`browser.mjs`, table `LIFTED_SUBTREES`) for
a re-parented subtree. The one entry is `IconPicker`'s `.icon-input-level-container`, which vanilla
builds inside the picker's anchor and React renders as its next sibling; it is the anchor's only
child either way, so the fold is a dedent of its four lines. **The fold itself is a no-op for both
tree comparisons** — `unexpectedLines` trims before comparing, so indentation is invisible to it, and
disabling the table leaves every spec green. What is load-bearing is the `lifted` / `total` counts
`normaliseLiftedSubtrees` returns: it runs on **both** sides, React must have nothing left to lift,
and both sides must hold the same number of containers. Put the container back inside the anchor and
both parity gates report `settings-tab: react still nests 34 level container(s) inside the picker
anchor`; disable the table and that same revert passes again. Every pane but settings reports
`lifted 0 total 0` on both builds.

First entry: the sidebar's `.character-stats-label` is an `<h3>`, not a `<label>`. A `<label>` with
no control labels nothing — it was a heading wearing the wrong element. The styling is unchanged and
measured: same 41×18 box, 14px/700 SimDefaultFont, 17.5px line-height, 7px bottom margin, 1px
letter-spacing (from the global `*` rule, which an `h3` inherits too). What the element used to pick
up from `label { font-weight: bold }` and the inherited body size is now explicit, because a heading
brings its own size and margins.

**An entry can also record that the port is the correct one — 2026-09-09.** The APL port added
`div.cooldown-action-picker…` ↔ `…hide…`, observed on `mage/fire` alone. Vanilla never hides that
picker on its first evaluation and React does, and React is right: `Input.update()`
(`ui-kit/input.tsx:126`) writes `hide` from `inputConfig.showWhen` **only**, while the rule that also
requires some value to carry an `actionId` lives in the picker class's own `showWhen()`
(`pickers/icon_enum_picker.tsx:265`), whose sole caller is the constructor's store subscription. So
in vanilla that rule lands on the *second* evaluation and never the first. React evaluates it every
render, first included. `druid/feral` is the counter-example that proves it is not a metadata race:
both builds start with an empty cooldown list and end with four, block and picker shown, identical.
The divergence is invisible because `.cooldown-settings` carries `hide` in the same state on both
sides. Two lessons: **measure a ceiling, never guess it** — the FA5/FA6 entry's `max` was raised
6 → 8 by setting `max: 0` and reading the printed tally, and its old prose reasoned from
`warrior/protection`, which has no simple pane at all; and a spec-specific entry will report "never
observed" when the gate is scoped to a spec that cannot show it, which is the design working, not a
regression.

### `Dialog` does not unblock stat-weights — checked 2026-09-06

The queue said stat-weights was waiting on the `Dialog` adapter. It is not. `Dialog` is necessary
and not sufficient, and the difference is worth knowing before someone schedules it as "cheap now".

`AdvancedEncounterModal` ported in an afternoon because its body was two clean seams — a shared
`addEncounterFieldPickers` and a `ListPicker` — so the React version mounts two islands and owns
nothing else. `EpWeightsMenu` has no such seam: 841 lines that build the body, the footer *and* an
extra header title inside the constructor, against `this.body` / `this.footer` / `this.header`, with
a dozen `ref`s and a `ResultsViewer` threaded through them. Extracting "build the body into this
element" from that is a substantial refactor of a vanilla file, which is what the dual-stack rule
tells you not to do.

**"No seam" was too strong, corrected 2026-09-06.** There is no *body-island* seam, which is what
rules out the `AdvancedEncounterModal` shape. There is a **model** seam, and it was taken: ~200 of
the 841 lines were DOM-free and are now `features/stat-weights/model/`. The shape stat-weights
actually ports in is the talents/settings one — the whole view becomes React and only
`renderSavedEPWeights` (second consumer: `reforge_panel.tsx`) stays an island.

**Done, 2026-09-06** — see the change log. `ResultsViewer` turned out **not** to be an island either:
it was there to host the run overlay, and the run is a `ProgressTrackerDialog` now.

The tractable second consumer is `Exporter` (`features/import-export/view/exporter.tsx`, 72 lines):
a textarea in the body, a copy button and an optional download button in the footer, and nine
subclasses of which most add no markup at all. That is where the `.<cssClass> .modal-body` stylesheet
merge gets proven at scale.

**Done, 2026-09-06** — see the change log entry. It also settled how a React dialog is *opened* from
a place that has no React: the header registry now holds either an `open()` or a component.

### Hands off: log / log_runner — 2026-09-06

The user is refactoring `log_runner` and the log pipeline in parallel with this migration. **Do not
port, touch or plan around those files** until they say it has landed. They are in the results
feature, which is Phase 3's last and hardest cluster and Phase 4's island work, so nothing in the
current queue needs them — but a future session picking work "by difficulty order" would walk
straight into it.

### Findings waiting on a decision

Batch these into the next `AskUserQuestion`; they are recorded rather than fixed because each one
would be an unrequested markup change with a parity divergence attached.

- **The `hide` class survives only as long as the parity gate does.** `ItemSwapPicker` and every
  `showWhen` render it rather than unmounting, because `panes-parity.mjs` compares element for
  element against a build that keeps those elements. That is a constraint of the gate, not a design
  choice — when Phase 5 retires the vanilla comparison, the idiom becomes a conditional render as
  the plan always said. Do not read the comments defending it as permanent.

Both of the settings-tab findings below were **decided on 2026-09-06 and are now fixed** — kept here
only so the reasoning is not re-derived:

- ~~A consumes row's `<label>` names an icon group~~ — settled everywhere at once, as the user asked,
  rather than one block at a time. `ConsumeRow` and `MultiIconPicker` now emit a `<span>` and put
  `role="group"` + `aria-labelledby` on the element that actually holds the icons. `PlayerSettings`
  needed no change of its own: it composes those two. `PickerShell` keeps its `<label>`, because that
  one is a real label with `htmlFor` pointing at a real control.
- ~~`elixir-space` was untranslated English~~ — now `settings_tab.consumables.elixirs.separator`, in
  both locales plus `schemas/translation.schema.json`, whose `consumables` block is
  `additionalProperties: false` with a `required` list, so a new key has to be declared in three
  files, not two.

### What the `@jsx-vanilla` pragma rule actually forbids

"Never touch a file carrying the pragma" is how this gets repeated, and it is not what the migration
does. `sim_ui.tsx`, `individual_sim_ui.tsx`, `sim_header.tsx`, `settings_tab.tsx` and
`preset_configuration_picker.tsx` all carry it, and every one has been edited — that is how a React
block gets mounted at all: the vanilla owner stops filling a container and exposes it instead.

The rule is about **feature views that have not been ported**: do not rewrite them, do not convert
their JSX, do not tidy them. Editing a vanilla *shell* file to hand React a container, delete a
builder that has moved, or expose a registry is the migration working as designed.

State it that way when briefing an agent. Told the blunt version, an agent will refuse the one edit
the port requires — or worse, work around it.

### Flag invalid markup, do not port it — standing rule, 2026-09-05

While reading vanilla markup for a port, keep a running list of anything invalid or spec-violating:
invalid nesting, `target="_blank"` with no `rel`, a `<button>` with no `type`, a label pointing at
nothing, duplicate ids, ARIA naming an element that does not exist. **Batch them into one
`AskUserQuestion` per unit of work, with options** — do not reproduce them faithfully and do not fix
them silently. The parity gate is the reason this is a rule rather than a preference: it makes
carrying a defect forward the path of least resistance, and once carried the gate locks it in.

The first one found this way was the toolbar's social links, `div.sim-toolbar-item > button > a` —
`<button>`'s content model forbids interactive descendants, so that markup never parsed the way it
read. `SimToolbarItem` produced it by accident: `SocialLinks` passed the anchor as a *child* and no
`href`, and the no-href branch renders a `<button>`. The React port drops the wrapper.

## `Button`: the `<button>` half only

The `<button>` branch renders Base UI's `Button`. The `<a>` branch does not, on Base UI's own
instruction (`docs/react/components/button.md:150`): *"Links (`<a>`) have their own semantics and
should not be rendered as buttons through the `render` prop."* That matches why `as="a"` requires an
`href` here — `item-picker-icon`, `glyph-link`, `gem-socket-container` and `metrics-action-icon` are
anchors *because* of the wowhead link they carry. They are links that look like buttons, so wrapping
them would layer `role="button"` and keyboard handling on top of link semantics.

What the swap buys: `data-disabled` for styling, enforced button semantics, and a dev warning when
`nativeButton={false}` is put on a real `<button>`. What it does not: `useButton` does **not** default
`type="button"`, so that stays ours — a `<button>` in a form submits it otherwise, and several here
are in forms. `focusableWhenDisabled` is Base UI's and is not exposed on our props yet; the buttons
that would want it (Simulate, Stat Weights) are built imperatively by `addAction`, not through this
component, so exposing it now would be API with no caller.

Rendered DOM is unchanged — `parity.mjs` and `panes-parity.mjs` both pass untouched, so there is no
`INTENDED` entry to add.

## Pickers are Base UI `Field`

`PickerShell` is `Field.Root` / `Field.Label` / `Field.Description`, and every picker's control is a
`Field.Control` rendering the same native element it always did (`render={<input type="text" />}`,
`render={<select />}`). Base UI's `Select` and `NumberField` are *not* used: `Select` is a popup with
its own markup, and `NumberField` ships spinner buttons — both are visual changes rather than ports,
and belong to their own units.

Three things this cost, all found by the parity oracle rather than by reading:

- **Pass `htmlFor` on `Field.Label` explicitly.** Field points a label at the `Field.Control` it
  finds and *generates an id when there is none* — `IconPicker` renders anchors, so its label pointed
  at an element that does not exist. `config.id` is the value vanilla uses either way.
- **`Field.Description` renders a `<p>`**, so it needs `render={<div />}`.
- **`Field.Control` honours a passed `id`** (`useLabelableId({ id: idProp })`) — unlike `TabsPanel`,
  which ignores one. Worth checking per part rather than assuming either way.

What Field adds is additive: `data-disabled` / `data-filled` state hooks, and `aria-labelledby` plus
`aria-describedby` — the latter an association vanilla never had, so a description was invisible to a
screen reader before. `PickerOracle` filters those from its diff and asserts them directly in
`associations()`, which rides along inside `diff()` so every parity assertion already written covers
it. Verified by mutation: breaking `htmlFor` takes the suite from 31 to 50 failures.

## Component folder layout

There is no `ui-kit/react/`. It made sense when React was the exception; every component in `ui-kit`
is React now, so the qualifier named nothing. What was in it went to where its kind belongs:
components to their own folders (`PickerShell/`, `LegacyHost/`), hooks to `ui-kit/hooks/` one per
file named after the hook, the `mountBoth` oracle to `ui-kit/testing/`, and the two DOM helpers into
`ui-kit/dom_utils.ts`.

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

**Some class names have squatters.** The batch's item search reuses `item-picker-ilvl` while
building its own markup, `glyphs_picker` wears the whole `item-picker-*` and `selector-modal-*`
vocabulary, and `pet_spec_picker` reuses the entire `talent-tree-*` / `talent-picker-*` vocabulary to
piggyback on the talent tree's stylesheet. Co-locating those styles silently breaks the piggybacker. Grep the
class name across `ui/` before moving its rules.

## Things that will bite

### A react-tooltip renders where you declare it, and overflow decides whether you see it

tippy portaled every tooltip to `<body>`. react-tooltip does not — the node appears inside the
element that declared it. In the header that is `div.sim-toolbar-item`, inside
`div.sim-header-container`, which is `overflow-x: scroll` (and therefore `overflow-y: auto`, since
one visible axis is not allowed beside a scrolling one). The toolbar's tooltips extend ~27px below
that container's bottom edge.

They are drawn anyway, and the reason is worth knowing before you rely on it: the tooltip is
`position: absolute`, and its containing block is the nearest *positioned* ancestor — the sticky
`.sim-header`, which is outside `.sim-header-container`'s scroll box. An absolutely-positioned
element is not clipped by a scroll container that is not in its containing-block chain. Had the
overflow been on `.sim-header` itself, the same markup would have been cut off.

None of the gates can see this. `getBoundingClientRect` is unchanged by clipping,
`getComputedStyle(...).visibility` still says `visible`, and `elementFromPoint` returns whatever is
underneath because both libraries set `pointer-events: none` on a non-interactive tooltip. It took
a screenshot of the tooltip's own rect on both builds. Do that once per *new* container a `Tooltip`
lands in, not once per tooltip — the answer is a property of the ancestors, not of the call site.
If one is ever clipped, the fix is `positionStrategy="fixed"` on the `Tooltip` primitive.


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
- **Never give `.sim-tooltip` a flat `opacity`.** react-tooltip's shown class is
  `opacity: var(--rt-opacity)` and its closing class is `opacity: 0`, and the tooltip node unmounts
  on that transition's `transitionend`. Override `opacity` and the transition never runs, so the
  node never unmounts — and the safety timer that exists for exactly this case is cleared by *any*
  `transitionend` reaching the tooltip, including one that bubbled from a descendant (a focused
  `.form-control` inside a popover is enough). The result is a tooltip that closes visually, stays
  mounted forever, and never blurs the picker inside it, so a half-typed value is silently lost.
  Set `--rt-opacity` instead. Found by `sidebar-popover.mjs` on the character-stats port: it was in
  `Tooltip.scss` from the day the component landed, and every unit test was green.
- **react-tooltip renders in place, not in a portal.** The tooltip element is a child of wherever
  the `<Tooltip>` sits in the React tree, so an anchor inside an `overflow: hidden` container needs
  `positionStrategy="fixed"` or a tooltip declared higher up. The plan assumed a body portal.
- **react-tooltip injects its stylesheet at runtime unless told not to.** `disableStyleInjection`
  alone only stops the *base* styles; `disableStyleInjection="core"` stops both, which is what the
  `Tooltip` component passes. The library's `REACT_TOOLTIP_DISABLE_*_STYLES` env vars are useless in
  a browser bundle — the guard around them tests `typeof process`, which is `undefined` there. An
  injected `<style>` lands in `<head>` after the bundle, so it silently outranks a component theme.
- **Sim progress bypasses the store, and it is not as fast as it looks.** The worker progress
  callback writes DOM directly, unbatched — never `setState` per tick. But "per tick" is **~10/s on
  wasm and ~2/s on the native host**, not per worker message: `sim/core/sim.go:336` reports at most
  once per 100 ms per sim, `ui/sim/wasm/sim.ts:118` decimates by worker count
  (`progressCounter % running`), `wasm/stat_weights.ts` runs its sims sequentially so nothing
  multiplies, and `worker/worker_http.ts:47` polls at 500 ms. So a `requestAnimationFrame` coalescer
  caps at 60/s and would never collapse a single tick — it is insurance, not an optimisation. Split
  by frequency instead: the discrete stage is React state, and every continuous value (the counters,
  the bar width, the elapsed clock) is a ref plus a `textContent` / custom-property write.
  `ProgressTrackerDialog` is the worked example. `startTransition` and `useDeferredValue` are the
  wrong answer — they change render *priority*, not render *count*.
- **Goldens do not cover the shell.** `tools/state-snapshots/snapshot.ts` imports
  `IndividualSimUIConfig` as a *type* and hand-mirrors `applyDefaults`. They prove no state write
  leaked into a component. They say nothing about whether anything rendered.
- **`ListPicker` splices the array you give it**, and the React one still does — deliberately.
  `next.splice(index, 1)` on delete, `next[index] = …` in the per-item `setValue`, and the same
  inside `take()` on a cross-list drag (`ListPicker.tsx:57`, `:82`, `:111`). It mutates whatever
  `config.getValue` returned, which for every APL list is the live proto's own array. That is
  consistent by construction rather than by luck: every APL picker reads through `config.getValue`
  on each render instead of holding a snapshot, and `useAplInput` gives all of them the rotation as
  their change source, so the mutation and the notification always arrive together. Break either
  half — cache the array, or drop the `storeSubscribe` — and the picker shows stale data with no
  error. The vanilla twin this bullet used to cite is deleted.
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
- **A tooltip outlives the render that opened it**, so unmount cleanup is load-bearing; assert it in
  the component's test. It does **not** portal to `<body>` — that was tippy. See "A react-tooltip
  renders where you declare it" above: react-tooltip's node is a child of wherever the `<Tooltip>`
  sits in the React tree.
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

## The settings tab, surveyed — 2026-09-06

Seven content blocks remain. Three shared shapes cover most of them: the generic input walk
(number/boolean/enum — all three React pickers exist), the icon-group walk (`icon` → `IconPicker`
and `iconEnum` → `IconEnumPicker`, both ported now), and the stat-option walk that Buffs, Debuffs
and the two cooldown blocks share.

**`IconEnumPicker` was missing from this file's "still missing" list, and it was the real gate.** It
blocked *all* of Consumes — every picker there is `iconEnum` — and Player settings on the majority of
specs, since `makeClassOptionsEnumIconInput` is how most classes declare their options. Three of the
six gate specs are affected. It landed 2026-09-06 with the player block, and Consumes followed the
same day. `MultiIconPicker` was listed and blocked Buffs and Debuffs, eleven instances between them.
Both are Bootstrap-dropdown shaped, so both were ports onto the `Menu` adapter that already landed —
not new adapters.

**Dead, found while surveying; delete rather than port:** the deprecated `customSections` function
form on `IndividualSimUIConfig` (declared, looped over, and declared by no spec);
`DEBUFFS_MISC_CONFIG`, which is `[]`, making the debuffs misc branch unreachable; and a bare
`this.simUI.player;` expression statement in the saved-settings block.

**One quirk to preserve rather than improve:** each `presets.itemSwaps` entry bakes in a snapshot of
*load-time* settings via `...this.getCurrentSavedSettings()`. Computing it lazily would read better
and would be a behaviour change.

## What is queued, and in what order — 2026-09-06

Kept here rather than in a head, so a fresh session picks up where this one left off. Strike an item
when it lands and add its change-log entry in the same commit.

**In flight** (four parallel agents; their work lands in the working tree for review, never committed
by them). All four have landed:

1. ~~**Bootstrap CSS vars, audited and re-homed.**~~ — **done.** 117 names, not 104; 87 at `:root`,
   30 not, and the "35 component-scoped" was 30 plus five prose prefixes. All 87 now have an owned
   twin in the seam block (65 already did, 22 were added), no consumer changed. The 26 genuinely
   component-scoped ones are grouped with a recommendation each in the audit, and are item 7's input;
   the remaining 4 turned out to be comment text, not references. See the section above.
2. ~~**The Base UI `Dialog` adapter**~~ — **done**, `ui/ui-kit/Dialog/`, registry row present, no
   consumer wired as intended.
3. ~~**A port plan for the settings tab's seven remaining content blocks**~~ — **done**, and then
   executed: the survey above is the plan, and items 5-12 below are the blocks, all struck.
4. ~~**`settings-tab.mjs`, a behaviour gate for that region**~~ — **done**,
   `tools/react-migration/settings-tab.mjs`, and it runs.

**Then, in this order** — the settings ordering below is the surveyed one, and it corrects the
assumption that `Dialog` gates this tab. It does not gate *anything* here: the tab's only modal is
`AdvancedEncounterModal`, already handled inside the ported `EncounterPicker`, and `SavedDataManager`
uses native `confirm()`/`alert()` rather than `BaseModal`. `Dialog` unblocks stat-weights and gear.

5. ~~**Other-settings inputs**~~ — **done.** It deleted the append-ordering dependency as intended,
   and produced `InputPicker`, the dispatcher items 6 and 7 will reuse.
6. ~~**The two external-cooldown blocks**~~ — **done.** They produced `StatOptionIcons`, and showed
   that `configureIconSection` was doing nothing for them at all.
7. ~~**Custom sections**~~ — **done**, verified by running both gates explicitly on
   `shaman/elemental` and `shaman/enhancement`, the only two specs that declare `sections`.
8. ~~**Extract the store writes**~~ — **done**, with no React in the change:
   `features/settings/model/apply_build.ts` and `features/settings/model/saved_settings.ts`.
9. ~~**`MultiIconPicker` onto Base UI `Menu`, then Buffs and Debuffs**~~ — **done.** The interleaving
   was handled by widening `StatOptionIcons` into a dispatch rather than by placing vanilla nodes
   among React siblings.
10. ~~**`IconEnumPicker` onto `Menu`, then Player settings**~~ — **done.** The inline
   `gridTemplateColumns` is kept and is still invisible to the tree gates; `settings-tab.mjs`'s
   `playerIcons()` is the only thing that reads it.
11. ~~**Consumes**~~ — **done.** Both extra costs were real and both are recorded in the change log:
   the `waitForInit` dependency is a hard one, and `updateRow`'s inversion was answered by exporting
   the picker's `showWhen()` override so the row asks the configs rather than the instances.
12. ~~**Preset configuration and the saved-data managers do not port with this tab**~~ — **done.**
   Both still vanilla, mounted through `useLegacyMount` into the React-owned right panel of
   `SettingsTabBody.tsx`, exactly as `TalentsTabBody` does. The tab body is React and
   `settings_tab.tsx` is 18 lines.
7. Switch ported components onto the owned tokens from item 1, and decide the component-scoped 26 —
   the audit groups them by consumer with a recommendation each. Three are cheap and independent of
   any port: rename `--bs-form-check-*-bg-image` (project-invented names, two writers and two readers,
   all in `scss/shared/`), drop `CritCapRow`'s `--bs-border-opacity` spacer, and correct the two
   mis-spelled names in `Dialog.tsx`'s comment.
8. Then the harder features, per the plan's Phase 3 ordering: stat-weights (needs `Dialog`), then
   ~~bulk~~, ~~import-export~~, ~~apl~~, ~~gear~~, results. **~~bulk~~ is done** — 2026-09-09, and it
   took `selector_modal.tsx`, `item_list.tsx`, `filters_menu.tsx`, `item_renderer.tsx` and
   `gear_change_icon.tsx` with it, so **gear is done too** but for `glyphs_picker`'s island. **~~apl~~ is done** — the whole cluster on
   2026-09-09, `features/apl/view/` deleted, and with it the vanilla `ListPicker` and
   `cooldowns_picker.ts`; the navbar followed the same day, so nothing vanilla is left in the
   rotation tab at all.
   **~~stat-weights~~ is done** — all four units, the
   model and opener seams on 2026-09-06 and the React dialog plus its SCSS the same day, with all
   sixteen recorded defects fixed. The investigation is
   `.github/skills/wowsims-react/plans/stat-weights.md`, in this repo, units struck.
   **import-export is done** — the five header exporters
   landed first, the four individual importers followed, and the batch's gear importer on 2026-09-09.
   One dialog is left: `LogExporter`, whose opener is inside the un-ported log runner and which
   therefore ports with it, not from here. `view/exporter.tsx` stays alive for exactly that one, and
   it is why `VANILLA_ON_BOTH` in `parity.mjs` still reads `[['exporter', 1]]`.

**Not queued, deliberately.** The three dropdown pickers could go on Base UI `Menu` now that the
adapter exists, but every one of their callers is still vanilla — a React picker with no consumer is
the thing Phase 2's rule exists to prevent. They port when a caller does.

## Change log (keep current — this skill documents itself)

- 2026-09-09 **The timeline's model left `view/`, and the earlier "already model" audit was wrong
  about `chart/`.** `results/view/timeline/` held 17 non-test files; 10 of them (999 lines, plus their
  two tests) were DOM-free logic, including a folder literally named `model/` nested inside `view/`,
  and the 7 that stayed are 842 lines. They are now
  `results/model/timeline/{constants.ts, chart/types.ts, rotation/*}`, the nested `model/` flattened
  into `rotation/` so the shape matches `model/replay/` — flat `build`/`types`/`index` beside a
  subject folder — and mirrors the surviving `view/timeline/{chart,rotation}` split the README
  sanctions for a capability with both halves. `tools/restructure/move.mjs` did the 12 moves and 40
  specifier rewrites; the hand count of importers matched it exactly, which is the check that catches
  a stale `DIR_TO_ALIAS`.

  **The `2026-09-08` entry below claims `chart/series.ts`, `chart/build.ts` and `rotation/model/*`
  "have zero DOM references". For the first two that is false**, and only because the audit was
  per-file. `chartSpec()` (`build.ts:33,45`) calls `dpsColor()`/`threatColor()` (`series.ts:32,34`),
  which call `cssVarColor` → `getComputedStyle(document.documentElement)` (`colors.ts:8`)
  unconditionally, so `chartSpec()` throws in Node. `chart/annotations.ts` is half DOM too:
  `majorCooldownAnnotations` is pure, but `annotationsPlugin` builds `new Image()`, hangs a `load`
  listener on it and re-renders through `requestAnimationFrame`. All three stayed in `view/`; only
  `chart/types.ts` moved. **The `features/*/model/**` lint rule cannot be the arbiter here** —
  `no-restricted-globals` lists `window`/`document`/`localStorage`/`location`/`navigator` and is
  per-file, so `Image`, `requestAnimationFrame` and a transitive `getComputedStyle` all pass it. The
  question to ask a candidate is whether it runs without a DOM, not whether oxlint objects.

  A follow-up could take the remaining ~357 lines: hoist the resolved colours into `chartSpec`'s
  arguments and split `majorCooldownAnnotations` out of `annotations.ts`. That is a refactor, not a
  move, and was left for the port that takes `ruler.ts` and the two `zoom.ts`.

  **`move.mjs` emits `'./'` when a file's own former barrel becomes its new directory.**
  `row_track.ts` and its test imported `'./model'`; flattening made the target their own folder, and
  the tool wrote `from './'`. Both were pointed at `'./types'` by hand, where `ContentRow` is actually
  declared, rather than left importing the barrel that re-exports them. The other invisible-to-tsc
  reference was `Timeline.test.tsx:18`'s `vi.mock('../../view/timeline/rotation/model')`, found by the
  plain-string sweep; the tool rewrites specifiers, not string arguments.

- 2026-09-09 **Switching saved rotations: two measured cuts in `DropdownMenu`, and the ceiling for
  the rest.** Numbers are `tools/browser-perf/apl-rotation-switch-counts.mjs` on warlock/demonology,
  warm switch, frozen builds — precise-coverage call counts, stable to the unit where wall clock on
  this host spans 3–6×.

  **`Menu.Portal keepMounted` came off.** 3,886,838 → 3,469,938 calls (−416,900, −10.7%) and the
  rotation pane 9,842 → **6,978 nodes, master's count to the node** — exactly 716 × portal +
  positioner + popup + `<ul>`, 716 being the pane's pickers and 718 the page's. The parity fold is
  the inverse of what it was: React's
  `div.dropdown-picker-slot` now stands alone where vanilla puts its `<ul>`, so `PORTED_MENUS` renames
  the slot to `ul.dropdown-menu.dropdown-picker-list` and collapses nothing. Renaming rather than
  dropping both sides is deliberate — a fold would stop the gate noticing if the *baseline* lost its
  menu, where a rename fails on the line count.

  **The per-picker `react-tooltip` is mounted with the options it serves**, `open &&`, the same gate
  `DropdownMenuItems` already had: its anchors are the `<li>`s, which do not exist while the menu is
  closed. 3,469,938 → 3,378,884 (−91,054, −2.6%), one line, no markup at rest either way.

  **What is left is architectural, and both obvious candidates are dead ends — measured, not
  assumed.** A switch whose two rotations differ by a single constant still costs **88.9%** of one
  that differs structurally, so essentially every field re-renders whatever changed. `memo` on
  `ListPickerItem` cannot bail: `children` is `renderItem(index, itemConfig(index))`, a fresh element
  every render, and stabilising it would freeze props two call sites read live at render time
  (`TargetInputsPicker`'s `input=`, `GroupVariablesField`'s `name=`/`groupSelected=`). A `useInput`
  short-circuit cannot bail either: `revision` is contractually "increments on every notification,
  *including* ones that leave the value unchanged" and six picker types depend on it, and the values
  that matter are proto messages the switch replaces wholesale, so identity never matches. A probe
  build that deleted Base UI's `Menu` from the picker entirely — trigger reduced to a bare `<button>`
  — bought only **6.6%** (3,378,884 → 3,154,303), so lazy-mounting the menu machinery is not the
  missing 2.6× either. The profile is flat: 2,987 distinct functions, the largest single row 36k
  calls, ~1%. The one number worth carrying forward is **14,782 Base UI `useStore` reads per
  switch** — not as a target, the probe already priced that machinery at 6.6%, but as the count of
  how many components a rotation change renders at all. That count is the target, and no memo
  reaches it while every field subscribes to the rotation on its own.

- 2026-09-09 **The sidebar's finished result is React, and `features/results/` has no vanilla file
  left.** `results_action.tsx` split in three. The model — the current run, the reference run, the two
  emitters, `getRunData()` — is `model/results_manager.ts` and takes a `Sim`, not a `SimHost`; the
  rendering half is `SimResultSummary`, beside `SimResultsPanel`; and what stays behind is 60 lines of
  Simulate-button wiring in `view/results_action.ts`, with **no JSX in it**, so the pragma came off and
  the file is plain TypeScript. `.results-content` is now an ordinary React child list, `setContent`
  and `contentElem` are gone from `ResultsPanelHandle` and `ResultsPanelStore`, and `showResult()`
  replaces them.

  **The consumer test passed on a technicality worth naming**: the constructor site
  (`individual_sim_ui.tsx`) is still vanilla, but the *renderer* of `.results-content` is
  `SimResultsPanel`, which `SimApp` has portalled for weeks. A model object the vanilla shell
  constructs and React reads is enough; the shell does not have to dissolve first. `addSimResultsAction`
  is the part that genuinely cannot move — it exists to call `simUI.addAction`, and that button's place
  in the sidebar's construction order is the shell's.

  **`waitAbort` was left exactly as it was**, and the earlier finding stands but is now half stale:
  the file has *one* private flag, not two — `isRunning` already reads `runs.isRunning(IndividualSim)`
  through the facade. The dedup that broke `sim-progress.mjs` is not available and was not attempted.

  **Two divergences, both measured, neither guessed.** First, master's `updateReference` re-adds `hide`
  and returns early when the reference is deleted, leaving the last delta string in the hidden span;
  the port renders that span from state, so it empties. Both are `display:none`, so nothing is on
  screen either way — `sidebar-reference.mjs` compares that stage with the text stripped **and asserts
  the divergence is still observed on both sides**, so the entry cannot rot. Second, and the one that
  mattered: `ResultMetricList`'s `metricLabelPrefix` put `'% '` in front of TMI and CoD, where master
  never did — master's ternary compared the *localized* label to `'tmi'`, so its `'% '` arm was dead
  code. Keying on `metric` instead of on the label is what let it fire. Deleted, along with the test
  line that had locked it in. It was written ahead of any `layout="list"` consumer and no gate could
  see it until this port supplied one, which is `unused.mjs`'s rule showing up as an actual defect
  rather than a policy.

  **`sidebar-reference.mjs` is new**, and it is the gate the reference bar never had: `topline-metrics.mjs`
  compares the finished sidebar list digit for digit but only in the state a page reaches on its own,
  and `sim-progress.mjs` stops at "the result carries its metric tiles". The new gate plants the
  baseline's own seeded settings blob on both ports and walks run → set reference → **rerun at a
  different iteration count** → swap → delete, diffing the bar's classes, the three buttons and all
  seven deltas character for character. The iteration change is the point: a fixed seed makes a rerun
  of identical settings reproduce the first result exactly, so nothing would move. Mutation-checked by
  dropping `type="button"` and `referenceDiffs` at once — it named both, and its `deleted`-stage text
  stripping did not mask the `secondRun` and `swapped` regressions.

  **Deleted as newly dead**: `formatDeltaTextElem` (the last "view concern in the model layer";
  `item_list.tsx` had already gone with `SelectorModal`), `translateResultMetricLabel`,
  `translateResultMetricTooltip` and `backendMetricI18nKeys`. **Added as newly shared**:
  `formatSignificance` in `@sim/utils/format.ts` — the z-score sentence was being built twice, here and
  in `BulkResultRow`, in two different but equal ways, which is where drift starts. `ResultReferenceDiff`
  moved out of `ResultMetricList/utils.tsx` into its own file when it gained props.

  **No SCSS moved.** `_sim_action.scss` nests `.results-sim-reference` under `.results-sim`, and
  `.results-sim` is emitted by `SimProgress`, `BulkProgressMessage` and `BulkResultRow` as well, so
  co-locating the reference bar would mean duplicating its parent. It stays global, as the panel's row
  already says.

- 2026-09-09 **The group-variable rows drop `copy`, a deliberate divergence from vanilla — owner
  decision.** Those rows are *derived*: `reconcile()` rewrites the stored `variables` to exactly the
  placeholder names the referenced group declares, keeping each name's binding. So neither row action
  could ever do what its icon says, and it was measured on Unholy DK's `Bend and Snappy` reference
  (`PLy` / `PSy` / `OBy`): **delete** leaves three rows and resets one binding to `Select Variable`,
  and **copy** changes nothing whatsoever, because the duplicate carries an existing name and the next
  reconcile drops it. Delete stays — clearing a selection is the useful reading and the only one it can
  have — and `copy` and `copyItem` go, which is the first real user of the `ListPicker` row's recorded
  "neither" arm.

  **Removing it needed no parity work, and the reason is worth knowing**: the row actions live in a
  popover that mounts only once the `⋯` menu is opened, so they are absent from the load-time tree both
  parity gates compare. An action button is free to add or remove; only what renders at rest is pinned.
  Its test asserts the *delete* button is present in the same breath, so a popover that failed to open
  fails the test rather than passing it vacuously — the first version of that assertion queried
  `.apl-group-variable-picker-root`, which is the row **body** and never contains the actions at all.

- 2026-09-09 **The batch's gear importer ports, and with it the vanilla `Importer`, the last of gear's
  `view/`, and the spec-change toast.** Deleted: `import-export/view/importer.tsx` (83) and
  `view/importers/` (`bulk_gear_json_importer.tsx`, 43, plus its barrel); `features/gear/view/`
  entirely — `item_notice.tsx` (88), `item_notices.tsx` (40), `gear_elements.tsx` (28) — and
  `NameDescriptionLabel.parity.test.tsx`, whose vanilla subject it was — its one React-only case, the
  `className` axis the vanilla helper had no parameter for, is `NameDescriptionLabel.test.tsx` now.
  `settings/view/spec_change_warning_toast.tsx` became a `.ts`. `@jsx-vanilla` files go 36 → 30, of which 29 are source. `import-export/view/` now holds only the exporter and
  `LogExporter`; `features/gear/` has no `view/` at all.
  **The vanilla importer leaked a modal per click, and that is the port's evidence.** `BulkTabBody`
  ran `new BulkGearJsonImporter(host.rootElem, host, bt).open()` on every press, and `Importer`'s
  `BaseModal` is `disposeOnClose: false` — so nothing was ever removed. A probe against :3401 counts
  `.importer` at 3 on load and **8** after five opens; the React build is 3 and 4, back to 3 on close.
  Everything else the probe compared is identical on both builds: title, the two description `<p>`s as
  direct children of `.import-description`, `spellcheck=false`, the upload label's `for` against the
  input's id, both footer buttons at 168px, the textarea at 288px, and 15 → 17 batch pickers from the
  same payload.
  **Two more vanilla defects die with the class.** `onImport` wrapped everything in a `try` that ended
  in `console.warn` + `alert(e.toString())` — the only importer of the five that reported a bad payload
  through an OS dialog instead of the error toast; the React definition throws and `Importer` toasts it
  with the dialog left open, which is what the other four already did. And `Importer.open()`'s
  `trackPageView(this.header!.title, …)` read the `.modal-header` *element*, so every batch import was
  logged with an empty title under the slug `/import/`; the React component tracks the `title` prop.
  That was the last holder of the bug the exporter port found.
  **It is mounted on demand, not `keepMounted`, and the gate is what decides that.** The other four
  importer dialogs are portals held from load, matching three baseline modals the header builds. Master
  builds *this* one on click, so an always-mounted portal is one `[pruned]` shell line with no baseline
  twin — `parity.mjs` failed all six specs with exactly that, and no `INTENDED` entry can express an
  insertion. `{importOpen && <BulkGearImporterDialog open … />}` is the `BulkProgressDialog` shape one
  row below it, and it needs **no `PORTED_DIALOGS` entry and no `PORTED_DIALOG_REACT` bump** — only the
  `importer` comment, which no longer has a React Bootstrap twin to describe. `VANILLA_ON_BOTH` still
  reads `[['exporter', 1]]`: that is `LogExporter`, which has not ported.
  **`ImporterDefinition` already hands `onImport` an `IndividualSimHost<any>`**, so `host.bt` is
  `BulkTab | null` with no `isIndividualSimHost` narrowing to do; the definition throws on a null the
  way `useBulkTab` does, which reaches the user as the same error toast rather than a silent no-op.
  **`SimHeader.addImportLink` had to go with the type it named**, and the chain it fed is now dead with
  no live producer: `addExportLink` → `ImportExportRegistry.add()` → `ImportExportEntry.open?` →
  `ImportExportMenu`'s `entry.open?.()` branch. Only `addDialog` is reached. Left in place — it is
  pre-existing dead code, not this port's, and `sim_header.tsx` is still vanilla.
  **`ItemNotice`'s only production caller was its own static.** `individual_sim_ui.tsx` called
  `ItemNotice.registerSetBonusNotices(db)`, a one-line forwarder to `features/gear/item_notices`; the
  class itself had no consumer left, because `ItemNoticeIcon` replaced every one when the gear pickers
  ported. Deleting it removes `view/item_notices.tsx` with it — the throwaway `createRoot` shim that
  handed tippy DOM — and **`react-dom/client` is now imported in exactly one file, `app/spec_entry.tsx`**,
  which is what the eslint suppression on that shim was waiting for. `createNameDescriptionLabel`'s only
  remaining consumer was the parity test asserting React matched it, so the two go together, and
  `getEmptySlotIconUrl` — the file's other half, and not JSX — moves to `gear/model/empty_slot_icons.ts`.
  **The toast's `body` is `string | Node` now, not `string | Element`.** The type was already lying: a
  tsx-vanilla `<>…</>` is a `DocumentFragment` at runtime, and `spec_change_warning_toast` passed one.
  Building the same fragment by hand keeps `.toast-body`'s children exactly as they were, where the
  `document.createElement('div')` the other two non-JSX toast bodies use would have added a wrapper.
  The file is a `.ts` **in place** — three `ui/specs/**` presets import it, and an extensionless
  specifier means that frozen surface is untouched.

- 2026-09-09 **The bulk tab is React, and it takes the vanilla gear selector with it.**
  `features/bulk/view/` is gone — 5 files, 2,187 lines — and so are `features/gear/view/`'s
  `selector_modal.tsx` (568), `item_list.tsx` (647), `filters_menu.tsx` (310) and
  `item_renderer.tsx` (253), plus `gear_change_icon.tsx` (129): **1,907 further lines of gear that
  bulk was the last consumer of.** `@jsx-vanilla` files go 45 → 37, of which 36 are source — 15 in
  `ui-kit`, 5 in gear, 5 in `app/`, 3 each in import-export and `ui/specs/**`, 2 in the shim, one
  apiece in results, settings and i18n. `features/bulk/` has none, and no feature holds a whole
  un-ported tab any more.
  **`BulkTab` is a model, not a view, and that is what decided the unit.** The other four tabs became
  six-line shims because their state lives on the player or the sim. Bulk's lives on the class — the
  item array, the frozen slots, the required set bonuses, the run — and it is `host.bt`, read by
  `ItemListRow` and by the JSON importer. So it stays, at `features/bulk/bulk_tab.ts`, with
  `buildTabContent()` empty and every DOM-building method gone; `BulkTabBody` is portalled into its
  `contentContainer` beside the other four. It exposes `subscribe`/`getRevision` for the three things
  the store slice does not carry — the run flag, the results and the combination count — because a
  `useSyncExternalStore` snapshot has to be a stable value and those three always change with a render.
  **The recorded mount race dissolved rather than being worked around.** `pickerGroups` was
  `Map<slot, BulkItemPickerGroup>`, DOM-owning components built inside `buildSetupTabContent` that
  `loadSettings()`'s `addItems` then reached into from a `waitForInit` callback — the reason the
  2026-09-09 gate entry called a React body a race needing a `whenGroupsMounted` promise. They are
  `model/picker_groups.ts` now: plain arrays with the same insertion order (equipped entries
  unshifted, which is what the vanilla group's `insertAdjacentElement('afterbegin')` produced) and the
  same duplicate rule, built in the constructor, so there is nothing left to mount late. `getSlotOptions`
  reads them unchanged. Toasts move to the caller, since a `features/*/model/**` file may not touch
  `document`; the add and remove paths return a result and `BulkTab` raises the same notices.
  **What the port unlocks is bigger than the port.** Bulk and item swap were the last two importers of
  the vanilla `SelectorModal`, which was the only importer of `ItemList`, which was the only importer
  of `FiltersMenu`. Two props on the React one serve all three consumers: `id`, because
  `bulk-selector-modal-*` is how `bulk-tab.mjs` tells the instances apart, and `rail`, because the
  rail opens each slot with the *equipped* item and an instance editing a batch entry or a swap set
  must not offer it. `SettingsTab` now holds a `GearSelectorModalOpener` where it held a lazily
  constructed vanilla modal, and `SettingsTabBody` renders the dialog — the shape `gear_tab.ts` and
  `GearTabBody` already had.
  **`GearData.subscribe` had no reader and now has one.** The React modal keyed `equippedItem` on the
  player's own gear, which is right for the gear tab and blind to a batch entry being replaced. It
  subscribes to the source's own notification too — in an effect, not `useStoreSubscribe`, which marks
  its snapshot stale as it subscribes and would rebuild every tab's item data a second time on each
  open, and only while open, because the dialog is kept mounted.
  **`ItemDetailCell` came out of the second copy, not the first.** Porting bulk's picker and its
  results cells meant writing the `item-picker-*` cell a second and third time, so the shape is one
  component now and `ItemPickerCell` is ~70 lines that add only the quick-swap tooltips. That is what
  finally deletes `item_renderer.tsx`. `formatDeltaText` is the same move one layer down:
  `formatDeltaTextElem` is now a two-line wrapper over a pure function the React results row uses.
  **Four recorded defects fixed, and each is visible somewhere.** `createFreezeWeaponTypePickers` put
  the initial `hide` on the container and toggled it on `container.parentElement`, so a saved frozen
  weapon left a block that could never be un-hidden — the class is on the container, from state.
  `removeItemByIndex`'s early-return error toast ignored its own `silent` flag, so clearing a list
  with holes in it fired one toast per hole — it checks the flag. `#bulkResultsTab` shipped `show`
  without `active`, which is inert and is now an `INTENDED` entry recording that the port is the
  correct one. And every `<button>` in the tab declares a `type`, where vanilla's eight defaulted to
  `submit`.
  **Gate bookkeeping, measured rather than guessed.** Five `INTENDED` entries, each capped at 1 by
  setting `max: 0` and reading the printed tally: four are the `SearchBar` adoption (its field root,
  its input group, `search-bar-input` on the control and `search-bar-clear-btn` on the clear button —
  `cancel-bulk-gear-search-btn` rides along through the new `clearClassName`, because
  `_bulk_item_search.scss` styles it and the gate clicks it), and the fifth is the results pane's
  `show`. `parity.mjs`: `VANILLA_ON_BOTH`'s `selector-modal` entry is **removed** — it asserted the
  vanilla copy bulk no longer builds — `PORTED_DIALOGS` gains `bulk-sim-progress-tracker`, and
  `PORTED_DIALOG_REACT` goes 12 → 14, the batch's and item swap's selector modals. The batch's
  progress dialog is mounted only while a run is in flight, the way the reforge one is, which keeps
  "no progress dialog is at load" true on the React side and the shell's pruned-line counts equal.
  `bulk-tab.mjs` needed two shape-agnostic reads: its modal row count is geometry now
  (`selector-modal.mjs`'s rule — how many rows a windowing strategy keeps in the DOM is its own
  business) and its progress-bar check accepts Base UI's track beside Bootstrap's `.progress-bar`.
  Its output is otherwise identical across the two builds apart from the three lines its header now
  names.
  **`a11y.mjs` gains a `#bulk-tab` region.** The pane is fully React, so it is measured rather than
  exempted, and two of the four checks are equalities the port established: the baseline leaves all
  five of the pane's icons readable and four of its seven buttons untyped, and both are zero now. Two
  ceilings stand. `unnamed` is 53 of 98 for the reason `#gear-tab`'s 57 is — an item cell's icon,
  socket and label anchors are text-free, and naming them is a markup change the parity gates pin.
  `unsafe` is 1 of 2 and is not React's: the setup pane's intro paragraph is a translated HTML string
  rendered through `dangerouslySetInnerHTML`, and its `<a href="https://raidbots.com"
  target="_blank">` carries no `rel` in either locale file. The same string writes `className=` where
  raw HTML needs `class=`, so all three of its styled spans render as bare `classname` attributes at
  `font-weight: 400` on **both** builds — measured, not inferred. Both are
  `assets/locales/{en,fr}/translation.json` defects: flagged, not fixed, because they are content and
  a gate ceiling is the honest place to record them.
  **The SCSS moved as a merge and was checked by measurement.** The four `individual_sim_ui/bulk/`
  partials are co-located into the three component folders; `_bulk_tab.scss` **stays global**, its
  rules being scoped under `#bulk-tab` and `#bulkSetupTab`, which are `SimTab`'s ids and not this
  component's — the `AplNavbar` rule. A 20-element computed-style sweep of the pane on both builds is
  what says the merge changed nothing, and it caught the one thing that did: `SearchBar` overlays its
  clear button on the right of the field, where Bootstrap's `.input-group > .btn` sat beside the
  control, so the three properties that wrapper supplied are restated in `BulkItemSearch.scss`. The
  dead `:nth-child(2n)` striping in `_item_list.scss` goes with the vanilla list it was for; the React
  rows are `[data-stripe]`.
  Flagged, not fixed: the batch's search results are a `<ul class="dropdown-menu">` of `<a
  target="_blank">` whose click is `preventDefault`ed to add an item — a link acting as a button, with
  an asynchronously filled `href`; it keeps the markup and gains the `rel` it lacked. The clear
  button's tippy is an `aria-label` now, because a react-tooltip renders in place and would add an
  element to a pane compared element for element. `BulkGearJsonImporter` is still the vanilla
  `Importer`, opened from React the way seven other React files open a vanilla `Toast`; it is what
  keeps `import-export/view/importer.tsx` and `IndividualImporter` alive, and it is now a unit of its
  own rather than a thing blocked on bulk.

- 2026-09-09 **The APL navbar is React, and the rotation tab has no vanilla left in it.**
  `app/tabs/rotation_inputs.tsx` (80 lines) and `ui-kit/sticky_toolbar.ts` are **deleted**;
  `features/apl/components/AplNavbar/` and `features/apl/model/apl_panes.ts` replace them. The tab's
  last `useLegacyMount` is gone, `@jsx-vanilla` files go 46 → 45 (44 source), and the tree's last
  `new TextDropdownPicker(...)` goes with it.
  **The blocker the old file described was half wrong, and the half that was right is what dissolved.**
  Its comment said `StickyToolbar` and the rotation-type picker both "append themselves". Only the
  picker's container did: `StickyToolbar` passed the navbar div as `Component`'s third constructor
  argument, which **adopts** an element rather than appending to it, so it was adding
  `sticky-toolbar-root` to a div React already owned. What was genuinely load-bearing is the *order* —
  picker first, strip second, because `.apl-rotation-navbar .nav-tabs` is `margin-left: auto` — and
  rendering the whole row in one component settles it by construction. Two things fall out of the
  same reading, both latent rather than live: `useLegacyMount`'s cleanup called `rootElem.remove()` on
  React's own div, and `StickyToolbar` never held its `IntersectionObserver` at all, so `dispose()`
  could not disconnect it. Neither ever fired, because the mount's `[host]` dep never changed and the
  rotation-type switch toggles `display` on `#rotation-tab` rather than rebuilding the pane.
  **The sub-tab state lives in `RotationTabBody`, as `useState`, not in a context.** The strip and the
  three panes are rendered ~40 lines apart in one component's JSX, so a context would be one provider
  and two consumers inside a single render — the abstraction the "why abstractions get bypassed"
  section exists to prevent. `APL_PANES` moved out of the view file into `apl/model/apl_panes.ts`,
  which is where a list of ids and i18n keys belongs, and `AplPaneId` is what types both
  `PANE_BODIES` and the strip.
  **Hand-rolled `.nav-link`, not Base UI `Tabs`, and the two reasons are hard ones.** `Tabs.Panel`
  ignores a passed `id` (`tabs/panel/TabsPanel.d.ts`, recorded above), and these panes' ids are what
  `aria-controls` names and what `#rotation-tab .tab-pane` styling reaches; and `Tabs.Root` must be a
  common ancestor of the list and the panels, which here live in two different subtrees of
  `.rotation-tab-apl` with `.tab-panel-right` between them — so it would add a wrapper the baseline
  does not have, in the pane `panes-parity.mjs` compares element for element. This is the
  `DetailedResults` shape, not the `SimTabs` one: Base UI took the **top-level** strip, where the
  markup was deliberately re-expressed. Bootstrap's tab plugin loses a consumer and is not gone —
  `bulk_tab.tsx:219` and `selector_modal.tsx:632` still construct it.
  **What Bootstrap was stamping, measured rather than assumed.** A probe of the baseline at three
  seconds shows the plugin *had* run on these sub-tabs: `tabindex="-1"` on the two inactive buttons
  and `role="tabpanel"` on all three panes, neither of which the vanilla JSX wrote. Both are rendered
  now. `aria-labelledby` is the one thing Bootstrap did **not** add — `_setInitialAttributesOnTargetPanel`
  needs `child.id` and the vanilla buttons had none — and it is not added here either, because that
  would be a markup addition on top of a port; `DetailedResults` did add it, and this is the
  divergence between the two strips.
  **Three duplicates collapsed rather than copied a third time.** `useStickyToolbar`,
  `useTabFade` and `nextTabByKey` are extractions of code `DetailedResults` already had; the navbar
  would otherwise have carried ~38 lines of it verbatim. Both consumers of each are live. What is
  deliberately **not** extracted is the strip's markup: `DetailedResultsTabs` puts a per-tab class on
  its `<li>` that four stylesheet rules and `browser.mjs`'s `probe.ids()` read, and ids on its buttons
  that its panes point back at, while this strip has neither — parameterising markup that differs in
  three ways for two callers is how a shared component gets bypassed. A `ui-kit/NavTabs` becomes worth
  it when bulk and the selector modal port and it has four.
  **`ui-kit/pickers/dropdown_picker.tsx` is not deletable, and the brief that said it might be was
  wrong.** Nothing constructs it any more, but `/usr/bin/grep -rn` from the worktree root finds two
  importers that a "no constructions" check misses: `ui-kit/pickers/unit_picker.tsx:23` `extends
  DropdownPicker`, and `apl/model/action_id_sets.ts:6` imports the `DropdownValueConfig` type. Under
  the dual-stack rule it is not trimmed either. It goes when `unit_picker.tsx` does.
  **`apl-tab.mjs` grew the step that makes it prove this port.** It drove the rotation-type picker
  already but never clicked a sub-tab, so the state this change lifted was unwitnessed by any browser
  gate. `walk the sub-tabs` clicks all three and reports active/show/aria-selected per stop; the two
  builds' whole outputs stay byte-identical apart from the port number, and forcing the first pane
  permanently active makes the new line diverge, which is the check that it is not vacuous.
  `INTENDED`'s `open-on-click` tally moves 421 → 422 under its 450 cap — the navbar's own picker —
  measured with `max: 0`, not guessed.

- 2026-09-09 **The APL cluster is React, and it takes the vanilla `ListPicker` with it.**
  `features/apl/view/` is gone — 11 files, 2,932 lines, `apl_helpers.tsx` alone 1,256 — and so are
  `ui-kit/pickers/list_picker.tsx` (703 lines, ten importers, every one of them an APL view file) and
  `features/settings/view/cooldowns_picker.ts` (149). 65 new files land under `features/apl/` —
  `components/`, `context/`, `hooks/`, `model/` — plus `ui-kit/UnitPicker/utils.tsx`.
  `@jsx-vanilla` files go 52 → 46, of which 45 are source and `features/apl/` has none. Four more of
  the rotation tab's `useLegacyMount` sites go, leaving **one**: the navbar, which stays imperative
  because `StickyToolbar` and the rotation-type picker append themselves and a React-rendered `<ul>`
  would land ahead of them instead of after. (Half wrong, and corrected by the navbar entry above:
  `StickyToolbar` *adopted* the div rather than appending to it. The ordering half was right.)
  **The mutual recursion is real, it is kept, and one line of shape is what makes it safe.**
  `ValuePicker` → `FieldGroup` → `AplField` → `ValuePicker` is a genuine ES module cycle. It holds
  only because `AplField` dispatches with a `switch` **inside the component body**, so the imported
  binding is resolved when a field renders, long after every module in the cycle has finished
  evaluating. The module-level lookup table this codebase otherwise prefers for a discriminated union
  is exactly what does not work: it reads the imported component while the cycle is still
  initialising, and the first module in throws `Cannot access 'ValuePicker' before initialization`.
  That is the shape vanilla had, in `valueKindFactories` / `actionKindFactories`, and it is why the
  2026-09-08 entry recorded the cluster as un-portable in halves. Three `vi.resetModules()`
  cold-import tests hold the rule — two in `ValuePicker.test.tsx` (`ValuePicker` imported first, then
  `AplField` imported first) and one in `ActionPicker.test.tsx` for the sequence/action edge. **The
  rule is about the cycle, not about tables:** `RotationTabBody`'s `PANE_BODIES` is a module-level
  component table and is perfectly fine, because it sits outside the cycle.
  **`useAplInput` closes the carry-forward the `ListPicker` entry left.** Every APL config gets
  `storeSubscribe: subscribePlayerField(player, 'rotation')` and a generated id, because a bound leaf
  handed no source freezes at its first render with no error and no visual cue, and `PickerShell`
  needs an id for the label's `htmlFor`. Nothing in the tree holds a copy of its message: vanilla
  reassembled each message from its child pickers in `getInputValue()` and pushed it back down
  through `setInputValue()`, where every field now writes its own property of the live proto and
  `touchRotation()` is the re-render. That is also why the React `ListPicker` still splices the array
  `getValue` returned, in place, deliberately.
  **What was data pretending to be view.** `model/{field_specs,kind_options,placeholders,unit_values}.ts`
  is where `apl_helpers.tsx` went: 29 field-descriptor types resolve to **13** picker kinds (the
  twelve fixed-enum types are one `enum` rendered by one `EnumField`, where vanilla had twelve
  near-identical `TextDropdownPicker` factories; four alias descriptors are a `number` and three
  `boolean`s; `variableName`/`groupName` are one `rotationName` over two sources). `placeholders.ts`
  replaces **five** hand-rolled depth-first walks over a proto's object graph, two of which silently
  lacked the others' short-circuit.
  **Two DOM reads that only worked because vanilla built into a parent that already existed.**
  `isPrepull` and `isGroup` came from `rootElem.closest('.apl-prepull-action-picker')` /
  `closest('.apl-groups-picker')` inside a constructor; they are a property of the *list*, not of the
  picker, so they travel down through `AplContext` instead — a React component renders before it
  is in the document, so the answer has to arrive rather than be looked up. And a row's validations
  came from `rootElem.id`, which every APL picker wrote its uuid into; the uuid is on the message, so
  `uuidValidations` matches on data and no APL picker needs a DOM id at all.
  **`ui-kit` changes the port forced, all small and all shared.** `DropdownOption.itemClassName`
  lands on the menu row only, never on the trigger, and the two channels are **not**
  interchangeable: `_apl_rotation_picker.scss:80` makes `.apl-list-item-picker .apl-prepull-actions-only`
  `display: none`, so a pre-pull-only spell carrying that class on the trigger would hide the whole
  picker the moment it was selected. `DropdownField` grew vanilla's third type parameter,
  `<ModObject, T, V = T>`, for a config whose stored type is not its option type (an `ActionID`
  offering `ActionId` objects, a `UnitReference` offering `UnitValue`s). The `UnitValue` → option
  mapping moved out of `UnitPicker` into `UnitPicker/utils.tsx`, because a *bound* unit field's root
  has to be the `PickerShell` and wrapping the unbound picker would add an element the baseline does
  not have. `ListItemAction` (vanilla's static `makeActionElem`) is exported; the type that used to
  own that name is `ListItemActionName`.
  **The locale bug is finally dead.** `sameGroupOnly` was added in the `ListPicker` port with no
  consumer and now has both: `PriorityList` sets it bare, `GroupEditor`'s action list sets it with
  `dragGroup: 'action-group-actions'`, so two groups' lists exchange rows and the priority list stays
  out of both. Vanilla expressed that as `itemLabel !== 'Action'` — a comparison against an English
  literal, against a label that is `i18n.t(…)`, so the rule simply vanished under any locale that
  translated it. The *other* cross-list rule, the `itemLabel` match, is unchanged and still what keeps
  a sequence's list (vanilla's lowercase literal `'action'`) out of a priority list.
  **Defects fixed on the way through.** `GroupVariablesField` derives its rows from the referenced
  group's placeholder names instead of storing them: vanilla's `reconcile()` rewrote
  `parentValue.variables` from *inside* `getValue()`, needed a three-part memo key to stop
  re-triggering itself, and smuggled a `__uiVarName` field onto each proto entry to carry its label —
  all three gone. `ActionIdIcon` drops the `CacheHandler` of cloned option nodes, which existed only
  because vanilla rebuilt the whole option list on every metadata change. `ActionPicker` drops
  vanilla's "no kind" branch, which the menu could never reach (its options come from the kind table
  alone, with no empty entry, unlike the value picker's) — the non-nullable `ValidAPLActionKind` is
  what records that. `GroupVariableRow`'s name is a real `<label for>` where vanilla appended a bare
  `<label>` naming no control at all. The list's root reports `data-disabled` rather than the
  `disabled` attribute vanilla wrote onto a `<div>`, and its create button is typed — the two
  assertions that survived `ListPicker.parity.test.tsx`, deleted here because the vanilla half of its
  oracle is gone.
  **`tools/react-migration/apl-tab.mjs` is the new gate**, shaped like `talents.mjs` because the pane
  is almost entirely editing and its DOM at load says nothing about whether an edit works. Its oracle
  is the autosaved rotation blob, not the rendered pickers, with per-row digests so a reorder is
  visible; structure counts come second and only for elements both stacks name identically. It takes
  **one** spec and reads `PORT`, so it runs once per build. Three things it had to learn, all still
  true: `page.hover()` times out on `.list-picker-item-actions` and the mouse has to be moved to its
  box instead; Playwright's `dragTo` reports success without reordering anything, so synthetic
  `DragEvent`s with a real `DataTransfer` are what both stacks actually listen for; and a synthetic
  reorder leaves the *vanilla* list inert to the next popover, so the script deletes first and drags
  last.
  Flagged, not fixed: `HidePicker` still has **no tooltip** — vanilla carried a commented-out
  `tippy(…, 'Enable/Disable')` and two "update the tooltip when available" TODOs, and the string was
  never translated, so adding it would put one English label into an otherwise localised header.
  `FloatingActionBar`'s `stuck` class is still *toggled* per observer delivery rather than set from
  `isIntersecting` — vanilla's shape, correct only because the `-100%` top margin makes the element
  cross the boundary once per direction, and the one `IntersectionObserver` in the tree that the
  2026-09-08 "read `entries[entries.length - 1]`" sweep does not cover. And `AplValidations` spells
  its four level classes as a map, where vanilla walked `Object.entries(LogLevel)` and only half its
  entries — the name→number ones — could ever match the level it was comparing against.

- 2026-09-09 **The combat replay is React, and `DetailedResults` has no islands left.** 1,076 lines
  deleted; `features/results/view/result_component.ts` went with it, the replay having been its last
  subclass. Phase 4's results pane is closed.
  **Nothing per-frame goes through state, and the split is worth copying.** `useReplayClock` owns the
  rAF loop, keeps the playhead in a **ref**, and holds only the transport (`playing`, `rate`) in React.
  `useReplayFrame(paint)` lets each leaf join a painter set and write its *own* ref'd nodes — about
  twenty subscribers, two or three properties each. `useFrameList` recomputes structure the playhead
  decides (the cast strip, the aura rows) every frame but **commits only when its key changes**, a few
  times a second rather than sixty. `arena/hitLayer.ts` stays wholly imperative: the impact animation
  is a particle system whose nodes are pooled by hit.
  Two bugs the tests caught and a browser would have hidden: `useLayoutEffect(() => paint(...))`
  returned the painter's value, and `classList.toggle` returns a **boolean**, which React read back as
  the effect's cleanup and threw `destroy is not a function`; and the repaint-on-every-render is
  load-bearing, because while paused there is no next tick, so a leaf that mounts or whose props change
  on a seek would hold the previous frame's value forever.
  **Frame cost, read honestly.** No regression and no dropped frames on either build — both hold 60 fps.
  In-callback scripting is ~40% lower and its worst case ~2× lower, but that figure flatters the port,
  because a `useFrameList` commit is scheduled by React and runs in a *later* task the rAF wrapper never
  sees. The CDP whole-page numbers are the fair ones: `Script` is lower on all three runs, while `Task`,
  `RecalcStyle` and `Layout` sit inside the baseline's own run-to-run spread.
  **A real latent bug fixed on the way through:** `mergeAdjacentAuras` ran over one flat array of *every*
  target's auras keyed on the spell alone, so a dot fading on one enemy absorbed the same dot landing on
  the next, and the merged span kept the first enemy's index. Merged per target now. It did not surface
  in a three-target browser run — Arms' debuffs happen not to line up that way — so it is latent, not
  visible, which is exactly the kind a port either fixes or inherits silently.
  `dropReplayState` in `browser.mjs` is an **assertion, not an allowance**: the vanilla constructor built
  both the placeholder and the whole scene up front and toggled `display`, where React renders whichever
  applies. It takes the baseline's hidden half off and each gate asserts the count per side, so a half
  that stops being built, or one the port starts building early, fails there.
  `combat-replay.mjs` is the new gate — one seeded fight on both ports, three fixed scrubber stops,
  play/pause, tab close and reopen, a second run resetting the playhead, and frame cost measured two
  ways.
  **Follow-up now due:** `ReplayIcon`, `Timeline/rotation/RotationRowIcon` and `ui-kit/IconPicker/ImprovedAnchor`
  are three near-identical actionId anchors. That is the trigger for a ui-kit extraction, and it touches
  three features, so it belongs in its own change.
  Flagged, not fixed: the scrubber `<input type="range">` has no accessible name **on either build**, and
  giving it one needs a new i18n string.

- 2026-09-09 **Bulk finally has a browser gate, and it passes on both builds — which is the point.**
  `tools/react-migration/bulk-tab.mjs` runs a real batch: the inner Setup/Results strip by
  `aria-selected` and computed display, every slot group's counts, every settings control keyed on its
  id, the combinations counter, then it *operates* the tab — search and its 21-row cap, adding items,
  opening the selector modal from an added picker (and proving an equipped one cannot), freezing a ring
  both ways, running the batch, reading the results table row by row, and equipping a candidate. Bulk
  is un-ported, so a gate that passes on both ports is proof it measures the tab rather than the port.
  Budget it: ~45 s per port on `warrior/arms`, 3–4 min on `monk/windwalker`.
  **Its two cross-port diffs are both master bugs the branch already fixes.** `BulkSimResultRenderer`
  asks for `gear-tab` after Equip; master's `SimHeader.activateTab` clicks the `<li class="gear-tab">`
  rather than the `<button>` inside it, and Bootstrap's tab data-API is bound to the button, so the
  request is silently dropped and master stays on the bulk tab. And the branch offers **198 fewer
  items** to an arms warrior — all bows, crossbows and guns — because `acf3ac287` emptied the pre-MoP
  ranged set. That one is invisible to any git-based comparison: `capabilities_auto_gen.ts` is
  gitignored and regenerated by every build, so only an md5 of the working tree shows it.
  **The port itself is deliberately partial**, and the blockers are concrete rather than time: there is
  exactly **one legal mount site** for a React bulk body — `createPortal(…, simUI.bt.contentContainer)`
  in `SimApp.tsx`, because `react-dom/client` is lint-banned in `features/**` and `ui-kit/**` and
  `useLegacyMount` only goes vanilla-inside-React; `BulkTab.loadSettings()` runs inside
  `waitForInit().then(...)` and calls `addItems`, which does `pickerGroups.get(slot)!`, so React-mounted
  groups turn that into a race needing a `whenGroupsMounted` promise that must land *with* the shell;
  and the combinations counter and Simulate button are written imperatively, so React owning them needs
  a third counter on the bulk store slice. What landed is the pure logic — `model/{set_bonuses,limits,tie_chains}.ts`,
  38 tests, `bulk_tab.tsx` 1673 → 1481 — with the gate's output **byte-identical before and after**,
  which is the evidence that the extraction changed no behaviour.
  **A correction to the brief:** `SimTab` is *not* down to one consumer — rotation, talents, settings
  and gear tabs all still extend it. Bulk is the last nested *Bootstrap tab strip* outside the selector
  modal, which is a different claim.
  Four defects flagged rather than fixed: `createFreezeWeaponTypePickers` puts the initial `hide` on the
  container but toggles it on `container.parentElement`, so loading with a frozen weapon slot leaves a
  block that can never be un-hidden; `clearItems` walks holes and `removeItemByIndex` raises an error
  Toast **without checking its `silent` flag**, so clearing a list fires one toast per hole;
  `#bulkResultsTab` carries `show` without `active`; and `@sim/bulk/utils` → `@sim/proto/items` →
  `@i18n/entity_mapping` is an import cycle that reads `BulkSimItemSlot` at module scope, so the new
  model imports the constants from `@sim/bulk/constants_auto_gen` directly.

- 2026-09-08 **The timeline is React, and the row-toggle scroll jump is fixed with a gate that proves
  it.** 34 production files grouped as `Timeline/{chart,rotation,tooltips}/`, `index.ts` exporting only
  `Timeline`. `DetailedResults` is down to **one** island, `CombatReplay`.
  **The jump's cause, read from the code rather than guessed.** The rendering frame holds
  `window.first`/`window.last` as **indexes into `order`**. Hiding a row produces a new `order`, so the
  stored frame is measured against a list that no longer exists — vanilla answered that with
  `unmountAll()` and re-windowed on the next scheduled frame, and the first port inherited the shape by
  rendering an empty window for one commit. Either way the content is empty for a commit, the spacers
  stop carrying the list height, the document is momentarily a whole rotation shorter, and the browser
  clamps `scrollTop`. The height returns; the scroll does not. **1,105px of jump from a 32px change.**
  The fix is to derive the frame for the new order **during the same render** from cached geometry, so
  the spacers never stop carrying the full height. A render-phase `setFrame` was tried first and does
  **not** work — React computed the right window and then reverted it, because the render-phase update
  was never committed. Pure derivation is what sticks. `tools/react-migration/rotation-row-toggle.mjs`
  passes on the port at both scroll positions and still fails on master, which is how it should read.
  **Timing, paired against master:** the swap is ~2.5× under the 300 ms baseline. Sync rose 20–25 ms,
  and the reason is the fix — deriving in render puts the row work inside the click where vanilla
  deferred it a frame. Settle is 60–90 ms *faster*, mutations ~9% fewer, four long tasks became two,
  and live tippy instances in the pane went **24 → 0**.
  **Which support modules were already model, verified by reading them:** `rotation/model/*`,
  `chart/series.ts`, `chart/build.ts` and `constants.ts` have zero DOM references and stayed put.
  `colors.ts`, `annotations.ts`, `chart/zoom.ts`, `ruler.ts` and `rotation/zoom.ts` are *not* DOM-free by
  nature (computed styles, canvas drawing, a pooled tick DOM) and stayed too. Two were converted to pure
  geometry and unit-tested: `timeline_window.ts` (a DOM-mounting class with ten refs) and `row_track.ts`
  (a pooling recycler), the binary search kept verbatim.
  **Round five of the delivery loop caught a regression the port had introduced** — an effect resetting
  the FAB drawer on every new result, where vanilla rebuilt the chips in place — and a vacuous probe
  assertion that had been comparing "no tooltip" to "no tooltip", because the anchor sat under the
  sticky row label. Six rounds to a fixed point.
  Divergences kept and flagged: item and chart tooltips are one viewport-anchored overlay rather than
  tippy (text compared, placement unverified); the chart is destroyed and rebuilt per result rather than
  `update('none')`; and a *cleared* result with the DPS view open shows a blank canvas where vanilla
  showed the waiting state, because `noData` conflates "never armed" with "armed, nothing" — a tri-state
  fixes it.

- 2026-09-08 **A React `ListPicker`, and the encounter target list as its first consumer.**
  `encounter_picker.ts` went from **629 lines to 7**. `ListPicker` uses `useInput` + `PickerShell` (the
  bound `NumberListPicker` pattern — all eleven callers are bound) and takes `renderItem` /
  `renderItemHeader` render props, the second replacing `getItemHeaderElem`'s sibling-walk DOM
  contract. `makeActionElem` became the `ListItemAction` component.
  The APL cluster proper (the field renderers, value and action pickers, the four lists, the navbar) is
  **not** ported, and the reason is shape rather than time: `AplValuePicker` ↔ `AplFieldGroup` ↔ a
  nested `ListPicker` are mutually recursive and cannot be half-wired. Three of the rotation tab's
  seven `useLegacyMount` sites are gone.
  **Carry-forward for whoever takes the rest, so it is not re-derived:** `APLPickerBuilder.makeFieldPicker`
  passes field pickers **no** `storeSubscribe`, and `useStoreSubscribe`'s `stale.current || !snapshot.current`
  guard means a React leaf without one freezes at its first render. Every APL field config needs
  `storeSubscribe: () => subscribePlayerField(player, 'rotation')`.
  **`DropdownPicker` was split** so a bound variant could exist without nesting a second root:
  `DropdownMenu`, `DropdownMenuItems`, and a `DropdownField` whose root **is** the `PickerShell`. That
  came out of the simplification sweep catching a wrapper div mid-write — the exact class of regression
  the rotation tab has produced three times.
  **A mutation survived first, and the test was vacuous.** happy-dom's synthetic `DragEvent` carries
  `clientY: undefined`, so a "inserts after its midpoint" component test never evaluated the midpoint
  branch. The rule moved to a pure test with real rects. A second test was wrong the other way: vanilla
  computes a move destination against **pre-removal** positions, so a forward move lands one place later
  than the drop cue — the code was right and the expectation was wrong.
  Findings recorded rather than fixed: `headerText` is provably dead in the vanilla `DropdownPicker`
  (filtered in the constructor *and* in `setOptions`), `configureInputSection` mutated
  `InputConfig.extraCssClasses` **on the frozen spec object** (deleted), `configureIconSection`'s `hide`
  branch was unreachable, and `TargetInputPicker`'s reuse guard compared a translated label against a
  raw one.
  `apl-edit-timing.js` itself needed fixing — it clicked `.nav-link`, which never opens a pane under
  Base UI tabs. Its sync figure is 19–24 ms against master's 6–9 ms, and that gap is **pre-existing on
  the branch**, A/B'd by reverting the port and re-timing at 18–23 ms.
  The last two `([entry]) => …` observers are fixed with it — `ui-kit/sticky_toolbar.ts`, which is live
  in the shell, and the unported `apl_floating_action_bar.tsx`. Every `IntersectionObserver` in the tree
  now reads `entries[entries.length - 1]`.

- 2026-09-08 **The reforge model is de-classed, and the frozen surface never required a class.**
  `ReforgeOptimizerModel` is an interface; `createReforgeOptimizer(sim, player, options)` returns an
  object literal built from closures. `ui/specs/**` constrains the **shape** — a getter satisfies
  `ctx.reforger.preCapEPs` and a function property satisfies `host.reforger?.setUseSoftCapBreakpoints()`
  identically — so the earlier reading that this had to wait for Phase 5 was wrong. What waits for
  Phase 5 is *dropping* the handle, not de-classing it.
  **The surface went from 34 members to 19, and the deletions are the result**: eight were one-line
  delegations to the store-backed `settings` facade that consumers now call directly, eight had no
  caller at all — `isTankSpec` was assigned and read by nothing, not even the model — and three became
  free functions in `model/utils.ts` (`applyBreakpointLimits`, `clearSoftCappedStats`, the cap↔percentage
  conversions), unit-testable without constructing anything. `breakpointValueToDisplayPercentage` had
  been written twice in components; it is one import now. The three pass-throughs that survive exist
  only for a frozen spec (`setUseSoftCapBreakpoints`) and for the still-vanilla `bulk_tab.tsx`.
  **`toProto` had zero external callers** — `state/serialization.ts:99` calls it on
  `reforger.settings`, not on the model, which the brief got wrong.
  `ReforgeSettingsState` can take the same treatment when someone wants it: two `new` sites, no
  `instanceof`, no subclass, and the subscription helpers only read its public `store`/`storeKey`. Two
  wrinkles to respect — `relativeStatCap` is assigned from outside and `undershootCaps` is a real
  setter, both expressible on an object literal. `RelativeStatCap` in the same file is **not** a
  candidate: throwing constructor, statics, three `new` sites. It is a value type.
  Behavioural proof is the browser solve, not the goldens: `test:snapshots` never constructs the
  reforger (`snapshot.ts:92` says so), and `reforge-popover.mjs RUN_SOLVE=1` runs a real optimisation
  and diffs identically against master apart from the one documented focus-tooltip line.

- 2026-09-08 **The log runner is React — `VirtualList`'s second consumer, and the one that answers the
  striping question in general.** ~915 lines across seven files became `components/LogRunner/`;
  `search/indexes.ts` and `query.ts` stayed as pure model.
  **The transform hazard did not bite, and the rule is now on the component.** `VirtualList` moves rows
  with `transform`, which makes each row a containing block for `position: fixed` **descendants** — but
  a log row contains only labels, anchors and text, and `ActionLink` hands its tooltip to Wowhead's
  script, which appends to `<body>`. A popup a row renders *itself* would land against the row; one
  portalled out is fine. The FAB menus live in the drawer, outside the list.
  **No striping normaliser, and the general reason:** the log has no striping at all, and no tree gate
  ever sees rows — vanilla's `VirtualList` empties its container at `count === 0`, `parity.mjs` and
  `panes-parity.mjs` never run a sim, and `results-tabs.mjs` cuts at `PANE_DEPTH = 4`, three levels
  above a row. That is why the selector modal did not need one either.
  **`([entry]) => …` is a real bug, in three places.** One `IntersectionObserver` delivery can carry
  several records, oldest first, and a list growing under an already-pinned bar produces exactly that
  pair; reading the first leaves the bar unpinned permanently and made `results-tabs.mjs` fail 4 of 6
  specs *at random*. Fixed in `LogFloatingActionBar`, and then in the two the port did not own —
  `DetailedResults`'s toolbar observer and `SimShell`'s header observer, plus the vanilla
  `rotation_floating_action_bar.tsx`. **Read `entries[entries.length - 1]`.**
  **The scroller is `.sim-ui`, not the window** — its `overflow-y: auto` does not grep as one would
  expect, and `findScrollParent` finds it, so the list runs in element mode. `VirtualList` gained a
  window mode for vanilla's `?? window` fallback, and `DropdownPicker` gained `side` and
  `positionMethod` — together they are vanilla's `extraCssClasses: ['dropup']` plus
  `popperConfig: { strategy: 'fixed' }`, load-bearing because the drawer clips its overflow.
  `TextDropdownPicker` needed no React equivalent: it adds only a text `setOptionContent`, and
  `label: ReactNode` already covers that.
  Two files could not be deleted: `results.tsx` and `entity_label.tsx` are imported by the still-vanilla
  timeline, so `OUTCOME_LABEL` is duplicated in `LogRunner/utils.ts` rather than importing a
  `@jsx-vanilla` module into React for one constant. They collapse when the timeline ports.
- 2026-09-08 **Class names and domain predicates got their helpers, and two of them already existed.**
  `metricsClasses` (`damage-metrics`, `healing-metrics`, …) was being re-interpolated as
  `` `${column.metric}-metrics` `` at four sites in the EP dialog and a fifth in `shell_classes.ts`;
  routing them through `metricsClassName`/`hideMetricsClassName` surfaced two loose types
  (`column.metric` was optional and silently produced `undefined-metrics`). `kebabCase` already lived in
  `@sim/utils/format` with eight users while three files hand-rolled
  `.toLowerCase().replace(/\s/g, '-')`, and one of those, `sim_result.ts:441`, was
  `PlayerClasses.getCssClass` re-implemented inline — it calls it now.
  New: `resourceClassName` (the `$resource-colors` Sass map generates one rule per key, so a name that
  does not kebab to one renders **uncoloured rather than failing**), `textClassName` (the primitive the
  two `textClassNameFor*` helpers now build on), and `isAvoidedOutcome`/`isCriticalOutcome` beside
  `OUTCOMES` — the avoided triple appeared four times, once negated, and `crit` alone silently misses
  `critical-block`.
  What was left inline on purpose: single `===` against a union member (`effect === 'healing'`) is
  clearer than a predicate, and the four keyboard-key pairs differ per component. The TMI/CoD
  percentage rule is deduped within `ResultMetricList/utils.tsx` but **cannot** be shared with
  `i18n/localization.tsx`, which the layer rule forbids from importing `@features`.

- 2026-09-08 **`DropdownPicker` and `UnitPicker` land on Base UI `Menu`, and `results_filter.ts` is
  deleted.** The "three dropdown pickers wait for the `Menu` adapter" objection is retired — all three
  are ported, and `Toast` is the only primitive still waiting for a first consumer.
  `Menu` was chosen over two alternatives with reasons: Base UI's `Select` positions with
  `alignItemWithTrigger`, overlaying the popup on the trigger where Bootstrap dropped below, and
  `EnumPicker` is a native `<select>` inside a `Field`, where an `<option>` cannot hold the `<img>` or
  the `text-<class>` colour a unit option renders. `Menu` also already carried two value pickers here,
  so the portal/slot pattern and the `parity.mjs` fold were solved. It brought something vanilla never
  had: `Menu.RadioGroup` gives `role="menuitemradio"` and `aria-checked`, where the vanilla menu was
  plain buttons in a `<ul>` and announced no selection at all.
  **A recorded SCSS hazard turned out not to be one, and the correction generalises.** The plan warned
  that `_list_picker.scss:92`'s `@extend .tippy-content` would silently extend nothing once the
  dropdown-picker tippy theme went away. Measured by deleting the block and building: no error, because
  `.tippy-content` is *also* defined in `shared/_tippy_style_overrides.scss` and both reach the same
  compilation unit. What disappears is one selector that could never match. "`@extend` of a missing
  target is a hard error" is still true — but *missing* means missing from the whole unit.
  One behaviour fix rather than a faithful port: vanilla dropped a no-longer-valid target selection
  inside `getUnitOptions`, i.e. re-entrantly during the first emit, so the tables briefly saw a filter
  pointing at a target that did not exist. The reset now happens before the emit.
  Two `INTENDED` entries, both capped at one occurrence: `input-root` (the vanilla `Input` shell's
  class — the React filter is deliberately not an `InputConfig` picker, and the probe reads the
  trigger's box back identical on both ports) and `open-on-click` (read only by
  `bootstrap_overrides.ts:24`, which hover-opens every *other* Bootstrap toggle, and a Base UI menu is
  not one). The `PORTED_MENUS` normaliser is scoped to `.target-filter-root` rather than
  `.dropdown-picker-root`, because the log search bar builds two **vanilla** dropdown pickers in the
  same pane and the root class cannot tell the stacks apart.
  **Operational note: never `rm -rf dist`.** `vite build` does not regenerate `dist/mop/assets/`,
  `lib.wasm.gz`, `highs.wasm` or the workers — `make dist/mop/.dirstamp` does — and the first parity
  run after wiping it reads like a repo-wide regression.

- 2026-09-08 **The Phase-0 open question is settled by measurement: React does not need
  `subscribeGated`, and that was never why `useStoreSubscribe` exists.** The evidence lives in
  `ui/sim/hooks/useStoreSubscribe.gate.test.tsx`, which binds the same store four ways and counts.
  The gate is a **vanilla-only** concern: a three-slice `batch()` fires the store listener once gated
  and three times ungated, and React collapses both to **one render**, because the read happens at
  render time after the batch has closed. No intermediate value is ever painted, gated or not. A
  `batch()` cannot span an `await` — it closes at the end of its synchronous body — so three
  `await`-separated writes are three renders under every binding, and the gate buys nothing there for
  anyone.
  **The conversion to zustand's `useStore` was measured and declined.** `useStore(store, counterSelector)`
  + `useMemo(read, [key])` is behaviourally identical to `useStoreSubscribe`: zero extra facade reads
  across unrelated parent renders, one stable reference. So it buys nothing measurable, while costing
  three things: it duplicates the `subscribe*` helpers at 30 call sites and leaks `player.storeKey` /
  `player.sim.store` into components; `subscribeAll` folds to a fresh array per call and zustand 5
  dropped `equalityFn` from `useStore`, so every folded source needs `useShallow` (**wrong** for
  `raidTuple`, which returns a new outer array per write) or `useStoreWithEqualityFn` from
  `zustand/traditional`; and **8 test files** deliberately stub `@sim/state/subscriptions` with opaque
  sources over doubles that have no store at all, every one of which would need a real
  `createSimStore()`. The `StoreSubscribe` *function* is the shared vanilla/React/test contract, and
  the hook is its adapter — which is also why the frozen `InputConfig.storeSubscribe` path can never
  convert.
  Two facts worth carrying: `useStore` re-evaluates its selector on every render (~4× per change
  against 1× for a `subscribeWithSelector` source), which is cheap for a counter and not for a
  selector that allocates. And **the `?.` in `s.players[key]?.v[field]` is load-bearing under every
  binding** — `subscribeWithSelector` runs every registered selector on every `setState`, so the gap
  after `deleteKeyed` is always visible; `Player.dispose()`'s `setTimeout` deferral is the real
  protection.
  The live-call recount is **30 files**, and **four** are structurally non-convertible rather than
  three: `useInput.ts`, `MultiIconPicker`, `PetSpecPicker` — and `SimWarnings.tsx`, whose source is
  `WarningsRegistry.subscribe`, a hand-rolled listener list with an allocating `getContents()`.

- 2026-09-08 **`FiltersMenu` is React, and a gate was lying about it.** The recorded "its own close
  button does not close it on either build" was a **probe artifact**: `selector-modal.mjs` matched
  `.modal.show .filters-menu` with a *descendant* combinator, and on the baseline the filters menu's
  `.modal` sits inside the selector modal's, so the selector matched through the outer one and read
  "open" whatever the button did. The same line made an `open: !!menu` assertion vacuous — the vanilla
  menu is built in the constructor with `disposeOnClose:false`, so it matched before Filters was ever
  clicked. Now `.modal.show > .filters-menu`, and closing is asserted on both builds.
  **Base UI detects nesting through the React tree, not the DOM** — measured on both builds: the child
  popup portals out of the parent entirely and lands as a *sibling* portal, yet the parent still
  survives a press inside it. That is why the menu renders inside `ItemList`'s JSX rather than behind
  an opener hoisted to `GearTabBody`: the React-tree position is the nesting signal.
  **A real Escape divergence, recorded as a pair.** `BaseModal.open()` puts its Escape handler on
  `document` for every modal and never scopes it to the topmost, so on master Escape over the filters
  menu takes the selector modal down with it; Base UI dismisses only the innermost dialog.
  `css-vars.mjs` gained a `gear filters menu` opener and it failed before the SCSS fix
  (`--bs-modal-padding` empty on 4 elements) — the third time this gate has caught a variable dying
  because a dialog left `.modal`, and the second time the gate could not see the dialog until someone
  taught it to open one.
  The seven `SelectorModal` components gained 75 tests, twelve of them proved by mutation. Three flags
  recorded rather than fixed: `${kebabCase(name)}-section` derives a CSS hook from a *translated*
  string, so `_filters_menu.scss`'s `.general-section` rule is dead in every non-English locale;
  section headings skip a level under Base UI's `<h2>`; and `item_sort.ts:15` optional-chains
  `scalingOptions` then dereferences `.ilvl` unguarded, so an item with no Base scaling entry throws
  inside the sort.

- 2026-09-08 **The topline row is React, and the reusable piece came out of it.** `ToplineResults` was
  28 lines because its work lived in a static on another class — `SimResultsManager.makeToplineResultsContent`
  — which one model feeds to **two** renderers: the sidebar's list and the detailed-results row. The
  model is now `model/topline_metrics.ts` (DOM-free, 14 unit tests) and `ResultMetricList` takes
  `layout`. The vanilla static survives as a three-line delegation to that model, so the sidebar keeps
  working un-ported and the metric derivation stops being duplicated — **that edit to a
  `@jsx-vanilla` file is deliberate and scoped**: the renderers, all eight `setResultTooltip` calls and
  `updateReference` are untouched.
  Two dead branches found by moving the code: the `% ` prefix on tmi/cod compared `column.name` against
  the *localized* label, so it never fired (the port implements the intent, visible only once the list
  layout has a consumer); and the row tooltips round-tripped the localized label through
  `backendMetricI18nKeys`, which misses in French for `hps` and `cod`, so master shows the label as its
  own tooltip. Keying on `metric` fixes both.
  **The new probe compares sim numbers digit for digit, which no other result gate can.** It reads the
  base build's own autosaved settings blob out of localStorage, patches in a fixed seed and iteration
  count, and plants the same JSON on both ports — a seeded 100-iteration run is then bit-identical
  across builds. It must be planted with `addInitScript`, not `evaluate`: the first load's debounced
  autosave flushes on `pagehide` and overwrites the blob after the reload was already requested, which
  silently compared two different sims until the probe started asserting the loaded seed.

- 2026-09-08 **The gear selector modal and its item list are React — Phase 3's last big unit.**
  ~1,215 lines of vanilla replaced by eleven files, and `VirtualList` finally has a consumer.
  **Base UI stops `keydown` propagation at `.sim-dialog-popup`.** Measured: a `document` listener sees
  ArrowDown in the capture phase and never in the bubble phase, while one on the popup fires. The
  vanilla rail navigation was a document listener, so porting it verbatim silently did nothing —
  `gear-tab.mjs` caught it. **Any dialog porting a document-level key handler must attach at the popup.**
  The predicted parity normaliser was not needed: a taken dialog is compared by count, and its rows
  exist only after a click no tree gate makes. What `parity.mjs` did need is the two-count shape the
  `exporter` already uses — `PORTED_DIALOGS += ['selector-modal', 2]` because the gear modal and bulk's
  railless copy are indistinguishable in the two lines `takeModals` matches on, with
  `VANILLA_ON_BOTH += ['selector-modal', 1]` asserting bulk's copy byte-equal to one of the pair.
  `css-vars.mjs` never opened this dialog, so all three `--bs-modal-*` references in
  `_selector_modal.scss` were invisible to it; an opener was added and the gate proved the failure
  before the fix (`--bs-modal-border-color` empty on 16/16 elements, `--bs-modal-padding` on 5/5).
  One of the three was already dead on master — `.selector-modal .modal-header .btn-danger` matches
  zero elements on either build, because the unequip button lives in the filter row.
  Two behaviour divergences kept deliberately: vanilla's ilvl sort re-sorts the array *on screen*, so
  ties inherit click history and the same list state comes out differently depending on how you got
  there (React sorts the filtered set every time, ties in database order); and vanilla removes the
  Enchants tab on Unequip and never re-adds it, so it stays hidden until you reopen the modal, which
  React derives from `player.getEnchants(slot)` instead.
- 2026-09-08 **`useDisplayMetrics` and `useShowExperimental`.** See the registry rows. The finding worth
  carrying: a `useStoreSubscribe` read that returns a fresh object is only safe while the subscription
  identity is stable, because the hook re-reads on subscription change — snapshot a primitive and
  expand it with `useMemo` instead. They first landed in `ui-kit/hooks/` only because `useStoreSubscribe` was
  there and `ui/sim/**` may not import `@ui-kit` at runtime; **that was fixed the same day** by moving
  the binding itself to `@sim/hooks`, and all four hooks now sit there.

- 2026-09-08 **The detailed-results pane is React, and results has its first port.** Nothing in
  results had moved because almost every file's owner is another vanilla file; `DetailedResults` was
  the exception — the shell builds it at `individual_sim_ui.tsx:380` — which is why it went first, and
  porting it is what makes each of its six children reachable. They all stay `useLegacyMount` islands
  for now, each mounted **into the div the vanilla JSX already had**, no wrapper.
  **How a result reaches the pane, end to end**: `addSimResultsAction` subscribes
  `sim.simResultEmitter` → `SimResultsManager.setSimResult` → `currentChangeEmitter.emit()`; React
  subscribes that emitter, calls `getRunData()`, and emits on `ResultChannel`, from which the vanilla
  islands read through `config.resultsEmitter.on` and the seven React tables through `useSimResult`.
  `WorkerProgressCallback` never enters this chain — it goes to `ResultsPanelStore`, which only the
  sidebar reads — so the pane has one subscription per completed run and no per-tick path.
  Two probe findings worth keeping. **Keyboard navigation starts from the focused tab, not the
  selected one**; the two coincide under a roving tabindex, so no unit test could see it, and only a
  cross-port probe did. And **comparing populated pane contents across ports is unsound** — each build
  runs its own unseeded iteration, so tables differ by crit rolls; the probe compares scaffolding and
  `results-tables.mjs` asserts the populated state.
  One ordering change was accepted here and then **removed** when `DpsHistogram` ported later the same
  day: vanilla dropped `dr-no-results` before the synchronous emit, while the island derived it from
  `useSimResult()` a microtask later and measured its row while still `display:none`. The React
  histogram reads `hasResults` and the chart from the same snapshot, which restores vanilla's order.

- 2026-09-08 **The reforge panel is React, and the view class is gone.** 1,019 lines deleted;
  `simUI.reforger` is now `ReforgeOptimizerModel`, which is all its four readers ever wanted
  (`.settings`, the autosave subscription, `.applyDefaults()`, `.statCaps`). `CopyButton` and
  `GearChangeIcon` came with it, both additive — `copy_button.tsx` still serves the log exporter and
  `gear_change_icon.tsx` still serves bulk. `ReforgeEpWeights` and the `epWeightsHost` indirection
  from `3677a3022` collapsed: `SavedEpWeights` renders directly in the popover now.
  **`container` must be the sidebar action group, not `host.rootElem`** — tippy's default `appendTo`
  is the reference's parent, so master's popper hung inside `.suggest-reforges-settings-group`, which
  is where `--settings-button-width` is declared and whose containing block is the sticky `aside`.
  **A trigger that also carries a hover `Tooltip` has to close it through its ref in `onOpenChange`**,
  because tippy's `hideOnClick` covered a click on the reference; `Tooltip`'s `hidden` prop does not
  work there, since the remount leaves react-tooltip open with no anchor hover left to close it.
  `parity.mjs` gained an assertion rather than an allowance: `ReforgeOptimizer` built its
  `ProgressTrackerModal` in its constructor, so master carries an empty one from load and React builds
  one only while a solve runs. The count comes off the page (`.suggest-reforges-settings-group`, 0 or 1
  per spec), both sides must render the same group count, and reverting the port grows the modal back
  on both sides so the multisets stop matching. New probe: `tools/react-migration/reforge-popover.mjs`,
  because no tree gate opens the popover.
  Two behaviour deltas, both fixes: `isCancelling` is reset per run — vanilla only ever set it, so
  every error after the first cancel was swallowed and the gear never restored — and starting a run
  now hides a lingering *error* toast too, since both go through one slot.
  **One accepted divergence**: after Escape, Base UI returns focus to the trigger and react-tooltip
  opens on focus, so the cog's tooltip is shown; master left focus on the body. That is correct for a
  keyboard user, and suppressing it would mean a rAF hack around Base UI's focus restoration. The
  probe's cross-port diff is therefore four lines, not three.

- 2026-09-08 **`ProgressTrackerBar` renders Base UI `Progress`, and the "never a render" rule became
  "never a render above the bar".** The bar was imperative because worker progress must not reconcile
  the dialog per tick; `Progress` is controlled, so the value now lives in `useState` **in the leaf**.
  rAF coalescing was written and then dropped, on evidence: `EpWeightsDialog.test.tsx:452` does a
  synchronous `act(() => report({…}))` and asserts the text in the same act, so a frame of latency
  breaks a contract a consumer already relies on — and there is nothing to coalesce anyway, because
  `sim/core/sim.go:336` throttles to one report per 100 ms and `wasm/sim.ts:118` decimates by worker
  count, a ceiling of ~10 ticks/s. React batches whatever lands in one task. The guarantee moved from
  *zero* commits to *one leaf commit per event-loop task*, and the test that pins it counts renders of
  an ancestor `Harness`, not just commits — a commit count cannot tell a leaf render from a dialog
  render. The indeterminate state is now `data-indeterminate` on Root and Indicator, which is also what
  the stylesheet hides on, so the test and the SCSS cannot drift apart.
- 2026-09-08 **`ui/ui-kit/Popover/` on Base UI `Popover`.** For an interactive form anchored to a
  button — `Menu` is the wrong semantics, and this is what the reforge settings panel needs.
  `sideOffset` defaults to 10 because tippy's default offset is `[0, 10]` and `ui/index.ts:103`
  overrides only `arrow` and `allowHTML`, so every anchored popup in the tree already sits 10px off its
  anchor. z-index is `--dropdown-zindex` (1000) rather than tippy's 9999: it clears the sidebar, header
  and sticky toolbar but not modals, which is correct for a sidebar popover and is a real behaviour
  change if anything opens a modal over an open panel. Under happy-dom the exit transition never
  completes (the same fact `Dialog.test.tsx` records), so opened-then-closed unmount is a browser fact,
  not a tested one; what is tested is that `unmount()` leaves no `[data-base-ui-portal]` node.

- 2026-09-08 **`Popover`: the interactive tippy, as Base UI's `Popover`.** `ui/ui-kit/Popover/` covers the
  one tippy shape `Tooltip` does not: `interactive: true, trigger: 'click'` with a *form* inside it — the
  reforge settings panel. `Menu` is the wrong primitive for that (menu semantics, item roles); `Popover`
  is the right one. Five things it settles:
  **The trigger is the only element in the page's flow.** `Popover.Root` renders nothing and
  `Popover.Trigger` *is* the button, so `<Popover>` drops straight into a grid slot — there is no
  `div.dropdown` wrapper of the kind `ImportExportMenu` needs. `triggerProps` exists because the real
  trigger is an icon-only cog that also anchors a hover tooltip: it carries the `aria-label` and the
  `tooltipAnchorProps(id)` pair.
  **Dismissal is entirely Base UI's, and a `keepOpenWithin` escape hatch was built and then cut.** The
  concern it answered was real for tippy: a picker inside the panel portals its popup to `<body>`, which
  is outside the popover by every measure, and it can dismiss through two paths — `outside-press`, and
  `focus-out`, where `FloatingFocusManager`'s `closeOnFocusOut` defaults to `true` so that with
  `modal={false}` focus leaving for a node outside the floating tree closes the popover on its own. It
  does not apply to a React child: Base UI nests floating trees, so a Base UI picker inside the popup is
  inside the tree and dismisses nothing. The prop only mattered for a tippy or Bootstrap dropdown inside
  a React popover, which no port should be creating — and an opt-in cancel hook is exactly what gets
  reached for later to paper over a nesting bug. If a non-Base-UI child ever does dismiss the panel,
  `details.cancel()` is the lever (the one `Dialog`'s `preventClose` pulls), but fix the child first.
  **Open/close is mount/unmount, and that is the whole mechanism.** Vanilla built the panel's content in
  tippy's `onShow` and threw it away with `setContent(<></>)` in `onHidden` because tippy had no other
  way to get fresh content per open. React re-renders on state change, so the portal is not
  `keepMounted` and the props surface has no imperative content setter — do not port that hack.
  **`initialFocus` defaults to `false`**, which is what `interactive: true` did: focus stays on the
  trigger and Escape still closes, because the dismiss listener is on the document. `true` moves focus
  to the first control in the popup, asynchronously — assert it with `waitFor`, not synchronously.
  **A dismiss test whose outside node is created after the popup is green for the wrong reason.**
  floating-ui ignores presses on elements injected after the floating element rendered (it reads them as
  third-party injections), so every outside node in `Popover.test.tsx` is built before the trigger is
  clicked, or the dismiss tests pass for a reason that has nothing to do with dismissal.
  Two things deliberately left to the consumer: the panel's `min-width` and its small-screen clamp,
  which are expressed in `--settings-button-width` and are the reforge sidebar's geometry rather than
  the primitive's. z-index is `--dropdown-zindex`, the tier `sim-dropdown-positioner` already uses —
  tippy sat at 9999, which also cleared modals, and a sidebar popover never needs that.

- 2026-09-08 **`ui/sim` and `ui/ui-kit` are grouped by subject, and `tools/restructure/move.mjs`
  was lying about two aliases.** `player/{player,player_class,player_spec}.ts` + `player/{classes,specs}/`,
  `raid/{raid,party,encounter}.ts`, `settings/*.ts`, `utils/{collections,math,format,json,misc,env,links}.ts`,
  `workers/`, `cache/`, and `proto_utils/wowhead.ts`; ui-kit's loose helpers became
  `ui-kit/utils/{css,dom,wowhead}.ts`. 50 files moved, 526 import specifiers rewritten.
  Three things this turned up:
  **`move.mjs` still mapped `domain: '@sim'` and `sims: '@specs'`** — the pre-rename directory
  names — so every `@sim/…` and `@specs/…` specifier silently resolved to nothing and was left
  alone. The first dry run reported 214 rewrites in 94 files; the corrected map reports 498 in 274,
  and only then did the 57 frozen spec files appear. A move tool that finds *no* work in a directory
  full of importers is reporting a bug, not a clean tree.
  **`env.ts` and `links.ts` are not view code.** Both were moved to `ui-kit/utils/` on the reasoning
  that they name `MouseEvent` and `HTMLAnchorElement`; `no-restricted-imports` then failed six
  `ui/sim` files that import them at runtime. Only `isRightClick` is genuinely view-layer (all five
  callers are ui-kit or features) — it went to `ui-kit/utils/dom.ts`, and the rest came back to
  `ui/sim/utils/`. `setExternalAwareHref` takes an element it does not create, which is the same
  category as `proto_utils/action_id/dom.ts` and belongs in the model layer by the same rule.
  **Two things outside `ui/` point at moved paths.** `tools/database/gen_character_constants_ts.go`
  writes `capabilities_auto_gen.ts` by literal path and every `vite build` regenerates it, and
  `sim.test.ts` mocked `'./worker_pool'` as a string. Neither is an import, so neither type-check
  nor the move tool sees them — the test suite caught the mock, the build caught the generator.
  `ui-kit/sim_host.ts` is gone: `SimUIHost`/`SimHeaderHost` moved into `@sim/sim_host` beside
  `SimHost`/`IndividualSimHost`, so the host contract is one file and `ui/sim` no longer type-imports
  back out of ui-kit. `formatDeltaTextElem` is marked in `utils/format.ts` — it writes `textContent`
  and the positive/negative classes onto an element, so it becomes a `<DeltaText>` component once
  `results_action.tsx`, `item_list.tsx` and `bulk_sim_results_renderer.tsx` port.

- 2026-09-08 **`cssClass`/`extraCssClasses` props are `className`, and `ContentBlock` owns its own
  props.** Five components took React's name for the prop (`ContentBlock`, `Dialog`, `PickerShell`,
  `ProgressTrackerDialog`, `SummaryTable` — which also gained `headerClassName`), 47 call sites
  moved, and the React `ContentBlock` stopped importing the vanilla `ContentBlockConfig`: it now
  declares `ContentBlockConfigProps` with `header.className` and `bodyClassName`, and its own
  `className` absorbed the block's `extraCssClasses`. Class-list props are clsx `ClassValue`s, so
  `className={['a', cond && 'b']}` replaces the conditional arrays the config fields carried
  (`CustomSection`'s visibility class is one). The parity test keeps its case table in the *vanilla*
  config shape — it is the oracle — and the React adapter maps the names; `header: {}` must map to
  an empty object, not `{className: undefined}`, or the empty-header rule inverts.
  Also renamed for the same reason: `textCssClassForClass`/`textCssClassForSpec` →
  `textClassNameFor*`, and `itemQualityCssClass`/`setItemQualityCssClass` → `itemQualityClassName`/
  `setItemQualityClassName`. `PlayerClasses.getCssClass` cannot follow — 33 frozen spec files call it.
- 2026-09-08 **`useOutdatedNativeSim` takes the sim, because `SimToolbar` renders outside the
  provider.** The hook moved out of `SimToolbar.tsx` into `sim/hooks/`, and reading the sim through
  `useSim()` crashed the app: `SimShell` is rendered *before* `IndividualSimUI` exists — it builds
  the DOM the host adopts — so there is no `SimHostProvider` above it. It takes `sim: Sim` and calls
  `useSimStatus(sim)`, which is why that primitive keeps its parameter while `useSimReady()` does
  not. `SimShell` already had `sim` and passes it down. Only `SimApp.test.tsx` caught this; every
  browser gate would have shown a blank page. Also moved: `useMetricsTable` and `useMetricMax` into
  `features/results/hooks/`, `SocialLink` into `ui-kit/`.

- 2026-09-08 **The rotation tab is React, and the vanilla `PresetConfigurationPicker` is deleted.**
  `rotation_tab.tsx` (12 KB) becomes a 30-line `rotation_tab.ts` that owns only the pane and the
  `rotation-type-*` class, with `RotationTabBody` portalled in — the shape the other three tab bodies
  already use. All four tab bodies are React now. The picker's last consumer went with it, so that
  file is gone and `preset_build_state.ts` has one caller instead of two.

  `SavedRotation` is the sixth and last saved-data slot, which retires the final `ALLOWED_HOOKS`
  entry. It is also the one that needed `SavedDataPanel`'s new `isActive` override: an Auto and an
  APL rotation can serialise differently and still be the same rotation, so it passes
  `isEqualAPLRotation` rather than comparing JSON. That closes the deferred item about giving the
  rotation slot its `equals` axis back.

  **Three DOM mismatches, all the same shape, and worth recognising next time.** A legacy mount that
  *appends* into its parent cannot be given a wrapper `<div ref>` without adding an element the
  baseline does not have. The fixes: `makeRotationTypePicker` now treats its parent **as** the
  `.rotation-type-container` that React renders; the two `ContentBlock`s use `bodyRef` instead of
  wrapping a div; and the APL navbar stays **entirely imperative**, because `StickyToolbar` and the
  type picker append themselves and a React-rendered `<ul>` would land ahead of them rather than
  after — order the layout depends on. `parity.mjs` caught all three at once as a 97-of-100-line
  divergence starting at line 4.

  A build with a type error still produces a bundle: the first parity run after the fix timed out on
  a blank page because `vite build` does not type-check. Run `type-check` before believing a gate.

- 2026-09-08 **Gear's remainder: the ownership question is answered, and the unit is bigger than it
  looked.** Decision taken with the owner: the gear `SelectorModal` becomes React, owned by
  `GearTabBody`, registering its opener into `host.gearSelectorModal` — the seam `ItemPickerCell` and
  `gear_tab.ts` already go through. The objection recorded when the gear tab landed ("a React owner
  would dispose an element it does not own, because the modal sits outside every pane") applies to an
  imperatively appended Bootstrap modal; a Base UI `Dialog` **portals itself**, so being outside every
  pane is satisfied by construction.

  `bulk_tab.tsx` turned out not to be a complication at all: it constructs its own railless instance
  and never reads `host.gearSelectorModal`, so the vanilla class simply keeps one consumer. No new
  duplication is created by porting the gear one.

  **What the mapping actually established: `ItemList` and `SelectorModal` have to port together.**
  Outside-in would leave the modal a React shell around imperative tab construction, because which
  tabs exist is derived from data `ItemList` owns — sockets, available reforges, upgrade options — so
  `setData` cannot become declarative while `ItemList` is a vanilla class that builds its own pane.
  Wrapping that in an effect buys a React lifecycle and no declarative gain, for real risk. So the
  unit is ~1,215 lines across both files, not the modal alone.

  Three things that pass through it, worth knowing before starting:
  - `_selector_modal.scss` and `_gear_picker.scss` reference `--bs-modal-padding`,
    `--bs-modal-header-padding-y` and `--bs-modal-border-color`. Those resolve **only** because
    `BaseModal` always carries `.modal`. A Base UI Dialog does not, so they go dead — and
    `css-vars.mjs` will say so, which is what it exists for. They need the `--modal-*` treatment the
    progress tracker got.
  - `parity.mjs` needs a `PORTED_DIALOGS` entry and a `PORTED_DIALOG_REACT` bump; a new ported dialog
    costs both, and missing either fails every spec.
  - This is where `VirtualList`'s transform layout finally lands, so `log_view`-style `:nth-child`
    striping has to become `[data-stripe]`, and both parity gates need the normaliser.

- 2026-09-08 **The global `button { outline: none }` is gone, replaced by one `:focus-visible`
  rule.** Two resets in `_global.scss` stripped the focus ring from every `button` and `a`, which is
  why each ported component has been restoring its own — `SavedDataPanel`'s copy was the fifth. The
  replacement restores exactly what those two removed and no more: bare `a:focus-visible,
  button:focus-visible`, so any component rule still outranks it, and inputs keep Bootstrap's own
  treatment rather than gaining a second one.

  `:focus-visible` is what the resets were really reaching for: it fires for keyboard focus and not
  for a mouse click, which is the behaviour that made `outline: none` look reasonable. Verified by
  tabbing on both builds — `button.sim-link` computes `solid 1px` on react against `none` on master.
  Bootstrap `.btn` is unaffected; it draws its focus with a box-shadow, not an outline.

  `[contenteditable]`'s reset is deliberately left: that one is an editing affordance, not a focus
  style. The eight remaining per-component `:focus-visible` rules are now redundant where they match
  and deliberate where they differ, so they stay until someone reads each one.

  Also: a preset build carrying `epWeights` listed it twice, once from the top-level key walk and
  once from its own rule. `epWeights` joins `encounter`, `settings` and `reforgeSettings` in the
  walk's exclusion list, so every specially-handled category is named exactly once.

- 2026-09-08 **`PresetConfigurationPicker` is React, and the gear, talents and settings tabs have no
  legacy mount left at all.** Five `useLegacyMount` sites are now two, and both survivors are the
  encounter islands that need a React `ListPicker` first. The three tab bodies also lose agent C's
  `insertBefore` trick — with the picker rendered as a JSX sibling, ordering is just source order
  again.

  **It is not a `SavedDataPanel` in `loadOnly` mode**, which is the tempting shortcut: it wears the
  same `saved-data-*` class vocabulary but different elements — a `<button>` chip wrapping a
  `<span role="button">`, against the panel's div-and-`Button` — so reusing it would have changed
  three panes' DOM. Separate component, shared logic: `preset_build_state.ts` holds `isBuildActive`
  and `buildCategories` for both stacks, extracted before the port precisely so a 60-line proto
  comparison could not end up duplicated while `rotation_tab.tsx` still uses the vanilla one.

  It uses `useReadyStoreSubscribe`, and that is not incidental: vanilla builds its chips inside
  `waitForInit().then(...)`, so the active check has never once run against an uninitialised sim.

  **The FA5/FA6 `INTENDED` ceiling rose from 4 to 5**, exactly as that entry predicted it would —
  the React `ContentBlock`'s header tooltip draws its glyph through `Icon`, which spells FA6's
  canonical name. Every tab that stops building a vanilla `ContentBlock` raises it again.

- 2026-09-08 **`preset_build_state.ts`: the preset picker's two pure halves lifted out of the vanilla
  component, ahead of porting it.** `PresetConfigurationPicker` has four consumers and one of them
  (`rotation_tab.tsx`) is still vanilla, so both stacks will coexist — and duplicating a 60-line
  `isBuildActive` across them is how two implementations quietly stop agreeing. Extracting first
  keeps one source of truth. Behaviour-neutral: 837 tests, the goldens and `panes-parity` unchanged.

  Making `buildCategories` testable immediately paid: a build carrying `epWeights` lists it
  **twice**, once as `category:epWeights` from the top-level key walk and once as "stat weights" from
  its own rule, because `epWeights` is not in the walk's exclusion list the way `encounter`,
  `settings` and `reforgeSettings` are. The test pins it as it behaves rather than as it reads;
  whether the tooltip should say it once is a question for the owner.

- 2026-09-08 **`useReadyStoreSubscribe`, so last night's crash cannot be written a second time.** The
  `SavedSettings` failure — every CLI gate green, `#root` empty — was a store snapshot reaching
  `sim.db` on the first render, before `useSimReady`. The fix was two things, and only one of them is
  obvious: gate the read, **and** fold `ready` into the subscription's identity, because
  `useStoreSubscribe` caches its snapshot and only drops it when the subscription changes. Gating the
  read alone leaves a cached `null` until the user's next edit.

  A shared "cold host" test double was the other candidate and was rejected: every component test
  builds its own host shape, so one fake satisfying all of them is a large object that would drift.
  Encoding the pattern in a hook makes the safe thing the easy thing instead. Both halves are
  mutation-checked — removing either fails two tests.

  `SavedDataPanel` also picked up the `:focus-visible` ring that had been scoped to
  `.ep-weights-sidebar`, so all five saved-data slots get it rather than one. It has to be restored
  per component because of the global `button { outline: none }` reset, which is still on the
  backlog.

- 2026-09-08 **`@tanstack/react-virtual` 3.14.10 installed, and `VirtualList` built on its own
  layout rather than the vanilla one's.** The decision was explicit: adopt the library's
  absolutely-positioned, transform-moved rows instead of reproducing the spacer rows the vanilla list
  emits. That buys the library's idioms and costs a DOM change — no spacers, and a row's sibling
  position is its position in the window rather than the list — so **`:nth-child` striping stops
  working**. Rows carry `data-index` and `data-stripe` instead. Adoption will need a normaliser in
  both parity gates; the primitive lands first because `item_list.tsx` and `log_view.tsx` are large
  ports that need it to exist.

  One dependency, one transitive (`@tanstack/virtual-core`), and a peer range that names React 19
  explicitly — unlike `react-use`'s `"*"`, which claims nothing.

  **Rows are fixed-height and never measured.** Wiring `virtualizer.measureElement` produced
  "Maximum update depth exceeded" immediately: every row measures 0 in happy-dom, so the virtualiser
  re-measures and re-renders forever. The vanilla list declared itself fixed-row-height too, so this
  matches rather than narrows it.

  **Three of the first four tests were vacuous, in two different ways.** They iterated an empty
  window, because `virtual-core`'s `getRect` reads `offsetWidth`/`offsetHeight` — not
  `getBoundingClientRect`, which is what a test naturally stubs. Once rows appeared, a mutation
  swapping `data-stripe` to the sibling position *still* passed, because at scroll 0 the window index
  and the sibling position are the same number; and dropping the `scrollMargin` subtraction passed
  because the test left it at 0. The tests now scroll first and pass a non-zero margin, and both
  mutations fail.

- 2026-09-08 **Two decided divergences from master, both deliberate.** `ItemCellAnchor` drops
  `role="button"` whenever it has an `href`. An `<a href>` is a link — Enter activates it, Space
  scrolls, and it still offers middle-click and open-in-new-tab — so the role was promising a Space
  activation that never worked. The decision is in the component, not the six call sites, so they
  keep passing `role="button"` uniformly and the hrefless anchor (which wires its own keys and takes
  `tabIndex`) still carries it, where it is accurate. Screen readers now say "link" for a filled gear
  cell, which is what it is.

  Item swap's `getEquippedItem` gains `.withChallengeMode(...).withDynamicStats()`, mirroring gear's.
  The selector modal is the same modal in both cases, so the same item was showing two different sets
  of numbers depending on which picker opened it. This is a real behaviour change against master with
  no gate over the numbers themselves; the test double needed both decorators before it would even
  return, which is how the unit suite caught the omission.

- 2026-09-07 **The four remaining `SavedDataManager` islands port onto `SavedDataPanel`, and the
  crash that came with them is the lesson.** Gear, talents, settings and encounter each get a thin
  wrapper over the shared panel, wired to the four `useSaved*` hooks that had no caller. Three
  `useLegacyMount` islands shrink to just `PresetConfigurationPicker`; `SettingsTabBody` renders two
  panels, because that pane was always two managers.

  **Every gate passed and the app did not start.** type-check, 826 tests, the goldens and both
  builds were green, and `#root` stayed empty: `SavedSettings`'s snapshot read
  `readSavedSettings(host)`, which reaches `player.getConsumes()` and dereferences `sim.db` — and
  `useSyncExternalStore` calls `getSnapshot` on the **first render**, long before `useSimReady` is
  true. The presets memo was correctly gated; the snapshot was not, and nothing in the unit suite
  builds a host whose `db` is still null. Caught only because the browser gates run on a real page.
  The fix gates the read *and* puts `ready` in the subscription's dep list, because
  `useStoreSubscribe` caches its snapshot and only drops it when the subscription changes — gating
  the read alone would have left the panel showing nothing until the user's next edit.

  **Ordering needed a trick worth remembering:** `Component`'s constructor only ever `appendChild`s,
  so a React sibling declared as a JSX child of the ref'd div lands *before* the legacy picker, not
  after. `parent.insertBefore(presets.rootElem, parent.firstChild)` after construction fixes it
  without touching `Component`.

  The panel grew two things ep-weights never exercised: a `tooltip` on `SavedDataPanelEntry`, and
  `{{name}}` substitution in the confirm/alert strings — vanilla did `.replace('{{name}}', …)` and
  talents' locale strings contain the placeholder, so it had been rendering literally. Parity needed
  **no** `INTENDED` entries: the new `data-tooltip-*` are attributes, and the gate records tag and
  sorted classes only.

  `unused.mjs` now sweeps hooks as well as components, which is how the sixth slot stays honest:
  `useSavedRotation` is the one still waiting, and it will need `SavedDataManager`'s optional
  `equals` back, because rotations cannot be compared by their JSON.

- 2026-09-07 **The selector modal's slot rail steps its own indices instead of the ItemSlot enum.**
  `switchToNext/PreviousItemSlotTab` computed `mod(currentSlot ± 1, enumSize)` and then looked that
  slot up in the rail, so a rail with gaps in it `preventDefault()`ed the key and then moved nothing.
  Identical for gear, whose rail is all 16 slots in enum order — which is why this could sit there —
  and it is what a sparse rail (item swap's four slots) needs before one is viable. `gear-tab.mjs`
  gained the assertion that separates the two implementations: ArrowUp from the first slot has to
  **wrap** to the last. Both walks wrap on a full contiguous rail, so the assertion is about the next
  rail, not this one.

  `node --check` passed the version of that gate that referenced an undefined `SETTLE`, exactly as it
  passed the dangling `logViews` in `panes-parity.mjs` earlier. It only parses. **Run a gate you
  edited, do not syntax-check it.**

- 2026-09-07 **Two recorded defects fixed, a third audited clean, and a new gate for the class the
  third belongs to.** `SavedDataManager`'s preset-name-collision guard read
  `newName in this.presets` — `presets` is an array, so `in` tested indices and the guard never
  fired once. Now `this.presets.some(preset => preset.name === newName)`; overwriting an existing
  *user* entry of the same name stays allowed, because that is `addSavedData`'s overwrite-by-index
  path and is deliberate.

  `action_id/index.ts` lost **seven** dead spellId overrides, not the five the backlog claimed. The
  backlog never listed them, so the set was re-derived from scratch with `/usr/bin/grep -rn` from
  the repo root, `.go` included — and that re-derivation is what saved 47897 ("Shadowflame Dot"),
  which is live in `ui/sim/talents/trees/warlock.json`. Three (37212, 37223, 37447) override icons
  for items that exist only in `leftover_db.json`; one (123180) is a transposed-digit typo, since
  `sim/paladin/items.go:46` shows the real id is 123108; three (96228/96229/96230) are Cataclysm's
  three-way Synapse Springs split, which MoP consolidated into one spell (126734,
  `sim/common/mop/enchants.go:214`). **Record the identifiers when recording a finding** — a count
  without a list costs the next pass the whole investigation again.

  The `--bs-modal-*` sweep found **nothing to fix**: Bootstrap 5.3.8 declares those on `.modal`
  itself, and every remaining reference under `ui/scss/` is inside a `BaseModal` subtree, which
  always carries that class. The progress tracker was the exception because it is a React popup with
  no `.modal` ancestor at all. `css-vars.mjs` now asserts that independently — and agrees.

- 2026-09-07 **Four more string unions became string enums, and the header-anchor note was closed as
  stale rather than fixed.** `ResultsPanelStage`, `GlyphKind`, `StatsType` and `ImportExportKind`
  follow `SimRunKind`'s pattern exactly — plain `export enum`, values unchanged. One consequence
  worth knowing before the next conversion: a bare string literal is not assignable to a
  string-enum-typed prop, so `<ImportExportMenu kind="import">` in `SimApp.tsx` had to move with the
  eight `addDialog` call sites. Three lookalikes were checked and left: `EpWeightsDialog`'s
  `stage: 'running'` is a different progress union, `StatsTableColumn.type` is a superset with a
  third variant, and `GlyphsPicker.test.tsx`'s `'major' | 'minor'` is a local CSS-selector helper.
  `DialogSize`, `IconSize`, `IconStyle`, `TooltipPlace` and `ButtonVariant` stay literal unions on
  purpose — they mirror CSS and vendor vocabularies where the literal *is* the value — and the five
  in `results/{model,view}/timeline/rotation/` wait for that subtree's port rather than being touched twice.

  The recorded "header tooltip anchor is not focusable" item was **re-audited and is not a defect**:
  every anchor there is a real `<a href>` or `<button>` through `Button`, and the one non-native
  control is Base UI's disabled menu item, which sets `focusableWhenDisabled: true` deliberately.
  This skill had already closed the same question on 2026-09-05, and `a11y.mjs` asserts it per
  region. The backlog entry was a duplicate of a closed finding — worth saying out loud, because a
  stale note that reads like an open defect costs the same to re-investigate as a real one.

- 2026-09-07 **`SavedDataPanel` extracted out of `SavedEpWeights`, so the other four saved-data
  slots have a React component to port onto.** Three of the five remaining `useLegacyMount` islands
  are `SavedDataManager` mounts, and four of the six named saved-data hooks had no caller for exactly
  that reason. The panel was **extracted, not written**: `SavedEpWeights` was already a React
  implementation of that component's markup with a parity test against the vanilla twin, so pulling
  the generic half out and leaving a ~70-line wrapper keeps that oracle pointed at the shared code.
  All 84 stat-weights tests, the parity test included, pass unchanged.

  It stays sim-agnostic to sit in ui-kit: a preset's `enableWhen` and `onLoad` are resolved by the
  caller into `disabled` and `afterLoad`, so nothing in `ui-kit` sees a `Player`. One behaviour is
  restored rather than carried: the vanilla manager refuses to save a user entry under a preset's
  name, and the React EP panel had quietly dropped that check.

- 2026-09-07 **`SimRunKind` is an enum, and the `results_action` dedup is settled — two of its three
  flags, not three.** The kind was a string union; it is now a string enum, so every call site reads
  `SimRunKind.StatWeights` and a rename is a rename rather than a grep. The values are in-memory
  store keys only — nothing persists them and the goldens are untouched — so they stay spelled as
  they were, to keep a devtools store dump legible. `SIM_RUN_KINDS` derives from `Object.values`,
  which is why this is a plain `enum` and not a `const enum` like `RequestTypes`.

  **The audit the dedup was blocked on:** exactly three things hold `individual-sim` — the Simulate
  button, and the "Sim Once" and "Sim Death" buttons in the detailed-results tab. All three are user
  clicks; nothing starts a run automatically. So a guard that is global to the kind is correct, and
  the earlier theory that `runSingleIteration` was firing under the gate was wrong.

  **Bisected one substitution at a time, rebuilding and re-running `sim-progress.mjs` between each.**
  Reading `isRunning` from the slice: green. Aborting through `SimRuns.abort`: green. Replacing
  `waitAbort` with `runs.isAborting`: **red**, four checks. The two are not the same thing —
  `waitAbort` means "this click's abort is still in flight", while the slice's `isAborting` tracks
  the kind's run and is cleared as that run settles. Substituting one for the other leaves the
  button disabled and the Stop zone up after the *next* run completes. So `isRunning` and the abort
  call dedup; `waitAbort` stays local, with a comment saying why. A three-flag component became a
  one-flag component, which is the win that was actually available.

- 2026-09-07 **Run controller units 4 and 5: bulk gets its own request type, and the reforge button
  finally disables.** `runBulkSim` registers under `RequestTypes.BulkSim` (0x8) instead of borrowing
  the individual sim's, so the two can be told apart. Both of bulk's masks had to be widened rather
  than simply renamed: the pre-run abort names `IndividualSim | BulkSim`, because a batch still has
  to replace an in-flight single sim *and* a previous batch — naming one would silently drop the
  other — and the cancel drops from `All` to `BulkSim | ReforgeOptimize`, keeping the batch's own
  reforge pre-pass while leaving a stat-weights run alone, which is the whole point of the split.

  `optimizeReforges` runs through `SimRuns.start`, and `reforge_panel.tsx` subscribes to the slice
  through `subscribeRunState` — the same helper every other picker on that panel already uses — so
  a vanilla component gains a running flag without porting. That is what unit 5 exists to
  demonstrate. `abortReforgeOptimization` deliberately keeps calling `signalManager.abortType`
  directly rather than `SimRuns.abort`: bulk's pre-pass registers under that type *without* going
  through `start`, so a store-gated abort would silently miss it.

  **Neither unit has automated cover, and the manager test does not reach either.** Flipping the
  registration back to `IndividualSim` leaves all four `sim_signal_manager` tests green, because
  those exercise the manager directly and never call `runBulkSim`. There are no reforge tests at
  all. The reforge claim was checked in the browser instead — a `MutationObserver` on the button's
  `disabled` attribute records `[false, true, false]` across one solve. Bulk's remains manual: start
  a batch and a stat-weights run and confirm they no longer cancel each other.

- 2026-09-07 **Named saved-data hooks, one per storage slot, over a generic `useSavedData`.** The
  six saved-data keys — EP weights, gear, talents, rotations, settings, encounters — all write the
  same thing: `Record<name, toJson(data)>` under one key. Read side by side, only the key and the
  codec differ, and every generated `MessageType` already *is* the codec, so each named proxy is one
  line and `SavedEpWeights` drops `entriesFrom`, `storedFrom` and `parseStoredEpWeights` for it.
  `getSavedRotationStorageKey` joins the other five on `IndividualSimHost`, which is the only
  interface change.

  **Five of the six have no caller yet**, because their slots are still vanilla `SavedDataManager`
  islands. That is deliberate and different from the sim-run hooks, where five named hooks were
  *deferred*: there the hook had to know a call's arguments and progress shape, so writing one
  without a consumer meant guessing; here the pairing of key and proto already exists, spelled out
  in each vanilla config, and the hook is where the next porter will look for it. `unused.mjs` does
  not see them — it walks ui-kit component folders, not hooks.

  **Two of the first three mutation checks passed, and both pointed at real problems.** Making
  `save` append instead of replacing an existing name changed nothing observable, because the store
  is a record and the duplicate collapses — so the upsert branch was not carrying its weight. It was
  replaced with a patch of the stored record, which fixed a defect the rebuild-from-`entries` shape
  had: a save would silently drop every entry the codec rejected, so one stale entry from an old
  schema would be deleted by the user's next unrelated save. Removing the container guard also
  passed, because an array's indices walk into the codec and each rejection is caught — the guard's
  real effect is that a wrong-shaped key stays *quiet* instead of warning per element. Both are
  pinned now, and both mutations go red.

- 2026-09-07 **One front door for starting and aborting a sim, and one record of what is running.**
  `SimRuns` (`ui/sim/sim_runs.ts`) owns a `runs` slice — two booleans per kind, for
  `individual-sim`, `bulk-sim`, `stat-weights` and `reforge-optimize` — plus the abort-then-run
  preamble, progress fan-out and `lastProgress`. It went in the **store**, not a seventh bespoke
  subscribe-and-snapshot object, because a slice gets folding, batching and the React adapter for
  nothing and is the only shape vanilla code can read through the helpers it already uses
  (`subscribeRunState`). `useSimRun(kind)` reads it from anywhere and can stop a run; it returns no
  `start`, so a run can only begin through a named hook — `useStatWeights` is the first, and the EP
  dialog drops its `running` state, both guard refs and its abort preamble for it.

  **Three things this cost, and each is worth keeping.** First, `start` is deliberately **not**
  `async`: it writes the running flag in the caller's own task, because `sidebar-loading.mjs` reads
  the spinner back before the vanilla click handler returns and an injected `flushSync` (passed in
  from `spec_entry.tsx`, keeping React out of `ui/sim`) cannot reach a write that lands a microtask
  later. `sim_runs.test.ts` pins it — restore the old `await this.abort(kind)` shape and three tests
  go red. Second, the pre-run `abortType` is **unconditional**, not gated on the store's own flag: a
  first attempt that skipped it when the kind looked idle passed every unit test and then made the
  run *after* an abort come back aborted, with no console error. Third, it lives inside the `try`,
  so a rejecting abort still clears the flag it already wrote.

  **`results_action.tsx` was left alone, and that is a finding.** Rewriting its two private flags to
  read the slice fails `sim-progress.mjs` (the run after an abort produces no metrics, and Simulate
  stays disabled) — bisected by reverting that one file. Its `isRunning` is local to the Simulate
  button, while the slice's is global to the kind, and `runSingleIteration` now claims the same kind
  from `detailed_results.tsx`. Dedup that only after auditing who else holds `individual-sim`.

  `RequestTypes.BulkSim = 0x8` is claimed and mapped, but nothing registers under it yet: bulk still
  runs as `IndividualSim`, and giving it its own bit is a separate unit with no browser gate over it.

- 2026-09-07 **`SearchBar` replaces `GlyphSelectorDialog`'s raw `<input>`, the one form control in
  `ui/features/*/components/` and `ui/ui-kit/*/` still bypassing Base UI `Field`.** A sweep of every
  non-`@jsx-vanilla` `.tsx` for raw `<input>`/`<select>`/`<textarea>` found six sites: this one
  (fixed), the importer's hidden file input (exempt — a file picker, not a field), two ref-driven
  `<textarea>`s in `Importer`/`Exporter` (left — bare and unlabelled like their vanilla twins, and
  `Importer.test.tsx` pins the flat parent-child shape a `Field.Root` wrapper would break), and
  `SavedEpWeights`'s name input (left — parity-locked by `SavedEpWeights.parity.test.tsx` against the
  still-vanilla `SavedDataManager`, whose markup has no `Field` either). `EnumPicker` and
  `BooleanPicker` were already correct.

  The component itself is new rather than a port: the vanilla search inputs in gear, bulk and the log
  stay untouched, but all four were read first to find the axis. They disagree on label, clear button
  and debounce, so those are props; `className` lands on the `<input>` rather than the wrapper so a
  caller's squatting global class still resolves, which is why `GlyphsPicker.test.tsx`'s
  `.selector-modal-search` query needed no change.

- 2026-09-07 **`useLocalStorage` gets a typed proxy.** `useTypedLocalStorage` wraps `react-use`'s
  `useLocalStorage<T>` with a required per-key `parse`, wired into react-use's own `deserializer`
  rather than re-implementing get/set/remove. The point is the type hole react-use leaves open: its
  generic types a deserialized value as `T` with zero proof, so a stale key from an old schema
  deserializes to whatever it was and the type system says nothing. A rejecting `parse` folds into
  the same `undefined` an absent key already gives. `SavedEpWeights` is the only adopter; its
  `parseStoredEpWeights` checks the container is a plain object and the pre-existing per-entry
  `SavedEPWeights.fromJson` validation stays where it was. Left alone: the vanilla `Component`
  storage users (`notice_native_sim.tsx`, `saved_data_manager.tsx`) and `i18n/locale_service.ts`,
  which is called from i18next init, from `ui/sim/**` and from bare module scope, so no hook can
  reach it. `ui/sim/**` keeps `Env.storage` as its only path into storage; the two do not converge.

- 2026-09-07 **The `sims`→`specs` rename left two string literals behind, and they took the build
  with them.** `tools/vite/spec_pages.mts` globbed `ui/sims/*/*/spec.{ts,tsx}` and so emitted no spec
  pages at all, and `ui/app/spec_entry.tsx` resolved its dynamic import through the same path and
  threw `No spec module for /mop/warrior/arms/`. Nothing in the CLI gate set can see a string
  literal, so type-check, lint, 761 tests, the goldens and both builds stayed green while a fresh
  dist had 34 missing pages. It hid for two commits because `dist/` is never cleaned: the pages from
  the last good build survived, kept serving a pre-rename bundle, and every browser gate run on
  `838ff1a6e` and `e82d5654a` was therefore measuring code that predates them. **When a rename
  touches a directory, grep the tree for its name as a string, not only as an import specifier**, and
  check a `dist/` page's `<script src>` hash against the newest bundle before trusting a gate run.
  `specPages` now throws when it discovers no specs.

- 2026-09-07 **Item swap is React, and the feature has one selector modal instead of one per slot.**
  `icon_item_swap_picker.tsx` deleted — the last `useLegacyMount` in the feature, and the file's only
  importer. `ItemSwapIcon` is ~60 lines against `useActionId`, `useWowheadDataset`, `GemSocket` and
  `getEmptySlotIconUrl`; `ItemCell` is deliberately not its base, because a swap slot is a picker
  root with an icon button and a sockets container and shares none of the cell's name/label/ilvl
  vocabulary.

  **Four defects close, and only the first needed a design decision.** Each icon built
  `new SelectorModal(simUI.rootElem, this.player)` in its own constructor, appended to an element the
  React component did not own, never registered as a child, never disposed — six `.selector-modal`s
  on the baseline where React now holds two. It now asks the shell: `SettingsTab` owns one, built
  lazily on first open, reached through `IndividualSimHost.itemSwapSelectorModal` beside
  `gearSelectorModal`. Lazy rather than eager so a spec with no swap slots builds nothing. Two more
  went with the file: the `itemSwap` subscription discarded its unsubscribe outright, and the
  profession subscription was released on each update but never at dispose.

  **The fourth is visible on screen.** Vanilla painted nothing until the first `itemSwap` change —
  `update()` ran only from the subscription — so a spec that loads a swap preset showed four blank,
  unpainted slots. `warrior/protection` ships two swap presets and has the row enabled by default, so
  on master its swap main-hand (item 87176, two gems) is invisible until the set is next touched.
  React renders from state, so the slot is filled from the first paint. `parity.mjs` and
  `panes-parity.mjs` fold this away through `normaliseSwapIcons`, which strips `.active` off the icon
  anchor and empties the sockets container on **both** sides and returns the counts — and both gates
  assert the baseline's are zero, so the fold fails rather than hides if master ever starts painting.
  `item-swap.mjs` records `sockets` and `painted` per icon and takes a spec argument: run it on
  `warrior/protection` and the two builds differ **only** in the at-rest line.

  **The rail is omitted, not rebuilt.** The gear picker's rail entries open with *equipped* gear, so
  reusing that modal would have turned the first ArrowUp into a silent switch to editing main gear.
  Vanilla passed no rail either: `addItemSlotTabs` returns early, `onShow` registers no keydown
  listeners at all, `setActiveItemSlotTab` iterates nothing — a path `bulk_tab.tsx` already
  exercises. A *swap* rail would not have worked as written:
  `switchToNext/PreviousItemSlotTab` steps the ItemSlot **enum** and then looks the result up in the
  rail, so every gap in a sparse rail is a dead arrow key.

  **The sockets container is lifted out of the icon anchor**, the second `LIFTED_SUBTREES` entry.
  Vanilla nested it, and a filled socket is an `<a href>`, so a gemmed swap set was anchors inside an
  anchor — `a11y.mjs` counts that as `nested` and allows none on `.settings-tab`. It passed only
  because the swap set is empty at rest. `.settings-tab`'s `unnamed` ceiling ratchets 125 → 121: the
  icons carry an `aria-label` now.

  **Two gate scripts moved with it.** `parity.mjs` compares modals as a multiset and asserts equal
  counts, so it reads the swap-icon count off the page and drops that many railless selector modals
  from the baseline — asserting first that there are that many and that they are identical markup —
  plus the same number of pruned modal lines off the end of the baseline's shell. That reconciliation
  has to run **before** the region comparison, not after: placed with the other modal bookkeeping it
  left the shell four lines short on every spec with swap slots.

- 2026-09-07 **`useWowheadDataset` adopted at all five call sites; `Component` registration after
  dispose now fires immediately.** `EnchantLabel`, `ItemPickerCell`, `MetricsActionCell` and
  `ItemSwapIcon` use the hook. The first two had no staleness guard at all; the third had neither a
  guard nor an attribute clear despite the registry listing it as guarded — `if (iconRef.current)` is
  a null check, not a race guard. `dom.ts` grew `actionIdWowheadTooltipData` and
  `equippedItemWowheadTooltipData` (pure resolvers) and both writers delegate to them with signatures
  unchanged. `equippedItemWowheadTooltipData` takes `isBlacksmithing` explicitly so the React dep
  array is honest rather than carrying a dependency the resolver reads off `player` behind its back.
  One thing the hook cannot carry: `data-whtticon`, which vanilla writes sticky-on-first-equip from
  inside the writer — `ItemPickerCell` and `ItemSwapIcon` render it as `item ? 'false' : undefined`,
  which matches master on first paint and differs only after an unequip, where it is inert.
  `Component.addOnDisposeCallback` now invokes the callback when already disposed and `addChild`
  disposes the child; all ~40 callback bodies were audited (every one a pure teardown), no
  `Component.dispose` override exists, `disposed` is never reset, and the only post-construction
  `addChild` is `list_picker.tsx:255` where immediate disposal is correct. `dispose()` sets
  `disposed` before draining, so this also closes the case where a callback registered *during*
  disposal was appended mid-`forEach` and then dropped. That closes `PresetConfigurationPicker`'s
  `waitForInit().then` subscription leak without touching the vanilla picker; its `tippy()` — the one
  unowned tooltip instance left in the tree — now registers a `destroy()` alongside.

- 2026-09-07 **The four remaining raw inputs go through Base UI's `Input`.** `NumberPicker`,
  `AdaptiveStringPicker`, `NumberListPicker` and `BooleanPicker` swap
  `<Field.Control render={<input type="…"/>}>` for `<Input type="…">`. Provably a runtime no-op:
  `@base-ui/react/input/Input.mjs` is a `forwardRef` that renders `Field.Control` and nothing else.
  **`NumberField` was rejected for `NumberPicker`, and the reason is worth keeping**: its `Input` has
  no native-`change` listener and its `onKeyDown` returns early on Enter (in `NAVIGATE_KEYS`), so
  Enter would stop committing. Four more blockers behind that one — `NumberField.Root` renders a div
  that becomes the flex item, the input hard-codes `value` so it cannot stay uncontrolled for
  `useInput`, parsing kills `parseInt('12abc') → 12`, and it adds five attributes outside
  `PickerOracle`'s `BASE_UI_ADDED`. `Checkbox`/`Switch` were rejected for `BooleanPicker` for one
  reason: both render a span plus a hidden input, and Bootstrap's `.form-check-input` sizes the input
  itself.

- 2026-09-07 **Gear units 2 and 5, merged: the gear tab body, the three summaries, `ItemCell` and
  `GearPicker` are React, and the gear-picker-to-modal cycle is cut.** The plan listed the tab body
  and `GearPicker` as separate units, and unit 2 as written hosted the vanilla picker through
  `useLegacyMount` — which costs two throwaway fixes (defects 8 and 11a) to code unit 5 then deletes,
  purely to sequence. Merged, `gear_picker.tsx` is never edited and never hosted. Deleted with it:
  `quick_swap.tsx`, the two popover binders, and the three summary views.

  **The cycle had to be cut here, not in unit 4.** `selector_modal.tsx` read
  `gearPicker.itemPickers[i].slot/.item/.onUpdate/.openSelectorModal` for its slot rail and for
  ArrowUp/ArrowDown, and a React picker has no `itemPickers`. It now takes a `SlotRailEntry[]` —
  `{ slot, getItem, subscribe, open }`, four fields — which `gear_tab.ts` builds from the player
  alone. `bulk_tab.tsx` and `icon_item_swap_picker.tsx` pass `undefined` and compile unchanged. Only
  that constructor parameter and the two index sites moved; unit 4's opener narrowing for bulk is
  still open.

  **The modal stays in the vanilla tab constructor, and that is what keeps `mount-once` honest.** It
  is appended to `simUI.rootElem`, outside any pane, so a React owner would be disposing an element
  it never rendered — defect 11a. Measured: on the dev server's StrictMode double-mount this branch
  holds 10 `.selector-modal`s where a build holds 6, and all four extras are `IconItemSwapPicker`'s,
  which was already mounted that way. The gear picker's is exactly one. Features reach it through
  `IndividualSimHost.gearSelectorModal`, the `epWeightsModal: { open() }` shape.

  **The summaries' first paint is the one behaviour that changed, and no gate can see it.** The
  vanilla blocks only ever filled themselves from a `gear` notification, and `subscribeGated` does
  not fire on subscribe, so they painted empty until the first one; React reads the same state at
  render. Both parity gates sample after the spec's default gear has landed, so all six specs are
  **byte-identical** — 360/404/377/421/409/399 lines, unchanged. There is therefore **no `INTENDED`
  entry**, and adding one would have failed as never-observed. `GemSummary.test.tsx` is where the
  improvement is asserted instead, against a subscription that never fires.

  **Two new gates.** `tools/react-migration/gear-tab.mjs` reads everything `SERIALIZE` excludes
  (item levels, names, quality classes, icon backgrounds, hrefs, wowhead datasets, label text, socket
  visibility) and then operates the pane: the modal opened from a cell, the rail walked three ways,
  an enchant favourited in the modal and equipped from the popover, the copy payload off a stubbed
  clipboard, and the four gear-writing buttons judged by how many equipment slots moved. Identical
  output on both builds. And `a11y.mjs` gains a `#gear-tab` region — id-scoped, because `.gear-tab`
  also names the tab strip's own button and silently added a control to one side only. Its ceilings
  are a ratchet at what React measures now: `_blank` links go 0/5 → 5/5, typed buttons 0/10 → 9/10,
  `aria-hidden` icons 0/5 → 4/5, and the one left in each is the vanilla `CopyButton`.

  **Two React-specific traps this pane sets, both invisible to the tree gates.** A `useStoreSubscribe`
  bails out when the snapshot is `Object.is`-equal, so `UpgradeCostsSummary` cannot subscribe to
  `race` and read the gear: on a race change the `Gear` reference is the same one and the honor
  currency icon never flips faction, where vanilla's `updateTable` re-ran and did. It takes a second
  subscription reading `getFaction()`. And react-tooltip renders its box **in the React tree**, so a
  `<Tooltip>` rendered beside a cell becomes a child of `.gear-picker-left` the moment it first
  opens — and `_gear_picker.scss:29` is `.item-picker-root:nth-child(6)`, the weapon-group separator,
  which `:nth-child` counts positionally whether or not the interloper is out of flow. Measured: the
  separator jumped from Wrist up to Chest. The popovers therefore render **inside** the cell, at the
  end of the label stack, where no `:nth-child` rule counts — which then made it inherit the right
  column's `text-align: right` (measured `right` against master's `start`), so the popover sets
  `text-align: start` of its own. `gear-tab.mjs` keeps both asserted, and hovers one cell in each
  column: the `:nth-child` trap is left-only and the inheritance trap right-only, and one hover
  cannot see both.

  **Two things the plan got wrong.** `ItemNotice.registerSetBonusNotices` does not move to `model/`:
  the class survives for `item_list` and `item_renderer`, so `individual_sim_ui.tsx` needs no change,
  and the function builds DOM, which `model/` lint forbids. And `GearTabBody` lives in `app/tabs/`
  rather than `features/gear/components/`, because it constructs `PresetConfigurationPicker`, which
  is in `app/` — the same place `TalentsTabBody` and `SettingsTabBody` are, for the same reason.

  `SummaryTable.scss` moved out of `scss/core/components/individual_sim_ui/` because every class in
  it was gear's alone; `_gear_picker.scss` did not, because `.item-picker-*` has six other wearers.
  The move was checked by reading computed style on both builds rather than by inspection — the
  container's `display`/`gap`, the body's flex axis and gap, the reset button's margin and colour, the
  row's box, the gem icon's size and the link's layout, plus the container's bounding rect: identical.

  Perf: `gear-selector-timing.js` re-run on both builds. Every count is identical to the pre-port
  baseline — 636 modal mutations on the open, 382 on a favourite toggle, 93 per keystroke, 178 on the
  tab switch, 443 on the scroll, pool 1658 / 29 mounted / 56 px rows — and the timings sit inside the
  recorded ranges. This unit does not touch the item list, and the numbers say so.

- 2026-09-07 **Sim progress units 4 and 5: the sidebar panel is React, and `results_viewer.tsx` is
  gone.** `SimResultsPanel` renders the four zones, `SimProgress` the running block, `SimWarnings`
  the trigger and its tooltip, `AbortButton` the Stop button, and `UnlaunchedNotice` the block
  `sim_ui.tsx` used to append after the viewer — which is the reason it was folded in rather than
  left imperative: a portal renders after construction, so leaving it there would have reversed the
  two at load. Deleting the viewer took the last importer of `ui-kit/sim_toolbar_item.tsx` with it;
  `app/header/SimToolbar/ToolbarItem.tsx` had already superseded it at both remaining call sites, so
  that file goes too.

  **The seam is `ResultsPanelStore` in `features/results/model/`, and two of its properties are
  load-bearing in ways no browser gate can see.** First, `notify()` is `flushSync`. React schedules
  an update from outside React on a microtask, and `addSimResultsAction` reads the panel back **in
  the click's own task** — `sim-progress.mjs`'s `START` clicks and calls `getComputedStyle` inside
  one `evaluate`, deliberately (`:95-98`). Measured before writing anything: a plain `notify()` left
  the spinner, the Stop button and the French relabel a task behind, six red lines. There was no
  `flushSync` anywhere in `ui/` before this. Second, `latestProgress` is a mutable field **outside**
  the `useSyncExternalStore` snapshot, and `SimProgress` reads it in a mount layout effect: tick one
  carries both the stage change and the first numbers, and the block it mounts does not exist when
  the callback returns. The gate waits for text to appear, so it passes on tick two and can never
  catch that — `SimResultsPanel.test.tsx` pins it, and deleting the read fails exactly that case.
  Everything from tick two on goes to a listener that writes `textContent`; 100 ticks, zero commits,
  Profiler-checked.

  **`.results-content` is rendered by React and never given a React child.** `SimResultsManager`
  still `replaceChildren`s the finished topline into it, and `makeToplineResultsContent` has three
  consumers — one of them the bulk renderer — so it does not port here. That is why the running block
  renders inside `.results-pending` instead of beside the topline: the one deliberate divergence, and
  the gate prints the block's parent rather than asserting it for exactly that reason. Consequence
  worth knowing before someone reads it as a leak: the previous run's topline now sits in
  `.results-content`, hidden and inert, for the length of the next run. `reset()` has already
  destroyed every tooltip and listener on it. The invariant holds only while React's child list for
  that node stays `null`; the test mutation-checks it, and a real child there fails it.

  **Load-time parity is unchanged but for one line.** Eight of the panel's nine serialised lines are
  byte-identical on all six specs; the ninth is `i.fa-3x.fa-exclamation-triangle.fas` becoming
  `i.fa-3x.fa-triangle-exclamation.fas`, because `Icon` resolves FA5's alias to FA6's canonical name.
  New `INTENDED` entry, `max: 1` — the sidebar is in `parity.mjs`'s shell region, so the cap is exact,
  and `parity.mjs` then requires it to still be observed. A hidden zone uses the `hidden` attribute,
  which borrows `[hidden]{display:none!important}` from Bootstrap's reboot; inside `.results-pending`
  the spinner/block swap is a plain conditional render, because no tree gate ever sees that subtree
  in its running state.

  **SCSS: two rules moved, and the second one had died.** `.results-pending .loader { margin: auto }`
  from `_sim_action.scss` and `.warning-zone [data-tippy-root] { width: 100% }` from
  `_sidebar.scss`, the latter **re-keyed** to `.warning-zone .sim-tooltip` because react-tooltip
  renders in place and creates no positioning wrapper — so the old selector would have matched
  nothing. `.results-sim` and `.results-sim-*` deliberately stayed global: `bulk_tab.tsx`,
  `bulk_sim_results_renderer.tsx` and `results_action.tsx` all emit those names. Measured rather than
  assumed: the loader's `margin` computes to `0px` on **both** builds, because `.results-viewer`
  shrink-to-fits its widest visible child and while pending that child is the 120px loader — the rule
  is inert in this layout on either build, moved as-is rather than deleted. The tooltip is the
  prescribed once-per-new-container screenshot: not clipped in `.warning-zone`, so no
  `positionStrategy="fixed"`. It does change width — 273px under tippy, 192px under react-tooltip,
  where `Tooltip.scss`'s `max-width` now caps a box that used to be a wrapper — which is why no
  cross-build width assertion was added to the gate. Master's version overflows
  `.sim-sidebar-content` by 5px; the React one sits 40px inside it.

  **Two focus rings, because `scss/shared/_global.scss:62` clears `outline` on every button.**
  Measured on both ports: the warning trigger and the Stop button report `outline-style: none` on
  master and a 1px solid ring here. Invisible to `parity.mjs` (a computed style), so it is recorded
  here rather than in `INTENDED`.

  **The gate was not touched.** All thirty `sim-progress.mjs` invariants pass on `:3402` with no edit
  to the file, and the three defect assertions still fail on `:3401`, which is what keeps them
  evidence. The only gate change in the unit is the one `INTENDED` entry.

- 2026-09-07 **Results unit 8: the vanilla island deleted, the SCSS co-located, and the two deferred
  accessibility changes landed.** `metrics_table.tsx`, `table_sorter.ts`, `metrics_total_bar.tsx` and
  `metrics_combined_tooltip_table.tsx` go — 485 lines with no importer since unit 7 — and with them
  `.tippy-box[data-theme='metrics-table']`, whose only setter they were. `_detailed_results.scss:148`
  was **split, not deleted**: the dead tippy selector shared a rule with the live `.metrics-table`.

  **The sortable header is now a real `<button>`, and the gate change is the point of the unit.**
  A `<button class="metrics-table-sort">` inside every `<th>`, with `aria-sort` on the `<th>` from
  `column.getIsSorted()`. That *inserts* 132 elements into the at-load shell both tree gates compare,
  which `INTENDED` cannot express (it substitutes one line for another at a fixed index) and
  `dropSubtrees` would over-delete (it would take the label with it). `browser.mjs` gains
  `normaliseSortButtons`, which `collapseWrappers` the button out of each header cell **on the React
  side only** and asserts the count against the pane's own header-cell count — so a column with no
  button, or two under one `<th>`, fails; the `<th>`'s class list, the `<span>` and everything below
  are still compared byte for byte. Proved by running it against the *old* dist first, where it read
  `sort buttons: collapsed 0 of 132 header cells`.

  **The handler stays on the `<th>`.** The button carries none of its own, so activating it — mouse,
  Enter or Space — raises a click that reaches the cell's. That keeps the whole cell as the hit area,
  leaves every computed style on `.metrics-table-header-cell` untouched, and needs no change to
  `results-tables.mjs`'s `th.click()` probes. Verified in the browser: Tab reaches
  `button.metrics-table-sort` type=button, Enter sorts ascending and `aria-sort` follows, Space sorts
  descending, focus is kept, and exactly one of the ten headers is ever non-`none`. **Caveat:**
  `scss/shared/_global.scss:62` puts `outline: none` on every `button` in the tree, so the focus is
  real but invisible — an app-wide finding, not this unit's to fix.

  **The wowhead icon anchor takes `aria-label` from the metric name.** The alternative — the link
  spanning the name text with an `aria-hidden` icon — was rejected on **behaviour**, not structure:
  the row's click handler toggles expansion, so a link over the name would navigate to Wowhead
  instead of expanding a parent row. `aria-label` costs a name that duplicates the adjacent visible
  text for a screen reader; it leaves `results-tables.mjs`'s `a.metrics-action-icon` / `href` probes
  untouched, and it is the documented technique (ARIA8) for a link whose content is a background
  image.

  **`.tablesorter` is gone**, with an `INTENDED` entry capped at 21 — the pane's whole table count,
  six metric tables plus fifteen resource ones, and no other pane has any. `results-tables.mjs`
  asserts the class list *exactly* on each side through an `IS_BASE` branch, `a11y.mjs` style, rather
  than relaxing to a containment test that would stop noticing a stray class on either. Its
  `labelled` check moves from "the span is the cell's first element child" to "a span holds the whole
  of the cell's text", which stops catching an element inserted around the span — the change — and
  starts catching a label that leaked out of it. Both rewrites were proved green on `:3401` before
  any table code moved.

  **SCSS co-location is a merge, and most of the named region did not move.** `.metrics-table`,
  `.metrics-table-header-row`, `.metrics-table-header-cell` and the four `.metrics-table-body` rules
  **stay global**: `features/results/view/results_action.tsx:540-556` builds the same skeleton for the
  sidebar's topline table and `detailed_results/_topline_results.scss` overrides it there, so they are
  not the component's to own. What moved is what only these components emit — `.metrics-action*`,
  `.parent-metric`, `.child-metric`, the caret and toggle rules into `MetricsTable.scss` (which now
  needs `@import 'shared/tokens'` for `wowhead-background-icon`), the five `.metrics-total*` rules
  into a new `MetricsTotalBar.scss`, and `_resource_metrics.scss` into `ResourceMetricsTable.scss`.
  No `@extend` anywhere in the tree names a metrics class. A computed-style diff across the two ports
  confirms the move is behaviour-neutral: 95 values compared, and every difference is either
  data-dependent (`table-layout: auto` column widths after two unseeded sims) or one of three
  unit-3 markup divergences — vanilla renders **two** `span.expand-toggle.fa-caret-*` as flex children
  of `.metrics-action` on *every* row, React renders one `<button>` on parents only.

  **The results pane was considered as an `a11y.mjs` region and declined, on measurement.** The pane
  would report `controls 37 → 169` (all 132 new buttons named), `untyped 13` unchanged (they are the
  iteration buttons, the combat-replay controls and a dropdown picker — all vanilla), and
  `firstVisibleAnchor: null` on both ports, because every header tooltip anchor sits in an inactive
  inner Bootstrap pane, so the describedby half would read as skipped. It would need three ceilings
  of pure vanilla slack and it runs at load, where the table has **no rows** — so it could never see
  the icon anchor, which is half of what this unit fixed. Both changes are asserted where they can be:
  the button by `normaliseSortButtons` across six specs and by `MetricsTable.test.tsx`, the anchor by
  `MetricsActionCell.test.tsx`. The region belongs to whoever ports the timeline, replay and log.

- 2026-09-07 **Results unit 7: the damage-taken and healing tables, and the shared attack-column
  builder.** Three consumers is the count the duplication survey measured, so this is where the axis
  could be read rather than guessed. `attackMetricsColumns` **parameterises the column set, its order
  and every column's bindings; it fixes only how one named shape renders.** The plan's
  `buildAttackMetricsColumns(kind)` would have fixed layout, and layout is precisely what varies:
  damage puts Crit % before Miss %, dtps puts it after, and healing shares four of its twelve columns
  with either. So the module exports five column builders (`name`, `primary`, `casts`, `withTicks`,
  `rate`) that a caller composes in its own order, and any shape they do not cover is written inline
  with `createMetricsColumnHelper` and dropped into the same array — an entry added, never a fork of
  the markup. Healing exercises that on purpose: eight of its twelve columns are inline and only four come from the builder. Beside them
  live the five tooltip-group builders (`damageBreakdownGroup`, `castsGroup`, `hitGroups`, `missGroup`
  shared damage↔dtps verbatim; `threatGroup` / `threatTooltip` shared damage↔healing) and
  `useMetricMax`. **`DamageMetricsTable` was refactored onto it in the same change** — that is what
  makes it a three-consumer abstraction rather than a two-consumer one with a bystander — and its gate
  numbers did not move: 19 rows, 14/19 icons resolved, 13 parent rows, 240 neighbours compared, 3
  groups of which 2 have one child, on both ports.

  **One shared-core addition, and it is an attribute reader.** `metricForAnchor(byRowId)` moves the
  four-line `activeAnchor → data-row-id → metric` resolve out of the three tables and into
  `MetricsTable/`, next to `MetricsTableRow`, which is what writes the attribute. Writer and reader
  now ship together. Nothing else in the core changed — no new props, no new options, no fork.

  **Plan defect 12, the missing dtps `shouldCollapse`, is a no-op and is now written out as one.**
  `shouldCollapse: () => true`, unit 5's exact form, because the pet exception cannot fire here:
  dtps rows come from `SimResult.getTargets(filter)`, whose members are either `encounterMetrics.targets`
  — every one built by `UnitMetrics.makeNewTarget`, which passes `petActionId = null` literally
  (`sim_result.ts:614`) — or `getUnitWithIndex`, which searches `units = players.concat(targets)`
  (`:158`) where `players` are party members built with `isPet = false` (`:319`). `isPet` is
  `petActionId != null` (`:474`), and both `forTarget` (`:1229`) and `merge` (`:1251`) carry `unit`
  through unchanged. So `!metric.unit?.isPet` is `true` on every reachable row and the override the
  plan calls missing would change nothing. The vanilla `actionIdOverride: metrics[0].unit?.petActionId`
  is kept for the same reason it is harmless — it always evaluates to `undefined`.

  **Plan defect 14, the missing dtps threat veto, is not an omission.** dtps has no threat *content*
  to veto: its Avg Cast, Avg Hit and DTPS columns carry no tooltip at all, so of its six tooltips
  (four cell, two header) not one shows a threat number, while damage and healing veto exactly the
  three each that do. And the whole tab is threat-gated one level up — the Damage Taken tab button
  carries `threat-metrics-tab`, which `_shared.scss:131-136` hides under `.hide-threat-metrics`.
  Reproduced deliberately: `DtpsMetricsTable` subscribes to **no** store field, because a dead read is
  worse than none. Confirmed in the browser on `:3402` (warrior/protection): four tooltips on the
  table, all four with a nested `table.metrics-table`, none of them threat.

  **What the gate cannot see.** `results-tables.mjs` runs `hunter/beast_mastery`, where dtps has
  **zero rows**, so its only dtps assertions are the nine-column shell at load and hide-when-empty.
  Everything below dtps's `<thead>` is unverified by the default gate. Covered instead by (i) a
  vitest suite in the damage mould, and (ii) a **supplementary** run
  `node tools/react-migration/results-tables.mjs warrior/protection`, which does produce a dtps row
  and exercises default-sort, sort-every-column and all four tooltips. That run is not a gate: it fails
  two checks on the baseline too (dtps's single target row resolves no icon, and prot's damage table
  has no pet so `EXPAND_PROBE` finds no parent), and its damage `neighbours compared` counter drifts
  188/189/192 run to run on one build, because a row whose column value is `NaN` compares equal to
  everything and its landing place among real numbers is not pinned. The default spec is untouched.

  **Five divergences declared, none silent.** (i) `useMetricMax` returns `null`, not `Math.max(...[])`,
  so plan defect 2 is gone for all three tables. (ii) The threat veto reads the store, deleting the
  last three `document.querySelector('.hide-threat-metrics')` calls — plan defect 11 is now fully
  gone. (iii) Healing's rate cell gains `fallbackString: '-'`, which vanilla omitted; unreachable,
  since `getHealingActions().filter(hps > 0)` cannot yield a falsy `hps`. (iv) Damage's Crit % cell
  becomes a fragment instead of a template string — same text, and `data-text` comes from the accessor
  either way. (v) A threat tooltip whose value is 0 renders nothing rather than an empty table, which
  is unit 6's shape carried to healing. **Reproduced rather than fixed, and flagged:** dtps's Avg Cast
  sorts a passive action as 0 while still printing its value (damage prints a dash — the `zeroWhen` /
  `dashWhen` split in `withTicks` is exactly this asymmetry); healing's Hits cell ends in a stray
  `{' '}`; healing's two tooltip group names, `'Hits'` and `'Ticks'`, are untranslated literals; and
  dtps carries a Miss % header tooltip that damage does not.

  **The plan's map is wrong about healing's grouping.** §1 says healing groups "same shape" as damage
  — player actions plus one group per pet. It does not: `getGroupedMetrics` is
  `ActionMetrics.groupById(player.getHealingActions().filter(hps > 0))` with no pet groups at all, so
  healing's own `shouldCollapse: !isPet` is *also* a no-op today. It is reproduced verbatim because it
  is vanilla's, unlike dtps's, which had to be chosen.

  **The vanilla `metrics_table/` island is now closed.** `/usr/bin/grep -rn` finds no importer of
  `metrics_table.tsx`, `table_sorter.ts`, `metrics_total_bar.tsx` or
  `metrics_combined_tooltip_table.tsx` from outside those four files — they only reference each other.
  With that, **`.tippy-box[data-theme='metrics-table']` is dead**: the theme is set only at
  `metrics_combined_tooltip_table.tsx:46`, which nothing constructs. Unit 8 deletes all of it, and must
  split rather than delete `_detailed_results.scss:148`, where the dead tippy selector shares a rule
  with the very-much-live `.metrics-table`.

- 2026-09-07 **Results unit 6: the damage table, and the tooltip shape every later table copies.**
  Ten columns, seven of them with a tooltip, plus one on the Avg Cast header. **One `<Tooltip>` per
  column, never one per cell** — 8 instances instead of the ~133 a 19-row table would otherwise mount.
  The `<td>` is the anchor, as `cellElem` was tippy's, so the hover target is the whole cell; it
  carries `data-tooltip-id` from `meta.tooltipId` and `data-row-id` from the row, and the column's one
  `Tooltip` resolves the hovered row through `indexMetricRows`. `getRowId` and that index share
  `metricRowId`, so the map cannot drift from table-core's ids
  (`coreRowsFeature.utils.js:208`, `parent ? \`${parent.id}.${index}\` : String(index)`), and a test
  hovers a **child** row's cell to prove the dotted path resolves to the child and not its parent.

  **What the gates can and cannot see of it.** react-tooltip renders **in place**, not in a portal —
  the node is a child of `div.damage-metrics`, beside `.damage-metrics-root` — and it renders `null`
  until first opened. So at load the pane is byte-identical and `parity.mjs` / `panes-parity.mjs` stay
  at 605 lines on both ports; after a sim, no gate serialises anything. `results-tables.mjs` is the
  only gate that sees a tooltip at all, and its probe was tippy-shaped
  (`.tippy-box[data-state="visible"]`); it now counts `.react-tooltip__show` as well and still asserts
  `withTable`, so the same four assertions hold on both builds. **That probe was rewritten and proved
  green on `:3401` before any table code moved**, which is the "a gate rewritten in the same commit
  proves nothing" rule applied without a commit to sequence.

  **Four shared-core changes, all small, none a fork.** `MetricsColumnMeta` gains `tooltipId`,
  `headerTooltipId` and `headerTooltip`; `MetricsTableRow` spreads the cell anchor and takes
  `rowClassName` (`customizeRowElem`, which no earlier table used); `MetricsTable` spreads the header
  anchor and threads `rowClassName`; `useMetricsTable` passes `getRowId`. Attributes only — `SERIALIZE`
  records neither, so none of them is visible to a tree gate. `Tooltip` gains `render`, passed straight
  through to react-tooltip.

  **The threat veto is `render` returning nothing**, which is the closest mirror of tippy's
  `onShow: () => false`: the anchor stays on the cell, the flag is read from the store through
  `subscribeUiField(sim, 'showThreatMetrics')`, and a `render` that returns nothing leaves
  `hasContent` false so no node is created at all
  (`react-tooltip.cjs:1547`). That deletes three `document.querySelector('.hide-threat-metrics')`
  calls, plan defect 11, for this table. The same mechanism is how a cell with nothing to show — no
  landed hits, no misses, a passive action — stays shut, which is vanilla's early `return`.

  **`buildAttackMetricsColumns` was NOT built, deliberately.** The plan puts it in this unit; the
  duplication survey it cites measured **three** consumers, and unit 6 has one. `SKILL.md:395-414`
  says an abstraction built against a single consumer fixes the wrong axis, so the damage columns are
  written as damage columns and unit 7 — which lands dtps and healing together — is where the axis can
  actually be measured. The tooltip *body* is shared now, because it genuinely has three consumers.

  **Three declared divergences.** `maxDamage` is `null` rather than `Math.max(...[])` when a run
  yields no rows, so plan defect 2's `-Infinity` (and its `-0%` bars) disappears by construction; it
  is held in a **ref** so the column defs stay referentially stable across results.
  `MetricsCombinedTooltip` copies before sorting, so plan defect 6's in-place mutation of a prop array
  is gone. And `placement: 'auto'` has no react-tooltip equivalent: the tooltip takes the primitive's
  default `place="top"` and flips on its own. Checked in the browser on `:3402`, which is the
  once-per-new-container rule for `div.damage-metrics`: all three shapes open, none is clipped by
  `body` or by `.sim-ui` (both `overflow: auto`, neither in the containing-block chain), none leaves
  the viewport, the table keeps `font-size: 12px` and `max-width: none`. The only visible difference
  from tippy is which side is chosen for a top row.

  **Plan defect 7 is gone by construction** — react-tooltip cleans up on unmount, asserted in the
  table's own test. The `Empty action id!` console line the gate whitelists now prints **zero** times
  on the port. Master logs 2 — one from the casts table, one from damage — and unit 3 took it to 1;
  this unit removes the last one.

  **The tippy theme stays.** `.tippy-box[data-theme='metrics-table']` in `_detailed_results.scss` is
  still healing's and dtps's; the React twin is a co-located
  `.sim-tooltip.metrics-table-tooltip` in `MetricsCombinedTooltip.scss`. Unit 8 merges them.

- 2026-09-07 **Results units 4 and 5: buffs, debuffs and the fifteen resource tables.** Almost pure
  configuration on top of unit 3 — no change to `MetricsTable`, `MetricsActionCell`,
  `useMetricsTable` or `grouping.ts`, so all six TanStack deltas are satisfied by reuse and none of
  these three tables needed a table-specific override. `AuraMetricsTable` takes `useDebuffs`, the one
  axis vanilla's constructor branched on. `ResourceMetricsTable` renders `div.resource-metrics-root`,
  reads the channel once and builds the six column defs once, then maps `orderedResourceTypes` to 15
  `ResourceMetricsSection`s; the section owns the `.resource-metrics-table-container` and its `hide`,
  which deletes `onUpdate` from the vanilla `MetricsTable` — that emitter's only consumer was the
  container hide/show, so the field, both `.emit()` calls and the now-unused `Emitter` import go.
  **None of these three tables has a tooltip** — no `tooltip` on any column config, no `fillCell` — so
  the per-column `<Tooltip data-tooltip-id>` decision is still unexercised and unit 6 is its first
  consumer.

  **The plan's unit-5 sentence is wrong and the gate is right.** §4 says the container should "render
  the container's title and table only when the model has rows"; `results-tables.mjs` asserts at load
  that all 15 containers are hidden **and** that each still holds one table with six `<th>`s. Fork
  A(a) says the same. The container is therefore always fully rendered and only its `hide` class
  moves — `hide` iff the table has no rows, which is true at load without needing `hasResult`,
  exactly as vanilla constructs it.

  **Plan defect 13, resolved as a no-op rather than an oversight.** `resource_metrics.tsx` has no
  `shouldCollapse` override, and it cannot matter: the only source is
  `players[0].getResourceMetrics(type)` (`sim_result.ts:560`), which filters one raid-indexed
  player's own `resources` array, and a raid-indexed player is never a pet — so `!metric.unit?.isPet`
  and the base class's `true` agree on every reachable input. Written out as
  `shouldCollapse: () => true`. **The same argument retires plan §2 item 4's claim about
  `aura_metrics.ts:69`**: that override is dead too, for the reason in the next paragraph.

  **Defect found, reproduced verbatim, not fixed: the buffs table's pet groups are always empty.**
  `filterMetrics` drops any aura whose `unit.isPet`, and vanilla applies it to the pet branch as well
  as the player's — `player.pets.map(pet => this.filterMetrics(pet.auras))`. A pet's auras carry that
  pet as their `unit` (`sim_result.ts:595`, via `makeNewPlayer(..., isPet=true)`), so every pet group
  empties, `buildMetricRows` drops it, and the buffs table has never rendered a `.parent-metric` row.
  With it, `shouldCollapse: metric => !metric.unit?.isPet` and the `petActionId` merge override are
  both unreachable. The port keeps all three so the one-line fix stays obvious; `results-tables.mjs`
  already skips its sub-row check when a table has no parents, on both builds.

  **Declared divergence: `useBuffAura` was dead in every production build.**
  `nameCellConfig` passed `useBuffAura: data.metricType === 'AuraMetrics'`, where `metricType` is
  `metric.constructor.name`. The minifier emits the class as `qm=class e{…}`, so the name is `e` and
  the comparison is false in `dist` — the wowhead tooltip never asked for the buff aura outside the
  dev server. The React name cell takes `useBuffAura` as a prop, so the aura table sets it literally
  and it now works in production. No gate sees it (`SERIALIZE` records neither attributes nor text);
  it is the same category as unit 3's Name-column sort delta, not a fix slipped in.

- 2026-09-07 **Results unit 3: the casts table, on `@tanstack/react-table@9.2.4`.** The first React
  metrics table, and with it the shared core the other five land on. `MetricsTable` portals into the
  `.cast-metrics` div `DetailedResults` still builds; `dr-root`, the nav strip and the panes stay
  vanilla, because the log, replay and timeline still hang off `shown.bs.tab`.

  **The dependency is adopted for one behaviour**: sorting must recurse into child rows with the same
  column and direction, and expansion must keep children adjacent to their parent. v9's
  `createSortedRowModel` recurses `subRows` with the same comparator and `createExpandedRowModel`
  interleaves. That is `table_sorter.ts:53-59` and `metrics_table.tsx:149-163` exactly, so 145 lines
  of hand-rolled model code — `TableSorter`, `addGroup`, `sortMetrics` — become four imports and
  three flags. v9's API is not v8's: `useTable`, not `useReactTable`, and row models are slots inside
  `tableFeatures({...})`, not table options. `@tanstack/react-virtual` is **not** installed; no
  metrics table needs it. Cost, measured on a clean `dist` with and without the portal: **+13,419
  bytes gzipped** across all 58 bundle chunks.

  **Six defaults that would each have shipped a silent difference**, all configured in
  `useMetricsTable.ts` and one test apiece: `enableSortingRemoval: false` (a third click clears
  otherwise), `enableMultiSort: false` (shift-click adds a column otherwise), `sortDescFirst: false`
  (`TableSorter`'s first click is ascending on every column, numeric included),
  `initialState.expanded: true` (TanStack starts everything collapsed), `autoResetExpanded`'s default
  re-expanding on a new `data` identity — which is why the rows are a `useMemo` over the channel's
  stable snapshot, delta six. And one more that is not a default: every column gets an explicit
  `sortFn` reproducing `TableSorter.sortFunc`, because `sortFn: 'auto'` picks `sortFn_text` for the
  Name column, which is not `localeCompare`.

  **Three declared divergences.** The Name column sorts by `metric.name` rather than by the rendered
  cell's `innerText`. The expand toggle is a real focusable `<button>` with `aria-expanded` — free,
  because it lives in a `<td>` that only exists after a sim, where no gate compares trees; the `<tr>`
  keeps its click handler so a click anywhere on a parent row still toggles, and the button
  `stopPropagation`s so the two do not cancel. And the port emits **fewer** `Empty action id!`
  console errors, because a React name cell keys on `useActionId`'s `equalityKey()` while
  `nameCellConfig` keyed its icon cache on `toString()`, which logs — 2 per sim on master, 1 now.
  The fourth divergence in the plan, a `<button>` inside every `<th>` with `aria-sort`, is **not**
  here: it inserts an element into the at-load shell that neither `INTENDED` nor `collapseWrappers`
  can express. It belongs in unit 8, once all six tables are React and it is one baseline change.

  **`results-tables.mjs`'s three click probes now yield before reading the result back.** They read
  the DOM in the same turn as the click, which worked only because `TableSorter` mutates inside its
  own listener; React schedules the commit in a microtask, so the gate saw the previous order and
  failed the port for the right implementation. `EXPAND_PROBE` also re-finds the child rows on every
  read instead of holding element references, because a React table unmounts a collapsed child and
  mounts a *new* one when it reopens. Both changes are behaviour-preserving on the vanilla build —
  the gate is green on `:3401` and `:3402`.

- 2026-09-07 **Results units 1 and 2: the result seam, and a gate that runs a real sim.** No React and
  no markup yet. `ui/features/results/model/result_channel.ts` is a `ResultChannel` — an `Emitter`
  that also holds the last value, so `getSnapshot` returns the **same object** until the next emit.
  A getter that built a fresh one re-renders forever under `useSyncExternalStore`. `IndividualSimUI`
  owns it as `readonly resultChannel = new ResultChannel()` and passes it into `DetailedResults`,
  which no longer constructs its own emitter; `IndividualSimHost` exposes it, so React reaches
  results through `useSimHost().resultChannel`. Ownership sits on the host rather than on
  `DetailedResults` because the tab is built mid-constructor, and reading it back would force a
  nullable host field.

  `SimResultData` moved to `ui/features/results/model/result_data.ts` and is re-exported from
  `view/result_component.ts`, so its fifteen view importers are untouched. It is `{ result, filter }`
  — pure data that happened to live in a view file, and the seam would otherwise have made
  model-imports-view a precedent.

  `tools/react-migration/results-tables.mjs` is the behaviour gate, landed green on the **vanilla
  build first**, then green again unchanged after the seam. That order is the whole point: neither
  parity gate ever runs a sim, so they compare an empty table shell and see nothing of what these
  tables do. It asserts the shell's exact column classes, then runs one iteration and checks the row
  invariants — sort in both directions on every column judged by `TableSorter`'s own comparator,
  children staying with their parent, expand/collapse, the combined tooltip and its threat veto both
  ways, and the resource containers. `PORT` picks a build; it must exit 0 on both. Default spec is
  `hunter/beast_mastery`, because a permanent pet is what guarantees the grouped-row assertions have
  a parent row to run on. It was proved non-vacuous by inverting three expectations and confirming 12
  failures.

  Two things the gate had to be shaped around. `TableSorter`'s comparator is not a total order: a row
  with no hits yields the **string** `'NaN'`, so a sorted column has no adjacent-pair guarantee at
  those boundaries and the gate skips mixed-type neighbours and prints the count. And collapsed
  children are asserted **invisible, never `.hide`**, so unit 3 stays free to unmount them and to
  make the expand toggle a real `<button>`.

  **Defect recorded, not fixed: merged pet-group parent rows carry an empty `ActionId`.**
  `mergeMetrics` passes `metrics[0].unit?.petActionId || undefined`, and a pet without one logs
  `Empty action id!` and renders an anchor with no href and no icon. Present on master too: 2 console
  errors per sim, 5 of 19 damage rows and 9 of 38 casts rows. The gate whitelists that one console
  line and asserts `resolved > 0` rather than per-row **because of** this; fix it and the assertion
  should tighten.

- 2026-09-07 **`Dialog` gains `elevated`, for a dialog opened from another dialog.** The progress
  tracker's backdrop did not cover the stat-weights dialog underneath it, and the obvious diagnosis
  was wrong on its own. Both dialogs did share one z-index tier — the backdrop sits at
  `$zindex-modal-backdrop` and every viewport at `$zindex-modal`, so a nested backdrop is below the
  popup that opened it by construction. But raising it fixed nothing, because **Base UI renders no
  backdrop for a nested dialog at all**: `DialogBackdrop.js:48` is `enabled: forceRender || !nested`.
  There was no element to raise. `elevated` therefore does two things — passes `forceRender` so the
  backdrop exists, and adds a modifier to the backdrop and the viewport that moves both to a new
  tier ten above the modal one, which is under `--toast-z-index` on purpose so a failure toast during
  a run stays readable over the tracker.

  Measured in the browser rather than assumed: stat-weights backdrop 1050 and viewport 1055, tracker
  backdrop 1060 and viewport 1065, and the tracker's viewport wins a hit test at the centre of the
  dialog beneath it. **A standalone dialog cannot reproduce this** — it gets a backdrop either way,
  so the first version of the test passed with `forceRender` deleted. The committed test nests one
  dialog inside another, and fails without it.

- 2026-09-07 **Four legacy islands go, and `react-use` is adopted.** The copy button, the saved EP
  weights sidebar and the glyphs picker all leave `useLegacyMount`; the talents copy button went with
  the glyphs work since it was the same file.

  **The copy button ports as a hook, not a component.** Its three consumers differ only in css class,
  label, tooltip and content getter — all button concerns — so a shared component would have fixed
  the one axis that varies. `react-use` is pinned exactly at 17.6.1 and **the convention is the root
  barrel**: barrel and deep-ESM produce byte-identical raw output, so it tree-shakes clean at about
  1.2 KB gzip, while `react-use/lib/…` is the CommonJS build and costs 4 KB more. One agent guessed
  the `lib` path because it could not see the other's measurement; both are on the barrel now.

  **Its write path changed and one probe had to move with it.** `copy-to-clipboard` runs
  `document.execCommand('copy')` and never touches `navigator.clipboard`, so `gear-tab.mjs`'s stub
  recorded nothing. It now stubs **both** paths, so a future switch back does not break it again.
  Recorded, not fixed: `execCommand` is deprecated, its no-permission fallback would put a whole
  settings blob in a blocking prompt, and it refuses empty strings — so the reforge summary's error
  fallback now says Copied while copying nothing.

  **The saved EP weights key is shared with a still-vanilla widget.** The reforge panel's `loadOnly`
  manager reads the same key, so an encoding drift would silently empty that popover rather than
  merely losing sets on upgrade. The tests drive the real vanilla manager in both directions.

  **A stack-specific root class is a tree diff.** Focus rings scoped under a new root class showed up
  in the modal-subtree comparison, which records tag plus *sorted class list* while `tabindex`,
  `aria-label` and `for`/`id` are all invisible to it.

  **A new ported dialog costs two counts, not one.** The glyph selector needed an entry in
  `PORTED_DIALOGS` to remove the baseline's Bootstrap modal *and* a bump to the React portal total.
  Missing either fails every spec at once, which is the count doing its job.

  Recorded, not fixed: the shared saved-data manager's name-collision check tests membership against
  an array with `in`, so it fires for `map`, `length` and `"0"` and never for a real name, and there
  is no check against existing user data at all.

- 2026-09-07 **The parity baseline is `master`, not `feature/ui-restructure`.** The restructure was
  never going to merge on its own, so gating against it measured half the diff and let a restructure
  regression pass as a baseline fact. `:3401` now serves a build of `~/personal/wowsims-mop`
  (`master`); `tools/react-migration/README.md` says so, and its old warning against serving master
  is inverted. Three things fell out of the switch:
  - The `LOG_VIEW` allowance in `parity.mjs` and `panes-parity.mjs` is gone — master carries the log
    rewrite, and `detailed-results-tab-tab` is now 605 lines on both sides for every spec. Removing
    it left a dangling `logViews` reference in `panes-parity.mjs` that only surfaced at runtime;
    `node --check` does not catch an undeclared identifier, so run the gate after editing it.
  - The three APL-validation `INTENDED` entries are deleted. Their own `why` said to delete them once
    the fix reached `feature/ui-restructure`; master classifies validations correctly, so both sides
    now agree and the stale check flagged them.
  - `shell_classes.ts` no longer emits `individual-sim-ui`. It existed only on this stack, was read by
    no SCSS, tool or module, and was the whole of the line-0 divergence on five specs.

  The one real behaviour change: the `features:` behaviour slots now run **before** `config.reforge`,
  not after. Ordering is observable — a slot that adds a sidebar button has to land above the reforge
  button — and mage/fire's constructor on master ran `CalculateCombustionThresholds` before
  `ReforgeOptimizer`. `features` is the only slot that touches the DOM, mage/fire is its only user
  repo-wide, and no slot reads `this.reforger`, so the move is safe. `derivedSettings` stays after
  `reforge`, where windwalker's `getEPDefaults` comment assumes it. All six specs now match master on
  every pane.

- 2026-09-06 **`IconPicker` un-nests its level container: no more `<a>` inside `<a>`.**
  `.icon-input-level-container` is the anchor's next sibling instead of its only child, so the two
  `ImprovedAnchor`s and the counter are no longer inside a link. 72 nested anchors across 36 pickers
  on `warlock/demonology`'s settings tab go to zero, and the vanilla picker keeps the old shape — the
  SCSS holds both, `.icon-picker-button > …` for it and `.icon-picker-button + …` for React.

  **Overlaying a sibling costs three things the nesting gave for free**, all of them found by
  measuring rather than by reading. `pointer-events: none` on the container with `auto` on
  `.icon-input-improved`, or it swallows every hover and click over the 33×33 it covers and the
  wowhead tooltips die. The same click handlers on the container as on the anchor, or a click on an
  improved icon follows the link instead of changing the value. `filter: grayscale(1)`, `none` under
  `.icon-picker-button.active`, or an inactive picker's counter stays green. And `flex-shrink: 0`:
  the root is a flex item that shrinks, and without it the container joins the label in absorbing
  that — the first attempt left containers 8 to 25 px wide instead of 33.

  **Geometry is asserted by measurement, not by argument.** The box math is `calc(var(--icon-size-md)
  - 2px)` for the size, `margin: 2px 0 0 calc(-1 * that)` for the position: 2px is the anchor's two
  1px borders, and the negative inline margin leaves zero outer width so the form label after it does
  not move. Vertical centring comes free because the margin box is exactly the anchor's height, which
  is what a picker with a two-line label needs (`spell=57933`: root 39.38, anchor at y 2.19,
  container at 4.19). Before/after on the same build: 108 box rows identical, 20 of 22 screenshots
  byte-identical; and across `demonology`, `protection` and `arms`, 119 React pickers are box-
  identical to the vanilla baseline on `:3401`. The two screenshots that move are the grayscale
  recomposite of one inactive counter, 115 pixels at exactly 1/255 — `grayscale` is a linear matrix,
  so applying it to the label separately is the same value rounded once more.

  **a11y `unnamed` ceiling 155 → 125, and the reason it moved down rather than up.** Un-nesting takes
  the counter `<span>` out of the picker's anchor, and on `warrior/arms` four multistate buff anchors
  had that digit as their only text — `name()` reads `aria-label || textContent`, so they had been
  counting as named on the strength of reading "0" or "4". Rather than raise the ceiling for four
  anchors that were never really named, `IconPicker` now sets `aria-label` from the name
  `useActionId` already resolves, which names every picker anchor on the pane: 34 more named on
  `warrior/arms` (12 → 46 of 171), so unnamed falls 155 → 125.

  The picker oracle catches this as a divergence, correctly — the port adds an attribute vanilla
  never had. `mountBoth` gained a `portAdded` regex for it, named per picker rather than folded into
  `BASE_UI_ADDED`, because a blanket rule would also hide a port that *dropped* an attribute vanilla
  did have.

- 2026-09-06 **Stat-weights units 3 and 4: the dialog is React, and all sixteen recorded defects are
  fixed.** `features/stat-weights/components/EpWeightsDialog/` is nine components plus `types.ts` and
  `utils.ts`; `view/stat_weights_panel.tsx` is deleted. Only `renderSavedEPWeights` stays vanilla,
  behind `useLegacyMount`, because `reforge_panel.tsx` is its second consumer. `ResultsViewer` is
  **not** an island here — with the overlay gone the dependency went with it.

  **The running state is a progress-tracker dialog, not the blur.** Vanilla added `blurred` to
  `simUI.rootElem` — a `classList` write on an element whose className is React's, wholesale — and
  hung a Stop button off `rootElem`'s *sibling*, outside the modal's focus trap. Both are gone.
  `ui/ui-kit/ProgressTrackerDialog/` is a React twin of `progress_tracker_modal.tsx` on the `Dialog`
  adapter with `preventClose` + `keepMounted`; the vanilla one is untouched, it has three consumers
  and one is inside frozen `ui/specs/**`. The EP dialog renders the twin **inside its own `Dialog`'s
  children**, which is how Base UI knows the two are nested — a sibling would make the inner popup's
  backdrop an outside press on the outer one, and cancelling a run would abort-on-close. Measured in
  the browser: the popup carries `--nested-dialogs`, and Cancel leaves the EP dialog open.

  **The progress split, and the rate that decides it.** See "Things that will bite" above: the
  callback fires ~10/s on wasm, so a rAF coalescer is insurance rather than a throttle. `stage` is
  React state; the caption, the bar, its text and the clock are DOM writes through
  `ProgressTrackerHandle.setProgress` and an interval that writes `textContent`. Measured with
  `Profiler`: **100 progress ticks produce zero renders**, a stage transition produces exactly one,
  and the 100 ms clock produces none. `keepMounted` is what makes the interval a real leak, so its
  cleanup is asserted on close *and* on unmount, mutation-checked.

  **The progress dialog is rendered only while a run is in flight.** Rendered unconditionally it is
  an 11th `sim-dialog-portal` under `.sim-ui` with nothing on the baseline to match, and `parity.mjs`
  failed on the extra `[pruned]` line — caught, not reasoned about. Conditional rendering is also
  what vanilla did with `pendingDiv`. `PORTED_DIALOGS` gains `['ep-weights-menu', 1]` and
  `PORTED_DIALOG_REACT` goes 9 → 10.

  **`INTENDED` cannot hold this port's divergences, and that is a property of the gate.** `SERIALIZE`
  records tag and sorted classes only — never an id — and `parity.mjs` removes every ported dialog
  from both trees by exact count, so nothing inside `.ep-weights-menu` is compared at all. An entry
  for the duplicate ids, the `--xl` popup class or the compact-layout selector would fail
  `unobservedIntended` on the next run. They live in `tools/react-migration/stat-weights.mjs`
  instead, which opens the dialog on both builds and prints the contrast: baseline 6 duplicate
  `ep-ratio-N` ids, spaces in every toggle id, 15 untyped buttons, 3 unnamed reference selects, 0
  options with a `value`, a size that does not move, and — at a 900px viewport, where the block is
  live at all — the compact layout applied to a spec that hides threat metrics. React clean on all
  seven. Three more assertions have no baseline counterpart and run on the React build only: the
  progress popup's vertical centring, the run itself (progress → Cancel → a completed table), and a
  header tooltip's rectangle, because `react-tooltip` renders **in place** and `.sim-dialog-body` is
  `position: relative; overflow: auto` — the one clipping risk the port introduces. Measured inside
  the popup and on screen; tippy appended to `<body>` and could not be clipped.

  **Two facts worth not rediscovering.** The reforge optimiser builds a *vanilla* `ProgressTrackerModal`
  at load, so an unscoped `.progress-tracker-modal-*` selector answers for **its** bar, not the EP
  one — every progress read has to be scoped to `.progress-tracker-dialog`, which is also why the
  React twin's root class is not `progress-tracker-modal` (the global rule positions the Bootstrap
  `.modal-dialog` and would fight Base UI's transform). And a tank spec has **no Calculate button**:
  `.sim-type--tank` hides the whole footer, so the browser exercise runs on `warrior/arms` and
  `priest/shadow` and asserts the layout on `warrior/protection`.

  **Unit 4 moved three rules that die under the Dialog's markup.** `_stat_weights_action.scss` is
  `EpWeightsDialog.scss`; `.sim-type--tank … .modal-footer` is `.sim-dialog-footer` (asserted on
  `warrior/protection`: footer, ratios and reference options all `display: none`); `.modal .modal-scroll-table`
  had exactly one consumer and its two declarations moved onto `.results-ep-table-container`. The
  global `.modal-body { gap }` needed nothing — `Dialog.scss` already sets `gap` on `.sim-dialog-body`.
  The co-located file reads the owned tokens (`--table-row-even-bg`, `--gray-500`, `--body-bg`) where
  the original read `--bs-*`. **The sticky header does not work and never did**: nothing constrains
  the container's height, so the dialog body is the scroller on both builds and the `<th>` scrolls
  away (baseline `.modal-body` 319 → 152, React `.sim-dialog-body` 318 → 152, identical). The
  declarations survived the move; the effect was never there. Not fixed here — it is a behaviour
  change nobody asked for.

  **The sixteen defects, and what each fix cost.** Ten are fixed by the port's shape: the dead
  `epAvgElem;` expression becomes a computed class, the dead `.pending` class is not written, the
  discarded unsubscribe is `useStoreSubscribe`'s, the frozen tippy tooltip is derived at render, the
  `<option>`s carry the `Stat` enum through `EnumPicker`, the three reference selects get a real
  `<label htmlFor>`, every `<button>` gets its `type` from `Button`, the dialog size follows
  `showThreatMetrics` through `useStoreSubscribe`, `isRunning` resets in a `finally`, and the
  floating `waitForInit().then(...)` chains get a `.catch`. Three needed a decision: ids are
  `ep-ratio-${type}-${index}` and `sw-stat-toggle-${sanitizeId(name)}`, and the always-true
  `.ep-weights-menu:not(.hide-threat-metrics)` is `.sim-ui:not(.hide-threat-metrics) .ep-weights-menu`
  — which is a **visible change on every non-tank spec at narrow viewports**, where the compact
  layout used to apply to everyone. Defect 5 (pseudo-stats not gated on `showAllStats`) is a
  **behaviour change**: "Show all stats" now reveals the seven pseudo-stats too, and unit 1's
  mutation-checked assertion of the asymmetry was inverted rather than deleted. Defect 15 is in
  shared vanilla `base_modal.tsx` and was fixed minimally — `open()`'s four listener-removers are a
  private per-open list now, `onHideCallbacks` stays the caller's; five open/close cycles left 20
  entries before. Defect 9's `results_viewer.tsx:150` instance is in the results feature and was
  **skipped**.

  **Three deltas that are not defects.** The reference selects are bound to
  `subscribePlayerField(player, 'epRefStat')`, so they follow an external write where vanilla set
  `.value` once. The table re-renders on an `epWeights` change, so the positive/negative colouring is
  live where vanilla only recoloured on a full rebuild. And a rejected pre-run `abortType` now raises
  an error toast where vanilla logged and returned silently.

- 2026-09-06 **Stat-weights units 1 and 2: the model seam and the opener seam, no React in the
  change.** Same shape as queue item 8's settings extraction. `features/stat-weights/model/` is three
  DOM-free files — `ep_unit_stats.ts` (the stat set and the row-visibility filter), `ep_math.ts`
  (`calculateEp` and its private `normaliseEpValue`, `emptyStatWeightsResult`, the two ratio folds,
  the excluded-stat merge) and `stats_table.ts` (the 13 columns as data, taking its five accessors as
  callbacks rather than values, so each is invoked at the moment the view invoked it before).
  `stat_weights_panel.tsx` keeps the pragma and imports them; across both units it lost 277 lines and
  gained 30, and the refs stay in the view. `parity.mjs` and `panes-parity.mjs` are byte-identical,
  which is the whole claim.

  **A 16th defect, found while checking that claim:** `tippy` resolves a function-valued `content`
  once in `evaluateProps` at `createTippy` (`tippy.esm.js:430,595`), not per show, so the ref-stat
  half of each column's label tooltip — `makeUpdateWeights`' `title()` — is frozen at construction
  and never follows a change of reference stat. Pre-existing, carried, and unit 3's to fix.

  **`IndividualSimHost.epWeightsModal` is `{ open(): void } | null` now**, and
  `prevEpIterations` / `prevEpSimResult` are gone from the host surface into private fields of
  `EpWeightsMenu`. Nothing outside the panel ever read them; they were host fields only because the
  vanilla modal is constructed after the shell. `reforge_panel.tsx` — the only external consumer —
  calls `.open()` and needed no change, so unit 3 can swap a React controller in behind that type
  without touching reforge. Goldens stayed at "34 specs match golden", as they must: neither field is
  serialised.

  **Current behaviour is pinned, quirks included.** 37 vitest tests, six of them mutation-checked
  by reverting the behaviour and watching exactly one fail: the `refWeight === 0 ? 0 :` guard, the
  clone in `calculateEp`, the ratio index order, the excluded-pseudo-stat loop, the tps column's ref
  stat being the *dps* one, and the asymmetry where "Show all stats" reveals extra `Stat`s but never
  extra pseudo-stats. The defects the port investigation found are deliberately **not** fixed here —
  they belong to unit 3, where the vanilla view is deleted rather than edited.

  One thing worth not rediscovering: under the vitest i18n stub (`resources: {}`) `i18n.t(key)`
  returns the key, so a label assertion in a model test does pin column identity rather than
  comparing two empty strings.

- 2026-09-06 **Comments stripped across the whole of PR 1567, per the `comment-checker` hook.**
  The user's standing rule — rationale lives in the commit message and here, not in the code — is
  now enforced by a PostToolUse hook on every Edit/Write. Swept retroactively over the PR diff
  against `feature/ui-restructure`: 449 comment units in 180 files. 227 removed outright, 96 trimmed
  to the one sentence that carries the fact (game-mechanics rules, a11y decisions, library semantics
  a future edit would silently break), 36 pre-existing lines that merely moved during a port kept
  verbatim. Net −1,589 lines, zero behaviour change: type-check, lint, vitest, build and every browser
  gate identical before and after.

  **Two traps for the next sweep.** The hook reports `/** @jsxImportSource @jsx-vanilla */` as a
  docstring — it is the pragma that switches a file onto the vanilla runtime, and removing it breaks
  the whole vanilla stack. It also flags `// oxlint-disable-next-line` and deliberately commented-out
  code (the 60U registrations). All three are excluded by rule in the sweep script, not by hand.
  The hook does not inspect SCSS, so the 188 `//` lines the PR adds there were swept by hand under the
  same ladder: 32 removed, 22 trimmed to the sentence carrying a measured value or a cascade reason
  (`display: block` on purpose, the flat-`opacity` unmount trap, `.dropdown-menu` being `display:
  none` without the plugin), 13 one-word section headings kept. On the user's decision the moved
  vanilla comments went too, except provenance (`Taken from Wowhead`), TODOs, and the two data-format
  facts; and `spec_config.ts`'s comment was removed as a comment-only exception to the freeze — the
  freeze protects the `defineSpec` contract, not a remark about it. `ui/specs/**` untouched.

  One matcher lesson: the hook once reported a comment together with the code line after it
  (`stat_display.ts`, where the same `//` text occurs twice), and text-matching deleted both. The
  guard is `git diff HEAD | grep '^[-+]'` filtered to non-comment lines — it must be empty.

- 2026-09-06 **The wowhead and tooltip anchor attributes come from one helper each.**
  `wowheadAnchorProps()` in `ui-kit/wowhead.ts` and `tooltipAnchorProps()` in
  `ui-kit/Tooltip/utils.ts`. Neither collapsed to a flat constant, because both had an exception
  that turned out to be load-bearing:

  `MultiIconPicker`'s trigger emits only `data-disable-wowhead-touch-tooltip`, not the pair — it
  carries no `href`, so wowhead has no icon to swap in, and the vanilla build does the same. Hence
  the `icon` option. The icon-enum pickers drop `data-tooltip-id` entirely when a value has no
  tooltip text, because an anchor pointing at a tooltip with nothing to say still opens an empty
  one; hence the nullable id. They also pass the text as `data-tooltip-content` so one `Tooltip`
  serves every option rather than one element per option, and an empty string is kept as distinct
  from absent.

  Attribute-preserving, verified against the running baseline rather than assumed: `data-whtticon`
  263 and `data-disable-wowhead-touch-tooltip` 152, identical on both builds. The vanilla stack
  still hand-writes these in `ui-kit/pickers/*`; they go when those files do.

  **`mount-once.mjs` passes with `errors=0`.** Two separate ports have now reported it failing on
  the `IconPicker` nested-anchor warning; both were wrong. That warning is a React *dev* build
  warning, and `:3402` serves a production build — `vite build` embeds the production React bundle
  regardless of mode, which the StrictMode note further up this file already says. Re-measure before
  recording this gate as red. **Which port it is pointed at decides the answer**, so say so when
  quoting it: `:3402` (the build) is `errors=0`; `:3403` (vite dev, which the README's invocation
  line names) is `errors=2`, both the nested-anchor warning from `SettingsTabBody`'s `IconPicker`s.
  Re-measured 2026-09-06 with stat-weights: same two frames, no stat-weights frame in either stack.

- 2026-09-06 **The importers are React too, and `.importer` joined `.exporter` as a dual-stack
  class.** Same shape as the exporters a day earlier: `Importer` + `IndividualImporter` + four
  concrete subclasses became one component and four objects, because nothing above `onImport` varied
  between them. `features/import-export/importers/` holds the definitions and the two shared pieces —
  `finish_individual_import.ts` and Wowhead's hash reader — and each importer has a small
  `*ImporterDialog.tsx` of its own rather than an `importerDialog(def)` binder, because the one part
  that stays JSX is the description.

  **`BulkGearJsonImporter` is why `view/importer.tsx` survives**, exactly as `LogExporter` is why
  `view/exporter.tsx` does: its only opener is `bulk_tab.tsx:752`, inside a tab that has not ported.
  So `IndividualImporter` stays as its base, minus `finishIndividualImport`, whose four callers all
  moved. The 60U importer *was* ported even though its registration is commented out — the 60U
  exporter set that precedent, and it is what let the shared tail stop existing twice.

  **`WOWHEAD_SLOT_IDS` stopped being a `static` on a view class.** The ported gear-planner *exporter*
  was reaching into `IndividualWowheadGearPlannerImporter.slotIDs` across the `view/` boundary; it is
  a `const` in `importers/wowhead_gear_planner.ts` now and the direction of the dependency is
  unchanged.

  **Five vanilla defects, all fixed by the port rather than carried.** `open()` passed
  `this.header.title` to `trackPageView` — `this.header` is the `.modal-header` *element*, so every
  import page view was logged with an empty title and the slug `/import/`, the same bug the exporter
  port found. The upload handler wrote `textarea.textContent`, which is a textarea's *default* value,
  so a field the user had already typed in ignored the upload and imported the typed text; and it
  read `files[0]` unguarded, so cancelling the picker threw inside the listener. Addon, WoWHead and
  60U all called `finishIndividualImport` **without `await`**, so its "Wrong Class!" rejection was
  unhandled — importing a mage export on a warrior page changed nothing and said nothing. And 60U
  called `sim.db.lookupEquipmentSpec` once for nothing before `finishIndividualImport` called it for
  real. Awaiting has one sequencing consequence worth naming: 60U's random-suffix warning toast now
  follows the success toast instead of preceding it, and only appears when the import actually
  succeeded.

  **`SimHeader.addImportLink` is dead code with no caller now**, the way `addExportLink` has been
  since the exporters ported. Both were left alone because `sim_header.tsx` carries the vanilla
  pragma, and `ImportExportRegistry.add()` is still reached through them. The vanilla
  `Importer.open()`'s `/import/` slug bug is likewise still there for `BulkGearJsonImporter` — the
  dual-stack rule says fix it when bulk ports, not from here.

  **`animation: false` on the standing warning toast is not cosmetic, and the reason generalises.**
  Bootstrap's `Toast.show()` queues its "done showing" callback behind `transitionend` *plus* a
  timeout even when nothing transitions, and that callback reads `this._element` — which `dispose()`
  nulls. A React ref callback that constructs a toast and disposes it in its cleanup therefore throws
  `Cannot read properties of null (reading 'classList')` under StrictMode's mount/cleanup/mount, and
  `mount-once.mjs` is the only gate that runs StrictMode at all. Nothing is lost: the toast is built
  while its dialog is closed, so its fade-in was never on screen. Expect this for any Bootstrap
  widget hosted from a ref callback.

  **The `rel` on the two external description links is not a change.** The baseline on 3401 is
  `feature/ui-restructure`, which has no `externalRel` in its JSX shim; on this branch the vanilla
  importers already emitted `rel="noopener noreferrer"` and the React ones spell it out. A throwaway
  probe opened all three importers on both builds and compared the title, the description
  paragraphs, the external links, the warning toast and whether it is shown, the textarea and its
  `spellcheck`, the footer controls with their computed widths, and the upload label's `for` against
  the input's id: **`rel` was the only difference**, and the two class *orders* the probe normalises
  (`Button` emits `btn btn-primary` first where the vanilla markup put its own class first).

  **`parity.mjs` gained `['importer', 3]` and `VANILLA_ON_BOTH` became a list.** Three `.importer`
  Bootstrap modals are in the baseline at load — the bulk one is constructed on click, so it is not —
  and they ported one at a time, which is what forced the second half: the still-vanilla React
  dialogs of *two* different markers now have to be taken out and asserted against their baseline
  twins. Verified by tightening `['importer', 3]` to 2, which fails with
  `base: 3 modals matching "importer", expected 2`.

- 2026-09-06 **Three loose ends cleared, and a fourth deliberately deferred.**

  `ImportExportMenu`'s `icon` is typed (`IconName` + `iconStyle` defaulting to `base`), which retires
  the last string-typed icon prop and finishes the `Icon` sweep.

  `settings_tab.debuffs.misc` is deleted from both locales and the schema — no reader, and no
  dynamic key construction reaches it (the ones that exist are `settings_tab.player.profession_*`,
  `settings_tab.consumables.*` and `common.phases.*`). **Its near-twin `settings_tab.raid_buffs.misc`
  is live** — `RaidBuffs.tsx:34` reads `.label` — so the two must not be confused; that is why the
  key survived earlier sweeps as "probably used". Removing it needs all three files, since the
  schema is `additionalProperties: false` *and* listed `misc` in `required`.

  Worth knowing while touching that schema: **it already fails validation at HEAD**, on
  `title_badge` being an additional property the schema does not declare. Pre-existing, verified by
  validating HEAD's locale against HEAD's schema, and the error set is byte-identical before and
  after this change. Nothing here introduced it and nothing here fixes it.

- 2026-09-06 **`IconPicker`'s nested anchors: invalid, inert, and deferred to Phase 5 — decided, do
  not re-open.** **Superseded the same day by the un-nesting entry at the top of this log**: the
  third option neither of the two below considered is to move the container out of the anchor rather
  than change what either element is, which keeps every `href` and costs `liftSubtrees` instead of an
  `INTENDED` entry. Two `<a class="icon-input-improved">` sit inside the outer
  `<a class="icon-picker-button">`. Measured on both builds: **68 nested pairs, identical**, and the
  browser does not re-parent them because both stacks build this DOM through DOM APIs rather than
  parsing HTML.

  Both fixes cost more than the defect does today. Turning the inner anchors into spans breaks
  `.icon-input-improved:not([href])`, which is how unfilled improved icons are hidden, and loses
  their wowhead link. Turning the outer element into a button — which is what it behaves as, since it
  `preventDefault`s every left click — drops the `href` that the wowhead tooltip script and
  middle-click both read.

  This is the third member of a set worth naming: **the parity gate pins vanilla's markup, so a
  defect vanilla shares cannot be fixed in the port without an `INTENDED` entry and a behaviour
  risk.** The other two are the `hide` class over a conditional render, and `CritCapRow`'s
  `--bs-border-opacity` write. All three become free the moment the vanilla comparison retires.

- 2026-09-06 **The seam block's colour tokens are namespaced by family, and one `--bs-*` write is
  load-bearing after all.** The 22 tokens added by the audit landed on bare words following the
  block's existing convention (`--uncommon`, `--health`), which left `--shadow` reading like a
  box-shadow token beside `--focus-ring`. All five families are now prefixed —
  `--quality-*`, `--school-*`, `--faction-*`, `--resource-*`, `--damage-*`, 35 declarations — so the
  block has one convention rather than two.

  **The rename was safe for a reason worth recording: those tokens have zero `var()` readers.** The
  live code still reads the `--bs-*` twins, so all 35 occurrences are declarations in one file.
  Checking that took a precise search, because `_timeline.scss` contains
  `.secondary-resource--arcane-charges` — a *class name* that a naive `--arcane-charges` search
  matches. A blind rename would have silently recoloured the timeline, and no gate would have caught
  it: parity compares elements and classes, not computed values. Verified instead by reading all 35
  off `getComputedStyle(:root)` on the running page — old names absent, new present, every value
  equal to its `--bs-*` twin.

  Phase C: the `--bs-form-check-{box,radio}-bg-image` pair is renamed without the prefix (they were
  project inventions — Bootstrap has neither), and `Dialog.tsx`'s comment now cites
  `--primary-dampened` / `--hover-color`, the spellings `_mixins.scss` actually declares.

  **`CritCapRow`'s `--bs-border-opacity: 0` was attempted and reverted, and that is the interesting
  half.** The rule says a ported component never writes a `--bs-*` name. Here it must, until the
  parity gate retires: `panes-parity.mjs` pins the class list, so `border-body border-brand` cannot
  be dropped, and Bootstrap's border-colour utilities carry `!important` — an inline
  `borderColor: 'transparent'` loses to them and paints the spacer solid orange. Measured on both
  builds: React `rgb(224, 163, 53)` against the baseline's `rgba(224, 163, 53, 0)`. Zeroing the
  variable the utility itself reads is the only lever the gate leaves. Same shape as the `hide`-class
  note: a constraint of the gate, not a design choice, and it resolves in Phase 5.

- 2026-09-06 **The `--bs-*` audit, and the `:root` half re-homed into the seam block.** 22 owned
  tokens added to `scss/shared/_variables.scss` — item qualities, spell schools, factions, `--chi`,
  the two balance-druid resources, and `--body-font-family` / `--body-font-size` /
  `--body-line-height`. Purely additive: no consumer changed, and verified by dumping **every**
  custom property that resolves at `:root` before and after — 447 → 469, nothing changed, nothing
  removed, and each new token painted through a probe element to match its `--bs-*` twin's computed
  colour rather than its text.

  **The old counts were wrong in both directions, and the fix is a method note.** A literal grep for
  `--bs-[a-z-]+` over-counts, because `--bs-btn-*` in a comment looks like a name, and under-counts,
  because `shared/_global.scss:192-219` writes `var(--bs-#{$label})` inside five `@each` loops —
  nineteen real names (`--bs-rare`, `--bs-fire`, `--bs-horde`…) that no grep can see. 117, not 104.
  The 68-at-`:root` figure survived unchanged; the "35 component-scoped" was 30, five of them prose.

  **Every live `--bs-*` reference in the tree resolves somewhere.** The four that resolve nowhere —
  `--bs-hover-color`, `--bs-primary-dampened`, `--bs-table-accent-bg`, `--bs-table-row-even-bg-hsl` —
  appear *only inside comments* recording bugs already fixed. Two of them are mis-spelled there and
  were mis-spelled in this file: `shared/_mixins.scss:23-24` declares `--primary-dampened` and
  `--hover-color` without the prefix.

  **Read vs write is the distinction that shrinks the remaining 26.** Most component-scoped hits are
  `.btn-primary { --bs-btn-hover-bg: … }` — Bootstrap's intended theming hook, not a token to own.
  Ten of the twelve `--bs-btn-*` are writes; the only reads are two lines in `_sidebar.scss`, which
  resolve today because the ported sidebar button still carries `.btn.btn-primary` and will need a
  `--btn-disabled-*` pair the day `Button` stops emitting variant classes. The three `--bs-nav-link-*`
  need no new family either: `--tab-padding-y/-x` and `--tab-font-size` already hold the same values
  from the same Sass variables — but `--bs-nav-link-padding-x` is `1rem` inside `.nav` and `0` inside
  `.navbar-nav`, so no single token covers both scopes.

- 2026-09-06 **The settings tab body is React, and it gave `ContentBlock` its first consumer.**
  `settings_tab.tsx` went from 306 lines to 18 — the same shape `talents_tab.tsx` has, registering the
  pane and owning nothing else — and the eleven portals `SimApp` aimed at named containers inside it
  collapsed to one aimed at `contentContainer`. The nine containers on `SettingsTab` are gone with
  them; nothing outside `SimApp` ever read them.

  **The `ready` gate is the port of one `waitForInit` callback, not a per-block decision.** The
  vanilla tab built its three columns in the constructor and *everything* in them inside a single
  `waitForInit().then(buildTabContent)`, so the faithful shape is the columns rendered always and
  their children behind `useSimReady` — which is also what keeps `ConsumesPicker`'s synchronous
  `Database.getSync()` legal. `SimApp` no longer calls `useSimReady` at all.

  **The right panel mounts before init where vanilla built it after, and that is safe for one
  reason worth writing down.** `useLegacyMount` runs in the commit that sets `simUI`, so its
  `waitForInit().then(...)` is registered in the same task as the shell's own — after
  `loadSettings`, which the constructor queues first. The load-time snapshot each `presets.itemSwaps`
  entry bakes in therefore still sees loaded settings. `player.getParty()` is likewise non-null: the
  page entry calls `raid.setPlayer(0, player)` before `createRoot`.

  **`CustomSection` absorbed its own block.** The reason its `ContentBlock`, `custom-section` class
  and `when` visibility stayed in `settings_tab.tsx` was that `when` toggles `hide` on the block's
  **root**, which React did not own. It does now, so the split is gone and `buildCustomSection` is
  deleted. A section with no `when` subscribes to nothing, as the vanilla builder did — the
  alternative, an unconditional hook on a source that never matters, would re-render the section on
  every player change.

  **One `INTENDED` entry, and it is `TooltipButton`'s first appearance in the tree.** A React
  `ContentBlock` header tooltip draws its glyph through `Icon`, which spells FA6's canonical
  `fa-circle-question` where the vanilla button hardcodes FA5's `fa-question-circle` alias — the same
  glyph in the pinned 6.0.0 CSS, a different class token, and the only line either tree gate reports.
  `max: 4` is the settings pane's ceiling: buffs, debuffs and the two external-cooldown blocks, which
  only `warrior/protection` has all four of. It rises as further tabs stop building vanilla blocks.

  **Two ratchets came down.** `a11y.mjs`'s settings `shown` went 3 → 0, because those three bare
  `<i>` were exactly the vanilla header tooltips and `Icon` marks its glyph `aria-hidden`; `unsafe`
  went to 0 as well, slack left by the external-link seams and taken up here rather than left as room
  a later port could grow into. `unnamed` is unmoved at its 155 ceiling — every control this port
  renders already existed.

  **Two gate defects found while running them, neither introduced here.** `settings-tab.mjs` keyed
  every multi-icon row on `label.multi-icon-picker-label`, which stopped matching when that caption
  became a `<span>` the day before, so the React side printed `multi:?` for all eight — a comment
  four lines above already says to select `.form-label` by class for that exact reason. And
  `simModalProbe.backdrop()` read `querySelector`, which was unambiguous when the page had one Base
  UI dialog and answers for an exporter now that it has six; `encounter.mjs` had been reporting
  `backdrop: false` on the React build since the exporters landed. Both fixed; both gates are
  byte-identical on the two builds again.

- 2026-09-06 **The `.form-label`-over-an-icon-group shape is settled across the settings tab.** A
  `<label>` with no control is not a label, and the tab had the shape in three places. `ConsumeRow`
  (one per consume row) and `MultiIconPicker` (its own caption) now render a `<span>` and name the
  group from the element that holds the icons, matching what item swap already did; `PlayerSettings`
  composes both, so it needed nothing. `PickerShell`'s label stays a `<label>` — it has `htmlFor`
  and a real control behind it, which is the distinction that decides this every time.

  Two `INTENDED` entries carry it: the plain pair rises to `max: 5` (item swap plus the four visible
  consume rows) and a new `label.form-label.multi-icon-picker-label` pair sits at `max: 8`. **The
  multi-icon count varies by spec — 6 on arms and fire, 7 on beast_mastery and windwalker, 8 on
  shadow and protection** — because the number of `MultiIconPicker`s is a per-spec fact, so the
  ceiling is the maximum across the six gate specs rather than a single expected count.

  The two tests that asserted the `<label>` were not merely retargeted at `span`: they now assert
  `role="group"` and that `aria-labelledby` resolves to the caption's own id, which is the part worth
  pinning.

  Also: `elixir-space`'s hardcoded "or" is now `settings_tab.consumables.elixirs.separator`. Adding a
  key touches **three** files — both locales and `schemas/translation.schema.json`, whose
  `consumables` block is `additionalProperties: false` with an explicit `required` list, so a key
  absent from the schema fails validation rather than being ignored.

- 2026-09-06 **Consumes is React, and the row's `hide` stopped being an inversion.** The block was
  queued last because every picker in it is an `IconEnumPicker`, and it carried the one shape in
  this tab that runs the wrong way: `updateRow` decided a `.consumes-row`'s `hide` by asking each
  *constructed picker* `showWhen()`, so the parent's class depended on its children's state.

  The answer is that `showWhen()` is a pure function of the config and the mod object, so it does
  not need an instance. It is `iconEnumPickerShown(config, modObject)` in `IconEnumPicker/utils.ts`
  now, `IconEnumPicker` itself reads it — `useInput`'s own `hidden` is the config's `showWhen`
  alone, which is only half the override — and `ConsumeRow` reads it for the two rows vanilla called
  `updateRow` for. Data flows down again, and the predicate has its own three assertions, one
  mutation-checked.

  **The row watches the two professions and nothing else**, as vanilla did. That is narrower than
  what its own pickers watch and narrower than what their values depend on — a value's `showWhen`
  tests faction, hence race — so a row whose last option goes away for some other reason stays shown
  until a profession changes. Matched rather than corrected.

  **`Database.getSync()` is a hard `waitForInit` dependency, not an inherited one.** Every other
  ported settings block would merely render early without `SimApp`'s `ready` gate; this one throws.
  The item lists are read once in a memo, as the vanilla `create()` factory read them once.

  **The gate entry was tightened as far as it goes, which is not all the way.** `normaliseBaseUiMenus`
  still counts *slots* rather than picker roots, because `CooldownsPicker` builds a vanilla
  icon-enum picker per cooldown row — always at least one, in the rotation pane — so the picker is
  still dual-stack. What changed is `roots < expected` → `roots !== expected`: the fold runs per
  pane and no pane mixes the two stacks, so a vanilla root appearing beside the React ones now
  fails. Root-counting waits for the rotation tab.

  Nothing moved in `a11y.mjs` (`unnamed` sits at its 155 ceiling either way — the port renders the
  same anchors vanilla did) and `settings-tab.mjs`'s whole output is still byte-identical on both
  builds, including the showWhen pair it exists for. Two defects were carried rather than fixed,
  both flagged for a decision: `ConsumeRow`'s `<label class="form-label">` names an icon group and
  not a control, the same shape item swap has an `INTENDED` entry for; and the `<span
  class="elixir-space">or</span>` between the flask and the elixirs is untranslated English.

- 2026-09-06 **The sidebar showed the pre-load default player's stats all session** — and it was
  never a React bug. `Sim.applyLoadedSettings` suppresses the stats recompute while the settings
  load applies its many writes, but nothing recomputed when the load finished. The comment
  justifying the skip claimed the stored settings "already carry the stats they were saved with";
  they do not — `currentStats` is server-derived, seeded as an empty `PlayerStats.create()` and
  written only by the `computeStats` round trip. The only compute that ran was the one
  `raid.setPlayer()` triggered during construction, *before* the settings were applied, so an Arms
  warrior displayed Strength 216 — the naked base value — until any later raid/encounter change
  happened to trigger a fresh one. Editing gear "fixed" it, which is how it was reported.

  Reproduced by toggling raid buffs (Strength 216 → 20153) and reloading: the reload came back at
  216, byte-identical to the pre-load defaults. `applyLoadedSettings` now recomputes once on the way
  out.

  The same gap left unit metadata stale, because `updateCharacterStats` also drives
  `player.updateMetadata()` — so `warrior/protection` rendered all 116 APL validations unclassified,
  and now classifies 11 warnings and 2 informational. **This is a `feature/ui-restructure`
  regression, not a port one** (the vanilla baseline shows the same naked values; production master
  does not), so the React build now diverges from the parity baseline and three APL-validation
  entries are recorded in `intended.mjs`. They stay: the restructure branch is being closed and this
  branch PRs directly into master, so the baseline they compare against is going away rather than
  being fixed.

- 2026-09-06 **Three domain defects around the database load, found while declining react-query.**
  `Database.get()` assigned `loadPromise` once and never cleared it, so one transient failure was
  cached as a rejected promise for the page lifetime — with ~30 `waitForInit().then(...)` sites
  hanging off it and no `.catch` between them, including React's own readiness hook. It now clears
  the memo on rejection (the rule `getSharedWasmModule` already states: *"Never memoize a
  failure"*), retries a couple of times first because a failed `db.json` is fatal to the page rather
  than to one widget, and `enchants.ts` gets the same reset. Pinned by `database.test.ts`, which was
  mutation-checked — the memo case fails when the reset is removed.

  It also **stopped taking an `AbortSignal`**. The promise is shared by the whole page, so honouring
  one caller's signal aborts the database for everyone; it was safe only by the accident that
  `Sim`'s constructor calls it first without one. `getItemIconData` two methods below already
  documented this rule about its own shared request. The signal is now honoured where it can be —
  `fillAndSetActionId` checks it before writing into an element the caller has dropped — and
  `ActionId.fill`'s dead `options` parameter is gone. `getCharacterStatsForGear` (zero callers) was
  deleted at the same time.

- 2026-09-06 **`useSimStatus`, and a skeleton that does not key off it.** Init is a
  `'loading' | 'ready' | 'error'` status with a rejection handler, where before a failed load left
  the boolean `false` forever and rendered nothing. `useSimReady` is a one-line wrapper, so `SimApp`
  is untouched. The CharacterStats skeleton deliberately keys off `currentStats.finalStats` instead:
  `waitForInit()` resolves *before* the first `computeStats` returns, so a ready-gated skeleton
  would vanish while the values were still empty.

- 2026-09-06 **External links get `rel="noopener noreferrer"` from three seams, not from call
  sites.** `isExternalHref`/`externalRel` in `ui/sim/links.ts`, applied by `Button` for React, by
  the `@jsx-vanilla` runtime for every `<a href>` written as JSX in the vanilla stack, and by
  `setExternalAwareHref` for the ActionId writer, which assigns `href` after the element exists
  where the JSX seam cannot see it. 8 of 227 external anchors carried it before; 151 do now, the
  remainder being `elem.href = ...` inside un-ported feature views. Externality is not an origin
  comparison — `ui/domain` may not touch DOM globals, and every internal link here is relative.

  **This is why the picker parity oracle exists.** The vanilla twins picked the attribute up and
  React's `IconPicker` did not, and `mountBoth` failed 22 assertions on the asymmetry. The browser
  parity gate cannot see it: it compares elements and classes, not attributes.

- 2026-09-06 **`Icon` absorbs the last raw glyphs, and two of its aliases were wrong.** Three call
  sites still passed FontAwesome classes as strings, each documenting the same cause: they use the
  bare `fa` prefix and `Icon` always emitted a style class. That is now `style="base"`, and
  `SocialLink`, `ToolbarItem`, `Exporter` and `TalentTreePicker` are typed. `ui/domain` cannot
  import `IconName`, so SOCIALS keeps its literals narrow with `as const` and they are checked where
  they are rendered.

  `ICON_ALIASES` mapped `rotate-left` → `arrow-rotate-left` and `arrow-right-from-bracket` →
  `right-from-bracket`. In the pinned 6.0.0 CSS those are four distinct glyphs (\f2ea vs \f0e2,
  \f2f5 vs \f08b), so each mapping silently swapped the icon — and the test asserted the wrong one.
  Both are canonical names now. **No FontAwesome npm package**:
  `@fortawesome/fontawesome-common-types` does export `IconName`, but 2,699 of its 4,837 members do
  not resolve against the pinned 6.0.0 CDN, which trades a hand-checked 52-name union that is 100%
  accurate for one that is 44% accurate.

- 2026-09-06 **Player settings are React, on an `IconEnumPicker` ported to Base UI `Menu`** — the
  second picker on that adapter, and it wants the opposite of what the first one did.

  **`Menu.Item` is right here.** Bootstrap's `clearMenus` hides on any click inside the menu whose
  target is not an `input`/`select`/`option`/`textarea`, so choosing an option always closed this
  one — the behaviour `MultiIconPicker` had to suppress. Each `<li>` is the item, not the anchor
  inside it, because Base UI's press-drag-release gesture dispatches its click on the item element,
  and `preventDefault` from there still cancels the anchor's navigation.

  **The popup is portalled into a slot element of our own**, an empty `<div>` where vanilla's `<ul>`
  sat. `Menu.Portal` appends its element to the container in a later commit than React places the
  root's own children, so a portal aimed at the root lands *after* the trailing `<label>` — proved
  by mutation, and the unit test asserts the child order for it. Three wrappers instead of
  `MultiIconPicker`'s two; `.icon-enum-picker-slot` and the portal are `display: contents`, so the
  box tree is vanilla's exactly and the absolutely-positioned popup is not a flex item.

  **React refuses to render the button's `href`.** Vanilla builds it as `javascript:void(0)`;
  React 19 substitutes a `javascript:` URL that *throws when followed*, which is worse than the
  no-op vanilla wrote. The port omits the attribute instead — `settings-tab.mjs`'s row key,
  and everything else that reads it, treats both spellings as "no link" — and `nativeButton={false}`
  is what keeps the anchor focusable without one. The stale-href quirk further up this file is not
  reproduced, as that note says it should not be.

  **Measured against the vanilla menu, opened on both builds:** `sideOffset={-1}` reproduces
  Bootstrap's `[0, -1]` on the pixel (dx 0, dy -1), the popup box matches (35x140 on mage, 175x315
  on hunter, `grid-template-columns` resolving to `35px 35px 35px 35px 35px` from `numColumns: 5`),
  and every declaration on the `<ul>`, the `<li>` and the option anchor is identical. Two move
  rather than change: `position: absolute` and `z-index: 1000` are the positioner's now, and the
  effective stacking context is still 1000.

  **What Base UI cannot reproduce.** Keyboard navigation visits options wearing `hide`, because
  `keepMounted` puts them in the composite list where Bootstrap instead filtered its focusable
  children by visibility. And the popup is nameless: Base UI points its `aria-labelledby` at the
  trigger, which is a bare anchor carrying a background image — `MultiIconPicker` fixed that with
  `config.label`, and an icon-enum picker has none to use.

  **There is no `*.parity.test.tsx`**, for `MultiIconPicker`'s reason: `mountBoth` compares the two
  trees index-aligned, and this one has three wrappers the vanilla tree does not, so it cannot line
  them up. The tree gates plus `normaliseBaseUiMenus` are the element-for-element oracle instead, and
  `IconEnumPicker.test.tsx` covers the behaviour — 22 cases, three of them mutation-checked.

  **Tooltips are one react-tooltip per picker**, serving the button and every option through
  `data-tooltip-content` on the anchor rather than one instance each — a pet picker has 31 options.
  It renders in place, which is a new container for a `Tooltip`, so it was measured: same text, same
  width as tippy's, and clipped by nothing between it and `<body>`.

  **Three gate changes.** `normaliseMultiIconMenus` is `normaliseBaseUiMenus`, a table of ported
  menus rather than one function per picker, so `dropdown_picker` adds an entry instead of a call
  site. Its icon-enum entry counts *slots* rather than picker roots, because that picker is half
  ported — Consumes still builds the vanilla one and those roots have no wrappers to fold — and the
  roots are then asserted to be a superset. `REACT_DANGLING_MAX` is 0, not 3: measured on eleven
  specs across ten classes — three that build no player icon inputs, one whose only one is an `icon`,
  and seven with a ported picker — and no label in the React pane names anything that is not there.
  `a11y.mjs`'s `unnamed` ceiling is 155, not 161. Neither number moved *because* of this port: both
  were already slack from an earlier one, and taking them up now is cheaper than leaving room a
  later port could grow into.

- 2026-09-06 **Buffs and Debuffs are React, on a `MultiIconPicker` ported to Base UI `Menu`** — and
  the port could not reproduce the markup, which is the interesting part.

  `Menu.Portal` is mandatory, `Positioner` must be its child and `Popup` the Positioner's, and each
  renders a real element, so there is no arrangement that yields `.dropend > a + ul`. The `<ul>` also
  cannot keep `.dropdown-menu`: `shared/bootstrap_overrides.ts` binds a capturing `mouseleave` to
  that class and reads `previousElementSibling` as the toggle, which inside a positioner is null, and
  Bootstrap then throws on it.

  Both tree gates therefore normalise the React side through `normaliseMultiIconMenus` in
  `browser.mjs`: two wrappers collapsed, the popup's class renamed back. Every count is asserted
  against the number of picker roots actually found rather than a number typed in, and it runs on the
  React side only — the baseline has the same roots, so normalising both reports the baseline as
  missing wrappers it never had. That mistake cost a run.

  **Clicking inside the menu must not close it**, which is why nothing in the popup is a `Menu.Item`;
  verified with real pointer clicks rather than synthetic ones, since a synthetic `.click()` never
  exercises Base UI's dismissal. `sideOffset={-1}` reproduces Bootstrap's `[0, -1]` on the pixel.

  The popup is `role="group"`, not the `menu` Base UI gives it. A menu's children must be menuitems
  and these are icon toggles; `Menu.Item` would close the popup on every click, which is the one
  behaviour that must not change. Naming the trigger is what makes the group usable — it is a bare
  anchor carrying a background image, so it announced nothing, and Base UI points the popup's
  `aria-labelledby` at it, which would have left the group nameless too. Both fixed by one
  `aria-label`; measured resolving to "Stats". One divergence stays recorded rather than fixed:
  Base UI's `markOthers` sets `pointer-events: none` on the rest of the page while a menu
  is open regardless of `modal={false}`; that is **pre-existing**, measured on the header's own
  menus, not introduced here.

- 2026-09-06 **The exporters are React, and the class hierarchy is gone.** Nothing above `getData`
  varied between the six, so everything above it became props and each exporter became a plain
  object. The registry now holds either a vanilla thing with `open()` or a component the menu
  renders; the dialogs are siblings of `Menu.Root`, not inside `Menu.Popup`, because clicking an item
  closes the menu and unmounts the popup — a dialog in there would go with it.

  The stylesheet merge this unit was chosen to prove cost two changes, not one. `.modal-footer .btn`
  is now dual-keyed with `.sim-dialog-footer`, because the log exporter is still a Bootstrap modal
  and wears `.exporter` at the same time. And `--bs-modal-padding` in the category row is emitted
  inside `.modal` only, so that whole `gap` declaration would have gone invalid the moment the row
  moved into a portaled popup — the exact trap the `Dialog` docstring names, hit for real.

  **Three vanilla defects fixed rather than carried.** `CopyButton` read the textarea's `innerHTML`,
  so the CLI export put `&amp;` on the clipboard where the field held `&` — 62 characters' difference on
  one export. `trackPageView` passed `this.header.title`, where `this.header` is the header
  *element*, so every export page view reached analytics with an empty title and a slug of
  `/export/`. And the WoWHead exporter called `getData()` in its constructor and discarded the
  result.

- 2026-09-06 **`LegacyHost` is deleted, and the rule that would have caught it is now a gate.**

  It was never used. Every port that needed to mount a vanilla `Component` reached for
  `useLegacyMount` instead, and the two are not interchangeable: `LegacyHost` renders a wrapper
  `<div>` of its own, which changes a pane's DOM, and `panes-parity.mjs` compares panes element for
  element. The hook mounts into the React element that is already there. That is why nothing picked
  it, and why it goes rather than waiting for a caller that would fail the gate.

  Three others also have no importer — `ContentBlock`, `NumberListPicker`, `AdaptiveStringPicker` —
  and they stay, because each ships a `.parity.test.tsx` comparing it attribute by attribute against
  a vanilla twin that is still live (14, 4 and 4 callers). Those tests do real work today: they pin
  that the port is correct while it waits for apl, gear and the tab bodies.

  `tools/react-migration/unused.mjs` reports any ui-kit component nothing imports. It is static —
  no browser, no build — and it is not an allowlist: an entry excused in `ALLOWED` that has since
  gained an importer fails too, so a component stops being excused the moment it stops needing to
  be. Same discipline `INTENDED` follows in `parity.mjs`.

- 2026-09-06 **The exporters are React, and the class hierarchy is gone.** `Exporter` +
  `IndividualExporter` + six subclasses became one component and six objects. Nothing above
  `getData` varied between them, so everything above `getData` is props: `title`, `allowDownload`,
  `selectCategories`. `features/import-export/exporters/` holds the six definitions — not `model/`,
  which forbids `window`, and the link exporter reads `window.location.href`.

  **The registry is what made this a design question.** A React dialog has no `open()` for
  `ImportExportRegistry` to call — it has state. So an entry is now *either* a vanilla thing with an
  `open()` **or** a `ComponentType<{open, onOpenChange}>`, and `ImportExportMenu` renders the second
  kind and owns which one is showing. The importers are untouched on the vanilla path. The dialogs
  render as **siblings of `Menu.Root`, not inside `Menu.Popup`**: clicking an item closes the menu,
  which unmounts the popup, and a dialog rendered in there would go with it.

  `app/individual_sim_ui.tsx` still carries the vanilla JSX pragma, so it cannot write the element —
  `exporterDialog(DEFINITION)` binds one and it registers the result, one line per exporter where it
  used to construct one class per exporter. That is also why `SimHeader.addExportLink` is now dead
  code with no caller; it was left alone because that file carries the pragma.

  **`sim_header.addExportLink` aside, one vanilla file survives on purpose.** `view/exporter.tsx`
  and `LogExporter` stay, because `log_runner` still opens the log exporter through a
  `(getLogData) => {open}` factory and the results feature is hands-off. So `.exporter` is worn by
  both stacks at once, which is what the stylesheet and the parity rule both had to absorb.

  **The stylesheet merge, which is why this unit was chosen.** Only one file selects on `.exporter`
  (`scss/core/components/_exporters.scss`), and it needed two changes. `.exporter .modal-footer .btn`
  became `.modal-footer, .sim-dialog-footer` — dual-keyed, because the log exporter is still a
  Bootstrap modal. And `.exporter-category-pickers` had `gap: … var(--bs-modal-padding)`, which is
  emitted inside `.modal` and nowhere else, so it resolved to nothing the moment the row moved into
  a portaled popup: `--modal-padding` is the seam token, same value. That is the trap the `Dialog`
  docstring names, found for real. Nine stylesheets select `.<cssClass> .modal-*`; this was one of
  them, and `_importers.scss`, `_selector_modal.scss`, `_filters_menu.scss`,
  `_progress_tracker_modal.scss` and `sim_ui/_shared.scss` still carry the rest.

  **`parity.mjs` grew from one ported dialog to a list, and the log exporter is why it is not a
  one-liner.** The baseline has six `.exporter` modals, five of which ported; the sixth is
  byte-identical to three of the five, so no class tells them apart and "drop five" would depend on
  sort order. All six leave the baseline, the one React still builds leaves the React side, and that
  pair is asserted against each other directly — so nothing loses coverage. Counts are exact on both
  sides; verified by tightening `['exporter', 6]` to 5, which fails with
  `base: 6 modals matching "exporter", expected 5`. Markers are matched on a subtree's **first two
  lines**, because the React exporters carry `.exporter` on their popup three levels below the
  portal that identifies them.

  **Three vanilla defects, all measured, all fixed by the port rather than carried:**
  `CopyButton.getContent` read the textarea's `innerHTML`, which is HTML-escaped — on the CLI export
  that copied 221,660 characters where the field held 221,598, the 62 being `2×&amp; + 7×&lt; +
  11×&gt;`, so `Tinkers & Bloodbath` reached the clipboard as `Tinkers &amp; Bloodbath`. `open()`
  passed `this.header.title` to `trackPageView` — `this.header` is the `.modal-header` *element*, so
  every export page view was logged with an empty title and the slug `/export/`. And the WoWHead
  exporter's constructor called `this.getData()` and discarded it.

  The gates: `header-toolbar.mjs` identical on both builds with
  `items=["Link","JSON","WoWHead","Pawn EP","CLI"]`; `parity.mjs` shows no shell, modal or pruned
  problem on all three specs; and a throwaway probe opened all five on both builds and compared the
  title, the generated text, the footer buttons and their widths, the category pickers' labels and
  `for=`, what the copy button copies, what the download button writes, and Escape — identical
  except the `<h5>`→`<h2>` title the adapter already records, and the copy defect above.

- 2026-09-06 **`a11y.mjs` covers the settings pane, on a ceiling rather than an assertion.** The gap
  was real — that region has 161 unnamed controls and 34 `_blank` links with no `rel`, almost all of
  it in markup that has not ported — so a hard "must be zero" would have been red the day it was
  added, which gates nothing.

  A region React fully owns still asserts zero. A half-ported one declares a ceiling of what its
  vanilla half currently has; the numbers may only fall, and lowering them is part of porting a
  block. Verified it fails when tightened by one.

  That is the second ratchet in the gates, after `REACT_DANGLING_MAX` in `settings-tab.mjs`. Both
  exist for the same reason: a defect that is being *removed* a block at a time cannot be expressed
  as an equality until the last block lands, and an exact expectation would need editing on every
  port. A ceiling only ever moves the right way.

- 2026-09-06 **The settings tab's store writes are out of the view, and no React went in.** Doing it
  as its own step is what made the encounter rules land cleanly, and it is worth repeating: a pure
  move is far easier to review — and to revert — than a move tangled up in a port.

  `applyBuild` was a `static` on `PresetConfigurationPicker` whose entire body is store writes, and
  it already had a caller that is not a view (`IndividualSimUI` applies `defaultBuild` through it).
  It is `features/settings/model/apply_build.ts` now. `getCurrentSavedSettings` and the fourteen-setter
  `setData` batch became `readSavedSettings` / `applySavedSettings` in
  `features/settings/model/saved_settings.ts`; the reader already had two callers, since the preset
  item-swap list bakes a load-time snapshot into every entry.

  Nine imports in `settings_tab.tsx` and three elsewhere were orphaned by the move and removed — all
  of them proto message types that only the batch referenced. Every `|| X.create()` in that batch is
  load-bearing rather than defensive: proto3 omits an empty message, so a saved entry with no debuffs
  comes back with the field absent and the setter still needs a value.

- 2026-09-06 **Custom sections are React**, and the deprecated `customSections` function form is
  gone from the tab — no spec declared it. The field is still on `IndividualSimUIConfig`, which is
  the frozen surface, so it is now declared and read by nothing; removing it is a spec-schema change
  and wants asking first.

  The split is the same as everywhere else, one line further out than usual: the `ContentBlock`, its
  `custom-section` class *and* its `when` visibility stay vanilla, because `when` toggles `hide` on
  the block's **root**, which React does not own. It only reads the player, so there was nothing to
  move to `model/`.

  `inline` is forced on everything including the icon pickers, because the vanilla builder walked
  every `.input-root` in the body afterwards — the same trap the other-settings port hit. An
  `iconEnum` input would need a picker that is not ported; the narrowing throws rather than rendering
  a section short, so a spec that adds one fails loudly.

  **This block had zero gate coverage** — only `shaman/elemental` and `shaman/enhancement` declare
  `sections` and neither is in `SPECS`, which is why it was sequenced after the cooldown blocks
  rather than before. Verified by running `panes-parity` and `settings-tab` explicitly on both, and
  by checking the probe actually lists the six Totems pickers rather than passing on an absent
  section.

- 2026-09-06 **Both external-cooldown blocks are React**, on one component. `StatOptionIcons` is
  typed to `IconPickerStatOption` rather than the wider union its input list can hold: the other two
  members name pickers with no React port yet, and a runtime dispatch returning `null` for them would
  render a section silently short. The type is what stops Buffs and Debuffs being wired up
  half-working before `MultiIconPicker` lands.

  `configureIconSection` turned out to do nothing for these two. Its only effect without
  `adjustColumns` is to hide an empty section, and each block's own guard already means it is not
  empty — so the call went rather than being reproduced.

  **The behaviour gate earned itself here.** `panes-parity` was identical on all six specs, because
  `SERIALIZE` compares tag and classes and nothing else. `settings-tab.mjs` caught what it cannot
  see: vanilla writes `for="undefined"` on an icon input whose config has no id, and `PickerShell`
  omits the attribute — so the port *fixes* a dangling label, and the probe diffed.

  That is recorded as a **ratchet** rather than a count. An exact expectation would need editing on
  every port, and "must be zero" is not true yet — three remain in blocks that are still vanilla. So
  `REACT_DANGLING_MAX` may never rise, lowering it is part of porting a block, and at zero it becomes
  an equality and both it and the defect are gone. Verified it fails when tightened.

- 2026-09-06 **The other-settings block is React, and it took the append-ordering dependency with
  it.** While its inputs were vanilla, `ItemSwapPicker` had to be portalled in *after* them, and the
  settings tab carried a comment explaining that. Both halves are one component now, so the order is
  the order they are written in.

  It also produced **`InputPicker`**, which is the React shape of `buildInputPickers` — the
  dispatcher every generic section walks its `InputSection` through. The external-cooldown blocks and
  custom sections reuse it, which is most of why this block went first despite being the smallest.

  `inline` is forced rather than read off the config, because the vanilla walk added `input-inline`
  to every `.input-root` in that body *after* construction — including to a config that says
  `inline: false`. `PickerShell` de-duplicates, so the configs that also carry it in
  `extraCssClasses` are unaffected.

  Two findings. **The swap-slots half of the block's guard is unreachable**: `applyDefaultConfigOptions`
  always prepends Challenge Mode, so `otherInputs.inputs` is non-empty on all 34 specs and the block
  always exists. Preserved as written rather than "simplified", since it is the config surface that
  would have to change. And **no store writes to extract** — every `setValue` is already a closure in
  `features/settings/model/other_inputs.ts`.

  **A gate gap worth naming, pre-existing rather than introduced:** `a11y.mjs` covers only the header
  and sidebar regions, so the `aria-describedby`/`aria-labelledby` Base UI's `Field` puts on these
  pickers is asserted by nothing. The encounter block has the same hole.

- 2026-09-06 **`Dialog` has its first consumer: the advanced encounter modal.** Both halves inside it
  stay vanilla — `addEncounterFieldPickers` is shared with the React block rather than duplicated,
  and the targets list is a `ListPicker`, which stays vanilla by a standing decision — so this port
  is the dialog chrome and nothing else.

  Three things the first consumer forced, all of which the next one inherits:

  **`headerChildren`.** The preset picker sits beside the title with `order-first`. It was already
  named as the axis two callers need; this is the one that needed it first.

  **`keepMounted`.** Vanilla built this modal once and left it in the DOM (`disposeOnClose: false`).
  A Base UI dialog unmounts when closed, and `parity.mjs` compares the modals under `.sim-ui` as a
  set — so without it the port is a diff on every spec.

  **A named portal.** With a `container`, Base UI's portal renders a wrapper of its own, and unnamed
  it is a classless `<div>` among the sim root's children that no gate can pick out. `Dialog` now
  gives it `sim-dialog-portal`, and `parity.mjs` treats that one class as the whole dialog: it is
  the Base UI counterpart of a Bootstrap `.modal`, placeheld the same way so the placeholder count
  stays aligned as modals port one at a time. The two sides' dialogs are then excluded from the
  set comparison — different markup by design — and each side is *required* to have exactly one, so
  reverting the port fails rather than passing quietly.

  The stylesheet merge was one selector, `.modal-body` → `.sim-dialog-body`. The gate for all of it
  is `encounter.mjs`, which went shape-agnostic a commit earlier; its one imprecision surfaced
  immediately, since it asked whether a backdrop *existed* — true for Bootstrap only while open, but
  permanently true for a kept-mounted Base UI dialog. It asks whether it is shown now.

- 2026-09-06 **The Base UI `Dialog` adapter exists, with no consumer yet** — deliberately: the point
  was to establish the contract and find where Base UI cannot reproduce Bootstrap, before a port is
  riding on it. Every box in all four sizes was measured pixel-identical to vanilla in a throwaway
  harness. Class names are ours, not `.modal-*`: those rules read `--bs-modal-*`, which Bootstrap
  emits inside `.modal` and nowhere else, so a portaled popup wearing `.modal-body` would get an
  empty padding rather than 1.25rem. A `--modal-*` family joins the seam.

  **The finding that changes how every dialog gets mounted: a body portal escapes the spec theme.**
  `scss/sims/sim.scss` applies `theme-color()` to `.<spec>-sim-ui`, so `--bs-primary`,
  `--bs-primary-dampened`, `--bs-hover-color` and the `--theme-*` set only resolve inside `.sim-ui`.
  Vanilla modals are children of `simUI.rootElem` and inherit it. Measured on `warrior/arms`: a
  `.btn-primary` inside a body-portaled dialog is Bootstrap blue on white; inside a `.sim-ui`
  portal it is the spec's brown on black, and three of those properties do not resolve at all
  outside. Hence the `container` prop. Any dialog whose *contents* use `.btn-primary` or a
  `--bs-primary*` must pass it.

  **Four vanilla behaviours that do not survive, all measured.** `BaseModal` never gave `.modal` a
  `tabindex`, so Bootstrap's `_element.focus()` was a no-op and focus stayed on the trigger — Base UI
  focuses the close button, which vanilla styled with no focus ring, so one was added under
  `:focus-visible`. Bootstrap put `role="dialog" aria-modal="true"` on the wrapper and left the
  title unreferenced, so the dialog had no accessible name; Base UI supplies `aria-labelledby` and
  aria-hides siblings instead. The title is an `<h2>`, not an `<h5>`. And vanilla capped
  `.modal-dialog` at the viewport height while only `.modal-content` scrolled, so a tall non-scroll
  modal painted its border at 671px with the body spilling below it — merging the two elements ends
  that, and the content is equally reachable either way.

  **Vanilla defects found while reading, reported not fixed.** `preventClose` modals are permanently
  2% oversized: `.modal-static` is Bootstrap's transient shake class and `base_modal.tsx` sets it
  once at construction, so the `scale(1.02)` never comes off. `onHideCallbacks` is never cleared, so
  every reopen of a `disposeOnClose: false` modal pushes four more entries. `closeButton.fixed` and
  `header: false` have zero callers.

  **What the first consumer will have to widen.** `headerChildren` — two callers put content beside
  the title. `disposeOnClose` → `Portal keepMounted`. `shown.bs.modal` → `onOpenChangeComplete`. And
  the big one: nine stylesheets select `.<cssClass> .modal-body`/`-header`/`-footer`, so each port is
  a stylesheet merge rather than a class rename. Stacked modals are real today — `item_list.tsx`
  builds a `FiltersMenu` from inside `SelectorModal`, which is what the backdrop-relocation hack
  existed for; Base UI nests natively.

- 2026-09-06 **The sim title dropdown is Base UI too, and the one thing it fights the library over
  is documented in its stylesheet.** `Menu.SubmenuRoot` per class, `Menu.LinkItem` per spec so each
  stays a real, middle-clickable link. `.sim-title` left `ShellDom`.

  Opening a submenu makes Base UI mark the rest of the floating tree inert (`markOthers`), and the
  parent menu's rows come back `pointer-events: none` — so you could open one class and then not
  move to another, which is the whole point of the menu. `modal={false}` does not lift it and
  `SubmenuRoot` has no `modal`. One scoped `!important` on `[data-base-ui-inert]` restores it.

  **The cost that was feared is not real, and this corrects an earlier note here.** `markOthers` was
  assumed to also set `aria-hidden` on the parent, which would have made the class list
  mouse-reachable and invisible to a screen reader. Measured: `aria-hidden` is `null` and there is no
  `inert` attribute — `data-base-ui-inert` is a marker with an inline `pointer-events` style, and
  overriding it costs nothing.

  `parity.mjs` drops the baseline's menu subtree, all 361 lines of it: Bootstrap built every class
  and every spec into the page up front and Base UI renders a popup only while it is open.
  `sim-title.mjs` covers them instead, and it landed a commit *before* this one — it walks all eleven
  classes and compares every spec link's tag, colour, label, title, launch status, href and icon.
  Identical on both ports.

- 2026-09-06 **The header's import/export dropdowns are Base UI `Menu`s — the last Bootstrap JS in
  the header is gone.** Styling was re-expressed rather than inherited: the popup portals to
  `<body>`, so no header selector reaches it and `--bs-dropdown-*` resolves to nothing (those are
  emitted inside `.dropdown-menu`, a class this markup does not carry). New `--dropdown-*` tokens in
  the seam block, and the result measured identical against the baseline — same box, same
  background, border, radius, font, item padding, and the same `rgb(15,16,21)` on hover. One nudge
  was needed: Bootstrap's plugin default offset is `[0, -1]` and the stylesheet pulled the menu up
  another 2px, so `sideOffset={-1}` is what lands it on the same pixel.

  **Contents are a registry, not props.** `IndividualSimUI` registers the links from
  `addTopbarComponents()`, which runs on `waitForInit` — long after the shell renders. So
  `ImportExportRegistry` is a `useSyncExternalStore` source, the same answer `SimTabRegistry` gives
  for the tab strip. The `SimApp` test caught the classic footgun immediately: a mock whose
  `getEntries` returned a fresh `[]` each call is an infinite render loop, because snapshots are
  compared by identity.

  **One behaviour diverges and is recorded rather than fought.** Bootstrap's click data-API toggled
  a hover-opened menu shut and it *stayed* shut, because re-opening needed a fresh `mouseover` that
  a stationary pointer never sends. Base UI re-evaluates hover at once, so the menu reappears and a
  click on the trigger looks inert. Two fixes were tried — closing from a controlled `onOpenChange`,
  then disabling `openOnHover` until `pointerleave` — and both lost the race with Base UI's own
  hover scheduling. `header-toolbar.mjs` now *asserts* the pair (`base: false`, `react: true`) and
  prints `as-recorded`, so its output still matches across ports and either side changing it fails.
  Hover-to-open itself is identical: `openOnHover` with `delay={0}` is what the global `body`
  listener in `shared/bootstrap_overrides.ts` used to do.

  **`dropSubtrees` joins `collapseWrappers`.** A portaled popup exists on one side and nowhere on
  the other, so `pruneSubtrees`' placeholder would itself be the difference. It drops the baseline's
  two `<ul>`s outright and requires both to have been there. It is scoped by a `within` pattern for
  the reason the first unscoped run demonstrated: `ul.dropdown-menu` also describes the sim title's
  dropdown and the language picker, and dropping those reduced the whole shell comparison to noise.

  The item labels moved out of the probe's structure section into its behaviour section, read with
  the menu open — the only moment both shapes have them in the document.

- 2026-09-06 **Three deferred decisions answered, and `INTENDED` became one list with a ceiling.**

  Item swap's `<label class="form-label">` named the icon group rather than a control, so it is a
  `<span>` and the group carries `role="group"` + `aria-labelledby`. Verified in the browser: the
  reference resolves on the React build and there is no group role on the baseline.

  That divergence is in a *pane*, and `panes-parity.mjs` had no way to record one — it was strict
  byte equality. Rather than give it a second list, `INTENDED` moved to `tools/react-migration/
  intended.mjs` and both gates read it: `parity.mjs` owns the "every entry must still be observed"
  check because it is the gate that sees the shell *and* every pane; `panes-parity.mjs` enforces
  only each entry's `max`.

  **`max` is new and it matters.** `label.form-label` appears a dozen times in the settings pane and
  exactly one of them is meant to change. Without a ceiling the entry would quietly absorb the next
  eleven, which is an allowlist wearing an assertion's clothes. The helpers
  (`unexpectedLines`, `overusedIntended`, `unobservedIntended`) live in `browser.mjs` and were
  checked directly: one fold passes, two fold as "folded 2 lines, at most 1 expected", an unrelated
  diff is still reported, and an unobserved entry is still a failure.

  `useSimReady` moved to `app/hooks/`. It encodes a fact about this shell's init order, which a
  generic widget kit does not know — unlike `useStoreSubscribe` and `useActionId`, whose subject
  genuinely is domain state. That is the line, and it is now written down.

  `watchTargetDummies` has a test. The guarantee worth pinning is that arming it does not apply it:
  settings are restored on `waitForInit`, raid settings and talents separately, so a rule that
  applied itself on arm would zero a saved count against talents that had not arrived. Converting it
  to a `DerivedSetting` — whose contract is apply-then-subscribe — is the refactor the test exists to
  fail, and it does: making it apply on arm fails exactly that case and nothing else.

- 2026-09-06 **`simDropdownProbe`, landed before the `Menu` port rather than after it.** The header
  gate read Bootstrap's shape directly — a `.dropdown-menu` sibling that gains `.show`, and
  `data-bs-toggle` on the toggle — which is exactly the shape the Base UI `Menu` adapter removes. A
  gate that only understands the shape it is about to lose cannot say whether the replacement
  behaves, so the reader moved into `browser.mjs` beside `simTabsProbe` and now covers both: the
  menu is found by `aria-controls` first and a sibling lookup second, `aria-expanded` is the state
  signal both shapes share, and a popup that has been unmounted counts as closed rather than
  unknown. `toggles(root)` is scoped, because there are dropdowns outside the header.

  What this places on the `Menu` port, the same way the tab probe constrained the `Tabs` one: the
  toggle keeps its `import-link` / `export-link` class as its identity, and keeps `aria-expanded`.

  `header-toolbar.mjs` also moved onto `openSpec`, which needed a `route` option for the `/version`
  answer it was doing by hand. Output identical on both ports for `warrior/arms` and
  `priest/discipline`, and every section below `dropdowns` is byte-for-byte what it was.

  **Next unit is the `Menu` adapter itself** — import/export dropdowns first, then the sim title
  dropdown and the three dropdown pickers. It is Tabs-sized, not encounter-sized: new markup, its
  own SCSS, a `parity.mjs` normalisation for the changed subtree, and the hover-to-open behaviour
  that `shared/bootstrap_overrides.ts` currently supplies globally from a `body` listener keyed on
  `[data-bs-toggle=dropdown]` — which the ported dropdowns will no longer match, while the
  un-ported ones still need it.

- 2026-09-06 **Item swap ported.** Same shape as encounter: the settings tab hands `SimApp` a
  content-block body, React renders into it. Two things worth keeping:

  **The `hide` class is not a missed simplification.** The plan says eleven sites hand-roll
  "subscribe, then `classList.toggle('hide')`" on a container and that React deletes the idiom by
  rendering conditionally. It cannot here. `panes-parity.mjs` compares this pane element for
  element, and vanilla keeps those elements in the tree with a class on them — item swap ships
  disabled on every spec, so conditionally rendering would be a diff on all six gate specs. The
  class stays until the parity gate does.

  **`swapWithGear` moved to `features/item-swap/model/`**, like the encounter rules. It was a method
  on the view whose whole body is two store writes in a `batch`.

  New gate `tools/react-migration/item-swap.mjs`: toggles the checkbox and checks the class flips
  *both* ways, then clicks the swap button twice — the operation is its own inverse, and the readout
  is which slots the swap set holds, read off the icons' wowhead links. A first draft of it measured
  nothing at all (it read a `window.__simPlayer` that does not exist and printed `null` on both
  builds, which diffs clean); the icons were what actually moved. Identical on `warrior/arms` and
  `monk/windwalker`.

- 2026-09-06 **Encounter is ported — the first React feature living inside a vanilla tab.** The
  settings tab still builds its nine content blocks; `buildEncounterSettings` now builds an *empty*
  one and hands `SimApp` the body to portal into. That is the pattern the other eight will use.

  **Three things this unit teaches, all of which cost a debugging round:**

  **`SettingsTab.buildTabContent()` runs inside a `waitForInit` callback, not the constructor.** So
  the container does not exist when `SimApp` first renders, and `createPortal` into `undefined` is
  React error 299 — at load, with no other symptom, and every gate just times out waiting for the
  strip. `useSimReady(sim)` gates the portal. An effect registered there always runs after the
  shell's constructor has queued its own callbacks, which is what makes the ordering safe rather
  than lucky.

  **A vanilla island can sit *between* React siblings, but only because `showWhen` is a class.**
  The target-input `ListPicker` belongs above the advanced button, and `useLegacyMount` appends —
  so the mount moves it back with `insertBefore`, which works because a ref callback runs after
  React has committed that element's children. This is safe only while React's child list under
  that element is static, and it is: `useInput` renders `showWhen` as the `hide` class rather than
  unmounting, exactly as vanilla did. If a picker there ever renders `null` instead, React will
  re-insert it relative to its own next sibling and the island will end up on the wrong side.

  **Read the whole class before deciding what is live.** The old `EncounterPicker` had ~90 lines of
  commented-out pickers, and a live `EnumPicker` sitting in the middle of them. It got dropped, and
  `panes-parity` caught it as 15 missing elements with a first-diff line that pointed at the picker
  *after* the hole. `npc-picker` and `encounter-preset-encouter` — spelling vanilla's — are back.

  Two store writes left the view for `features/encounter/model/`, wired in `individual_sim_ui.tsx`:
  re-seeding the primary target's inputs from its preset, and zeroing the raid's dummy count when the
  player stops being able to enable it. Both are queued on `waitForInit`, in the position the
  picker's own callback held — after `loadSettings` — and both need that. The repair is against
  saved state, so it has to see it. The dummy rule must not be *armed* during the restore at all:
  raid settings and talents come back separately, so a rule reading `shouldEnableTargetDummies()`
  between them would zero a saved count against talents that had not arrived yet. Registering it in
  the constructor instead — which is where a `DerivedSetting` would put it — reintroduces exactly
  that window.

  `durationConfigs`/`executeConfigs` are shared with the still-vanilla `AdvancedEncounterModal`,
  which builds the same two `.picker-group`s into its header. Sharing the configs rather than
  copying them is what stops the two stacks drifting while both exist.

  New gate `tools/react-migration/encounter.mjs`: the block's children, its picker ids and its
  groups, then the modal opened by clicking and closed by Escape. It caught a bug in itself first —
  `BaseModal`'s `rootCssClass` lands on the `.modal-dialog`, while Bootstrap puts `show` on the
  `.modal` that wraps it, so reading the dialog's own classList reports "closed" forever. Identical
  on both builds for `warrior/protection` and `monk/windwalker`.

- 2026-09-05 **A tooltip's content is already reachable by keyboard — do not re-raise this.** It
  looked like a gap: react-tooltip does not render the tooltip until it opens, and no call site
  writes `aria-describedby`. The library does it itself. Its default `openEvents` are
  `{mouseenter, focus}`, so tabbing to a control opens its tooltip; while open it sets
  `aria-describedby` on the active anchor and removes it on close; and the tooltip node carries
  `id={id}` and `role="tooltip"`. Measured on `priest/discipline` (the only spec where the
  known-issues link is visible): focus the cog or that link on either build and the attribute
  resolves to the text. The React port is in fact ahead — tippy's node has no `role`.

  `a11y.mjs` asserts the chain rather than trusting the reading: per region it focuses the first
  *visible* tooltip anchor and requires `aria-describedby` to resolve to a `[role="tooltip"]` node
  with text. Verified by breaking it — passing `openEvents={{mouseenter: true}}` (the obvious fix for
  a tooltip that flashes while tabbing past) makes three regions fail and the gate exit 1. On the
  baseline that half reads as skipped, because tippy anchors carry `data-tippy-content`, not
  `data-tooltip-id`.

  The bonus-stats `±` button did have no name, and now reads "Add bonus Strength" from a new
  `sidebar.character_stats.bonus_action` key (en + fr + `schemas/translation.schema.json`, whose
  `additionalProperties: false` makes the schema part mandatory). Its existing `label` names the
  *value* — right for the picker inside the popover, not for the control that opens it. `Icon`
  already emits `aria-hidden` unless given a `title`, so nothing else was needed.
  `.sim-sidebar-stats` is now a region in `a11y.mjs`, and it was clean apart from that one button.

- 2026-09-05 **The sidebar's social links are React too, and every clickable in the header now goes
  through `Button`.** `SocialLink` is one component for both places — it renders the anchor and
  nothing around it, because what wraps it is exactly what differs (the toolbar's
  `div.sim-toolbar-item`, the sidebar's nothing). `SOCIALS` moved to `@sim/constants/other`
  beside the `REPO_*` URLs it already used. The vanilla `SocialLinks` class is deleted;
  `sidebarSocials` left `ShellDom` the way `toolbar` did.

  **`Button` gained an `unstyled` variant**, which emits no `btn` class at all. Without it the rule
  "every `<a>`/`<button>` is a `Button`" could not reach the header: those controls carry their own
  classes and none of Bootstrap's button styling, so routing them through `Button` would have
  restyled the whole toolbar. Everything else `Button` does still applies to them — the `<a>` vs
  Base UI `<button>` split, and the `type` default. Base UI's `useButton` also adds `tabindex="0"`
  to a native `<button>`; redundant, behaviourally identical, and not removable from the outside.

  **One SCSS change, and it is load-bearing.** `.sim-sidebar-socials` was
  `& > *:not(:last-child) { margin-right }` and is now `gap`. react-tooltip renders *in place*, so
  an open tooltip becomes a child of that container — under the old rule it would have taken
  `:last-child` off the last link and given it a trailing margin, shifting a centred row the moment
  you hovered. `gap` cannot be disturbed by an out-of-flow child. Measured identical: container and
  all three links at the same box on both builds.

  The accessibility checks moved out of `header-toolbar.mjs` into `a11y.mjs`, one region per area
  React owns (`.sim-toolbar`, `.import-export`, `.sim-sidebar-socials`). `header-toolbar.mjs` goes
  back to being byte-identical on both ports, which is easier to reason about than a probe with one
  block that is meant to differ. Point `a11y.mjs` at `PORT=3401` to read the baseline: 8 checks
  fail there, and that output is the list of findings the port fixed.

- 2026-09-05 **The header toolbar is React** — known issues, bug report, download binary, the cog
  and the socials. `SimHeader` keeps only the two import/export dropdowns, which wait on the Base UI
  `Menu` adapter, plus `openSettings()`; everything else it built is gone. Three things are worth
  knowing:

  **`ShellDom` shrinks as containers become React's.** `toolbar` left the bundle in this commit.
  Handing out an element whose children React reconciles is how you get the "half React, half
  `appendChild`" bug the `SimShell` docstring warns about, so a container is removed from the
  interface at the moment its contents are ported, not later.

  **Callbacks, not the `simUI` object.** `SimApp` passes `onOpenSettings` down; it closes over a
  `simUIRef` filled in the same layout effect that constructs the shell, so the arrow is created once
  with the memoised element and the toolbar's props never change identity. `SettingsMenu` is still
  built eagerly in `SimHeader`'s constructor — building it on first click would drop a modal out of
  `parity.mjs`'s set comparison.

  **`knownIssues` widened to `Array<ReactNode>`** — the one authorised change to the frozen spec
  surface, taken deliberately. `SimUI.addKnownIssues` used to prepend the launch-status notice *into
  `config.knownIssues` itself*, mutating that surface on the way past; `knownIssuesFor` derives the
  list instead. Vanilla rendered each issue with `innerHTML` because "the issue text can contain
  stringified HTML" — no spec currently does, and rendering as text would have quietly closed the
  door, so the field now carries content rather than markup.

  Gates: `parity.mjs` green on all 6 specs and `header-toolbar.mjs` byte-identical on `warrior/arms`
  and `priest/discipline` — the second because it is unlaunched, which is the only way the
  known-issues link is visible and its tooltip comparable.

  **What the flag-it rule produced on its first run**, all three approved and fixed: every icon-only
  control in the header had no accessible name (the glyph is a private-use codepoint and the tooltip
  is a `data-` attribute nothing reads), every `target="_blank"` had no `rel`, and the dropdown
  buttons had no `type`. The tooltip string is now the `aria-label` on any item with no text of its
  own, every `<i>` is `aria-hidden`, and both are invisible to `parity.mjs` — it compares structure
  and says so explicitly. So `header-toolbar.mjs` grew an `accessibility` block of PASS/FAIL checks,
  which is the *only* part of that probe meant to differ between the two builds: everything above it
  stays byte-identical, and the probe exits non-zero when a check fails against the React port.
  Reading it against the baseline prints the findings themselves.

- 2026-09-05 **Talents is the first feature ported end to end.** `TalentsPicker` is React
  (`TalentTreePicker` and `TalentPicker` are their own files, helpers in `utils/`), the vanilla view
  is deleted, and `PetSpecPicker` is wired — which is why `TalentsPicker` had to go first: an
  imperative mount always appends, so a React sibling would have landed before it and flipped the
  panel's order. `GlyphsPicker`, `CopyButton`, `PresetConfigurationPicker` and the two
  `SavedDataManager`s stay vanilla behind `useLegacyMount`, each because something *else* still
  consumes it. `PickerShell` gained a root `ref` for exactly that: a picker whose vanilla constructor
  appended into its own root needs somewhere to put it, and a ref callback runs after React has
  committed that element's children, so the append lands in the right place. Three dead members went
  with the port — a `zIndex` accessor pair, `getTalent(location)`, and an `isPlayer()` gate that the
  React props type makes always true. Gate: `talents.mjs` byte-identical on warrior *and* hunter,
  the second because `PetSpecPicker` renders for no other class.

- 2026-09-05 **Base UI owns the top-level tabs** (`838991da1`), and no Bootstrap class is left on
  them. The styles were copied onto Base UI's markup rather than reused, and the result is
  pixel-identical to the parent branch at rest and after keyboard navigation — a diff harness caught
  two mistakes that no DOM gate could (a height that used to resolve against a wrapper `<li>`, and a
  focus ring the baseline has). The fade is `[data-starting-style]` plus `keepMounted`'s `hidden`
  attribute, so it stays enter-only with no animation dependency. Panels adopt their panes rather
  than being them, forced by the `TabsPanel` id defect. Commits 4 and 5 of the sequence are closed
  out above rather than left open.

- 2026-09-05 **Base UI `Tabs` accepted, and commit 1 landed.** Keeping Bootstrap's markup was
  rejected as a permanent position. `SimTab` and `SimUI.addTab` no longer build nav items;
  `SimTabs` renders the strip into the header's `<ul>` through a portal, markup byte-identical, so
  `parity.mjs` still matches the parent branch. Two quirks are carried deliberately and die with the
  swap: `addTab` puts `aria-controls` on the list item where `SimTab` puts it on the button, and a
  tab title is a translation string that may carry markup (`bulk_tab.title` is
  `Batch (<span class="text-success">New</span>)`), which the old innerHTML path rendered as HTML —
  rendering it as a text child silently dropped the span, and parity.mjs caught it as 3958 elements
  becoming 3957. Everything verified in `node_modules` is in the section above, including a Base UI
  defect that decides the design.

- 2026-09-05 **`SimHostProvider`, and two conventions.** Ambient `host`/`player`/`sim` through
  context instead of threading them down every level — `CharacterStats` now takes no props. The
  value is deliberately stable references only; the reasoning is in its own section above and it is
  the thing to get right, because a context that carried store state would re-render every consumer
  on every notification. Conventions recorded at the user's request: one component per file, arrow
  syntax for components. Zero DOM change — `parity.mjs` and `sidebar-popover.mjs` both unchanged.

- 2026-09-05 **Phase 3 unit 1: the sidebar.** `CharacterStats` is React, portalled from `SimApp`
  into the container `IndividualSimUI` builds, and its stylesheet is co-located. The vanilla view is
  deleted — a feature view is not dual-stack, only `ui-kit` primitives are. The port paid for itself
  immediately by surfacing a `Tooltip` defect that had been there since the component landed and
  that every unit test was blind to: `.sim-tooltip { opacity: 1 }` killed react-tooltip's closing
  transition, so a closed tooltip stayed mounted forever and the picker inside it never got the blur
  that commits. `sidebar-popover.mjs` now runs green against both builds, line for line.

- 2026-09-05 The two questions blocking the sidebar port were answered in a browser rather than
  argued about, and one of the standing answers was wrong. `tools/react-migration/sidebar-popover.mjs`
  opens the bonus-stat popover, types into the picker inside it and closes it four ways. The sidebar
  does **not** clip the popover — `position: absolute` resolves against `aside.sim-sidebar`, which is
  sticky and outside the scroller — so the planned `positionStrategy` pass-through is not needed.
  Every close path commits the half-typed value, on both stacks and for the same reason: a focused
  input that is removed or hidden gets blurred, and blur fires `change`. The React half was measured
  too, with the real `Tooltip` under the dev server, because the ordering of React's DOM removal
  against its effect cleanups decides it; `onBlur` would not have worked and looks like it would.
  Both findings sit in the readiness section. The only prerequisite left for unit 1 is the
  `createPortal` mount.

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
  query the DOM. Out of that came `mountBoth` (`ui/ui-kit/testing/PickerOracle.tsx`): check 1 run
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
