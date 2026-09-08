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
links, the sidebar's character-stats table and the talents and settings tab bodies. The header is
finished: the import/export dropdowns are Base UI `Menu`s, and no Bootstrap JS is left in it. The
remaining four tab bodies are vanilla `Component`s.

Branch `feature/ui-react`, worktree `~/personal/wowsims-mop-react`, targeting `master`. It carries
`feature/ui-restructure` inside it: that branch is never merged on its own, so every gate compares
against master.

| Phase | State |
|---|---|
| 0 — JSX coexistence, React 19, store hooks, LegacyHost, vitest, hook lint rules | **done** |
| 1 — React root, React-owned top-level tabs (same DOM) | **done** |
| 2 — ui-kit primitives land *beside* the vanilla ones | done for everything Phase 3 needs so far; `Menu` landed with the header dropdowns, `Dialog` with the exporters and `ProgressTrackerDialog` with stat-weights; `Toast` and the three dropdown pickers wait for their first consumer |
| 3 — features port inward, easiest first | **done:** sidebar/character-stats, shell sequence C0–C6, encounter, item-swap, header dropdowns and sim title on Base UI `Menu`, settings, import-export, stat-weights, and all six saved-data slots. **Partly done:** gear (tab body, the three summaries, `ItemCell`, `GearPicker` — `item_list.tsx` and `selector_modal.tsx` are the remainder) and talents (tab body, `GlyphsPicker`). **Remaining:** bulk, apl, results, and gear's two big files |
| 4 — island wrappers (combat replay, Chart.js, VirtualList) | `VirtualList` **built** on `@tanstack/react-virtual`, waiting on `item_list.tsx` or `log_view.tsx` to have a consumer; combat replay and Chart.js not started |
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
| **Rotation** | 299 | apl 2,925, `CooldownsPicker`, `TextDropdownPicker` | `Menu`; the APL pickers are `ListPicker`-based, so islands |
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
  today, and three of them read the live document while building
  (`detailed_results.tsx:219,379`, `rotation_view.tsx:262`).
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

