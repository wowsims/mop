# Styling, state and locating elements

Source of truth: `ui/styles/style.css` (entry, `@utility`, `@source`), `ui/styles/theme/`
(tokens, split by type — `colors.css`, `spacing.css`, `breakpoints.css`, `typography.css`,
`effects.css`, `z-index.css`, `vars.css`, `specs.css`, imported via `index.css`),
`ui/styles/base.css` (element defaults, replaces Bootstrap's reboot), `ui/styles/vendor.css`
(the handful of selectors with no JSX element to carry them), `tools/tailwind/canonical-classes.mjs`
and `tools/tailwind/class-hooks.mjs`, `ui/no_class_hooks.test.ts`.

There is no SCSS and no Bootstrap left anywhere in `ui/` (`find ui -name '*.scss'` is empty; neither
HTML entry links anything but `style.css` and the FontAwesome CDN sheet). Every class in `ui/`
markup is a Tailwind utility, a `ui-*` composition class, one of a small fixed allowlist (`sim-ui`,
`<spec>-sim-ui`, `group`/`peer` and their named forms, FontAwesome's `fa`/`fas`/`far`/`fab`/`fa-*`,
and the two react-tooltip class-as-theme names), or a `data-testid`/`data-*` used only by tests and
tools. `ui/no_class_hooks.test.ts` enforces this — see "The gates" below.

## 1. Styling with Tailwind

Reach for a **named utility** first, including its variants and `!`-free forms. Arbitrary values
(`bg-[#123456]`, `text-[rgb(0,0,0)]`, `p-[10px]`) are a last resort, not a shortcut:

- **No arbitrary colours.** Every colour is a `--color-*` token in `ui/styles/theme/colors.css`'s
  `@theme static { … }` block, so it renders as `bg-primary`, `text-danger`, `border-surface-border`,
  and so on. If the colour you need has no token, add one to `@theme static` (named by role or hue,
  e.g. `--color-grey: #808080`) rather than writing `bg-[#808080]` — never drop a declaration because
  no token exists yet either; a missing visible property is a bug, not a simplification.
- **No arbitrary spacing where a scale step exists.** Tailwind's spacing scale in this repo is
  _dynamic_: any multiple of `0.25` is a legal step, so `p-1.25` is exactly 5px and `w-4.5` is 18px.
  Convert a source px value to its **exact** step (`gap-[4px]` → `gap-1`, `10px` → `p-2.5`, `5px` →
  `p-1.25`, `18px` → `w-4.5`) rather than writing `[Npx]` — see §7 for why a rounded/nearest
  conversion is not acceptable here. Keep a literal `[Npx]` only when no step lands on the value
  exactly, and prefer a token over a repeated arbitrary value. `1rem` is 14px at every width
  (`ui/styles/base.css`'s `--font-size-root`), so a converted step follows the root everywhere — a
  size the JavaScript relies on (the timeline, the log runner's virtual list, the combat replay) is
  pinned to an exact px value with a named `@theme` token instead, so it never scales with the root.
- **Canonical spelling only.** `node tools/tailwind/canonical-classes.mjs` runs Tailwind's own
  `designSystem.canonicalizeCandidates()` — the same function IntelliSense's "the class X can be
  written as Y" lint uses — over every `className`/`clsx`/`*ClassName` string and every `@apply` in
  `ui/`, and fails if any token isn't already in its canonical form (`data-stuck:` not
  `data-[stuck]:`, `scrollbar-none` not `[scrollbar-width:none]`, a bare-number or named form over a
  bracket). Run it with `--write` to auto-fix, or `--json` for tooling.
- **CSS variables in class names.** Never write `-[var(--x)]`. If `--x` is a `@theme` token, use its
  named utility instead — `--z-index-*` tokens generate `z-<name>` directly (`z-dropdown`,
  `z-modal`), no paren form needed. For a non-token var, use the paren shorthand:
  `w-(--loader-width,60px)`, `text-(length:--tab-font-size)`. `var()` stays inside a class name only
  inside a genuine multi-term `calc()`/`min()`/gradient, or an arbitrary property (`[prop:…]`) that
  has no utility form.

Breakpoints are named tokens in `ui/styles/theme/breakpoints.css`: `sm md lg xl xxl xxxl fhd qhd uhd`
(`576px` through `3841px`; `fhd` is the legacy `1080p` 1921px cutover, kept as a layout breakpoint even
though the root font-size no longer changes there). All breakpoints are px, so they never depend on
the root.

**Spec themes are CSS variables, not per-spec CSS.** `ui/styles/theme/specs.css`'s `.sim-ui` block
declares `--color-primary`/`--color-primary-foreground` from `--theme-color`/`--theme-color-foreground`, and
34 per-spec blocks (`.arms-warrior-sim-ui, .fury-warrior-sim-ui, … { --theme-color: var(--color-class-warrior); … }`)
set those two variables from the class-colour tokens. A component never needs a spec-aware variant —
`bg-primary`/`text-primary`/`border-primary` already re-theme per spec because the sim root carries
the spec's class. Derived shades (`--color-primary-hover/-active/-dampened/-disabled`) are
`color-mix(in srgb, var(--color-primary) …)` in `@theme static inline` — `inline` because they read a
var that's re-declared lower in the tree (see `ui/styles/theme/colors.css`'s comment-free but
documented block; the `inline` flag matters here specifically because plain `@theme` would resolve
`var(--color-primary)` at `:root`, before `.sim-ui` re-declares it).

## 2. `ui-*` composition classes

When a component needs a reusable multi-utility recipe, or a rule keyed on a state/descendant
selector Tailwind's utility-per-property model can't express cleanly, it gets a `ui-<component>-<part>`
class in a co-located `.css` file, `@import`ed from `ui/styles/style.css` (see the long list of
`@import '../ui-kit/…/X.css'` lines there — one per component that has one). Example,
`ui/ui-kit/Chip/Chip.css`:

```css
@layer components {
	.ui-chip {
		@apply rounded-full flex p-0 border border-primary text-white text-ui font-normal …;

		&:hover:not([data-active]) {
			@apply bg-primary-dampened;
		}

		&[data-active] {
			@apply bg-primary;

			& .ui-chip-delete {
				@apply text-primary-foreground;
			}
		}
	}
}
```

Rules:

- **A `.css` file selects only `ui-*` classes** — attribute (`[data-active]`), pseudo (`:hover`,
  `::after`), and element/descendant parts are allowed _inside_ a `ui-*` rule, but the file may never
  target a semantic hook class, a `data-testid`, or a raw element selector at the top level. The two
  exceptions are `ui/styles/theme/specs.css` (the spec theme selectors) and `vendor.css` (see below).
- Built with `@apply`, unlayered classes stay unlayered (until the global element rules that used to
  fight them are fully gone); the file itself lives inside `@layer components` in the ones written so
  far, matching the layer order declared in `style.css:1`.
- No comments — including lint-disable directives — in any `ui/` `.css` file, same rule as `.ts`/`.tsx`.
- Names are `ui-<component>-<part-or-variant>` for both kit and feature components, so they can never
  collide with a retired hook name; tests never locate elements by them (see §5).
- `@utility` is reserved for a handful of atomic, non-component patterns where every carrier is
  enumerable and nothing else on any carrier sets the same properties. Only five exist today, all in
  `ui/styles/style.css`: `text-fluid-xl`/`text-fluid-5xl` (RFS-style fluid headings), `interactive`
  (cursor + user-select), `icon-sm` (a fixed icon box), `focus-ring`/`focus-ring-inset` (the
  outline-based focus treatment), and `active-underline`/`fade-in-out` (an animated underline and a
  Base UI enter/exit fade). Don't add a sixth without the same proof: enumerate every element that
  will carry it, and show nothing else touches those properties there.
- Native CSS nesting (`&:hover`, `&[data-active]`, `& .child`, `.parent &`, nested `@media`) is fine —
  Tailwind's build goes through Lightning CSS, which flattens it for the v4 browser baseline. There's
  no Sass-style suffix concatenation (`&-item` isn't legal), no variables/mixins/`@each`/`@extend`.
- `vendor.css` (imported before the utilities layer, unlayered) is the deliberate home for the small
  number of selectors that have no JSX element to carry a class — third-party internals like
  react-tooltip's build-hashed content node (`[class*='styles-module_content']`) or its `--rt-opacity`
  variable.

## 3. State: `data-*` attributes

Every stateful class (`active`, `stuck`, `selected`, `show`, `loading`, `open`, `expanded`, `disabled`, …)
is a `data-*` attribute, never a class — boolean presence (`data-active`) or a value
(`data-state="open"`), plus Base UI's own state attributes on its primitives (`data-popup-open`,
`data-highlighted`, `data-checked`, `data-starting-style`, `data-ending-style`, `data-disabled`, …).
Style with the matching variant:

```tsx
<button data-active={active ? '' : undefined} className="… data-active:bg-primary hover:bg-primary-dampened" />
```

- `data-active:` (bare-key presence — write it this way, not `data-[active]:`; the canonical-classes
  checker flags the bracketed form), `data-[state=open]:` for a valued attribute, `aria-*:`,
  `group-data-[…]:` for ancestor state (a marker `group`/`group/<name>` class sits directly on the
  ancestor; `group` and `peer` are plain marker classes, not utilities, and have no effect inside
  `@apply`), `in-data-[…]:` for a descendant-driven read.
- A state class is never reintroduced as a styling hook once it's gone — `ui/no_class_hooks.test.ts`'s
  retired-names list (`ui/retired_class_names.json`) fails the build if it comes back anywhere in `ui/`.
- Perf-critical per-frame writers (the combat replay HUD, the timeline ruler) use
  `element.toggleAttribute('data-*', cond)` instead of `classList.toggle` — same cost, same no-op when
  unchanged, and it's the attribute form the styling above already expects.

## 4. Visibility driven by settings

A user setting that decides whether something exists (show-threat/healing/damage-metrics toggles,
experimental settings, EP ratios, and the like) is a **conditional render**, never a CSS hide class or
a `data-hide-*` + `in-data-[…]:hidden` pair. Read the value from a hook and branch in JSX:

```tsx
const displayMetrics = useDisplayMetrics(sim);
const showThreatMetrics = displayMetrics.threat;
…
{showThreatMetrics && <ThreatColumn />}
```

`ui/sim/hooks/useDisplayMetrics.ts` is the existing example (consumed by
`ui/features/stat-weights/components/EpWeightsDialog/EpWeightsDialog.tsx`, which also filters its
column list with `!column.metric || displayMetrics[column.metric]` rather than hiding cells by CSS).
For input configs, the equivalent is `showWhen` on the input plus the toggle's own store subscription
(see any spec's `inputs.ts` for the `showWhen: player => …` shape) — never a class the element itself
renders unconditionally and then hides.

## 5. Locating elements — tests and tools

Prefer role and accessible name first (`getByRole('button', { name: … })`); reach for `data-testid`
only when no role fits. Never `querySelector('.some-class')`, `closest('.x')`, `classList.contains`,
or an exact class-list snapshot (`expect(el.className).toBe(…)`) in production code, tests, or
`tools/react-migration/*.mjs` — `ui/no_class_hooks.test.ts` fails on all of these outside
`ui/specs/**` (locator-only edits are allowed there; anything beyond a selector/testid change stays
frozen).

- **`data-testid` value convention:** when a class hook is retired and something still needs to find
  the element, the testid keeps the old class name verbatim (`className="apl-list-item-picker"` →
  `data-testid="apl-list-item-picker"`), so the mechanical rewrite is a search-and-replace and every
  `\.name(\.|$)` regex a tool used to run against the class keeps matching the testid instead. An
  _unread_ hook is just deleted — don't add a testid nobody consumes.
- **`data-testid` is never a styling hook.** No `.css` rule, `@apply` selector, or TSX arbitrary
  variant may key off `[data-testid=…]`; `ui/no_class_hooks.test.ts`'s "no `[data-testid]` styling"
  check fails the build on one. If a style needs to reach a child, give that child a prop
  (`triggerClassName`), a `ui-*` class of its own, or a real `data-*` state — never repoint a rule at
  its testid.
- **Kit components take a `testId` prop** (`Dialog`, `Popover`, `Tooltip`, …), forwarded to
  `data-testid` on the element that actually carries the identity (often not the root — `Dialog`'s
  `testId` lands on the popup, with `sim-dialog-portal`/`-backdrop`/`-viewport` fixed on the
  surrounding wrapper elements).
- **`tools/react-migration/*.mjs`** (the Playwright probes — tracked on this branch) use a shared
  helper:
    ```js
    const q = name => `:is([data-testid="${name}"], .${name})`;
    ```
    which matches the testid on a converted build and the bare class on an unconverted one, so one
    selector string works across the migration. Inside a `page.evaluate`/`waitForFunction` closure
    Node's `q()` isn't available — inline the same one-liner or pass the selector in as an argument.

## 6. Dialogs, menus, popovers

Every overlay primitive (`Dialog`, `Popover`, `ConfirmPopover`, `Menu`, `Toast`, `ProgressTrackerDialog`)
wraps a Base UI component. Dismissal — Escape, outside click, nested-popup layering — is Base UI's
job: never add a hand-written `onKeyDown` that swallows Escape, and never portal a popup out of the
floating tree in a way that breaks topmost-first closing. If Escape or click-outside misbehaves, the
fix is almost always removing whatever broke the native layering, not adding logic on top of it.

## 7. The gates

- **`ui/no_class_hooks.test.ts`** (vitest) runs three checks over `ui/**/*.{ts,tsx}` (excluding
  `*.test.ts(x)`) via `tools/tailwind/class-hooks.mjs`:
    1. **Class hooks** — every class-bearing string that isn't a real Tailwind utility (checked by
       compiling it against `ui/styles/style.css` with Tailwind's own design system, not a
       hand-maintained list), isn't `ui-*`, and isn't on the allowlist, fails.
    2. **Retired names** — any token in `ui/retired_class_names.json` (the names Phase 6 removed)
       appearing anywhere in production `ui/` (`*.test.ts(x)` excluded) fails, even outside a
       `className`, so a hook can't quietly come back through a comment-free reintroduction — unless
       the token has since become a real Tailwind utility or is on the allowlist, since Phase 6 retired
       some hand-rolled classes whose names collide with a later Tailwind utility of the same spelling
       (`grayscale`, `flex-3`, `tabular-nums`, …).
    3. **`data-testid` styling** — a `.css` rule or TSX arbitrary variant selecting `[data-testid=…]`
       fails.
- **`ui/class_hook_allowlist.json`** is the only way to keep a raw class name. An entry needs a
  `token` or a `pattern` plus a `reason`, and today it holds exactly: `sim-ui` and the
  `<spec>-sim-ui` pattern (the theme root `ui/styles/theme/specs.css` selects), `group`/`group/*`, `peer`/`peer/*`
  (Tailwind's own marker classes), `sim-tooltip`/`sim-tooltip--unpadded` (the Tooltip base class,
  forwarded into react-tooltip), `fa`/`fas`/`far`/`fab`/`fa-*` (FontAwesome, loaded from a CDN
  stylesheet, not ours to convert), and three **third-party-required** names
  (`tooltip-quick-swap`, `suggest-reforges-softcaps`, `bonus-stats-popover`) — react-tooltip forwards
  a component's `className` as its own `data-theme` attribute and forwards no `data-testid`
  equivalent, so these can't become pure testids. Add an entry only for a genuinely external
  constraint like these, never as a shortcut past a real conversion.
- **The canonical-class check** (`tools/tailwind/canonical-classes.mjs`, §1) runs as a standalone
  script today; it becomes a tree-wide CI gate in a later pass — run it by hand before that lands.
- **The rendering gate is `tools/react-migration/tw-probe.mjs`**, and its companion is
  `tools/react-migration/state-probe.mjs` (both tracked on this branch). Neither reads a class —
  both walk the DOM by child-index path from `document.body` plus tag, capturing ~54 computed style
  properties and the bounding box per node, and diff that against a baseline build, which validates
  a class-hook removal for free.
    - `tw-probe.mjs` captures each top-level tab **at rest** (`TABS` in the script), at three widths
      (`2200/1600/700`), plus one scrolled "results-stuck" capture. **It never opens a sub-pane, a
      dialog, or a modal** — it only ever sees the default state of each top-level tab.
    - `state-probe.mjs` is the companion for exactly what `tw-probe.mjs` can't reach: it runs a seeded
      sim and opens the Detailed Results sub-tabs, an expanded metrics-table row, the Rotation tab's
      APL sub-panes and Auto rotation type, the Bulk tab's sub-tabs, the gear selector modal, the
      settings Encounter Advanced dialog, and the EP weights dialog, diffing the same properties.
    - That split is exactly how a real regression slipped through once: the log runner's rows grew
      from 32.5px to 34px when a real `@utility` (`icon-sm`) was deleted as if it were a retired class
      hook. `tw-probe.mjs`'s default-pane run stayed green because it never opened the log tab; only a
      probe that opens sub-panes (or a behaviour script) caught it. **The lesson: a custom `@utility`
      or a `ui-*` composition class is real styling, not a hook** — the class-hook gate and the hook
      census tell the two apart by compiling every candidate against Tailwind's own design system
      (`tools/tailwind/canonical-classes.mjs`), never a hand-written name list, and deleting one
      because it "looks like" an old semantic class is the mistake both probes exist to catch. Run
      both before calling a class-hook or utility change done.
    - `tw-probe.mjs` separately caught a different regression, historical but worth knowing: three
      early utility conversions rendered **12.5% smaller** than the SCSS they replaced (`padding: 10px`
      → `p-2.5` computed to 8.75px, not 10px — `1rem` is 14px here, not 16px), passing type-check,
      ~1700 unit tests, oxlint and all 34 snapshots straight through. **The current rule (superseding
      that fixed-`[Npx]` reaction) is the exact dynamic spacing step**: Tailwind v4's spacing scale
      here accepts any multiple of `0.25`, so a source px value converts to its exact step —
      `10px` → `p-2.5`, `5px` → `p-1.25`, `18px` → `w-4.5` — computed-identically, and
      `tools/tailwind/canonical-classes.mjs` rewrites a lingering `p-[5px]` to `p-1.25` automatically.
      Keep an arbitrary `[Npx]` only where no named or dynamic step exists (an odd one-off border
      width, say), and add a token instead of an arbitrary value for anything repeated.
    - A class-removal commit and a DOM-structure commit must never land together — both probes are
      position-keyed, so an inserted or deleted element misaligns every comparison after it.