**Three nested Bootstrap tab strips stay** — `bulk_tab.tsx:219` constructs `new Tab(...)`, and
`detailed_results.tsx:122` and `selector_modal.tsx:632` carry `data-bs-toggle="tab"`. They still need
`.nav-link`, `.tab-pane`, `.fade`, `.show` and `_bootstrap_style_overrides.scss:198-226`, so none of
that may be deleted. Removing Bootstrap's tab plugin entirely is a separate, larger port.

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
| `ContentBlock` | `ui/ui-kit/ContentBlock/` | `ui-kit/content_block.tsx` (still live, dual-stack) — the nine settings blocks are React now, the other nine sites are gear, apl and bulk | `className` (a clsx `ClassValue`, so array notation works), its own `ContentBlockConfigProps` — `header` (`title`, `className`, `titleTag`, `tooltip`) and `bodyClassName` — `children`, `headerChildren`, `bodyRef`/`headerRef` | the header/body markup and the header-only-when-non-empty rule |
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
| `useStoreSubscribe` | `ui/ui-kit/hooks/useStoreSubscribe.ts` | — (binding) | a `StoreSubscribe` + a read | binding existing subscriptions to a component |
| `SocialLink` | `ui/app/SocialLink/` | `app/header/social_links.tsx` (**deleted** — both consumers ported) | one `Social` from `SOCIALS` (`@sim/constants/other`) | the anchor, its tooltip and its accessible name. It renders the link and **nothing around it**, which is the axis that varies: the toolbar wraps each in `div.sim-toolbar-item`, the sidebar does not |
| `EncounterPicker` | `ui/features/encounter/components/EncounterPicker/` | the `EncounterPicker` class in `features/encounter/view/encounter_picker.ts` (**deleted** — one consumer) | `showExecuteProportion`; everything else comes from the host | the block's field order, and that the target-input list and the advanced modal are still vanilla |
| `ItemSwapPicker` | `ui/features/item-swap/components/ItemSwapPicker/` | `features/item-swap/view/item_swap_picker.tsx` (**deleted** — one consumer) | `itemSlots`, `note` | the toggle, the swap button, and that the icon pickers are the group's own children |
| `ImportExportMenu` | `ui/app/header/ImportExportMenu/` | Bootstrap's dropdown plugin + `SimHeader.addImportExportLink` | `kind`, `icon`, `title`, and the registry it reads — whose entries are *either* a vanilla `open()` or a React dialog it renders | the popup's markup and styling, that the contents arrive asynchronously, and which dialog is open |
| `Dialog` | `ui/ui-kit/Dialog/` | `ui-kit/base_modal.tsx` (still live, dual-stack — ~15 subclasses) | `size`, `title`, `header`, `footer`, `preventClose`, `scrollContents`, `cssClass`, `container`, and `elevated` | the header/body/footer stack, the close button, and that the popup is the merge of `.modal-dialog` and `.modal-content` |
| `Popover` | `ui/ui-kit/Popover/` | `tippy({ interactive: true, trigger: 'click' })` — the reforge settings panel's `buildContextMenu`, **deleted**; `ReforgePanel` is the consumer | `trigger`, `triggerClassName` and `triggerProps` (the trigger is the only element the popover puts in the page's flow); `open`/`onOpenChange`, both optional, so omitting them gives an uncontrolled popover the trigger drives; `className` on the popup, `container`, `side`/`align`/`sideOffset`, and `initialFocus` | that it is `Popover` and not `Menu` — the content is a form, not items — `modal={false}`, the tooltip-token box tippy drew, and that closing unmounts the children |
| `CopyButton` | `ui/ui-kit/CopyButton/` | `ui-kit/copy_button.tsx` (still live, dual-stack — `import-export/view/exporter.tsx` is the un-ported caller) | `getContent`, `className` (a clsx `ClassValue`), `text`, `tooltip`, `onCopied` (vanilla's `postClickEvent`) | the `copy-button` class the vanilla `Component` root carried, the `btn`-with-no-variant shape (`variant={null}`, so a caller's `btn-outline-primary` is not doubled), and the no-clipboard branch the hook does not carry: `navigator.clipboard == undefined` alerts the payload, never enters the copied window, and alerts again on a second click. Composes `useCopyToClipboard` |
| `GearChangeIcon` | `ui/features/gear/components/GearChangeIcon/` | `features/gear/view/gear_change_icon.tsx` (**still live** — `bulk/view/bulk_sim_results_renderer.tsx` is its second caller, and bulk ports last) | `slot`, `item`, `previousItem` | the frame markup, the reforge marker's `d-none` rule, and `gearChangeSockets`, which walks the **previous** item's sockets so a slot that gained one reports it unchanged. Reuses `useActionId`, `useWowheadDataset` and `Tooltip`; deliberately not `GemSocket`, whose anchor-plus-two-`<img>` shape shows gems where this shows empty sockets with an exclamation marker. `_gear_change_icon.scss` stays global, because the vanilla twin renders the same classes from bulk |
| `ReforgePanel` | `ui/features/reforge/components/ReforgePanel/` | `features/reforge/view/reforge_panel.tsx`, **deleted** (1,019 lines) | nothing — it is the feature's own shell, portalled from `SimApp` into `simUI.reforgeActionsContainer` | the sidebar button, the `Popover` and its five sections, and the run outcome (toast, `ProgressTrackerDialog`, gear change icons). `simUI.reforger` is now `ReforgeOptimizerModel`, which is what its four readers always wanted |
| `ProgressTrackerDialog` | `ui/ui-kit/ProgressTrackerDialog/` | `ui-kit/progress_tracker_modal.tsx` (still live, dual-stack — three vanilla consumers, one of them in frozen `ui/specs/**`) | `title`, `className`, `warning`, `hasProgressBar`, `onCancel`, `container`, and the discrete `state` (`stage`, `message`) | that it cannot be closed, the elapsed-time readout, and the split the twin exists for: `stage` is React state, and what a worker message moves goes through `ProgressTrackerHandle.setProgress` — the clock stays a DOM write, the bar is now local state in `ProgressTrackerBar` (Base UI `Progress`), so a tick commits that leaf and never the dialog |
| `EpWeightsDialog` | `ui/features/stat-weights/components/EpWeightsDialog/` | `EpWeightsMenu` in `features/stat-weights/view/stat_weights_panel.tsx` (**deleted** — a feature view, not a dual-stack primitive) | `opener` and `settings`; everything else comes from the host | the 13-column table, the EP-ratio row, the reference selects, and that the saved-EP-weights manager is a vanilla island because the reforge panel is its second consumer |
| `useCopyToClipboard` | `ui/ui-kit/hooks/useCopyToClipboard.ts` | the copy half of `ui-kit/copy_button.tsx` (still live — the log exporter view and the reforge panel keep it) | **nothing about the button** — each caller renders its own `Button` with its own class, label and tooltip, which is the only axis its three consumers varied on. `CopyButton` now wraps this hook rather than competing with it — reach for the hook when a caller renders its own button, and for the component when it wants the vanilla one's shape | the copy and its feedback: `getContent` read at click time (one caller lazily re-exports and fires analytics inside it), the vanilla 1.5s copied window, and a re-entrancy guard held in a **ref** — state has not flushed when a second click lands in the same task, so a state guard copies twice. Wraps `react-use`'s hook |
| `useWowheadDataset` | `ui/ui-kit/hooks/useWowheadDataset.ts` | the `data-wowhead` effect in `GlyphPicker` (converted); all five call sites converted | the target ref and a resolver returning the url, `null` when nothing is selected | clearing the attribute before each resolve, and dropping a resolution that lost the race. `resolve`'s identity is what says the selection moved, so an inline arrow re-clears every render |
| `SearchBar` | `ui/ui-kit/SearchBar/` | the search `<input>` hand-rolled in `gear/view/item_list.tsx`, `bulk/view/bulk_item_search.tsx` and `results/view/log/search/search_bar.tsx` (all three still live, dual-stack — only `GlyphSelectorDialog` adopts today) | `value`/`onChange`, `label`, `debounceMs` (0 by default — bulk, gear and glyph never debounced, the log hand-rolled 150 ms), `clearable`/`clearLabel` (bulk's only), `placeholder`, `id`, `autoComplete`, `autoFocus`, and `className` — applied to the `<input>` itself so a caller's squatting global class (`.selector-modal-search`) still targets the real control | `Field.Root`/`Field.Label` wrapping via Base UI, the native `form-control` input, and — when `clearable` — that the clear button lives inside the input group and clears through one call |
| `useReadyStoreSubscribe` | `ui/ui-kit/hooks/useReadyStoreSubscribe.ts` | the hand-rolled gate in `SavedSettings`, written the night the un-gated version crashed the app | `subscribe`, `read`, and `ready`; returns `T \| null` | **both halves of the guard**, which is the point — gating the read alone leaves `useStoreSubscribe`'s cached `null` in place until something else changes the subscription, so `ready` is folded into the subscription's identity too. Reach for it whenever a snapshot touches `sim.db`, which is null until init: `useSyncExternalStore` calls `getSnapshot` on the first render, long before any `useSimReady` gate |
| `useTypedLocalStorage` | `ui/ui-kit/hooks/useTypedLocalStorage.ts` | the raw `react-use` `useLocalStorage<T>()` call in `SavedEpWeights` | a storage `key` and a **required** `parse: (value: unknown) => T \| undefined` | the deserializer only — `react-use` still owns read/write/remove. `parse` is required because react-use's generic types the deserialized value as `T` with no proof, so a stale key from an old schema comes back typed as the new shape. Anything `parse` rejects folds into the same `undefined` react-use already returns for an absent key, so callers keep one falsy state instead of two. Its one consumer is now `useSavedData`, which is what components reach for |
| `useSavedData` + six named proxies | `ui/ui-kit/hooks/useSavedData.ts`; `use{SavedEpWeights,SavedGear,SavedTalents,SavedRotation,SavedSettings,SavedEncounter}` under each feature's `hooks/` | the storage half of `ui-kit/saved_data_manager.tsx` (still live, dual-stack — five of the six slots are its vanilla islands) | **the key and the codec, and nothing else.** Every generated `MessageType` satisfies `SavedDataCodec` structurally, so a named proxy is one line: `useSavedData(host.getSavedGearStorageKey(), SavedGearSet)` | the record shape (`Record<name, toJson(data)>`, what `SavedDataManager` has always written), per-entry parse with warn-and-skip, the `json` string entries are compared by, and `save`/`remove`. **Not** presets, which come from config, and **not** identity — `SavedDataManager`'s optional `equals` exists because rotations cannot be compared by their JSON, so a rotation consumer will need that axis back |
| `SimRuns` / `useSimRun` / `useStatWeights` | `ui/sim/sim_runs.ts`, `ui/sim/hooks/` | the abort-then-run preamble copied at each entry point, and `EpWeightsDialog`'s `running` state plus its two guard refs | `useSimRun(kind)` takes only the kind and returns `isRunning`/`isAborting`/`abort` — **no `start`**, so a run can only be begun through a named hook that knows its arguments; `useStatWeights({ onProgress })` binds `computeStatWeights`'s three arguments and its progress shape | that a run is one user-visible operation rather than one worker request, that its two flags live in the store beside every other piece of sim state (so vanilla reads them through `subscribeRunState` and React through `useSyncExternalStore`), and that progress never touches the store — it stays a callback, with `lastProgress` for a consumer that mounts mid-run |
| `VirtualList` | `ui/ui-kit/VirtualList/` | `ui-kit/virtual_list.ts` (still live, dual-stack — `item_list.tsx` and `log_view.tsx` are its two callers and neither has ported) | `count`, `rowHeight`, `overscan`, `getScrollElement`, `scrollMargin`, `rowClassName` and a `renderRow` render prop | that rows are a **fixed height and never measured** — `measureElement` re-renders on every row reporting a different height, which is an easy infinite loop and something the vanilla list never did either. **The DOM is deliberately different from the vanilla list**: `@tanstack/react-virtual` positions rows absolutely and moves them with `transform`, so there are no spacer rows and a row's sibling position is its position in the *window*, not the list. `:nth-child` striping therefore does not work — every row carries `data-index` and `data-stripe`, and stripes are styled off `[data-stripe='odd']`. Adopting it will need a normaliser in `parity.mjs`/`panes-parity.mjs`, which is why the primitive lands first and the consumers follow |
| `PresetConfigurationPicker` | `ui/app/PresetConfigurationPicker/` | the vanilla `app/preset_configuration_picker.tsx` (still live, dual-stack — `rotation_tab.tsx` is its fourth consumer and has not ported) | `categories`, and only that; the builds, the active check and the tooltip all come from the host | the chip markup, which is **not** `SavedDataPanel`'s: a `<button class="saved-data-set-chip">` wrapping a `<span class="saved-data-set-name" role="button">`, versus the panel's div-and-`Button`. Same class vocabulary, different elements, so it is a separate component rather than a `loadOnly` panel. Both share `preset_build_state.ts`, which is where `isBuildActive` and `buildCategories` live so the two stacks cannot drift. One `Tooltip` serves every chip through `render` + `activeAnchor`, replacing a `tippy()` per chip. Uses `useReadyStoreSubscribe`, because vanilla built its chips inside `waitForInit` and the active check has never run against an uninitialised sim |
| `SavedRotation` | `ui/features/apl/components/SavedRotation/` | the `SavedDataManager` in `rotation_tab.tsx`'s `buildSavedDataPickers` | nothing — key, codec, presets and subject all come from the host and `useSavedRotation` | the sixth and last saved-data slot, and the one that needed `SavedDataPanel`'s `isActive` override: an Auto and an APL rotation can serialise differently and still be the same rotation, which is why `SavedDataManager` carried an optional `equals`. It passes `isEqualAPLRotation` instead of relying on the JSON comparison |
| `SavedDataPanel` | `ui/ui-kit/SavedDataPanel/` | the rendering half of `ui-kit/saved_data_manager.tsx` (still live, dual-stack), extracted out of `SavedEpWeights` rather than written fresh | the strings (`title`, `label`, `nameLabel`, `saveButtonText`, and the four alert/confirm messages), the two entry lists, the subject's `currentJson`, and `loadOnly` | the chip rows, the presets/custom split and their `hide` toggles, the create row, the active-entry rule (last match wins, unless the user loaded one by name), and the confirm-before-delete. Deliberately sim-agnostic: a preset's `enableWhen`/`onLoad` arrive already resolved as `disabled` and `afterLoad`, so ui-kit never sees a `Player`. `SavedEpWeights` is now a ~70-line wrapper over it, and its parity test against the vanilla `SavedDataManager` still passes unchanged — which is what proves the extraction kept the markup |
| `SavedEpWeights` | `ui/features/stat-weights/components/SavedEpWeights/` | the `renderSavedEPWeights` call in `EpWeightsDialog` only — that helper **and** `ui-kit/saved_data_manager.tsx` both stay, because `reforge_panel.tsx` calls the helper with three options this component deliberately does not grow | nothing — storage key, presets and player all come from the host | the chip sections and their `hide` rule, the create row, and the active-check. Storage is `react-use`'s `useLocalStorage` on the shared key **the still-vanilla reforge widget also reads**, so its tests drive the real vanilla manager in both directions rather than hand-building JSON. Its focus rings are keyed on `.ep-weights-sidebar`, not a class of its own: the modal subtree is compared by tag plus sorted class list, so a stack-specific root class is a tree diff |
| `GlyphsPicker` | `ui/features/talents/components/GlyphsPicker/` | `features/talents/view/glyphs_picker.tsx` (**deleted** — one consumer) | nothing — the class comes from the host | the two blocks of three slots, the one dialog all six share, and that it **still wears** gear's `item-picker-*` and `selector-modal-*` class names to inherit those stylesheets, which stay global. Only the `.glyph*` rules co-located, checked by a before/after build rule-stream diff rather than by reading specificity |
| `AdvancedEncounterModal` | `ui/features/encounter/components/AdvancedEncounterModal/` | the `AdvancedEncounterModal` class in `features/encounter/view/encounter_picker.ts` (**deleted**) | nothing — `open`/`onOpenChange` only | the header's preset picker, and that its two halves are vanilla islands |
| `Exporter` | `ui/features/import-export/components/Exporter/` | `IndividualExporter` and its six subclasses (**deleted**); `view/exporter.tsx` stays for `LogExporter`, whose opener is in the un-ported log runner | `title`, `allowDownload`, `selectCategories`, `getData` — an `ExporterDefinition` from `features/import-export/exporters/` | the textarea, the copy button, the download button and the category row. `exporterDialog(def)` binds one for the registry, because `individual_sim_ui` cannot write JSX |
| `Importer` | `ui/features/import-export/components/Importer/` | `IndividualImporter`'s four concrete subclasses (**deleted**); `view/importer.tsx` and `IndividualImporter` stay for `BulkGearJsonImporter`, whose opener is in the un-ported bulk tab | `title`, `allowFileUpload`, `onImport` — an `ImporterDefinition` from `features/import-export/importers/` — plus the description, which is `children` | the description block, the textarea, the upload label and its hidden input, the import button, that a rejected `onImport` is an error toast with the dialog left open, and that a resolved one closes it. The four `*ImporterDialog.tsx` beside it bind one definition each and are not shared components: the description is JSX, so there is no `importerDialog(def)` binder to write |
| `ImportWarning` | `ui/features/import-export/components/Importer/ImportWarning.tsx` | `showImportWarning` in `view/importer.tsx` (**deleted**) | `titleKey`, `messageKey` | the pinned, undismissable warning toast, that its body is a real `<div>`, and its teardown — `Toast` is not a `Component`, so this is `useLegacyMount`'s shape written by hand |
| `MultiIconPicker` | `ui/ui-kit/MultiIconPicker/` | `ui-kit/pickers/multi_icon_picker.tsx` (still live, dual-stack) | the `MultiIconPickerConfig` it is given, plus `subscribe` and `onClear` as props — ui-kit can reach neither `useSimHost` nor `features/` | the option-list markup, hover-open at delay 0, and that clicking inside keeps the menu open |
| `IconEnumPicker` | `ui/ui-kit/IconEnumPicker/` | `ui-kit/pickers/icon_enum_picker.tsx` (still live, dual-stack — the cooldowns picker, in the rotation tab, is the last vanilla consumer) | the `IconEnumPickerConfig` it is given | the button-and-menu markup, that choosing an option closes the menu, and the button's `href`, which vanilla only ever overwrote. `iconEnumPickerShown(config, modObject)` is its `showWhen()` override, exported because a caller can need the answer without the picker |
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
| `SimResultsPanel` | `ui/features/results/components/SimResultsPanel/` | `features/results/view/results_viewer.tsx` (**deleted** — one consumer, a feature view), and with it the last importer of `ui-kit/sim_toolbar_item.tsx` (**deleted** too; `app/header/SimToolbar/ToolbarItem.tsx` had already superseded it everywhere else) | `panel` (the `ResultsPanelStore` the shell drives) and `warnings` (the `WarningsRegistry`); `disabled` and the healing flag come from the host | the four zones in order and the visibility table across them — `setPending` and `setContent` leave the button zone alone, `hideAll` takes it down without removing the button — plus the same split `ProgressTrackerDialog` exists for: the stage is React state, and dps, hps and the iteration counter are `textContent` writes off `ResultsPanelStore.onProgress`, never renders. **`.results-content` is rendered here and never given a React child**: `SimResultsManager` still `replaceChildren`s the finished topline into it, and its builder has three consumers, one the bulk renderer — which is why the running block renders inside `.results-pending` instead, and why the previous run's topline sits there hidden and inert for the length of the next run. Two seams are load-bearing and neither is visible to a browser gate: the store's `notify` is `flushSync`, because the run action reads the panel back in the click's own task, and `latestProgress` is a mutable field **outside** the `useSyncExternalStore` snapshot that `SimProgress` reads in a mount layout effect, because tick one carries both the stage change and the first numbers. Beside it: `SimProgress` (the running block and its three refs), `SimWarnings` (the zone, the `hide` toggle and the tooltip — read through `useStoreSubscribe`, because `getContents()` builds a fresh array per call), `AbortButton` (Stop, which `flushSync`es its own relabel and disable before calling the handler) and `UnlaunchedNotice` (folded in from `sim_ui.tsx`, so it can no longer render before the panel it is supposed to follow). Owns `SimResultsPanel.scss` — `.results-pending .loader` from `_sim_action.scss` and `.warning-zone [data-tippy-root]` from `_sidebar.scss`, re-keyed to `.warning-zone .sim-tooltip`; `.results-sim*` deliberately stays global, the bulk renderer emits it |
| `ItemCell` | `ui/features/gear/components/ItemCell/` | the cell shape nine sites hand-roll; it absorbs gear's own — `GearPicker`'s sixteen. `view/item_renderer.tsx` stays and stays dual-stack, because bulk's picker and its results renderer are un-ported callers and `glyphs_picker.tsx` is a talents island | the six axes the duplication survey found varying: the icon element and how its image is set, whether there is an item-level badge and whether it carries the `+N` upgrade span, what the name row holds, the enchant/tinker/reforge stack, whether there are sockets and what they do, and a trailing action slot. `ilvl` and `sockets` are three-state on purpose — omitted drops the element, `null` keeps the empty one an unfilled gear slot renders | the class vocabulary (`item-picker-root`, `-icon-wrapper`, `-ilvl`, `-sockets-container`, `-name-row`, `-name-container`, `-labels-container`) and the nesting order, and nothing else. That is the whole lesson of `ItemRenderer`, which fixed the icon, the badge, the name row, the sockets and the labels as well and was bypassed by seven of its nine callers. Beside it: `ItemCellAnchor`, which is how `href="javascript:void(0)"` ports — React refuses that URL, and an `<a>` with no `href` is not tabbable, so the anchor takes `tabIndex` and Enter/Space instead; and `GemSocket`, the socket anchor with its gem icon, its empty-socket icon and its Wowhead link. **No co-located stylesheet**: `.item-picker-*` is worn by `bulk_item_search`, `bulk_item_picker`, `gear_change_icon`, `icon_item_swap_picker`, `glyphs_picker` and `_suggest_reforges_action.scss`, so `_gear_picker.scss` stays global until they port |
| `GearPicker` | `ui/features/gear/components/GearPicker/` | `features/gear/view/gear_picker.tsx` (**deleted** — with `quick_swap.tsx`, `quick_enchant_popover.ts` and `quick_gem_popover.ts`) | `ready`, and only that: the shell's init order is the one thing a cell cannot read for itself, and `useSimReady` lives in `app/`, which features may not import | the two columns and their slot lists, and what each cell does — open the selector modal at the right tab, and the two favourites popovers. Beside it: `ItemPickerCell` (one slot), `EnchantLabel`, `ItemNoticeIcon`, and `QuickSwapList` / `QuickEnchantList` / `QuickGemList`. **The popovers read the store themselves**, inside `Tooltip`'s children, which react-tooltip does not build until the tooltip first opens: that is what keeps 16–64 `filters` subscribers off the pane, and it is also how the recorded stale-closure bug stays fixed — no `EquippedItem` is captured at all, `active` is derived at render and the click reads the slot again. Owns `GearPicker.scss`: the cells' `:focus-visible` rings, and `_quick_swap.scss` re-keyed from `.tippy-box[data-theme='tooltip-quick-swap']` to `.sim-tooltip.tooltip-quick-swap` — which needs `max-width: none`, because `Tooltip.scss` caps every tooltip at 192px and tippy capped nothing. The popovers render **inside** the cell, not beside it: react-tooltip's box lives in the React tree, and a sibling would take a child index in the column and move the `:nth-child(6)` weapon separator |
| `ItemSwapIcon` | `ui/features/item-swap/components/ItemSwapIcon/` | `features/gear/view/icon_item_swap_picker.tsx` (**deleted** — one consumer, and the last one) | `slot`, and only that: everything else is read from the host, and the picker renders only under `SettingsTabBody`'s `ready` gate, which is what replaces the vanilla `waitForInit` the click was wired inside | that a swap slot is a picker root with an icon button and a sockets container — **not** an `ItemCell`; that vocabulary is the gear cell's and the swap icon wears none of it beyond `item-picker-sockets-container`. Reuses `useActionId` (the `(setHref, setBackground) = (true, true)` pair the vanilla `fillAndSetActionId` passed, as `href` and `iconUrl`), `useWowheadDataset`, `GemSocket` and `getEmptySlotIconUrl`. Fixes four defects: the modal is the shell's one `itemSwapSelectorModal`, not one `new SelectorModal(simUI.rootElem, …)` per icon appended to an element React does not own; the `itemSwap` subscription's unsubscribe is no longer discarded; the last profession subscription is no longer stranded; and the icons paint their loaded state, which vanilla never did because `update()` only ever ran from an `itemSwap` change. And it un-nests, the way `IconPicker` did — vanilla built the sockets **inside** the icon anchor, so a gemmed swap set was anchors inside an anchor, which `a11y.mjs` allows none of on `.settings-tab`; `browser.mjs` carries the matching `LIFTED_SUBTREES` entry. Owns `ItemSwapPicker.scss`: the two `:focus-visible` rings and `position: relative` on the picker root, which is where the lifted sockets container now takes its containing block from. `_item_swap_picker.scss` **stays global** — `.item-swap-picker-root .icon-picker-button` and `.icon-picker .icon-picker-button` are both (0,2,0) and only source order separates them |
| `SummaryTable` | `ui/features/gear/components/SummaryTable/` | `features/gear/view/{gem,reforge,upgrade_costs}_summary.tsx` (**all three deleted** — one consumer each) | `title`, `className` (the block's modifier class), `headerClassName` (whether the header carries it too), `empty`, and what resetting means | the hidden-when-empty root, the `ContentBlock`, and the reset button's place in its header — the three-class vocabulary all three blocks agreed on. `SummaryTableRow` beside it fixes the row's own three classes. `GemSummary`, `ReforgeSummary` and `UpgradeCostsSummary` sit in the same folder and read `model/summary_totals.ts`. Owns `SummaryTable.scss`, co-located from `scss/core/components/individual_sim_ui/_summary_table.scss` — every class in it was gear's alone. **They render from state on the first paint**, where the vanilla blocks filled themselves only from a `gear` notification and so painted empty until one arrived |

Not yet built, in rough priority — see the plan for evidence and counts:
`ActionIcon`
(the `ActionId` dom writers), `FieldRow`, `PickerGroup`, `IconButton`.

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

## Conventions

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

**The batch gate is not a reason to prefer either — measured, not assumed.** The plan left open
whether React needs `subscribeGated` at all. `store.test.tsx` answers it: a `batch()` writing three
slices produces **exactly one render, gated and ungated alike**, because React coalesces
same-tick updates and the read happens at render time, after the batch has closed. The gate stays
because vanilla subscribers still need it, but nothing on the React side depends on it.

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
- `sticky_toolbar.ts` measures `.sim-header`'s `offsetHeight` *while the tabs are being
  constructed*, so the header must be laid out in the first render. A header that arrives one render
  later measures zero and the sticky offset is silently wrong.

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

**Some class names have squatters.** `bulk_item_search` and `gear_change_icon` reuse
`item-picker-ilvl` / `item-picker-sockets-container` while building their own markup, and
`pet_spec_picker` reuses the entire `talent-tree-*` / `talent-picker-*` vocabulary to piggyback on
the talent tree's stylesheet. Co-locating those styles silently breaks the piggybacker. Grep the
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
   bulk, ~~import-export~~, apl, gear, results. **~~stat-weights~~ is done** — all four units, the
   model and opener seams on 2026-09-06 and the React dialog plus its SCSS the same day, with all
   sixteen recorded defects fixed. The investigation is
   `.github/skills/wowsims-react/plans/stat-weights.md`, in this repo, units struck.
   **import-export is done** — the five header exporters
   landed first, the four individual importers followed. What is left of the feature is two dialogs
   whose openers live inside un-ported tabs and which therefore port with those tabs, not with this
   one: `LogExporter` (results, hands-off) and `BulkGearJsonImporter` (bulk). `view/exporter.tsx`,
   `view/importer.tsx` and `IndividualImporter` stay alive for exactly those two.

**Not queued, deliberately.** The three dropdown pickers could go on Base UI `Menu` now that the
adapter exists, but every one of their callers is still vanilla — a React picker with no consumer is
the thing Phase 2's rule exists to prevent. They port when a caller does.

## Change log (keep current — this skill documents itself)

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
  in `results/view/timeline/rotation/` wait for that subtree's port rather than being touched twice.

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
