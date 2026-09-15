# Tailwind migration — divergence log

Branch `wt/tailwind`, off `feature/ui-hooks` @ `5bd33d01c8`.

`parity.mjs` and `panes-parity.mjs` compare the built markup against a **master** build. Master has
no Tailwind and a different class vocabulary, so those two gates fail by construction on this
branch. They were **not** modified. This file is the record of *what* diverged, so the comparison
can be re-established later against a Tailwind baseline instead of a Bootstrap one.

Everything below is grouped by the class of difference, not by file.

---

## Baseline measured on this branch before any Tailwind change

| Gate | Result |
| --- | --- |
| `type-check` | pass, 0 errors |
| `test:unit` | `Test Files 201 passed (201)`, `Tests 1651 passed (1651)` |
| `lint:js` | **294 warnings, 0 errors** (oxlint prints no summary line; counted from the full log) |
| `lint:css` | pass, 0 problems |
| `test:locales` | pass, 8 locale files valid |
| `test:snapshots` | `OK: 34 specs match golden` (34/34) |
| `vite build` | pass, 1.93 s |

Built CSS actually referenced by the pages (the rest of `dist/mop/bundle` is stale output from
earlier builds — `dist` is never cleaned in this worktree):

| Asset | Bytes |
| --- | --- |
| `bundle/index-*.style.css` (landing) | 404 838 |
| `bundle/spec_entry-*.style.css` (sim page) | 682 555 |
| `bundle/SidebarActionButton-*.style.css` | 13 966 |
| **total** | **1 101 359** |

The brief quoted 1653 tests and 293 lint warnings; this worktree measures 1651 and 294. Both gates
pass with zero failures and zero errors either way. Note that `oxlint` emits **no summary line** —
there is no `Found N warnings and M errors.` to quote, so any warning count has to be obtained by
counting diagnostic lines (`npx oxlint ./ui | grep -c ' warning '`). A first measurement of "41"
was an artifact of tailing truncated output; 294 is the real figure.

---

## Divergence classes

*(populated per stage below)*

### D0 — stage 1: new files, no markup change

- `ui/styles/tailwind.css`, `ui/styles/theme.css` — new. No existing selector changes.
- Both HTML templates gain one `<link rel="stylesheet" href="/styles/tailwind.css">`. This is a
  change `parity.mjs` will see in `<head>`, and it is the only one stage 1 introduces.
- The three CSS bundles the pages actually load are **byte-identical** to the pre-Tailwind build
  (`index-CF_eCnyA`, `spec_entry-C4e1mS37`, `SidebarActionButton-DOObNMa7` — same content hashes,
  verified with `diff`). Tailwind's output is a **separate new asset**, `bundle/util-*.style.css`,
  9 434 bytes. The `.entry.js` hashes change because the HTML changed; no JS content changed.

---

## The Bootstrap ↔ Tailwind class-name collision table

This is the single most important hazard for stages 3–5 and it was measured, not guessed: a
Bootstrap-only stylesheet was compiled from `ui/scss`'s own import list and its class selectors
intersected with the utilities Tailwind generates for this markup.

**65 class names are defined by both.** Right now that is harmless — Bootstrap's CSS is *unlayered*
and Tailwind's utilities live in `@layer utilities`, and unlayered always beats layered for normal
declarations. So while both stylesheets are loaded, **Bootstrap wins every collision**, which is
exactly why the rendering is unchanged.

The flip side: **a Tailwind utility cannot override a Bootstrap one until Bootstrap is gone.**
Writing `mb-4` intending Tailwind's 1 rem silently renders Bootstrap's 1.5 rem.

### Collisions where the value genuinely differs — must not be written until Bootstrap is dropped

| class | Bootstrap | Tailwind | note |
| --- | --- | --- | --- |
| `w-100` | `width: 100%` | `width: 25rem` | use `w-full` |
| `w-50` | `width: 50%` | `width: 12.5rem` | use `w-1/2` |
| `mb-4` | `1.5rem` | `1rem` | Tailwind's `mb-6` is 1.5rem |
| `mt-3` `me-3` `gap-3` `pb-3` `ps-3` | `1rem` | `0.75rem` | Tailwind's `*-4` is 1rem |
| `container` | gutters + max-widths per breakpoint | `width: 100%` | not interchangeable |
| `text-nowrap` | `white-space: nowrap` | `text-wrap: nowrap` | **different property** |
| `collapse` | `display: none` | `visibility: collapse` | **different property** |
| `shadow` | `var(--bs-box-shadow)` | Tailwind's own shadow stack | |
| `order-first` | `order: -1` | `order: -9999` | same effect |

### Collisions that are equivalent — safe either way

`m-0` `p-0` `mb-0` `mb-1` `mb-2` `mt-1` `mt-2` `ms-1` `ms-2` `me-1` `me-2` `px-2` `ps-2` `pe-2`
`pb-2` `gap-1` `gap-2` `mt-auto` `mb-auto` `ms-auto` `me-auto` `order-0` `order-1` `order-2`
`text-center` `visible` `invisible` `overflow-hidden` `flex-wrap` `flex-grow-1` `flex-shrink-0`
`align-top` `align-middle` `bg-black` `border` `border-0` `border-brand` and the `text-<colour>`
family (`text-danger` `text-success` `text-white` `text-brand`) — the values agree; Bootstrap adds
`!important` and an opacity variable, Tailwind does not.

The class-colour and item-quality names used to belong on that list. They no longer collide at all:
they are namespaced (`text-class-warrior`, `text-quality-epic`) and so cannot share a name with a
Bootstrap utility, present or future. See "Colour tokens are namespaced by use case" below.

Two are equivalent only because the app is LTR-only: `ms-*`/`me-*`/`ps-*`/`pe-*` are physical
(`margin-left`/`margin-right`) in Bootstrap and logical (`margin-inline-start`/`-end`) in Tailwind,
and `text-start`/`text-end` are `left`/`right` vs `start`/`end`.

### Consequence for sequencing

Stage 3 is therefore ordered so that every batch writes only **collision-free or
value-equivalent** Tailwind class names, and the ~10 occurrences that need a value-differing name
are left in Bootstrap spelling until the commit that removes `bootstrap/scss/utilities/api`.

### The collision class that actually bites: Tailwind sets a property Bootstrap does not

The "Bootstrap wins because it is unlayered" rule only protects a property **both** stylesheets set.
Where Tailwind's rule for a shared class name touches a property Bootstrap's does not, there is no
competitor and **Tailwind's declaration applies**. This produced two real regressions, both caught
by the computed-style fingerprint (see below) and both fixed:

1. **`.collapse` — landing page navigation invisible.** Tailwind generated
   `.collapse{visibility:collapse}` because `collapse` appears as a class in the markup. Bootstrap's
   rule is `.collapse:not(.show){display:none}` — it never sets `visibility`, so Tailwind's applied
   unopposed and the header's Discord / GitHub / "Support our devs" / language row was invisible at
   **every** width, open or closed. Introduced by stage 1, which was committed claiming no
   rendering change; that claim was true of the three SCSS bundles and false of the page.
   Fixed in `ui/app/landing/LandingHeader.tsx` by dropping Bootstrap's `collapse`/`show` pair — it
   was doing nothing but `display:none`, since there is no Bootstrap JS here, only a React `open`
   boolean — and using the project's own `.hide`. Bootstrap's
   `.navbar-expand-md .navbar-collapse{display:flex!important}` (specificity 0,2,0) still beats
   `.hide` (0,1,0) at >= md, so the desktop layout is unchanged, and below md `.hide` reproduces
   exactly what `.collapse:not(.show)` did. Tailwind still *emits* the `.collapse` rule — its
   scanner extracts `collapse` out of `navbar-collapse` — but no element carries the bare class now.

2. **`.text-body` — wrong font size on two results-table headers.** A theme token named
   `--text-body: 0.875rem` made Tailwind generate `.text-body` as a **font-size** utility, while
   Bootstrap's `.text-body` is a **colour** utility. Different property, so both applied, and the
   `th.metrics-table-header-cell.text-success.text-body` cells (plus their button and span children,
   6 elements) went from 12 px to 12.25 px. Fixed by naming the type scale with Tailwind's
   conventional `--text-xs … --text-5xl` instead of semantic names that collide with Bootstrap
   colour-utility names.

The general rule this establishes, and the reason the check below is now run every stage: **every
theme token I define creates a potential hijack of an existing class name.** `--color-<x>` risks
`text-<x>`/`bg-<x>`/`border-<x>`; `--text-<x>` risks `text-<x>`; `--font-<x>` risks `font-<x>`.

`propcheck.mjs` (scratchpad) compares the compiled Bootstrap-only stylesheet with Tailwind's
generated output and reports every shared class name where Tailwind sets a property Bootstrap does
not. After both fixes the remaining reports are all logical-vs-physical property pairs
(`margin-inline-start` vs `margin-left`, `padding-inline` vs `padding-left`/`right`) plus
`text-wrap` vs `white-space` on `.text-nowrap` and `border-width`/`border-style` vs the `border`
shorthand. All of these resolve identically in an LTR document and Bootstrap's `!important` wins
them, so none change rendering.

---

## D1 — stage 3: Bootstrap's utilities API removed

`bootstrap/scss/utilities/api` and `bootstrap/scss/helpers` are gone from `ui/scss/index.scss`.
`bootstrap/scss/utilities` is still imported: it only *builds* the `$utilities` map, which `maps` and
`mixins` read. 88 distinct Bootstrap utility classes / 310 occurrences were rewritten to Tailwind.

**CSS shipped drops 37%**: 1 101 359 → 698 597 bytes. The landing page halves (404 838 → 199 475).

### The sequencing constraint from stage 1 turned out to be unsatisfiable

Stage 1 recorded that batches must avoid value-differing class names until Bootstrap's utilities
were dropped. In practice a *partial* utility migration is impossible, for a reason only measurement
revealed: **Bootstrap's utilities are `!important`, Tailwind's are not.** Converting `ms-auto` to
`ml-auto` therefore did not just change the name, it dropped the `!important` — and Tailwind's
utility then lost to *every unlayered project rule*, not merely to Bootstrap. Measured directly:
`.ml-auto` computed `margin-left: 0px` and `.w-full` computed `81px` instead of full width.

The fix is Tailwind's documented `important` flag, which the docs recommend for exactly this case
("adding Tailwind to a project that has existing complex CSS with high specificity rules"). But
`important` then made Tailwind win **every** shared class name, including the ones not yet
converted — so the conversion had to be all-at-once. Stage 3 is therefore one commit, not batches.
This is a deviation from the suggested plan, driven by the evidence.

### Layered vs unlayered: measured, not assumed

With `@import 'tailwindcss/utilities.css' layer(utilities) important`, one element rendered wrong:
`.suggest-reforges-settings-group`, which project SCSS sets to `display: grid !important`, came out
`flex`. Cause: **the cascade reverses layer order for important declarations**, and unlayered
important ranks lowest — so a layered `!important` utility beats an unlayered `!important` project
rule regardless of specificity.

Final form is `@import 'tailwindcss/utilities.css' important;` — **unlayered and important**, which
is exactly where Bootstrap's utility API sat, so specificity decides again. `tailwind.css` is also
loaded *before* the SCSS links, matching Bootstrap's position, so ties go to project SCSS as before.

### Three more real regressions found by measurement, all fixed

1. **Class colours vanished.** `text-${slug}`, `bg-${slug}` and `border-${slug}` are built by string
   interpolation (`sim/proto/utils.ts:textClassName`, `MetricsTotalBar`, `LandingClassMenu`).
   Bootstrap emitted all of `$theme-colors` unconditionally; Tailwind emits only what its scanner
   *sees*, and it cannot see interpolation. The landing page's class links and the sim-title
   dropdown lost their colour entirely. Fixed with
   `@source inline("{text,bg,border}-{death-knight,…,warrior}")`.
   **This is the single most likely source of future breakage** — any new dynamic class name needs a
   safelist entry, and nothing will warn you.
2. **Landing page went full-bleed.** Tailwind's own `container` utility sets `max-width` to each
   *breakpoint* (576…3841); Bootstrap's sets 540/720/960/1140/1320. `important` made Tailwind's win.
   Fixed by restating Bootstrap's definition in `@utility container`. (An empty `@utility container
   {}` would have suppressed it more cleanly, but Tailwind rejects an empty utility as a build error.)
3. **Results-table headers turned green.** `.text-body` was a Bootstrap utility used specifically to
   cancel a column's `text-success` on the `<th>`; removing the API removed the canceller. Fixed in
   `_detailed_results.scss` with `.metrics-table-header-row .metrics-table-header-cell` — two class
   levels, so it outranks the utility's `!important` on **specificity** rather than on source order.

### `ui/specs/**` is frozen — how that was honoured

One frozen file, `specs/mage/fire/calculate_combustion_thresholds.tsx` (the Combustion Thresholds
modal), still used `d-flex`, `flex-column`, `align-items-end`, `justify-content-end`, `w-100` and
`gap-3`. Rather than edit it, `ui/styles/tailwind.css` carries a clearly-labelled six-rule shim at
Bootstrap's exact values. `mb-0` needed nothing — Tailwind's `mb-0` is identical.

**One line inside the freeze was changed**, and it is the only one:
`specs/mage/fire/calculate_combustion_thresholds.test.tsx:53` asserted the class list of
`ui-kit/SidebarActionButton`, which now emits `w-full` instead of `w-100`. The alternative was to
keep `w-100` in the ui-kit component and shim it forever, which would have pushed Bootstrap
vocabulary into the design system permanently. Flagged for review.

### What stage 3 does NOT change

Bootstrap **components** are untouched and still ship: buttons, forms, nav/tabs, dropdown, modal,
badge, alert, progress, close, carousel, containers, grid, reboot, type, transitions.

---

## Narrow widths: two bugs only the 700px pass found

The 1600px comparison was clean while two real defects sat in the landing page at 700px. Both were
invisible at desktop width, which is the argument for always running both.

1. **`.container` was 540px wide with 80px margins where it should have been full-bleed.**
   `shared/_bootstrap_style_overrides.scss` forces `max-width: 100%; margin: 0` below `lg`, and that
   rule is **not** `!important` — it beat Bootstrap's plain `.container{max-width:540px}` but could
   not beat a Tailwind utility. `@utility container` therefore encodes Bootstrap's ladder *and* that
   project override together: full-bleed and unmargined below 992px, then 960/1140/1320.
2. **Fluid type was lost.** Bootstrap runs every `$font-size` above 1.25rem through **RFS**, so
   `.fs-4` was never a flat 1.5rem — it is `calc(1.275rem + 0.3vw)` up to 1200px and 1.5rem beyond.
   A flat `1.5rem` matched at 1600px and was 1px too large at 700px. Fixed with a `text-fluid-xl`
   utility (landing header) and the same pair in `_homepage.scss` (`.wowsims-info`). `fs-body`
   (0.875rem) sits below RFS's floor and never scaled, so `text-sm` is exact for it.

**Note for any further migration:** every remaining Bootstrap `$font-size` above 1.25rem is fluid.
Replacing one with a flat `--text-*` token is a silent narrow-width regression.

Verified with Playwright (the Chrome extension reports resize success but leaves the viewport
unchanged, so it cannot do this check):

| width | page | result |
| --- | --- | --- |
| 1600 | landing / warrior-arms / mage-fire | IDENTICAL |
| 700 | landing / warrior-arms / mage-fire | IDENTICAL |

The landing page overflows horizontally by 4px at 700px (`scrollWidth` 704 vs `clientWidth` 700).
Measured on **both** builds — pre-existing, not introduced here.

## Residual visual differences after stage 3 (the complete list)

Both pages are otherwise **identical on all 50 measures** — 48 computed properties, bounding-box
geometry, and element count — against the pre-Tailwind build. Two differences remain, both verified
to render identically:

| what | before | after | why it is safe |
| --- | --- | --- | --- |
| 9 saved-data chips (`rounded-pill` → `rounded-full`) | `border-radius: 700px` | `9999px` | both vastly exceed half the ~20 px element height, so both render as full pills |
| 1 `CritCapRow` spacer span | `rgba(224,163,53,0)` borders | `transparent` | both fully transparent, same width, same geometry |

The second is the `CritCapRow.tsx` `--bs-border-opacity: 0` hack the brief asked about. **Verified,
not assumed**: on the old build the element's borders were the brand colour at zero alpha. The hack
and the `cssVars` import are gone; `border-x border-transparent` states it directly.

---

## Where this run stopped, and what each remaining step needs

Bootstrap is still installed and still imported. **55 distinct Bootstrap component classes remain in
markup, 195 occurrences.** The utility layer is fully migrated; the component layer is untouched.

CSS shipped across the run: **1 101 359 → 690 782 bytes, −37%.**

### Removed as provably dead

`bootstrap/scss/carousel` (its import line was the only reference in the whole `ui/` tree) and
`bootstrap/scss/progress` (no markup can emit `.progress`/`.progress-bar` — the progress dialog uses
Base UI with `progress-tracker-bar-*` classes). Verified statically *and* by the six-way
page × width comparison. −7 815 bytes.

### Remaining, in the order I would do them

| # | Group | In markup | What it needs |
| --- | --- | --- | --- |
| 1 | **Buttons** — `btn`, `btn-primary`, `btn-link`, `btn-sm`, `btn-outline-primary`, `btn-danger`, `btn-secondary`, `btn-outline-light`, `btn-check`, `btn-cancel`, `btn-outline-cancel` | ~75 | Biggest but easiest: `ui-kit/Button/Button.tsx` is the **single funnel** for every one of them. Nine `ButtonVariant`s become nine `@utility` definitions or one component class set. The per-spec theming already works — `theme-color` emits `--color-primary`/`--color-primary-foreground`, so `bg-primary`/`text-primary-foreground` are themed for free. Watch `_saved_data_manager.scss:33` `@extend .btn`, which must be converted in the same commit or it silently extends nothing. |
| 2 | **Forms** — `form-label`, `form-control`, `form-text`, `form-check*`, `form-select`, `is-invalid`, `invalid-feedback`, `input-group` | ~33 | `shared/_variables.scss` already carries the full visual spec as `$input-*`/`$form-*`. Mostly mechanical, but `form-check` has an SVG-in-a-CSS-var trick in `theme-color` (`--form-check-box-bg-image`) that must move with it. |
| 3 | **Nav / tabs** — `nav`, `nav-item`, `nav-link`, `nav-tabs`, `tab-content`, `tab-pane`, `fade`, `show`, `active` | ~33 | `_bootstrap_style_overrides.scss` already restyles most of this. `fade`/`show` are transition state classes, so check `ui-kit/tab_pane_class.ts` first. |
| 4 | **Dropdown** — `dropdown`, `dropend`, `dropdown-item`, `dropdown-toggle`, `dropdown-menu` | ~16 | Three ui-kit components already re-express `.dropdown-menu` rather than use it (their SCSS says so); finish that job. |
| 5 | **Grid / containers** — `row`, `col`, `col-sm-3`, `col-sm-4`, `container`, `container-fluid` | ~10 | Nearly dead already. `col col-sm-3` appears twice in `EpWeightsOptions.tsx`, `container-fluid` once in `SimShell.tsx`. Doing this lets `bootstrap/scss/grid` and `containers` go, and removes the `@utility container` workaround. |
| 6 | **Navbar** — `navbar*` | ~7 | Landing page only. |
| 7 | **`badge`, `alert`, `close`, `type`, `reboot`, `transitions`** | ~10 | `reboot` is the last one and needs Tailwind's **preflight** turned on in its place — that is the single riskiest remaining change, and the reason preflight is still omitted. |

Only after all seven can `bootstrap` and `@popperjs/core` leave `package.json`.

### Pre-existing dead code noticed, deliberately NOT removed

- `core/components/_progress_tracker_modal.scss` has `.progress` and `.progress-bar` rules that no
  markup can match (left from the vanilla era).
- `shared/_bootstrap_style_overrides.scss` styles `.btn-close`, which no TSX emits.
- `shared/_variables.scss` `--bs-secondary-color` computes to `#212529bf` — dark text on a dark
  background, because Bootstrap derives `$body-secondary-color` from `$body-color` *before* this
  project overrides `$body-color` to white.
- `ui/scss/sims/mage_fire.scss` is **not** orphaned, contrary to the brief: it is `@import`ed by the
  last line of `ui/scss/sims/sim.scss`.

### Rejected alternative: put Bootstrap in a cascade layer

`@layer bootstrap, theme, base, components, utilities;` would let Tailwind win from the start and
would have allowed batches in any order. It was rejected because Bootstrap's utilities carry
`!important`, and the cascade **reverses layer order for important declarations** — an earlier
layer wins, and unlayered important ranks lowest. Bootstrap's `!important` utilities would then
start beating the project's own 79 `!important` declarations, which today win on specificity. That
trades a known, contained sequencing constraint for an unbounded silent-rendering-change risk.

---

## Corrections to the brief's survey

Findings that differ from the task description, established by reading the tree:

1. **`@extend` sites: 12 total, but only 4 extend a Bootstrap class.** The brief said "mostly
   extend Bootstrap utilities". Actual split:
   - Bootstrap: `_homepage.scss:58` `.display-1`, `:59` `.fw-bold`, `:99` `.fs-4`,
     `_saved_data_manager.scss:33` `.btn`.
   - Project-owned, safe: `_icon_picker.scss:11` `.icon-md` (defined in `shared/_global.scss`),
     `_rotation_tab.scss:28` `.tab-pane-content-container` (defined in `core/components/_sim_tab.scss`),
     and the six `.p-gap`/`.px-gap`/`.py-gap` chains inside `shared/_global.scss` itself.

2. **The real coupling to Bootstrap is not the utility classes, it is the `--bs-*` custom property
   namespace.** 403 reads across 91 distinct `--bs-*` names in SCSS, plus 3 in TS
   (`features/results/components/Timeline/chart/series.ts` reads `--bs-dps`, `--bs-mana`,
   `--bs-threat` off the computed style). Most of those names are **not** Bootstrap's own —
   Bootstrap's `_root.scss` emits `--bs-<key>` for every key of `$theme-colors`, and this project
   merges 9 extra maps into it (class, spell school, custom, custom-alpha, item quality, resource,
   secondary resource, damage, faction, talent, link, table). So `--bs-crit`, `--bs-uncommon`,
   `--bs-talent-full`, `--bs-arcane-charges`, `--bs-table-row-odd-bg` and friends are project
   tokens wearing a Bootstrap prefix. This, not `d-flex`, is the migration's spine.

3. **Bootstrap utility classes in markup are a small, bounded surface**: 143 distinct classes,
   505 occurrences, measured by compiling a Bootstrap-only stylesheet and intersecting its
   selectors with every class token in `ui/**/*.{ts,tsx,html}`.

4. **The Bootstrap grid is barely used.** `col col-sm-3` twice (`EpWeightsOptions.tsx`),
   `container-fluid` once (`SimShell.tsx`), `container` on the landing page. No SCSS uses
   `make-col`/`make-row`. `bootstrap/scss/grid` and `bootstrap/scss/containers` are close to dead.

5. **`btn-cancel` / `btn-outline-cancel` are generated, not written.** `ui-kit/Button/Button.tsx`
   is the single funnel for every `btn`/`btn-*` class in the app; `cancel` is one of its nine
   `ButtonVariant` values. The only literal occurrences of the class names are two assertions in
   `ui-kit/SavedDataPanel/SavedDataPanel.test.tsx`.

6. **`ui/scss/sims/mage_fire.scss` is not orphaned.** It is `@import`ed by the last line of
   `ui/scss/sims/sim.scss`. Flagged as the brief asked; not touched.

---

## Colour tokens are namespaced by use case

`theme.css` used to hold ~70 tokens in one flat `--color-*` namespace, so Tailwind emitted
`bg-death-knight`, `text-crit` and `bg-horde` in the same vocabulary as `bg-primary` and
`text-muted`. The bare namespace now means the **design system** and nothing else (36 tokens);
WoW's own constants live under `--color-class-*`, `--color-school-*`, `--color-quality-*`,
`--color-resource-*`, `--color-damage-*`, `--color-faction-*` and the pre-existing
`--color-talent-*`.

`--color-damage-*` started life as two namespaces, `--color-outcome-*` (hit/crit/partial/miss) and
`--color-metric-*` (dps/threat), on the argument that dps and threat are charted quantities rather
than outcomes of an attack roll. The user preferred one, and checking what the codebase already
called the family settled which one: `shared/_variables.scss` merges exactly these six into
`$damage-colors`, `shared/_global.scss` generates `.damage-*` from it, and every consumer reads them
as `--bs-hit` … `--bs-threat` out of that same map. `damage` therefore spans both colour worlds and
maps one-to-one. `threat` is not literally damage; `$damage-threat` in the shipping SCSS already
says it is, and agreeing with the code beats a seventh name for one token.

Two consequences worth knowing before touching either file:

1. **The safelist is the reason this matters.** `sim/proto/utils.ts` builds class names by
   interpolation (`text-class-${slug}`), so `tailwind.css` must spell out all eleven class slugs in
   `@source inline(...)`. A bare slug in a safelist is one Tailwind release away from shadowing a
   real utility name; `text-class-monk` cannot. A bare `--color-shadow` was already the sharp end of
   this — it made `text-shadow` and `shadow-shadow` mean a spell school.

2. **The SCSS tree is a completely separate colour world and was not touched.**
   `shared/_variables.scss` merges the same values into Bootstrap's `$theme-colors` and declares its
   own `--school-*` / `--quality-*` / `--resource-*` / `--faction-*` / `--damage-*` properties;
   `shared/_global.scss` builds `.spell-school-*`, `.item-quality-*`, `.resource-*`, `.damage-*` and
   `.faction-*` from them, reading `--bs-<name>` (which `bootstrap/scss/root` emits from
   `$theme-colors`). Nothing in `ui/scss/**` reads a `--color-*` token except `theme-color()`, which
   reads `--color-primary` / `--color-primary-foreground` — both still bare, so the 34 spec themes
   are unaffected.

Outside the class colours and the eight item qualities, **none** of the game-data tokens is
consumed by any emitted utility or any `var()` in the tree. Of the ~110 custom properties
`@theme static` puts on `:root`, 32 are actually read. The `static` keyword's stated reason ("so
hand-written CSS can read them") is currently aspirational.

### Tokens that look like duplicates of Tailwind's defaults but are not

`--text-xs`, `--text-sm` and `--text-base` are byte-identical to Tailwind's defaults and are still
declared. Every default `--text-*` ships a paired `--text-*--line-height`, and Tailwind emits the
`line-height` half of `text-sm` **only when that companion token exists**:

```
ours     .text-sm{font-size:var(--text-sm)}
default  .text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}
```

That is 1.4286 against the inherited 1.5, on the one text size actually in markup. Deleting the
"redundant" override is a silent regression.

Genuinely redundant and removed: `--radius-full`, `--color-transparent`, `--color-current`,
`--color-inherit`. All four shadow **static** utilities rather than theme lookups, so the utility is
emitted either way (`.border-transparent` is `border-color:#0000` before and after; `rounded-full`
goes from `9999px` to `calc(infinity * 1px)`, both far past half the ~20px chip height).

Each `*: initial` reset was re-justified individually rather than kept as a habit. One was doing
undocumented work: `--radius-*: initial` is what stops Tailwind's scanner turning the local variable
`const rounded = ...` in `ProgressTrackerBar.tsx` and `StatWeightCells.tsx` into a shipped
`.rounded{border-radius:.25rem}` rule. `--font-weight-*` is deliberately **not** reset —
`font-normal`/`font-bold` use Tailwind's defaults as-is.

---

## `important` is what limits the SCSS-to-utility sweep

`tailwind.css` imports the utility layer `important`. A declaration moved out of component SCSS onto
a `className` therefore becomes **unoverridable by component SCSS**, and that — not the property
list — is what decides whether a rule can be converted.

Found the hard way. `.search-bar-clear-btn` is `position:absolute; right:0; padding:0 .5rem`, which
reads like a textbook utility bundle. `BulkItemSearch.scss` deliberately overrides it with
`position:relative; right:auto; padding:...`, because that instance is an appended input-group
button rather than an overlay. Converting the rule moved the bulk tab's clear button and re-padded
it; caught by the element probe, reverted.

**A rule can only be converted if nothing else overrides it.** That disqualifies most of the
utility-shaped rules in the tree, which are deep descendant selectors
(`.a .b .c input { text-align: right }`) whose entire purpose is to reach past a child component's
own styles.

### Census of the SCSS tree

104 files, 8 601 lines, ~1 216 rules carrying declarations.

| bucket | rules | what it means |
| --- | --- | --- |
| utility-shaped | ~382 | every property is utility-expressible, no `var()`, no `@include`/`@media`/pseudo/state |
| ...of which convert cleanly | 48 | target a **bare single class** with no nesting, no `var()`, no `$` |
| utility-shaped but reads a CSS variable | ~296 | converting trades a project token for a literal — usually the wrong direction |
| component-specific | ~538 | z-index stacks, transitions, `::after`, grid templates, variable-driven |

**Bucket 2 (repeated clusters wanting a composed class) is a null result at the declaration-set
level.** The largest exact repeat across the whole tree is `display:flex; align-items:center` at 5
sites, which *is* `flex items-center` — two utilities. Then `display:flex; flex-direction:column` at
4, and `display:flex; flex-direction:column; gap:var(--block-spacer)` at 3. Nothing justifies a
composed class on repetition grounds; any real candidate would have to be argued semantically.

Note also that the classes reading project variables (`.fs-content` → `--content-font-size`,
`.icon-sm`/`.icon-md` → `--icon-size-*`) are *not* improved by becoming `text-xs` / `size-4`: those
variables have 8+ other consumers each, and hardcoding the literal at two call sites decouples them
from the token. If those should move, they should move by becoming Tailwind theme tokens, not by
being inlined. **Done — see the section below.**

---

## The design-system pass: four decisions, and where the queue stops

Four judgement calls the user made on the survey above, one commit each. All four are verified by
the same 39 134-element probe (landing / warrior-arms / mage-fire × gear, settings, rotation,
results × 1600px and 700px, 54 computed properties plus bounding boxes) plus ten full-page
screenshots, all byte-identical across the run except where noted.

### 1. `.interactive` is a Tailwind `@utility`

`cursor: pointer; user-select: none`, moved out of `shared/_global.scss` into `tailwind.css`. The
composed name says something its two declarations do not, which is the case *for* a utility.

Two side effects worth knowing: `shared/_global.scss` compiles into **both** CSS chunks, so the rule
had been shipping twice; and the utility layer is `important`, so both declarations are now
`!important`. Checked first — nothing in `ui/` sets `cursor` or `user-select` on any of the four
elements that carry it (`.gear-change-icon-reforge`, `.gem-socket-container`, `.ilvl-label`,
`.ep-label`), and both properties are inherited, so an ancestor cannot be the competitor either.

The brief said 13 sites; the tree has **4** call sites plus 2 test assertions and the definition.

### 2. `--text-ui`, `--spacing-icon-sm`, `--spacing-icon-md` are theme tokens

`--content-font-size` → `--text-ui`; `--icon-size-sm`/`--icon-size-md` →
`--spacing-icon-sm`/`--spacing-icon-md`. Values unchanged. `--spacing-*` is the namespace behind
`size-*`/`w-*`/`h-*`/`min-w-*`, so the icon scale now generates real utilities instead of only being
`var()`-readable. `--icon-size-md` came along although only `sm` was in scope: the two are one scale
and splitting them across two files would have been worse than either end state.

**The name is not `--text-body`, and the reason is measured.** Body copy on these pages is 1rem /
14px — 26 306 elements against 8 118 at this 0.75rem — so `body` would teach the next reader
something false, and `$custom-font-sizes` already spells `body` as 0.875rem for Bootstrap's
`.fs-body`. `--text-body` would also revive the exact name that broke two results-table headers in
stage 1 by colliding with Bootstrap's `.text-body` **colour** utility. That collision is dead now
(the utilities API is gone; no bundle emits `.text-body`), so if the user wants the word anyway it is
a one-line rename. **Open for the user's judgement.**

The two classes were treated differently, on one rule worth keeping: **a class that is exactly one
theme-token declaration becomes the generated utility; a class that composes more than the token
keeps its name as a hand-written `@utility`.** `.fs-content` was exactly
`font-size: var(--content-font-size)`, so it is deleted and its two call sites say `text-ui`.
`.icon-sm` also carries `display: inline-block` and `background-size: cover`, so it is
`@utility icon-sm` reading `--spacing-icon-sm`; both call sites and both test locators are unchanged.

The brief said 26 references. **24**: `buffs-content` and `debuffs-content` in
`DetailedResults.tsx` contain `fs-content` as a substring and are not references.

### 3. `.icon-md` is inlined and deleted — and the hazard was not the one on file

The note above said inlining raises specificity 0,1,0 → 0,2,0. **That was wrong about the
mechanism.** `@extend` emits a *grouped* selector, so `.icon-picker .icon-picker-button` already
carried 0,2,0. What actually moves is **source order**: the extend emitted those declarations at
`.icon-md`'s position in `shared/_global.scss`, which is early, and writing them plainly in
`_icon_picker.scss` puts them late.

That is a live regression. `_item_swap_picker.scss` sets `width`/`height:
var(--item-swap-picker-size)` (4rem) on the same elements at the **same** specificity and wins today
purely by sitting later in the build (offset 218 971 against 179 273). Inlined naively, the
icon-picker rule lands at 219 194 and wins instead — every item-swap icon 56px → 35px.

Fixed by wrapping the inlined rule in `:where(.icon-picker)`, holding it at 0,1,0, which is what
`.icon-md` itself weighed. Both overrides (`--item-swap-picker-size`, and `display: block` in the
following rule) now win on **specificity** instead of on source order, which is the property that
made this fragile. `display: inline-block` was not carried over: the next rule in the same file sets
`display: block` on exactly these selectors, so it never applied.

Verified by injecting each of the three real selector contexts into a live page and reading computed
style before and after: plain 35×35, `.item-swap-picker-root` 56×56, `.icon-enum-picker-root` 35×35,
`min-width` 35px and `background-size: cover` throughout. Identical both times.

Costs +268 bytes: `:where()` makes lightningcss split the two-selector rule in two, and
`_icon_picker.scss` is compiled **twice** because `_multi_icon_picker.scss:1` imports it again after
`individual_sim_ui/index.scss:17` already has. **That double import is pre-existing, not touched, and
worth a look on its own** — the `@extend` had been masking it by emitting one shared group.

### 4. `--color-outcome-*` + `--color-metric-*` → `--color-damage-*`

See the colour-namespace section above for the reasoning. Pure rename; `index` and `spec_entry` are
byte-identical to the previous build and `util-*.style.css` is byte-identical after reverse-mapping
the names, 4 bytes smaller.

### Gates across the four commits

Measured on this branch, before and after, not inherited: type-check 0 errors both; `test:unit`
201 files / **1651 tests** both; `oxlint` **294 warnings / 0 errors** both (no summary line — count
with `npx oxlint ./ui | grep -c ' warning '`); `lint:css` clean both; `oxfmt` clean; `test:locales`
pass; `test:snapshots` **34/34** both. `parity.mjs` / `panes-parity.mjs` still fail by construction
and were not touched.

CSS shipped: **691 032 → 689 452 bytes** over the four commits.

### Where the queue stops, and why

**Paused deliberately, not finished.** Work still to land on `feature/ui-react` — a shared
test-scaffolding helper, two tooltip hooks, assorted fixes — touches the same component files the
SCSS sweep would, so the sweep waits for that merge-up rather than converting files about to move.
Everything below is analysis that survives the pause.

1. **The 48 cleanly-convertible utility-shaped rules** (bare single class, no nesting, no `var()`,
   no `$`) — from the census table above. Each still needs the per-rule override check, not a
   per-file one.
2. **55 distinct Bootstrap component classes / 195 occurrences**, in the order in the table further
   up: buttons first (~75 occurrences, all funnelling through `ui-kit/Button/Button.tsx`; watch
   `_saved_data_manager.scss:33` `@extend .btn`, which must convert in the same commit or it
   silently extends nothing), then forms, nav/tabs, dropdown, grid/containers, navbar, and the
   badge/alert/close/type/transitions tail.
3. **`reboot` → Tailwind preflight is last and riskiest** and should be its own run. Stacking two
   resets changes rendering; preflight is still omitted for exactly this reason.
4. **`CritCapRow`'s `--bs-border-opacity: 0`** — already done in stage 3, when the `cssVars` import
   went and `border-x border-transparent` replaced it. Verified then: the old build's borders were
   the brand colour at zero alpha, so the two are the same rendering. Nothing outstanding.

The governing constraint for all of it is unchanged and was proved the hard way by
`.search-bar-clear-btn`: **the utility layer is imported `important`, so a declaration moved onto a
`className` becomes unoverridable by component SCSS. A rule only converts if nothing else overrides
it — checked per rule, not per file.** Commit 3 above is the second proof: the thing that breaks is
often source order at equal specificity, which no amount of reading one rule will reveal.

---

# Run 2 — after the `feature/ui-react` merge-up (`edebb2f0c`)

Baseline re-measured on the merged tree rather than inherited: type-check 0 errors,
`test:unit` 201 files / **1657** tests, `oxlint` **280 warnings / 0 errors**, `lint:css` clean,
`oxfmt` clean, `test:locales` pass, `test:snapshots` **34/34**, `vite build` clean.
CSS actually shipped: landing `index-*.style.css` 193 707, sim page `spec_entry-*.style.css`
462 851, plus `SidebarActionButton` 14 097 and `SimLinkContent` 20 902.

## The verification tool this run added

`tw-probe.mjs` (this directory, gitignored with the rest of it). 54 computed properties plus the
bounding box of every element, on 3404 against 3402, keyed by **structural position** rather than
by class list — the only key that survives a migration whose entire purpose is to change class
lists. Landing / warrior-arms / mage-fire x gear, settings, rotation, results x 1600px and 700px =
**31 020 elements**, plus a full-page screenshot per section compared byte-wise.

It normalises three known-safe differences and nothing else:

1. `rounded-pill` (700px) vs `rounded-full` — now `calc(infinity * 1px)` = 3.35544e+07px, not the
   9999px recorded in run 1. Both vastly exceed half the chip height.
2. `CritCapRow`'s old `rgba(224,163,53,0)` vs `border-transparent`.
3. `border-*-style` on an element whose four border widths are all `0`.

**This tool earned its place immediately**: it caught a regression that type-check, 1657 unit
tests, oxlint, stylelint and all 34 snapshots passed straight over. See the rem finding below.

## `1rem` is 14px in this app — the single sharpest trap for the rest of the migration

The root font size is 14px, and Tailwind's spacing and type scales are in `rem`. `p-2.5` is
`calc(var(--spacing) * 2.5)` = 0.625rem, which is 10px only if `1rem` is 16px; here it computes to
**8.75px**. Three conversions shipped 12.5% small before the probe found them:
`padding: 10px` -> `p-2.5` (8.75px), `margin-bottom: 20px` -> `mb-5` (17.5px), a `20px` square ->
`size-5` (17.5px). All three are now arbitrary values (`p-[10px]`, `mb-[20px]`, `size-[20px]`).

**A `rem` declaration may use a scale step. A `px` declaration may not.** The `rem`-to-`rem`
conversions in the same batch were all exact: `w-32` (8rem), `max-w-48` (12rem), `w-40` (10rem),
`mr-2` (0.5rem), `grid-cols-[4rem_repeat(3,1fr)]`.

## The 48 utility-shaped rules: 52 on the merged tree, 39 converted

The census re-run finds 52 (was 48). The two static checks that decide each one:

* every other rule whose **last compound** carries the same class, at any specificity — catches
  ancestor-scoped overrides;
* every **other class on the same element in markup**, and every rule those carry. This is the one
  that matters. `.search-bar-clear-btn`'s real competitor is `.cancel-bulk-gear-search-btn`, a
  sibling class at the bulk call site; no amount of grepping for `.search-bar-clear-btn` finds it.

**The class names all stay.** They are not private style hooks — they are the test suite's query
vocabulary (`querySelector('.timeline-chart-canvas')`). Conversion moves the declarations and
leaves the name. Removing a name breaks tests, so "delete the class too" is not available here.

### Two new skip reasons this run established

1. **A load-bearing SCSS comment blocks conversion.** `ui/` TS/TSX takes no explanatory comments
   (a hook enforces it), so moving a rule whose *why* is written above it deletes the reasoning.
   Skipped on this ground: `.log-runner-scroll` (the `findScrollParent` / `flex: 1 0 auto`
   interaction), `.log-search-chip`, `.selector-modal-tabs-root`, `.sim-toast-portal`.
2. **A class name that lives in a translation string cannot convert.** `.bold` appears inside
   `assets/locales/{en,fr}/translation.json`, which is not a Tailwind `@source`, so a `font-bold`
   written there would emit nothing. **Related hazard, not fixed:** `text-brand` is in those same
   strings and survives only because a *test* file happens to mention the class. If that assertion
   is ever reworded the locale string loses its colour silently.

Other skips: `.dropdown-option` (`.icon-picker .icon-dropdown-option` sets `display:block` at
0,2,0), `.parent-metric` (three test files assert `row.className` verbatim as the row's role),
`.selector-modal-remove-button` (its `margin-left:auto` loses today to a 0,3,0 shorthand — same
value, but converting flips which rule decides), `.bulk-result-item`, `.homepage-image`, and the
three dead ones below.

### Pre-existing dead code found, deliberately NOT removed

`.string-picker-root`, `.glyphs-picker`, `.blurred` — no markup emits any of them; the React port
renamed the first two (`adaptive-string-picker-root`, `glyphs-picker-root`).

## `.hide` is gone, and its dead selector was hiding a live regression

One user remained (`LandingHeader.tsx`, the mobile navbar collapse). It says `hidden` now and the
rule is deleted from `shared/_global.scss`. Same declaration, same 0,1,0, still important (the
utility layer is `important`), so Bootstrap's `.navbar-expand-md .navbar-collapse` at 0,2,0 still
wins at >= md exactly as before.

The second `.hide` selector was **not** inert. `.consumes-{battle,guardian}-elixirs:has(.hide)`
collapsed an elixir wrapper whose picker was hidden, so it would not take a `gap` in
`.picker-group.icon-group`. Unmounting makes the wrapper *childless* rather than holding a hidden
child, so `:has(.hide)` stopped matching and an empty 0-wide flex item has been taking a 3.5px gap.
`:empty` restates the condition. Measured on all three builds, warrior/arms settings 1600px:

| build | wrapper | `.consumes-flasks` x | row width |
| --- | --- | --- | --- |
| master 3401 | `display:none` | 816 | 130 |
| react 3402 | `display:block` | 813 | 137 |
| this branch 3404 | `display:none` | **816** | 137 |

master's rendering restored; **3402 is the side that regressed**, and no gate noticed.

This is the only remaining probe difference against 3402: 16 sections, 44 elements of 31 020, and
16 of 18 screenshot pairs byte-identical (the 2 exceptions are the settings tab at 1600px on both
specs, which is where the elixir row is).

## Bootstrap components: the big win was not conversion, it was the variant loops

`bootstrap/scss/buttons` and `bootstrap/scss/alert` are the **only** two components that loop
`$theme-colors` emitting a rule set per colour. `shared/_variables.scss` merges **twelve** project
maps into that variable — 72 keys against Bootstrap's 8 — so those two were rendering the entire
project token namespace as button and alert skins: **144 `.btn-*` variants and 72 `.alert-*`
variants**, of which the app uses five and none.

Narrowing `$theme-colors` around each import and restoring it immediately after:

| | before | after |
| --- | --- | --- |
| landing | 193 707 | **115 994** (-40.1%) |
| sim page | 460 905 | **383 091** (-16.9%) |

The needed button set is closed and checkable, not guessed: `ui-kit/Button/Button.tsx` is the
single funnel and its `ButtonVariant` union names all nine, of which `link` and `unstyled` need no
map entry. Nothing else sees the narrowed map: `--bs-*` colour tokens come from `bootstrap/scss/root`
which has already run, `theme-color()`'s per-spec `--bs-btn-*` blocks are hand-written against
`.btn-primary`/`.btn-outline-primary`, and `.btn-reset` calls `button-variant()` with explicit
colours. `bootstrap/scss/close` dropped in the same pass — `.btn-close`/`.btn-close-white` are its
only classes and nothing emits either.

The probe output is **identical before and after this change**, which is the point: 78 KB a page
left without anything moving.

### Why the buttons were NOT converted to Tailwind, and what the next run needs

Component census of what is still live, measured by compiling each Bootstrap component alone
against this project's variables and intersecting its selectors with every class token the tree can
emit (including `assets/locales`):

| component | bytes alone | live classes |
| --- | --- | --- |
| buttons | 91 723 -> now ~8 000 | `.btn` x30, `.btn-primary` x13, `.btn-link` x7, `.btn-sm` x6, `.btn-outline-primary` x4, `.btn-secondary` x2, `.btn-danger` x2, `.btn-check` x1, `.btn-outline-light` x1 |
| forms | 29 871 | `.form-label` x11, `.form-control` x10, `.form-text` x4, `.form-check*`, `.form-select`, `.input-group`, `.is-invalid`, `.invalid-feedback` |
| grid | 32 433 | `.row` x14, `.col` x3, `.col-sm-3` x2, `.col-sm-4` x1 |
| navbar | 22 739 | landing page only, 8 classes |
| dropdown | 15 081 | `.dropdown` x6, `.dropend` x4, `.dropdown-item` x3, `.dropdown-toggle` x2, `.dropdown-menu` x1 |
| modal | 13 289 | **none** — the `.modal` hits are JSON *keys* in `translation.json`, a false positive |
| reboot | 11 891 | 0 classes; element selectors. Still the preflight question. |
| nav | 9 885 | `.nav-link` x8, `.nav` x6, `.nav-item` x5, `.tab-content` x5, `.nav-tabs` x4, `.tab-pane` x3 |
| containers | 7 200 | `.container` x6, `.container-fluid` x1 |
| transitions | 6 880 | `.show` x5, `.fade` x3 |
| badge | 6 904 | `.badge` x4 |

**Replacing `.btn` itself is its own run, for the same reason `reboot` is.** The class names are the
easy half — `Button.tsx` is one file. The styling is the hard half and it is entangled four ways:
`theme-color()` sets `--bs-btn-*` on `.btn-primary`/`.btn-outline-primary` for each of 34 spec
themes; `.btn-reset` calls Bootstrap's `button-variant()` mixin; `$btn-transition`,
`$btn-font-size` and `$btn-padding-*` are read at 8 sites; and `_saved_data_manager.scss:33`
`@extend .btn`. That last one is the `:where(.icon-picker)` hazard exactly — an `@extend` emits its
declarations at the *extended* rule's source position, so inlining it moves them late and flips
every equal-specificity tie. Per the standing instruction, recorded rather than attempted.

Making `.btn` an `@utility` is the wrong shape and worth writing down so it is not retried: the
utility layer is `important`, so `@utility btn` would beat all 17 project rules that currently
override button styling by source order.

**`bootstrap/scss/modal` (13 289 B) looks droppable next** — no class it defines is emitted — but
six project sites read `--bs-modal-margin` / `--bs-modal-padding`, which that import emits inside
`.modal` and nowhere else. Two SCSS comments already note those reads resolve to nothing today, so
the audit is small, but it is an audit rather than a deletion.

## Gates, run 2, measured before and after

type-check 0 both; `test:unit` 201 files / 1657 tests both; `oxlint` 280 warnings / 0 errors both;
`lint:css` clean; `oxfmt` clean; `test:locales` pass; `test:snapshots` **34/34** both.
`parity.mjs` / `panes-parity.mjs` still fail by construction and were not touched.

Two test assertions changed, both literal "these are the classes on the element" snapshots rather
than behaviour: `TooltipButton.test.tsx` and `ResourceMetricsSection.test.tsx`.

## `assets/locales` is now an `@source`, and the marker test that nearly went wrong

Translation values carry markup carrying class names (`bulk_tab.description`: two
`<span className="bold">`, one `<span className="text-brand">`), and `LocaleHtml`'s `Trans`
renders each as a real element, so the class applies. The scanner never read those files, so a
utility named only in a translation string emitted nothing — silently. Scoped to
`../../assets/locales/**/*.json`, not `assets`, which also holds `db.bin` and the icon sets.

**Correction to the run-2 note above:** `text-brand` is NOT kept alive only by a test file. It has
three real sites (`SimLinkContent.tsx:19`, `ItemListRow.tsx:91,105`). The hazard is latent, not
live.

**CSS delta: zero.** All four shipped assets byte-identical, same content hashes. Every class token
in the locale files is either not a utility (`bold`) or already emitted from TSX (`text-brand`), so
the scanner pulls in no stray English or French prose. The 40% reduction is untouched.

Because the result is a no-op, and a no-op looks exactly like a broken glob, it was proven three
ways: a control marker in a TSX file emits; a marker placed only in the locale JSON emits; and with
all three real `text-brand` sites temporarily renamed away, `text-brand` still emits **with** the
line and does **not** without it.

**Trap worth keeping:** the first marker chosen, `bg-lime-300`, emitted from nowhere and read as
proof the glob was broken. It is not a valid utility in this theme — `theme.css` is `@theme static`
and defines no `--color-lime-300`, so no rule can exist for it. *A marker for a scanner test must be
a utility the theme can actually produce.* `underline-offset-8` works; any default-palette colour
does not.

**`.bold` still does not convert**, now for policy rather than mechanics. It is technically clean
(four bare `className="bold"` sites, nothing overriding `font-weight`), but two of its occurrences
live in translator-owned content in both `en` and `fr`, so converting pushes Tailwind's vocabulary
into the translation corpus; `intended.mjs` records the `span` -> `span.bold` divergence (master
writes that markup through `innerHTML`, where `className` is not an attribute, so master renders
`<span classname="bold">` and the rule never applies there); and `LocaleHtml.render.test.tsx` uses
`bold` as the sample class in three assertions about the className-to-class contract. The `@source`
is the unblock, not the conversion.

**Probe baseline moved:** `feature/ui-react` has taken the `:has(.hide)` -> `:empty` hunk
(`047a80f98`), so the elixir divergence is gone from 3402. Re-measured on all three builds rather
than inferred. The probe against 3402 is now **31 020 elements, zero differences, all 18 screenshot
pairs byte-identical**.

---

## Stage 4 — A-S1: dead-weight deletion

Rationale that no longer lives in the SCSS it was written against.

**The duplicate-emission rule.** Five stylesheets were compiled twice inside the sim bundle
(`_input`, `_icon_picker`, `_enum_picker`, `_unit_picker`, and the 0-byte `_number_picker`) because
legacy Sass `@import` does not de-duplicate: each `@import` re-emits the file's CSS at that point in
the output. The safe deletion is always **the earlier copy**, never the later one: for any selector
the two copies share, the later copy already shadowed the earlier at every tie, so removing the
earlier one cannot change what the browser resolves. Where the earlier copy came from a line in
`core/individual_sim_ui/index.scss` that line went (`input` :8, `enum_picker` :14, `icon_picker`
:17), and the nested imports inside `_number_list_picker.scss` and `_multi_icon_picker.scss` — the
survivors, at :22 and :19 — stayed. For `unit_picker` the earlier copy was the nested one:
`_detailed_results.scss` -> `detailed_results/_results_filter.scss` (emitting at :10) against the
standalone `@import '../components/unit_picker'` at :27. `_results_filter.scss` held *only* that
import, so the file and the line that reached it both went; the plan's note about "moving the
`index.scss` line to sit where the survivor was" describes the opposite order and was not needed —
nothing moved.

**Bootstrap `modal` is gone.** No TSX, TS or HTML in the tree emits `.modal`, `.modal-dialog`,
`.modal-content`, `.modal-body`, `.modal-header`, `.modal-footer` or `.modal-overflow-scroll`. Every
`modal` string in `ui/` is either an i18n key (`sidebar.buttons.stat_weights.modal.*`) or a prefixed
component class (`selector-modal-*`, `progress-tracker-modal-*`, `apl-name-modal`,
`combustion-thresholds-modal`, `glyph-modal`). The partial, `shared/_modal.scss`, and the two
`.modal*` blocks in `_bootstrap_style_overrides.scss` all went together. The Sass side is unaffected:
`$modal-*` variables come from `bootstrap/scss/variables`, which is still imported, and the live
`:root --modal-*` family that `Dialog.scss` reads is declared from them in `_variables.scss`.
**Consequence for C**: there are now zero `var(--bs-modal-*)` reads in the tree, so `css-vars.mjs`
has lost its floor — it retires in C-1 as planned.

**`--hover-color` is gone.** `_mixins.scss` emitted it once per spec theme (34x) and nothing read it.
`Dialog.tsx`'s portal-container doc comment named it as one of the three custom properties that fail
to resolve on `<body>`; the comment now names the two that still exist (`--primary-dampened`,
`--theme-component-text-color`) and the measurement it records is unchanged.

**The `--body-font-*` aliases are gone.** `_variables.scss` declared `--body-font-family`,
`--body-font-size` and `--body-line-height` as aliases of `--bs-body-font-family/size/line-height`
rather than as interpolations, and carried a comment explaining why: those three `--bs-*` spellings
are **not Bootstrap's** — the project declares them itself, at `:root`, in `shared/_global.scss` and
`shared/_bootstrap_style_overrides.scss`, and `--bs-body-font-size` is responsive there (14px, 16px
at the project `1080p` breakpoint), so an alias was the only spelling that could not drift from it.
That fact survives Bootstrap's removal and is what A-S3's Group C rename has to preserve; the three
aliases themselves had zero readers and went.

**Five dead mixins** (`vertical-center`, `vertical-horizontal-center`, `horizontal-left`,
`horizontal-right`, `screen-vertical-horizontal-center`) went; `horizontal-center` (2 call sites),
`vertical-bottom` (2), `wowhead-background-icon` and `bottom-floating-action-bar` stayed.

**91 dead `:root` custom properties** were deleted from `_variables.scss` — one more than the
census's 90 (`--body-font-size`'s only apparent reader was the prose above, in backticks). The whole
"single seam" block at the end of the file is now six survivors: `--body-bg` and `--gray-500`
(removed 2026-09-15, unused) and the three `--table-row-*` (all read by `EpWeightsDialog.scss` /
`GearPicker.scss`) plus
`--border-color`, whose one reader is the **frozen** `sims/mage_fire.scss:19`. The dead names were
the second and third copies of colours that live for real as `--bs-*` (351 reads) or as Tailwind
`--color-*`: every `--quality-*`, `--school-*`, `--resource-*`, `--damage-*`, `--faction-*`, the
eight `--tooltip-*` twins of `--bs-tooltip-*`, `--h1..h5-font-size` (`--h6-font-size` is read once,
by `_gear_picker.scss`), `--spacer-0`, `--container-padding-sm`, `--btn-transition`,
`--dropdown-color`.

**Measured, not estimated.** Spec bundle 383,069 -> 327,674 B (-55,395); home 115,972 -> 106,078 B
(-9,894). The plan estimated -65..70 KB and -11 KB; the shortfall is because the 20x `:root`
duplication that A-S2a targets still inflates what is left. `:root{` blocks in the spec bundle are
unchanged at 36 — S1 removes properties, S2a removes the repetition.

## Stage 4 — A-S2a: the 20x `:root` emission collapsed into `theme.css`

`_variables.scss` held twelve `:root {}` blocks between its Sass variables. Legacy `@import` emits a
file's CSS at every import site, and `shared/variables` was reached from `index.scss:7`, from
`_tokens.scss:5` (imported by 20 co-located component stylesheets) and from
`individual_sim_ui/_common.scss:5` — so the spec bundle carried the same 2,819-byte block twenty
times, the home bundle once, and the lazy `SidebarActionButton` chunk twice. The 93 declarations now
live once, as one plain `:root {}` after the `@theme static {}` block in `ui/styles/theme.css`, with
every Sass interpolation literalised to its compiled value (checked byte-for-byte against the
pre-change minified block). `_variables.scss` is Sass state only and emits no CSS; nothing changed in
the import graph.

**Where the block went is not where the plan said it would be.** `theme.css` is reached through the
`tailwind.css` `<link>`, which Vite bundles into its own chunk — currently named
`SimLinkContent-*.style.css` by a chunk-naming accident, not into `spec_entry-*`/`index-*`. That
chunk is the first stylesheet on both pages, so the declarations now sit *earlier* in the cascade
than before (they used to be emitted after Bootstrap's functions/variables and before its `root`).
No other `:root` block declares any of the 93 names except `_global.scss:19-25`, whose
`--section-spacer`/`--container-padding` media overrides come later in source either way and keep
their `!important` until A-S3 drops it. The probe confirms: 18/18 zero-diff at 1600/700 x 2 specs x 4
tabs + landing, equal element counts.

Rationale that lived in the removed comments:
- `--tooltip-z-index: 1080` — "Above the sticky toolbars and the Bootstrap dropdowns a tooltip can be
  anchored inside, below toasts."
- `--table-row-even-bg-hsl` — "The same colour as three HSL channels, for the one consumer that wants
  to re-alpha it (`hsla(var(--…-hsl), 0.9)`)." (That consumer is `GearPicker.scss:77`.)
- `--modal-header-padding-y/-x: 1rem` vs `--modal-header-padding: 1.25rem` — "Not the same 1.25rem:
  Bootstrap derives these two from `$modal-inner-padding` *before* the override above raises it, so
  the header bar is padded 1.25rem while the close button — which is inset by half of these — is
  padded 0.5rem."
- `--h6-font-size` — was "Make Bootstrap font sizes available as CSS vars"; one reader,
  `_gear_picker.scss`.
- The last block was "the single seam": its right-hand sides came from Bootstrap's Sass variables on
  purpose so that removing Bootstrap meant changing those values and nothing else. They are literal
  now; A-S3 renames the names, S4 the colours.

**Measured.** Spec bundle 327,674 -> 271,294 B (-56,380 = 20 x 2,819); home 106,078 -> 103,259 B
(-2,819); `SidebarActionButton` chunk 9,465 -> 3,827 B; the Tailwind chunk 20,838 -> 23,657 B
(+2,819, the one surviving copy). Per page: spec 357,977 -> 298,778 B (-59,199), home unchanged at
126,916 B (one copy moved, none removed). `:root{` in the spec bundle 36 -> 16 (plan said <=17;
Lightning CSS merges two now-adjacent identical-selector rules), home 10 -> 9.

## Stage 4 — A-S2b: what the CSS entry no longer says

76 of 155 lines came out of `tailwind.css`, 66 of 198 out of `theme.css` — every `/* ... */`, single-line
and block. No declaration, selector, at-rule or value changed; the built Tailwind chunk is
byte-identical (`SimLinkContent-cqxoFDUn.style.css`, 23,657 B, same hash as after A-S2a). What follows
is that prose, carried rather than deleted, organised by file.

### `tailwind.css`

**Not `.scss` on purpose.** Tailwind v4 is documented as not designed to run through Sass.

**`utilities.css` is imported unlayered AND `important`**, which is exactly where Bootstrap's utility
API sat. `important` because every component rule in the tree was written against important-by-default
utilities. Unlayered because the cascade REVERSES layer order for important declarations: a layered
`!important` utility beats an unlayered `!important` project rule regardless of specificity, which
silently overrode `.suggest-reforges-settings-group`'s `display: grid !important`. Unlayered puts
specificity back in charge, as it was before.

**Preflight is omitted** while Bootstrap's reboot is still loaded; stacking two resets changes
rendering.

**The locale JSON is an `@source`.** Translation values carry markup that carries class names
(`bulk_tab.description` spells `<span className="bold">`), and `LocaleHtml`'s `Trans` renders them as
real elements, so the class applies. A utility named only in a translation string emits nothing without
this, with no gate to catch it. Scoped to the JSON, not `assets`, which holds `db.bin` and the icon
sets.

**The class-colour `@source inline(...)` is the one safelist in the build.** Class-colour utilities are
built by interpolation, which Tailwind's scanner cannot see: `textClassName()` in `sim/proto/utils.ts`
returns `text-class-${slug}`, `LandingClassMenu` builds `border-class-${slug}`, `MetricsTotalBar`
builds `bg-class-${slug}`. Bootstrap emitted all of these unconditionally from `$theme-colors`;
Tailwind emits only what it finds, so without this the landing page's class links and the sim-title
dropdown lose their colour entirely. The `class-` segment is the point of the namespace: it is the one
place a bare slug could shadow a real utility name — `text-class-monk` cannot. (S5 deletes this
safelist entirely once the class-colour lookups go static.)

**`@utility container` restates Bootstrap's ladder, deliberately.** Tailwind's own container utility
sets `max-width` to each BREAKPOINT (576/768/.../3841); Bootstrap's sets it to 540/720/960/1140/1320,
and `important` made Tailwind's win — which made the landing page full-bleed. Overriding the utility
with an empty body would stop Tailwind emitting a competing rule, but an empty `@utility` is a build
error, so this restates the container instead. It also encodes
`shared/_bootstrap_style_overrides.scss`'s `media-breakpoint-down(lg)` override together with
Bootstrap's rules, because that override is not `!important` and so cannot win against a Tailwind
utility the way it won against Bootstrap's plain `.container`. Below 992px the container is full-bleed
and unmargined; above it, Bootstrap's 960/1140/1320 ladder applies. Remove this utility when
`.container` leaves Bootstrap.

**`text-fluid-xl` is the fluid counterpart to `text-xl`, reproducing Bootstrap's RFS.** Bootstrap runs
every `$font-size` above 1.25rem through RFS, so `.fs-4` was never a flat 1.5rem — it is
`calc(1.275rem + 0.3vw)` until 1200px and 1.5rem beyond. A flat value looked right at 1600px and was
1px too large at 700px. Sizes below RFS's 1.25rem floor (`fs-body`) never scaled, so the plain
`--text-*` tokens are exact for those.

**Project utilities earn a name only when the composed name says more than its expansion.**
`interactive` is "this responds to a click", which is why the four call sites read better than
`cursor-pointer select-none` would. It moved out of `shared/_global.scss` for two reasons beyond the
name: that file compiled into BOTH CSS chunks, so the rule shipped twice; and as a utility it is
finally in the same layer as everything else that behaves like one. Same `important` check applies as
below: nothing in `ui/` sets `cursor` or `user-select` on any element that carries it, so the utility's
declarations are never fought.

**`.fs-content` became a pure alias, `icon-sm` did not.** `.fs-content` was exactly one declaration,
`font-size: var(--content-font-size)`, so promoting that variable to `--text-ui` (in `theme.css`) made
Tailwind's own `text-ui` an exact replacement — no `@utility` needed. `icon-sm` composes two more
declarations than any single token expresses, so it stays a name. Its override-proof: nothing in `ui/`
sets `display`, `width`, `height`, `min-width` or `background-size` on either element that carries it
(`ActionLink`'s log icon, `LogSearchGroup`'s spell icon). `.log-event .icon` sets only
`vertical-align`, which does not collide.

**The Bootstrap utility shim is for `ui/specs/**` only.** That tree is frozen, so its one remaining
consumer of Bootstrap utilities — `specs/mage/fire/calculate_combustion_thresholds.tsx`, the
Combustion Thresholds modal — cannot be rewritten here. The six class names in the shim
(`.d-flex`, `.flex-column`, `.align-items-end`, `.justify-content-end`, `.w-100`, `.gap-3`) are the
exact set it still uses, at Bootstrap's exact values. `.gap-3` has to restate `1rem` because Tailwind's
own `gap-3` is `0.75rem`, and it wins only by following the utilities import in source order. Delete
this block together with those class names when the freeze lifts; nothing outside `ui/specs/` may use
them.

### `theme.css`

Later split into `ui/styles/theme/` (`colors.css`, `spacing.css`, `breakpoints.css`, `typography.css`, `effects.css`, `z-index.css`, `vars.css`, `specs.css`, `index.css`); the mentions below describe the single-file state at the time.

**`static` on `@theme static { ... }`** means: emit every token at `:root` even when no utility uses
it, so hand-written CSS can read them with `var()`.

**The five `--*: initial` resets are four separate decisions, not one habit** — each was re-tested
against `node_modules/tailwindcss/theme.css` and each is still load-bearing on its own:
- `--color-*` suppresses Tailwind's ~250-swatch default palette, in a codebase with its own.
- `--breakpoint-*` — the project's ladder is Bootstrap's (576/992/1200/1400 plus four high-DPI stops).
  Without the reset, Tailwind's `2xl` (1536px) would sit alongside the project's `xxl` (1400px) as a
  second, differently-sized name for the same idea.
- `--radius-*` — no radius token survives it, and that is the point: `$enable-rounded: false`. It also
  stops a `rounded` LOCAL VARIABLE in two `.tsx` files (Tailwind scans for bare candidate strings, not
  JSX attributes) from shipping a real `.rounded` rule.
- `--font-*` and `--text-*` — see the scale note below.

`--font-weight-*` is deliberately NOT reset: `font-normal`/`font-bold` use Tailwind's defaults as-is,
which is what letting a default through looks like when it genuinely matches.

**`--text-xs`/`--text-sm`/`--text-base` have the same value as Tailwind's defaults and are
re-declared anyway.** They are a trap, not a duplication: every default `--text-*` ships a paired
`--text-*--line-height`, and `text-sm` emits `line-height` only when that companion exists. Letting the
default through turns `.text-sm` from `font-size` alone into `font-size` + `line-height: calc(1.25 /
0.875)` = **1.4286** against the inherited **1.5** — measured, not assumed. `text-sm` is the one size
actually in markup, so that would have been a live regression. Above `base` the values genuinely
differ: this is Bootstrap's scale, and every `$font-size` over 1.25rem is RFS-fluid, which is why
`text-fluid-xl` exists in `tailwind.css`.

**`--text-ui` is semantic, not a scale step:** the size of form controls and dense data labels —
inputs, form labels, gear-picker labels, character stats, saved-data names. It was
`--content-font-size` in `shared/_variables.scss`, where the name said nothing; 17 SCSS rules and
`$input-font-size`, `$form-label-font-size`, `$form-select-font-size` and `$form-text-font-size` all
read it. It is NOT called `--text-body`, which is what "content" was reaching for, because it is
measurably not the body text size: body copy on these pages is 1rem/14px — **26,306 elements** against
**8,118** at this 0.75rem size — and `$custom-font-sizes` already spelled `body` as 0.875rem for
Bootstrap's `.fs-body`. A reader who wrote `text-body` expecting the default size would get a size two
steps below it.

**`--spacing-icon-sm`/`--spacing-icon-md` are the icon box scale, promoted out of
`shared/_variables.scss`** so it is one token vocabulary rather than two. `--spacing-*` is the
namespace behind `size-*`/`w-*`/`h-*`/`min-w-*`, so these now generate real utilities as well as being
readable by `var()`.

**Design system vs. GAME DATA is a deliberate namespace split.** The bare `--color-*` namespace is the
answer to "what are our colours?", and nothing else: everything under the GAME DATA heading in the file
is WoW's, and is namespaced away from it. Rename a game-data token freely; never change its value.
Namespacing them also keeps `bg-class-mage` out of `bg-primary`'s vocabulary, and — since
`sim/proto/utils.ts` builds these names by interpolation — keeps a slug from ever colliding with a real
utility, as a bare `--color-shadow` would collide with `text-shadow`/`shadow-shadow`.

**Class colours are keyed by `PlayerClasses.getCssScheme()`**, and are the values safelisted by
`tailwind.css`'s `@source inline(...)`.

**Qualities are keyed by the `ItemQuality` proto enum, via `itemQualityClassName()`.**

**Resources — primary and secondary alike — because a spec has at most one secondary**, so the two
never collide in one theme.

**`--color-damage-*` is one namespace, not the `outcome`/`metric` split it used to carry.** `damage` is
not new coinage: `shared/_variables.scss` already merges exactly these six into `$damage-colors`,
`shared/_global.scss` generates `.damage-*` from that map, and every consumer in the tree reaches them
through the `--bs-hit`/`--bs-crit`/`--bs-partial`/`--bs-miss`/`--bs-dps`/`--bs-threat` that map emits —
the Timeline's rotation rows and chart series, and CombatReplay's hit rings. So this one name spans both
colour worlds and maps one-to-one. `threat` is not literally damage, but `$damage-threat` in the
shipping SCSS already says it is, and agreeing with the code beats inventing a seventh name for one
token.

### Elsewhere: `_mixins.scss` (still living there, unedited — `.scss` is comment-safe)

`--form-check-box-bg-image`/`--form-check-radio-bg-image` are Sass-generated, not literal CSS, because
"these are custom variables but parsed SVGs can't use CSS vars so we need to assign them with Sass" —
inline SVG cannot read a `var()`, so the `escape-svg(url(...))` values are computed at Sass compile
time and only their output lands in the `:root` custom property.

---

## Stage 4 — C-1a: the parity gates compare tag trees

`parity.mjs`/`panes-parity.mjs` were class-keyed, so stages 1-3's Bootstrap-to-Tailwind renames read
as hundreds of differing lines per region with nothing structural behind them. Refit before the class
drops resume:

- `browser.mjs`'s `SERIALIZE` now emits `tag.` + sorted tokens, where tokens are the class list union
  the element's `data-testid` value (if any) — a class hook and its eventual test-id replacement
  serialise to the same line. `compareKey(line)` strips everything from the first `.` onward,
  indent kept, so `parity.mjs`/`panes-parity.mjs` compare through it: two lines are equal once their
  tag matches, whatever their tokens are. The printed diff lines stay token-keyed (the more useful
  read); only the equality check goes through `compareKey`. `matchesIntended` accepts a `RegExp` on
  either side of an `INTENDED` entry, which is what let the four structural entries below survive.
- `q(name)` is `[data-testid="${name}"], .${name}` — one selector that matches the class on the
  parent branch and the test-id on this one. `openSpec`'s default selector, `parity.mjs`'s
  `.sim-sidebar`/`.sim-ui` reads, `PROBE`'s modal-finder and every bare `'.sim-ui'` read across the
  other probe files now go through it (a page-context `page.evaluate` callback gets the selector
  string inlined instead, since it cannot close over `browser.mjs`'s `q` — `PROBE` keeps its own
  copy for the same reason).
- Every `$`-anchored or exact class regex — `ITEM_HEADER`/`ITEM_MENU`/`ITEM_TRIGGER`, `LOG_SEARCH`,
  `SEARCH_BAR_WRAPPERS`, `TABS_ROOT`, `SORT_BUTTON`, `SWAP_ICON_ANCHOR`/`SWAP_SOCKETS`,
  `LIFTED_SUBTREES`' `lift`/`parent`, `dropReplayState`'s hidden marker, and in `parity.mjs`
  `DROPDOWN_MENU`, `TOAST_PORTAL`, `TOAST_AREA`, `NATIVE_SIM_NOTICE_LINK`, `SOCIAL_WRAPPER`,
  `PANE_ROOT` — became "class anywhere in the token list": `/^div\.search-bar-input-group$/` shapes
  became `/^div\.(.*\.)?search-bar-input-group(\.|$)/`, and the two-token exact matches
  (`ITEM_TRIGGER`, `NATIVE_SIM_NOTICE_LINK`) use a new `withTokens(tag, ...tokens)` helper —
  independent lookaheads anchored right after the tag, so token order stops mattering. This is what
  keeps every helper working once a class is replaced by a `data-testid` carrying the same string, or
  gains one alongside it.
- `PROBE.idOf` tries the class/token scan **first** now (an element's DOM id named by a class token
  on the tab, resolving inside `.sim-main`), falling back to `aria-controls`. The plan called for
  `aria-controls` first; on this branch `SimTabs.tsx`'s `Tabs.Panel` carries no `id` prop (unlike the
  inner strips', e.g. `RotationTabBody.tsx:105`), so its `aria-controls` resolves to Base UI's own
  auto id — a real element inside `.sim-main`, just the wrong one, one level up from the pane that
  actually carries the semantic id (`div.sim-tab.gear-tab`). Trying the token first and `aria-controls`
  only when no token resolves is what makes pane identification work on both shapes today; flip the
  order back once `SimTabs.tsx` gets an explicit `id={tab.id}`. **Deviation from the brief**, which
  asked for `aria-controls` first. `PROBE.nameOf` now reads `dataset.testid` ahead of the `-link`
  class scan, and `simModalProbe.find` goes through `q()`.
- `intended.mjs`: entries 1-4 (the `label` → `h3`/`span` structural rewrites) survive as `RegExp`
  pairs; entries 5-21 — every one of them purely a class swap with no tag or structural change — are
  deleted, since `compareKey` no longer sees a reason for them:
  - 5: `i.fa-question-circle.far` → `i.fa-circle-question.far` (FA5→FA6 icon alias)
  - 6: `i.fa-3x.fa-exclamation-triangle.fas` → `i.fa-3x.fa-triangle-exclamation.fas` (same)
  - 7: `cooldown-action-picker`'s `hide` class — see below, already unobserved
  - 8: `table.metrics-table.tablesorter` → `table.metrics-table` (dead jQuery hook dropped)
  - 9: the results filter's `input-root` class dropped
  - 10: `dropdown-picker-button`'s `open-on-click` class dropped
  - 11: the log runner's add-filter picker's `dropup`/`input-root` → `log-search-add-picker` — see below
  - 12: `log-search-input` gains `search-bar-input`
  - 13: `log-runner-logs` gains `virtual-list`
  - 14: the bulk search's field root swaps to the `SearchBar` primitive's classes
  - 15: `input-group` → `search-bar-input-group`
  - 16: the bulk search input gains `search-bar-input`
  - 17: the bulk search's clear button gains `search-bar-clear-btn`
  - 18, 19: the batch description's `<span>`s gain `font-bold`/`text-brand` (a `className`-in-locale-
    string quirk, `LocaleHtml`'s `Trans` vs. innerHTML)
  - 20: the batch's results `tab-pane` loses `show` with no `active` — its `why` is carried below
  - 21: `hide-healing-metrics` dropped from a tank's root class on a `showThreatMetrics` fix — see below
- **The present-but-hidden-vs-conditional-mount difference is upstream's, not this unit's.** The first
  pass here treated `ItemSwapPicker`'s enabled-state block as a one-off — a scoped `dropItemSwapAtRest`
  fold matching `div.hide.input-item-swap-container` under `.item-swap-picker-root` — because
  `tools/react-migration/` is git-excluded and this worktree's copy of the gates was a stale snapshot
  taken 09-11 21:52. `wt/unmount-hidden` (`e103a43db`, "unmount what `showWhen` used to render as
  `class="hide"`") landed on `feature/ui-react` afterwards and was merged into this branch's ancestry
  at 15:26 the same day — general, not item-swap-specific: the sidebar's warning trigger, the header's
  known-issues link, `settings-tab`'s `list-picker-items`, gear-tab's tinker/reforge anchors, the
  results-pane halves and item swap all stopped rendering their hidden half. The React worktree
  (`~/personal/wowsims-mop-react`) picked that up in its own copy of the gates at 12:04 the same day;
  this branch's copy did not, because nothing re-syncs an untracked directory across worktrees. What
  read as five separate structural regressions (`ContentBlock`'s wrapper, `saved-data-create-container`
  shifting by one line, the warning triangle, the known-issues link, item swap) was one cause once the
  copies were reconciled.
  The fix is `browser.mjs`'s `HIDDEN`/`countOutermost`/`dropHiddenSubtrees`/`VISIBLE_DESPITE_HIDE`/
  `SHOWN_COUNT`, three-way merged in from the React worktree's copy (`git merge-file` against the
  pristine pre-refit baseline, four conflicts total — import lists and two local variables, all
  resolved by keeping both sides). `dropHiddenSubtrees` drops every **outermost** `.hide` subtree from
  **both** sides before any other fold runs, so the comparison is honest about what each build actually
  shows rather than what it built; `VISIBLE_DESPITE_HIDE` (in the page) and the survived/capped counts
  (in the tree) are what keep it from being a silent escape hatch. `dropItemSwapAtRest` and
  `ITEM_SWAP_CONTAINER` are deleted — a special case the general fold now subsumes — and `parity.mjs`'s
  `swapIcons` is upstream's `SHOWN_COUNT`-based one (what each side *shows*, comparable by equality on
  both sides, on or off by default alike), paired with `swapIconsBuilt` (a raw count, what the count
  behind `dropSwapModals` needs, since the baseline still builds one selector modal per icon whether or
  not the row is shown). `REFORGE_GROUP`/`COMBUSTION_BUTTON`/the `.item-swap-picker-root` half of
  `SWAP_ICONS` moved to `q()` forms (`:is(...)` groups the alternation ahead of the descendant
  combinator in `SWAP_ICONS`, or the `[data-testid]` half would read as a second top-level selector
  rather than a scoped ancestor); `.hide` itself stays a bare class — it is a state class C-2 rewrites,
  not a structural hook.
  Nine single-sided probes changed for the same `wt/unmount-hidden` work and were synced from the React
  worktree wholesale: `bulk-tab.mjs`, `gear-tab.mjs`, `results-tables.mjs`, `results-tabs.mjs`,
  `selector-modal.mjs`, `settings-tab.mjs`, `sim-progress.mjs`, `timeline.mjs`, `topline-metrics.mjs`.
  The last two also carried this unit's own `'.sim-ui'` → inlined-selector edit, so those two were
  three-way merged (both merged with zero conflicts) rather than overwritten outright.
- **Entry 7's finding, carried forward**: `IconEnumPicker.tsx`'s `hidden` (from `iconEnumPickerShown`)
  is read on every render, first one included — the picker has since moved from a `hide` class to
  fully unmounting (`PickerShell.tsx:31`, `if (hidden) return null;`), so the class-based entry 7 was
  already unobserved before this refit (per the plan's own note). `IconEnumPicker.test.tsx:279`,
  "renders no picker at all unless some option carries an actionId and is shown", already asserts this
  on a fresh `mount()` — no new test was needed.
- **Entry 11's finding, carried forward**: no test asserted the log runner's add-filter picker opens
  upward. Added `LogSearchBar.test.tsx`'s "opens the add-filter menu upward and out of flow, for the
  drawer it clips against", asserting the positioner's `data-side` is `'top'` and `position: 'fixed'`
  — precedent `DropdownPicker.test.tsx:138`. `LogSearchBar` owns `.log-search-add-picker`, not
  `LogSearchGroup`, which owns the per-group value pickers instead.
- **Entry 20's `why`, carried verbatim**: "the batch's results pane. Vanilla shipped it
  `class=\"tab-pane fade show\"` — `show` with no `active` — which is inert either way: `.tab-pane` is
  `display: none` until `.active`, so the pane was hidden and its opacity never mattered. The React
  strip drives both classes from the panel's own transition status through `tabPaneClass`, so a pane
  that is not open carries neither. One results pane, and no other pane in the tree ships `show`
  without `active`."
- **Entry 21's deviation**: the plan named `ui/app/shell_classes.test.ts` for the regression test
  ("`data-hide-healing` follows `showThreatMetrics` on a tank"). `shell_classes.ts` is pure —
  `simUiClasses`/`metricVisibilityClasses` take a `MetricVisibility` object and derive nothing from
  `showThreatMetrics` themselves — so a test there could only assert the identity function. The actual
  derivation is `Sim.getShowHealingMetrics()` (`ui/sim/sim.ts:915`, ORs `showHealingMetrics` with
  `showThreatMetrics` on the five tank specs), read through `ui/sim/hooks/useDisplayMetrics.ts:38`,
  which is what the shell root's `hide-healing-metrics` class is now sourced from. Added
  `ui/sim/hooks/useDisplayMetrics.test.ts` instead, modelled on `useStoreField.test.tsx`'s duck-typed
  `Sim` fake: a `createSimStore()`-backed store plus `getShowDamageMetrics`/`getShowThreatMetrics`/
  `getShowHealingMetrics` mirroring `sim.ts`'s own derivation, asserting the healing flag flips on a
  tank spec when `showThreatMetrics` is toggled on with no write to `showHealingMetrics`, and does not
  flip on a non-tank spec.

Also touched, mechanically: 30 `'.sim-ui'` reads across the other probe files, inlined to
`'[data-testid="sim-ui"], .sim-ui'` (the evaluate callbacks that hold them run in the page and cannot
close over `browser.mjs`'s `q`); `stat-weights.mjs`'s three (`.sim-ui.blurred`,
`.sim-ui.hide-threat-metrics`), `css-vars.mjs` and `tw-probe.mjs` are untouched, per the plan (the
first two are C-2's, the third is a later step's).

**README.md**: the `parity.mjs`/`panes-parity.mjs` table rows now say they compare tag trees keyed by
position and ignore class lists.

## Stage 4 — C-1b: the rendering probe widened, css-vars retired

`tw-probe.mjs` gained a third width, a wider spec list, all six tabs by pane id instead of four by
link text, and a `results-stuck` capture; `css-vars.mjs` was deleted outright.

- **Widths: `[2200, 1600, 700]`, was `[1600, 700]`.** 2200 is the untested regime: `theme.css`'s root
  font-size switches from 14px to 16px at 1921px, and nothing below this unit had ever rendered above
  that line. A layout bug that only shows up once `1rem` is a sixth larger — a padding that overflows,
  a flex item that wraps a line early — would have shipped invisibly at every width this probe used to
  cover.
- **Specs: `+warrior/protection`.** Carries the tank `data-*` root state (`hide-threat-metrics` et al,
  the same reason `browser.mjs:26` already added it to the shared `SPECS` list) — the two DPS specs
  never exercise it.
- **`TABS` and `openTab`: pane ids, not link text or hrefs.** Vanilla's tab strip is anchors, so the
  old `openTab` matched `href === '#<name>-tab'` or the lowercased link text. React's strip
  (`ui/app/SimTabs.tsx`) is Base UI: `<button role="tab" className={clsx('sim-tab-link', tab.id)}>`,
  no `href`, and the batch tab's visible text is "Batch" plus a `TabBadge` — neither predicate matches
  anything. `TABS` is now the six pane ids `SimTabDef` registers
  (`ui/app/SimTabsSection.tsx`): `gear-tab`, `settings-tab`, `talents-tab`, `rotation-tab`,
  `detailed-results-tab-tab`, `bulk-tab`. `openTab` now scans `[role="tab"]` for the first visible one
  whose class list contains the id or whose `aria-controls` equals it — the class check is what
  actually fires (Base UI's `aria-controls` points at a generated panel id, not the pane id string),
  the attribute check is kept as the future-proof fallback the plan asked for.
- **`waitForSelector` reads `q('sim-ui')`, not the bare class.** `q`, exported from `browser.mjs`,
  matches `.sim-ui` and its `data-testid="sim-ui"` replacement, so the probe survives whichever one a
  given build ships.
- **`results-stuck`.** After the six-tab loop (which leaves `bulk-tab` open, the last entry), the
  results tab is re-opened, the sim root is scrolled 400px
  (`document.querySelector(q('sim-ui'))?.scrollTo({ top: 400 })`, evaluated in the page — precedent
  `header-toolbar.mjs`'s own `.sim-header` sticky check, which scrolls the same root the same way),
  settled ~700ms, then snapshotted and screenshotted like every other key. It exercises the sticky
  toolbar mid-stick, a state none of the six at-rest tab captures reach.
- **`css-vars.mjs` retired.** Its only floor was the `--bs-modal-*` family: it asserted that any
  element resolving `var(--bs-modal-*)` outside Bootstrap's own `.modal` scope matched what the
  baseline resolved there too (that was how the progress tracker's missing border was caught). A-S1
  removed Bootstrap's `modal` import outright, and `/usr/bin/grep -rn -- "--bs-modal" ui` now returns
  only two comments (`_bootstrap_style_overrides.scss`'s explanatory note and the deleted gate's own
  header, gone with it) — zero live reads. A gate whose watched properties no longer exist anywhere
  can only ever report "0 declarations found" or pass vacuously; neither tells anyone anything, so it
  is deleted rather than kept as dead weight. Its README row and run-block line are removed; the
  README's new `tw-probe.mjs` section carries the one-sentence retirement note instead of a table row
  for a file that no longer exists.

## Stage 4 — A-S3: `--bs-*` reads → project tokens

Every `var(--bs-X)` read across `.scss`/`.css`/`.ts`/`.tsx` was renamed to the matching project token
(`theme.css`'s `@theme static` block, or the pre-existing `:root` twins for tabs/tooltips). The
starting census (340 reads, 79 names) ended at exactly three residual reads: `--bs-gutter-x` (×2,
`tailwind.css`'s `@utility container`, self-declared and out of scope until U-landing) and
`--bs-btn-disabled-bg`/`--bs-btn-disabled-color` (`_sidebar.scss:114,128`, deliberately left — see
below).

**Value-identity proof source.** Every rename was checked against the Bootstrap `:root` block in the
built baseline bundle: the `--bs-*` custom property's value there equals the corresponding
`theme.css` token's value. `--bs-body-bg`, `--bs-body-color`, `--bs-border-color`,
`--bs-secondary-color`, and `--bs-link-*` all carry a second value under a `[data-bs-theme=dark]`
override in Bootstrap's stylesheet, but that selector is never active in this app (no
`data-bs-theme` attribute is ever set), so only the root value was load-bearing.

**Why Group B (alpha colours) is written as literals, not `rgba(var(--x-rgb), a)`.** Chrome computes
`color-mix(in srgb, #fff 80%, transparent)` to `color(srgb 1 1 1 / 0.8)`, but computes
`rgb(255 255 255 / 0.8)` to `rgba(255, 255, 255, 0.8)` — two different serializations for the same
color. The rendering probe diffs computed style strings, so a static alpha color has to be written in
whichever form the probe already expects for these exact sites, which is the literal
`rgb(r g b / a)`/`rgba(...)` form Bootstrap itself was emitting. The one exception is
`Timeline.scss:190`'s `rgba(var(--bs-primary-rgb), 0.5)`, which sits on a `:focus-visible` box-shadow
the rendering probe never exercises — that site was converted to
`color-mix(in srgb, var(--color-primary) 50%, transparent)` instead, since nothing pins its computed
form and `color-mix` tracks the token going forward.

**Three deviations from the plan, as instructed to record:**
1. `_bootstrap_style_overrides.scss:5-6` (`--bs-body-font-family` / `--bs-body-line-height`) were
   *not* deleted, contrary to the plan's text. They're declarations Bootstrap's `reboot` still reads
   for `body { font-family; line-height }`; deleting them now would drop body line-height to the
   browser default (1.5) until `reboot` itself is removed at step 26. They stay until then.
2. `_sidebar.scss:114,128` (`var(--bs-btn-disabled-bg)` / `var(--bs-btn-disabled-color)`) were left
   untouched. They resolve inside the themed `.btn-primary` scope, and their replacement tokens
   (`--color-primary-disabled`, `--color-primary-disabled-foreground`) don't exist yet — they're
   created by the next step, B0.
3. The plan's correction (3) guessed `.import-link` (one of the `--bs-nav-link-*` read sites) had no
   `.nav` ancestor. It does — `SimShell.tsx:100-101` renders `import-export nav` — so all eight
   `--bs-nav-link-padding-y`/four `-padding-x`/one `-font-size` reads resolve to `.nav`'s scope
   values, which are exactly the `--tab-padding-y`/`--tab-padding-x`/`--tab-font-size` `:root` twins
   already in `theme.css`. Renamed straight to those, no new tokens needed.

**`$gray-800` deletion proof.** `_bootstrap_style_overrides.scss:2` declared `$gray-800: #323232`, a
Sass variable. Its only reader, `_variables.scss:83` (`gray-800-alpha-50: rgba($gray-800, 0.5)`),
evaluates before that declaration line in Sass's import order, so it was already picking up
Bootstrap's own `$gray-800` default (`#343a40`) — confirmed by the built bundle's
`--bs-gray-800-alpha-50` resolving to `#343a4080`, not `#32323280`. The override line was dead. It's
deleted, and `theme.css`'s `--color-gray-800` is corrected from `#323232` to `#343a40` to match what
was actually rendering; no `gray-800` Tailwind utility exists anywhere in `.ts`/`.tsx`, so nothing
visible changes.

**`--font-size-root` mechanism.** `_global.scss`'s old `--bs-body-font-size` (14px, 16px at 1080p) is
renamed to `--font-size-root`, still set on `:root` and read by `html { font-size }`. Bootstrap's
`reboot` then reads its own `--bs-body-font-size: 1rem` for `body { font-size }`, which resolves to
the same pixel value because `html` already carries the root size — `1rem` is relative to `html`'s
font-size, not a hardcoded value, so the two layers stay in sync without any Bootstrap variable being
touched.

**The six spacing tokens** (`--spacing-block`, `--spacing-gutter`, `--spacing-gutter-sm`,
`--spacing-page`, `--spacing-section`, `--spacing-cell`) replace `--block-spacer`, `--gap-width`,
`--gap-width-sm`, `--container-padding`, `--section-spacer`, `--table-cell-padding` respectively,
added to `theme.css`'s `@theme static` block so they're real Tailwind-visible tokens rather than
private `:root` twins. The eleven now-dead declarations they replaced (`--table-cell-padding`,
`--container-padding{,-lg,-xxl}`, `--section-spacer{,-sm,-lg,-xxl}`, `--block-spacer`, `--gap-width`,
`--gap-width-sm`) are deleted from `theme.css`'s `:root {}` block. The responsive overrides
(`_global.scss`'s `@include media-breakpoint-up(lg/xxl)` blocks, which used `!important` to beat the
`:root` declaration under Sass's Bootstrap-driven cascade) move to `theme.css` itself as two plain
`@media` blocks appended after `:root {}`, with no `!important`: an unlayered `:root` rule already
beats the layered `@theme static` emission on specificity/cascade-layer order alone, so the
`!important` escape hatch is no longer needed. The `lg` values are unchanged (`section-spacer-lg` was
`calc(container-padding-lg / 2)` = 1.5rem; `xxl`'s was `calc(container-padding-xxl / 2)` = 2rem).

**Two harmless residual text matches**, not live tokens, left as-is because this step touches only
`var(--bs-*)`/spacing-token reads, not prose or unrelated identifiers: `LogRunner.scss:8`'s comment
still says `` `--container-padding` `` (stale prose reference, not a rule against touching comment
*content* the brief didn't ask to edit); `_bulk_tab.scss:117,124`'s local custom property
`--bulk-gear-combo-gap-width` contains `gap-width` as a substring of its own name, not a read of the
deleted `--gap-width` token.

## Stage 4 — B0 / A-U0: portal container default, vendor.css, primary-derived and z tokens

`usePortalContainer` (`ui/ui-kit/hooks/usePortalContainer.ts`) gives `Dialog`, `Popover` and
`ToastArea` a `PortalContainerContext` fallback for their `container` prop, so every consumer that
used to pass `container={host.rootElem}` (or, in `SimShell`, `container={rootEl}` on its own
`ToastArea`) can drop that prop entirely. The default is tree-neutral by construction: `host.rootElem`
is `dom.root` (`ui/app/individual_sim_ui.tsx:107`), the same `.sim-ui` element `SimShell` stores as
`rootEl` and now provides through `PortalContainerContext` (`ui/app/SimShell.tsx`), and
`landing_entry.tsx` provides its own `#root` the same way. So every portal keeps landing exactly where
it does today — nothing moved, nothing new was inserted into the tree. An explicit `container` prop
still wins over the context (`container ?? portalContainer ?? undefined`); the sites that keep one
pass something the context can't provide — `headerElem`, `group`/`slot`/`dropend` anchors,
`host.simActionsContainer`, a `container` variable threaded from a caller, `ImportWarning.tsx`'s
`container={host}`, and `NoticeNativeSim` — plus the two `container={host.rootElem}` sites frozen in
`ui/specs/**`. `ReforgePanel.tsx`'s settings popover keeps forwarding its own `container` prop
unchanged (no more `?? host.rootElem` fallback); its progress-tracker dialog drops the prop entirely,
same as every other now-parameterless dialog.

One correction versus the brief: `container ?? portalContainer` alone is not safe — Base UI's
`FloatingPortal` treats an explicitly-passed `container={null}` as "wait for the container to be
resolved" and never renders (see `useFloatingPortalNode` in
`node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.js`), which is different
from an `undefined` prop, where it falls back to `document.body`. `PortalContainerContext`'s default
(no provider above) is `null`, so without a final `?? undefined` every dialog/popover/toast rendered
outside a provider (most component tests) silently stopped rendering at all. All three components use
`container ?? portalContainer ?? undefined`. A handful of existing tests that asserted `container=
{host.rootElem}` behavior (`FiltersMenu.test.tsx`, `Importer.test.tsx`, `ReforgePanel.test.tsx`,
`EpWeightsDialog.test.tsx`) needed the same fix production code gets: they now wrap their `render()`
call in `<PortalContainerContext value={rootElem}>` (or `host.rootElem`) alongside their existing
`SimHostProvider`, instead of relying on a `container` prop the component no longer takes.

`vendor.css` (`ui/styles/vendor.css`, imported unlayered before `tailwindcss/utilities.css`) carries
three react-tooltip rules straight from `Tooltip.scss` (untouched — B0 deletes no SCSS, U1 does):
`.sim-tooltip`'s `z-index` and `--rt-opacity: 1`, its `[class*='styles-module_content']` padding, and
the `--unpadded` override. `--rt-opacity: 1` exists because a flat `opacity: 1` on react-tooltip's
generated class would kill its closing transition — the tooltip unmounts only on `transitionend`, so
without the custom property overriding react-tooltip's own closing-opacity variable, the tooltip would
either vanish instantly or never unmount. Measured but not carried: `[data-base-ui-inert]`. Base UI
1.7.0 applies that attribute through `markOthers` to elements *outside* an open modal dialog, so
`SimTitleDropdown.scss:4`'s selector is live, but the attribute lands on our own `.sim-title-dropdown`
element rather than something vendor.css would need to reach into — it converts to an inline
`data-[base-ui-inert]:` Tailwind variant at U3, not a vendor.css rule.

The A-U0 tokens add two families to `theme.css`'s `@theme static` block. The primary-derived set
(`--color-primary-hover/-active/-dampened/-disabled/-disabled-foreground`) gets `color-mix()`
fallbacks at `:root` scope (hover/active at Bootstrap's 30%/20% black-mix shade amounts —
`$btn-hover-bg-shade-amount` is 30% per `_variables.scss:247`, active keeps Bootstrap's default 20%)
and, separately, literal Sass values re-declared inside `theme-color` in `_mixins.scss` (replacing the
deleted `--primary-dampened`, whose one reader — `_saved_data_manager.scss:52` — now reads
`--color-primary-dampened`). Both are needed, not redundant: a custom property's `var()` reference
resolves relative to the element the property is declared *on*, so a `:root` fallback using
`var(--color-primary)` would never see a spec's `--color-primary` override further down the tree
inside `.sim-ui`'s spec-root class — the mixin has to re-declare the literal Sass-computed color right
there. The mixin literals also keep the rendering probe's computed value in its native `rgb(...)` form
inside `.sim-ui`, whereas a `color-mix()` declaration serialises its computed value as
`color(srgb ...)` instead — a form the probe doesn't expect. `--color-surface-raised` and
`--color-surface-hover` are added the same way at `:root`, copying `--dropdown-bg` and
`--dropdown-link-hover-bg`'s existing `color-mix()` values verbatim. The two leftover `--bs-btn-disabled-*`
reads A-S3 left behind are picked up here: `_sidebar.scss:114` → `--color-primary-disabled`,
`:128` → `--color-primary-disabled-foreground`.

The nine `--z-*` renames (`theme.css`'s `:root {}` block, values unchanged): `--header-z-index` →
`--z-header` (100), `--sidebar-z-index` → `--z-sidebar` (200), `--tooltip-z-index` → `--z-tooltip`
(1080), `--toast-z-index` → `--z-toast` (9999), `--dropdown-zindex` → `--z-dropdown` (1000),
`--modal-zindex` → `--z-modal` (1055), `--modal-backdrop-zindex` → `--z-modal-backdrop` (1050),
`--modal-elevated-backdrop-zindex` → `--z-modal-elevated-backdrop` (1060), `--modal-elevated-zindex` →
`--z-modal-elevated` (1065). All 16 code reads across 13 `.scss` files were repointed at the new names;
the one prose mention in `_sticky_toolbar.scss:11`'s comment (`... less than var(--header-z-index)
...`) is left as literal text, untouched, per the brief.

## Stage 4 — A-S4: colour single-source, the theme layer as CSS

`theme.css` is now the only place a spec's colour theme is defined. The 34-entry `$sim-themes`
Sass map in `ui/scss/sims/sim.scss` and the `theme-color()` mixin in `ui/scss/shared/_mixins.scss`
(which turned each map entry into a per-spec `.<spec>-sim-ui { ... }` block via Sass colour math)
are both deleted; nothing else in the tree read `map.get`/`color.mix` for theming, so nothing else
needed to change to keep emitting the same custom properties.

The derivation formulas move to plain CSS `color-mix()` on `.sim-ui` instead of Sass:
`--theme-background-color` is 10% `--color-primary` over black (matching the old `mix($black,
$base-color, 90%)`, which is 90% black / 10% base); `--color-primary-hover` is 70% primary over
black, `--color-primary-active` 80%, `--color-primary-dampened` 25%; `--color-primary-disabled` is
50% `--color-gray-600` mixed with primary. The five primary-derived tokens (`--color-primary-hover`,
`-active`, `-dampened`, `-disabled`, `-disabled-foreground`) stay declared twice: once in
`@theme static` against the plain `--color-primary` default, which is what makes Tailwind emit the
`bg-primary-hover` / `text-primary-disabled-foreground` utilities other units consume (a token
missing from `@theme static` means the corresponding utility class emits nothing, silently, so it
can't only live on `.sim-ui`) — and again, identically, on `.sim-ui`, because a custom property
inside a `var()` fallback or a `color-mix()` argument resolves against the element it is declared
on: a `:root`/`@theme` declaration can never see the `--theme-color` a spec's root class sets, so
the per-spec values need their own declaration on the element (`.sim-ui`) that actually carries
both the spec class and the theme colour. Each of the eleven classes gets one grouped rule
setting `--theme-color` / `--theme-color-foreground` to `var(--color-class-<x>)` /
`var(--color-class-<x>-foreground)`, and `.sim-ui`'s own `--color-primary: var(--theme-color,
#0d6efd)` picks that up (or falls back to Bootstrap blue outside any spec root).

The eleven foreground literals (`#fff` for death-knight and shaman, `#000` for the other nine)
are hand-measured matches for Bootstrap's `color-contrast()`, and a new vitest
(`ui/styles/theme.test.ts`) parses `theme.css`'s eleven `--color-class-<x>` / `-foreground` pairs
and recomputes WCAG 2 relative luminance / contrast ratio against both black and white, asserting
each foreground is the one `color-contrast()` would have picked — so the literals can't silently
drift from the colours next to them. It lives at `ui/styles/theme.test.ts` rather than
`ui/ui-kit/utils/`, since the vitest `include` glob (`ui/**/*.test.ts`) already covers
`ui/styles/**` and colocating it with `theme.css` avoids an import across the tree.

The two `--form-check-box-bg-image` / `--form-check-radio-bg-image` data-URL SVGs can't hold a
`var()` (parsed SVG attributes don't resolve custom properties), so — as before — they exist as
literal strings, just four of them now instead of 68: one box/radio pair with a `#000` stroke on
`.sim-ui` (default, for the nine `#000`-foreground classes) and one pair with `#fff` re-declared on
the six death-knight/shaman spec roots. All four literal strings were copied byte-for-byte out of
the last built bundle (`dist/mop/bundle/spec_entry-o7Nm4psv.style.css`) rather than re-encoded by
hand, so the escaped SVG markup is guaranteed identical to what Sass's `escape-svg()` used to emit.

The 68 old `.<spec>-sim-ui .btn-primary` / `.btn-outline-primary` blocks (34 specs × 2) become two
rules, `.sim-ui .btn-primary` and `.sim-ui .btn-outline-primary`, in
`_bootstrap_style_overrides.scss`. Both keep the old rules' `(0, 2, 0)` specificity (two classes,
zero IDs, zero elements) so they still outrank Bootstrap's own `.btn-primary`; only the `--bs-btn-*`
values change, from a literal Sass colour to a `var(--color-primary...)` chain that now resolves
per spec through `.sim-ui`'s cascade instead of per spec through a hand-written block.

The three consumers of `rgba(var(--theme-background-color), var(--theme-background-opacity))`
(`_shared.scss:87-88`, `_sticky_toolbar.scss:29`) become
`color-mix(in srgb, var(--theme-background-color) calc(var(--theme-background-opacity) * 100%),
transparent)`, because `--theme-background-color` is now a `color-mix()` result itself (a genuine
color value) rather than an `r, g, b` triplet string that `rgba()` could splice channels out of.
`_saved_data_manager.scss:47`'s `var(--theme-component-text-color)` becomes
`var(--color-primary-foreground)` — the same value, now under the vocabulary the rest of the theme
layer uses. `_global_old.scss`'s `:root { --theme-background-* }` block is deleted outright: nothing
outside `.sim-ui` ever read those three properties, and `.sim-ui` itself always overrides them now.

Chrome serialises a `color-mix()` computed value as `color(srgb r g b / a)` rather than
`rgb()`/`rgba()`, so `tw-probe.mjs`'s `SNAP` gained a `normalizeColor()` step applied to every
computed-style read: it matches `color(srgb ...)` (with or without an alpha channel), converts the
0-1 channel floats back to 0-255 integers, and reprints as `rgb(r, g, b)` (alpha absent or 1) or
`rgba(r, g, b, a)` otherwise, with alpha rounded to three decimals so `0.95` still prints as `0.95`.
The pre-Tailwind baseline never emits `color(srgb ...)` for anything the probe reads, so the
normaliser is a no-op on that port and only changes what the Tailwind port's snapshot looks like.

Net effect on `theme.css`: one ~230-line Sass map + 76-line mixin (used only to emit 34 near-copies
of the same nine-property block) is replaced by a `.sim-ui` base block, eleven colour-group rules,
one six-class form-check override, ~21 background-image rules (grouped by shared image), and one
opacity override for the three hunter specs — well under half the line count of the generated CSS
it replaces, with the actual color math now visible as plain `color-mix()` instead of buried in
Sass function calls resolved at build time.

The probe's `normalizeColor()` channel rounding needed a small epsilon fix: `--color-primary-disabled`
is a 50/50 `color-mix`, so its channels sit at exact half values (e.g. warrior 136.5/117.5, mage
106.5/182.5). Sass rounds a `.5` up, but Chrome serialises `color(srgb ...)` with six decimal
places, and `0.535294 * 255 = 136.49997` — 3e-5 below the true half — so a plain `Math.round` on
the disabled `.btn-primary` rounded down instead (`rgb(154, 136, 117)` vs Sass's
`rgb(154, 137, 118)`, `rgb(106, 161, 182)` vs `rgb(107, 161, 183)`), a 63-section false divergence.
`chan()` now rounds `v * 255 + 1e-4`: the epsilon is far below the 1/255 spacing between any two
non-half channel values, so it only nudges the printed-half cases back up to match the paint
rounding, and changes nothing else.

## Stage 4 — A-S5: static colour lookups; the three utilities

The six `@each` loops in `_global.scss` (`item-quality-*`, `resource-*`, `damage-*`, `faction-*`,
`spell-school-*` + `bg-spell-school-*`, plus the multi-school gradients) interpolated a Sass map
key into a class name at build time, so the seven call sites that built the matching class with a
JS template literal (`` `spell-school-${x}` ``, `` `bg-class-${x}` ``, `` `text-class-${x}` ``, …)
were invisible to Tailwind's content scanner — the only reason `tailwind.css` carried a hand-written
`@source inline("{text,bg,border}-class-{…}")` safelist for the three worst offenders. Every one of
those call sites now indexes a static `Record<string, string>` in the new `ui/ui-kit/utils/colors.ts`
(`QUALITY_TEXT`, `RESOURCE_TEXT`/`SECONDARY_RESOURCE_TEXT`, `SPELL_SCHOOL_TEXT`/`SPELL_SCHOOL_BG`,
`FACTION_TEXT`, `CLASS_TEXT`/`CLASS_BG`/`CLASS_BORDER`, `DANGER_TEXT`) whose values are string
literals — every class name the scanner needs to see is now sitting in a `.ts` file, verbatim, so
the safelist is gone along with the loops it existed only to cover.

The nine multi-school gradients (`astral`, `shadowflame`, `spellfire`, `spellfrost`, `frostfire`,
`shadowfrost`, `plague`, `firestorm`, `elemental`) become core `bg-linear-to-r` utility stacks with
the `/srgb` interpolation modifier — `bg-linear-to-r/srgb from-school-<a> to-school-<b>` (plus
`via-school-<mid>` for `elemental`). Tailwind v4's gradients interpolate in `oklab` by default;
the modifier is load-bearing because the original `_variables.scss` gradients were plain CSS
`linear-gradient(90deg, …)`, computed in sRGB, and an oklab interpolation between the same two
endpoints produces different intermediate pixels even though the endpoints themselves match.

`DamageResult.tsx` used to stack `text-danger` with the interpolated `spell-school-<x>` class and
let the `!important` loop rule win the cascade fight for `color`. Two Tailwind `color` utilities on
one element are unordered (whichever the compiler emits last in the stylesheet wins, not source
order in the class list), so the fix is to never emit both: `schoolClass ?? 'text-danger'` picks
`SPELL_SCHOOL_TEXT[school]` when a school is present and falls back to `text-danger` only when it
is not — the same rendered outcome as before (the loop rule's `!important` always beat `text-danger`
when a school existed), reached by replacement instead of a cascade fight this time.

`topline_metrics.ts`'s `dangerLevel` (`'safe' | 'warning' | 'danger'`) is looked up through the new
`DANGER_TEXT` record rather than staying the three bare literal class names it used to pass through
as `extraClass`. All three grades match `_global_old.scss`'s current, active rules exactly: `.safe,
.positive { color: var(--color-success) !important; }` (still imported from `ui/scss/index.scss`
today) is why `safe` maps to `'text-success'` rather than being left uncoloured — an earlier draft
of this record wrongly assumed `.safe` had no rule and left it `undefined`; it does, and dropping
the colour would have been a rendered-output regression. That mapping dies together with
`_global_old.scss` at whichever unit retires it (U-base): once the file is gone, `'text-success'` is
just an ordinary Tailwind utility with no special-case history to account for. `warning` and
`danger` do match `_global_old.scss`'s existing `.warning`/`.danger` rules exactly
(`text-damage-partial` plus the triple `text-shadow`, and `text-danger`, respectively), since those
two are still in active use elsewhere and changing them
was out of scope.

The class-colour table (`CLASS_TEXT`/`CLASS_BG`/`CLASS_BORDER`) lives in `ui/ui-kit/utils/colors.ts`
for every caller except `ui/sim/proto/utils.ts`'s `textClassName`/`textClassNameForClass`/
`textClassNameForSpec`: `.oxlintrc.json` forbids `ui/sim` from importing `@ui-kit`, so
`ui/sim/proto/utils.ts` keeps its own literal `CLASS_TEXT` table (the same eleven entries,
duplicated rather than imported) and `textClassName` now indexes it instead of building
`` `text-class-${className}` ``. The duplication is the cost of the layering rule; the alternative
would have been moving `getCssScheme`'s callers into `ui-kit`, which was out of scope here.

The interpolated `color: var(--bs-#{$label})` the six loops emitted is exactly why A-S3's earlier
census of literal-class markup never listed `.item-quality-*` / `.resource-*` / `.spell-school-*`
etc. as Tailwind-utility candidates in the same pass as the rest of `_global.scss` — the loops
themselves were invisible to a static read of the file (the class names only exist after Sass
expands the `$item-quality-colors` etc. maps), so they only became visible once their generated
output was traced from the call sites forward. They are gone now, along with `$damage-colors`'
loop, which had no emitter at all (`grep` found zero call sites for any `damage-<x>` class) and is
simply deleted rather than ported to a lookup table nothing would ever index.

The three new `@utility`s (`focus-ring`, `focus-ring-inset`, `active-underline`, `fade-in-out`) sit
in `tailwind.css` unworn — no markup in this unit's scope references them yet — verified to compile
cleanly (including the `&::after` and `&[data-starting-style]`/`&[data-ending-style]` nesting)
via a throwaway `@tailwindcss/cli` build against a scratch HTML file carrying all four classes; all
four rules appeared in the generated output. Their override proofs, for whichever unit wires them
onto markup next: `focus-ring` matches the non-`!important` `outline`/`outline-offset` pair every
one of its eight carriers sets today (`SimResultsPanel.scss:14`, `MetricsTable.scss:10,22`,
`ItemSwapPicker.scss:9`, `GearPicker.scss:11`, `GlyphsPicker.scss:35,62`, and the canonical
`_global.scss:163` `a:focus-visible, button:focus-visible` rule this brief's `_global.scss` diff
left untouched); `focus-ring-inset` is the same pair with a negative offset, matching
`GearPicker.scss:86`. `active-underline` reproduces `_header.scss:18-30` and
`_sticky_toolbar.scss:14-26`'s shared eleven-declaration `::after` byte-for-byte, including the
`calc(100% - 2 * var(--spacing-page))` width and the `width 0.15s ease-in-out` transition, so a
`data-[stuck]:` variant can drive it. `fade-in-out` reproduces the `transition: var(--transition-fade)`
plus starting/ending-style opacity pattern shared by `Dialog.scss:10-13,30-37,54`,
`Popover.scss:20-23`, `Toast.scss:50-57`, and `ProgressTrackerDialog.scss:8`; `SimTabs.scss:55-57`
only sets the enter-only half of that pattern (no exit transition), so a future caller wiring
`fade-in-out` onto `SimTabs` markup should confirm that is deliberate rather than assume full parity.

## Stage 4 — B-U1b: Tooltip, Popover, ConfirmPopover, SearchBar as utilities

`ui/ui-kit/Tooltip/classes.ts` exports `TOOLTIP_SURFACE = 'p-0 border border-surface-border rounded-none bg-overlay text-white text-sm font-normal'`. Token map: `--tooltip-border` → `border-surface-border` (`--color-surface-border`); `--tooltip-bg` → `bg-overlay` (`--color-overlay`); `--tooltip-body-color` → `text-white` (`--color-white`); `--btn-font-size` → `text-sm`; `--tooltip-max-width(-lg/-sm)` → the `max-w-[15vw] max-xl:max-w-[25vw] max-md:max-w-[75vw]` default ladder; `--tooltip-body-padding-x/y` (`--spacer-2` = .5rem) → `px-2 py-2` on Popover, `p-0` (react-tooltip's own content padding, in `vendor.css`, is unchanged) on Tooltip. The three react-tooltip rules already duplicated in `vendor.css` (`z-index`, content padding, `--unpadded` content padding) were dropped from `Tooltip.scss` with no replacement — `vendor.css` already carries them, keyed on the same `sim-tooltip`/`sim-tooltip--unpadded` classes Tooltip.tsx still emits.

`Tooltip` gained `width?: string`, `maxWidth?: 'default' | 'none' | string` (default → the ladder above), `align?: 'start' | 'center'` (`'start'` → `text-left`), `padded?: boolean` (`false` → `sim-tooltip--unpadded`, read by vendor.css). Composed as `clsx('sim-tooltip', TOOLTIP_SURFACE, maxWidthClassName, width, align === 'start' && 'text-left', padded === false && 'sim-tooltip--unpadded', className)`.

Six piggybacks absorbed into these props (box rule deleted from the feature `.scss`, content residue re-rooted without the `.sim-tooltip`/`.sim-popover-popup` compound):
- `DropdownPicker` (`DropdownMenu.tsx`'s shared option tooltip): `maxWidth="max-w-[35vw]" align="start"`.
- `CharacterStats`/`BonusStatsLink` bonus-stats popover: `align="start"`; `.number-picker-root` residue re-rooted as `.bonus-stats-popover .number-picker-root` (its `margin:0 !important` is untouched here — out of scope for this unit, a later unit removes it with `_number_picker.scss`).
- `ReforgePanel` settings `Popover`: `maxWidth="max-w-[350px] max-lg:max-w-[min(350px,calc(100dvw-var(--settings-button-width,36px)-var(--spacer-3)*2))]"` + `className="reforge-optimiser-popover min-w-[300px]"`; `.saved-data-manager-root` residue re-rooted as `.reforge-optimiser-popover .saved-data-manager-root`. Soft-caps `Tooltip`: `maxWidth="max-w-[310px]"` (box rule fully deleted, no residue).
- `SimResultsPanel`/`SimWarnings` warning-zone tooltip: `width="w-full"` (box rule fully deleted).
- `GearPicker`/`ItemPickerCell` quick-swap tooltips (both the enchant and the per-gem ones): `maxWidth="max-w-none" width="w-[220px]" align="start" padded={false} className="tooltip-quick-swap cursor-default"`; the vendor content-padding override rule is now redundant with `vendor.css`'s own `.sim-tooltip--unpadded […] { padding: 0 }` and was deleted; `ul`/`li` residue re-rooted as `.tooltip-quick-swap ul` / `.tooltip-quick-swap li`.
- **Deferred**: `MetricsCombinedTooltip.scss`'s `.sim-tooltip.metrics-table-tooltip` box rule (max-width/font-size/breakpoint) was left untouched — its `<Tooltip className="metrics-table-tooltip">` call sites live in `DamageMetricsTable.tsx`, `HealingMetricsTable.tsx` and `DtpsMetricsTable.tsx`, none of which are in this unit's file scope. Whichever later unit owns those files should apply `maxWidth="max-w-none max-sm:max-w-[300px]" className="text-[12px]"` there and delete the box rule, keeping the `thead th` residue re-rooted as `.metrics-table-tooltip thead th`.

`Popover`'s popup: `clsx('sim-popover-popup', maxWidth ?? 'max-w-(--available-width)', 'max-h-(--available-height) overflow-y-auto', TOOLTIP_SURFACE, 'px-2 py-2 text-left opacity-100 fade-in-out motion-reduce:transition-none', className)`. `maxWidth` is a prop rather than a second call-site utility because `TOOLTIP_SURFACE` already sets `p-0`/`max-w` on the same element (Tailwind's fixed utility-category order lets `px-2 py-2` win over `p-0` regardless of source order, and Tailwind's `max-w-*` utilities are one category so two conflicting call-site classes would be a source-order gamble — the prop makes the override explicit and typed instead of relying on cascade order). `ConfirmPopover` forwards `maxWidth="max-w-[220px]"`; message gets `mb-(--spacing-block)` (0.75rem, no matching scale step so kept as the var read, not a literal step); actions get `flex justify-end gap-2`.

`SearchBar` clear button: `absolute right-0 px-2 py-0`. New `grow?: boolean` prop (default `true`); `grow={false}` adds `flex-none` to both the root (`Field.Root`) and the input group, replacing `SelectorModal.scss:26-33`'s `.selector-modal-filters .search-bar-root, .search-bar-input-group { flex: 0 0 auto }`; wired at `SelectorModal/ItemList.tsx`'s `<SearchBar grow={false}>` (the actual `<SearchBar>` carrier — `SelectorModal.tsx` itself has no `SearchBar` element).

Tie checks: grepped `.sim-tooltip`/`.sim-popover-popup`/`.sim-confirm-popover`/`search-bar-*` across `ui/**/*.scss` and `ui/styles/vendor.css` post-edit — only `vendor.css`'s three untouched rules and the deferred `MetricsCombinedTooltip.scss` rule remain, no stray `!important` on these selectors elsewhere. Grepped `.style.(width|padding|maxWidth|textAlign)` across all touched directories — no imperative writers found. `Tooltip`/`Popover` `className` stays additive-only (kit classes prepended, caller's `className` last).

Deleted: `Tooltip.scss`, `Popover.scss`, `ConfirmPopover.scss`, `SearchBar.scss` (imports removed from their `.tsx`).

Notes: `DropdownMenu.tsx` (not `DropdownPicker.tsx`) and `SimWarnings.tsx` (not `SimResultsPanel.tsx`) turned out to be the actual `<Tooltip>` carriers for their piggybacks, and `SelectorModal/ItemList.tsx` (not `SelectorModal.tsx`) the actual `<SearchBar>` carrier — all three are siblings, in-scope directories of the named files, edited with the Edit tool after a fresh re-read.

**Deferral closed**: `MetricsCombinedTooltip.scss`'s box rule is now converted — each of the seven `<Tooltip className="metrics-table-tooltip">` call sites across `DamageMetricsTable.tsx`, `HealingMetricsTable.tsx` and `DtpsMetricsTable.tsx` gained `maxWidth="max-w-none max-sm:max-w-[300px]"` and `className="metrics-table-tooltip text-[12px]"`, and the `thead th` residue is re-rooted as `.metrics-table-tooltip thead th` with no `.sim-tooltip` compound.

## Stage 4 — B-U1a: Dialog, ProgressTrackerDialog, Toast as utilities

`Dialog`, `ProgressTrackerDialog` and `Toast` moved from `.scss` to inline Tailwind utilities. `Dialog.scss`, `ProgressTrackerDialog.scss`, `Toast.scss` and `_progress_tracker_modal.scss` are deleted; the `progress_tracker_modal` `@import` is removed from `individual_sim_ui/index.scss`.

**Dialog bundles.** Backdrop: `fixed inset-0 bg-(--modal-backdrop-bg) opacity-(--modal-backdrop-opacity) fade-in-out motion-reduce:transition-none`, plus `z-(--z-modal-backdrop)`/`z-(--z-modal-elevated-backdrop)`. Viewport: same shape with `overflow-x-hidden overflow-y-auto` and `z-(--z-modal)`/`z-(--z-modal-elevated)`. Popup: `flex relative flex-col border border-(--modal-border-color) bg-(--modal-bg) bg-clip-padding outline-0 transition-(--modal-transition) motion-reduce:transition-none`, plus the size-driven max-width (see below) and the `verticalAlign` string. Header: `flex shrink-0 items-start`, plus (unless bare) `mx-(--modal-header-padding) border-b border-(--modal-header-border-color)` and either `py-(--modal-header-padding)` or, with `headerFlush`, `pt-(--modal-header-padding) pb-0`. Title: `mb-0 text-(length:--modal-title-font-size) leading-(--modal-title-line-height)`. Close: `flex items-center justify-center box-content w-[1em] h-[1em] mt-[calc(-0.5*var(--modal-header-padding-y))] mb-[calc(-0.5*var(--modal-header-padding-y))] -mr-1 ml-auto py-[calc(0.5*var(--modal-header-padding-y))] px-[calc(0.5*var(--modal-header-padding-x))] border-0 bg-transparent text-(--modal-close-color) cursor-pointer transition-(--link-transition) z-[1000] hover:text-white focus-visible:outline-0 focus-visible:shadow-(--focus-ring)`. Body: `flex relative flex-1 flex-col p-(--modal-padding)` plus a gap utility (see `bodyGap`) and, with `scrollContents`, `overflow-auto max-h-[calc(100vh-2*var(--modal-margin))]` on the popup. Footer: `flex shrink-0 flex-wrap items-center justify-end mx-(--modal-header-padding) py-(--modal-padding) border-t border-border` (the footer's `--modal-footer-border-color` aliases `--color-border`, so it uses the named `border-border` utility instead of an arbitrary var reference).

**New Dialog props (B2).** `maxWidth?: string` replaces the size-keyed max-width string entirely (base+`max-lg:` breakpoint together, since a custom formula like SelectorModal's already covers narrow widths and must not also carry the generic `max-lg:` override). `headerFlush?: boolean` drops the header's bottom padding, keeping the border. `verticalAlign?: 'top' | 'center'`: `'top'` (default) is `my-(--modal-margin) mx-auto` plus the fade-slide `data-[starting-style]/[ending-style]:[transform:var(--modal-fade-transform)]`; `'center'` is `m-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` with no fade-transform variant at all, so the popup is pinned centred through open/close — matching the old `!important` transform override's *intended* effect (see the divergence note below on why that specific old rule was actually dead). `bodyGap?: string` replaces the body's default `gap-(--modal-padding)` — kept a separate prop rather than folded into `bodyClassName` because the body bundle sets `gap` unconditionally, so two gap utilities at once would tie; `AdvancedEncounterModal` and `FiltersMenu` both pass `bodyGap="gap-block"` (a real utility generated from the `--spacing-block` theme key). `bodyClassName?: string` / `closeClassName?: string` are additive on top of the body/close bundles (no property overlap with either).

**Piggyback conversions.** `_exporters.scss`'s `.modal-footer, .sim-dialog-footer .btn { width: 12rem }` → `className="… w-48"` on `Importer.tsx`'s upload label and import `Button`, and on `Exporter.tsx`'s copy and download `Button`s; the SCSS block is deleted. `_encounter_picker.scss`'s and `_filters_menu.scss`'s `.sim-dialog-body { gap: var(--spacing-block) }` (the encounter one also had `overflow: auto`) → `AdvancedEncounterModal` passes `bodyClassName="overflow-auto" bodyGap="gap-block"`; `FiltersMenu` passes `bodyGap="gap-block"` only. `_selector_modal.scss`: `padding-bottom: 0` on `.sim-dialog-header` → `SelectorModal.tsx` passes `headerFlush`; the nested `.selector-modal-tabs` block is re-rooted directly under `.selector-modal` (it no longer needs the `.sim-dialog-header` ancestor now that ancestor carries no styling of its own); the `.btn-danger` margin rule stays (not this unit's file) but its nested `& + .sim-dialog-close { margin-left: 0 }` is removed — see the divergence note, it was dead. `SelectorModal.scss`'s own `.selector-modal.sim-dialog-popup { max-width: min(…) }` → `SelectorModal.tsx` passes `maxWidth="max-w-[min(calc(var(--modal-width-xl)-var(--spacing-icon-md)),calc(100vw-(2*var(--modal-margin))-var(--spacing-icon-md)))]"` (its `.gear-picker-modal-slots` nested rule is untouched, out of this unit). `EpWeightsDialog.scss`'s tank block drops its `.sim-dialog-footer,` line; `EpWeightsDialog.tsx` renders `footer={isTank ? undefined : <Button …>}` with `isTank = Boolean(player.playerSpec?.isTankSpec) && !player.playerSpec?.isHealingSpec` (optional-chained because the component's own test suite's `FakePlayer` mock carries no `playerSpec` at all — the production `Player` always has one).

**Two dead rules found during inventory, not converted.** (1) `_progress_tracker_modal.scss`'s top-level `.progress-tracker-modal { margin: 0; top: 50%; left: 50%; transform: translate(-50%, -50%) !important; }` (plus its nested `.modal-title` rule) had zero carriers: `ProgressTrackerDialog.tsx` gives its `Dialog` the class `progress-tracker-dialog`, never `progress-tracker-modal`, and renders no `.modal-title` element (its title goes through `Dialog`'s own `.sim-dialog-title`). The *actually* live centring rule was `ProgressTrackerDialog.scss`'s own `.sim-dialog-popup.progress-tracker-dialog { top: 50%; transform: translateY(-50%); …data-starting/ending: translateY(-50%) var(--modal-fade-transform) }`, which — unlike the dead `!important` rule — still slid during open/close. That rule is now replaced by `Dialog`'s new `verticalAlign="center"`, which does *not* slide (per the B2 spec, matching the dead rule's apparent intent rather than the live rule's actual behaviour). Net effect: `ProgressTrackerDialog` no longer slides vertically on open/close, a small user-visible behaviour change from before this commit, judged acceptable because it matches the plan's explicit `verticalAlign="center"` contract and the previous live behaviour was itself an accident of a stale rule. (2) `.progress-tracker-modal-progress-container .progress` / `.progress-bar` (Bootstrap progress-bar selectors) had zero carriers — `ProgressTrackerBar.tsx` uses Base UI's `Progress` with `.progress-tracker-bar-track` / `.progress-tracker-bar-indicator` instead, which already had their own (now-converted) rules in `ProgressTrackerDialog.scss`. Both dead blocks were deleted rather than converted. Similarly, `_selector_modal.scss`'s `& + .sim-dialog-close { margin-left: 0 }` (nested under `.sim-dialog-header .btn-danger`) had zero live carrier: the only `.btn-danger` in the gear picker (`ItemList.tsx`'s remove button) renders inside the dialog body's tab panes, never inside `.sim-dialog-header`, so the sibling selector never matched. No `closeClassName` was added to `SelectorModal.tsx` for it.

**Toast.** Sass→token mapping used as given: border `1px solid #373d57` → `border border-surface-border`; `border-radius: 0` → `rounded-none`; bg `#212329` → `bg-overlay`; shadow → `shadow-[0_0.5rem_1rem_rgba(0,0,0,0.15)]`; `color: #fff` → `text-white`; `font-size: .875rem` → `text-sm`; width rules → `w-full max-w-full md:w-[350px]`; header padding → `px-4 pt-4 pb-0`; close `margin-right: calc(-.5 * spacer-3)` → `-mr-2`, `margin-left: spacer-3` → `ml-4`; body padding → `p-4`; `word-wrap: break-word` → `[overflow-wrap:break-word]`. The cross-rule `--icon-color` (root sets it per variant, the icon reads `text-(--icon-color)`) is a `VARIANT_ICON_COLOR` lookup covering all four variants (`info`/`warning` → `--color-warning`, `success` → `--color-success`, `error` → `--color-danger`) rather than a base default plus per-variant override, so no two utilities ever set the same custom property on one element. `ToastViewport` takes a new `inline?: boolean` prop directly (previously `ToastArea` built the `sim-toast-viewport--inline` class string itself) and switches between two complete, mutually exclusive utility bundles rather than overlaying conflicting `position`/`z-index`/`align-items`/`padding` utilities.

**`--animate-shimmer`.** Added to `theme.css`'s `@theme static` block as `--animate-shimmer: loading-shimmer 6s linear infinite;` (the duration/timing from `_progress_tracker_modal.scss`'s `.progress-bar` rule, since that's the value the still-live `.progress-tracker-bar-indicator` rule used too), with the matching `@keyframes loading-shimmer` placed right after the `:root {}` block. `ProgressTrackerBar.tsx`'s indicator gets `animate-shimmer motion-reduce:animate-none` per the plan's spec, even though no reduced-motion rule previously existed for this specific element (the old reduced-motion block only covered the now-dead Bootstrap `.progress-bar`).

**Tie checks run.** Body `gap`: Dialog's own bundle sets it unconditionally, so `bodyGap` is a full-replacement prop, not folded into additive `bodyClassName` (would have put two `gap-*` utilities on one element). Toast viewport `inline`: `position`/`z-index`/`align-items`/`padding` all differ between the two states, so `ToastViewport` swaps one complete bundle for another rather than adding conflicting utilities. Toast `--icon-color`: a per-variant lookup covering every `ToastVariant`, so exactly one `[--icon-color:…]` utility is ever present. No `!important` was carried forward anywhere in this unit. Close-button focus rings on `Dialog` and `Toast` both reuse the existing `--focus-ring` token via `focus-visible:shadow-(--focus-ring)` rather than the unrelated `focus-ring`/`focus-ring-inset` `@utility` pair (which implements a different, outline-based ring against `--color-link` and does not apply to either of these components).

**Gates.** `npm run type-check`: clean. `npm run lint:css`: clean. `npx oxlint ./ui`: 0 errors, 259 warnings (ceiling 280; all pre-existing `simple-import-sort`/`no-unused-vars` items outside this unit's files). `npx vitest run ui/ui-kit/Dialog ui/ui-kit/ProgressTrackerDialog ui/ui-kit/Toast ui/features/import-export ui/features/stat-weights ui/features/gear/components/SelectorModal ui/features/gear/components/FiltersMenu ui/features/encounter ui/app`: 338/339 passing; the one failure (`TargetsPicker.test.tsx`, `disables the dual-wield miss penalty until dual wield is on`) is in a file this unit did not touch, modified by a concurrent worker in this wave.

## Parked for the user

### Frozen spec test asserts the sidebar action button's class list

`ui/specs/mage/fire/calculate_combustion_thresholds.test.tsx` (frozen tree, tests included) asserts the exact sorted class list of a `SidebarActionButton`, so any utility the component adds to that element (`relative` for the loading icon's anchor, in A-U-shell) fails it. Treated as a reader under the per-rule override check. Options: (a) relax that one assertion to a behavioural/role check so the button can carry utilities; (b) keep the button's declarations in SCSS for good (`_sidebar.scss` `.sim-sidebar-action-button*`, three rules) and delete them only when `ui/specs/**` is unfrozen; (c) move the declarations to a wrapper the assertion does not read — a tree change, so not inside a style commit. Default taken meanwhile: (b) — `SidebarActionButton.tsx` reverted, the SCSS restored verbatim, the rules listed under "Deferred" with the spec test and `ReforgePanel.tsx:170-198` (which copies the markup by hand) as their readers.

### Landing page CSS

Landing page CSS: since A-S4 the single CSS entry (`tailwind.css` → `theme.css`) carries the 34 spec-theme rules and the four form-check SVG data URLs, so the landing page loads ~10 KB raw it never uses (home page total 127,526 → 137,710 B while the spec page fell 304,759 → 258,450 B). Options: (a) accept — one entry, one source, as decided; (b) at A-S6 split the `.sim-ui`/spec block into `ui/styles/themes.css` linked only by `index_template.html`. Default taken meanwhile: (a).

## Stage 4 — B-U2: Chip

New `ui/ui-kit/Chip/{Chip.tsx,Chip.test.tsx,index.ts}` absorbs the four hand-copied `.saved-data-set-chip` sites. Verified against the built bundle `dist/mop/bundle/spec_entry-njqnFpru.style.css` (`grep -oE '\.saved-data-set-chip[^{]*\{[^}]*\}'`).

**`.btn` declarations that were load-bearing on the chip, and their reproduction:**
- `display: inline-block` → chip's own rule already overrides to `display: flex` (kept as the `flex` utility).
- `padding` → chip's own rule already sets `padding: 0` (kept as `p-0`).
- `text-align: center` → `text-center`.
- `vertical-align: middle` → `align-middle`.
- `cursor: pointer` → `cursor-pointer`.
- `user-select: none` → `select-none`.
- `white-space: $btn-white-space` (nowrap) → `whitespace-nowrap` (this also subsumes the `.log-search-chip { white-space: nowrap }` rule in LogRunner.scss, deleted).
- `text-decoration: none` (`if($link-decoration == none, null, none)`) → `no-underline`.
- `border-radius: var(--bs-btn-border-radius)` → already carried by the pre-existing `rounded-full` class on the chip, unaffected by dropping `.btn`.
- `background-color: var(--bs-btn-bg)` (transparent) and `box-shadow`/hover/focus/active button chrome (`--bs-btn-*` vars, `:hover`, `:focus-visible`, `:active` states) were bootstrap's *button* interaction styling — the chip only ever uses its own `.active`/`:hover:not(.active)` rules for color, and has no keyboard focus-ring requirement in the current design, so these are not reproduced (no visual difference at rest, in `.active`, or in `:hover:not(.active)`, which is all `.saved-data-set-chip`'s own CSS ever depended on).

**Why the border `!important` went:** it existed only to beat `.btn`'s own `border: var(--bs-btn-border-width) solid var(--bs-btn-border-color)` (transparent). With `@extend .btn` removed, nothing else sets `border` on the chip (checked via `grep` for `saved-data-set-chip`/`rotation-fab-chip`/`log-search-chip` across the touched `.scss` files), so plain `border border-primary` is sufficient — confirmed no tie to break.

**`badge` neutralisation:** `badge` is kept on the element (class removal is C-U2.2's job), but every declaration it contributed is now also produced by an explicit utility so dropping the class later is a no-op: `display: inline-block` is overridden by `flex` (unaffected), `padding`/`font-size`/`font-weight`/`color` are already overridden by the chip's own rule, `line-height: 1` has no visible effect once `flex` centers children vertically, `text-align: center` → `text-center`, `white-space: nowrap` → `whitespace-nowrap`, `vertical-align: baseline` is superseded by `align-middle`, `border-radius` is already `rounded-full`. `.btn .badge{position:relative;top:-1px}` never applied (the chip is not itself inside a `.btn .badge` context) and is not reproduced.

**Root class bundle:** `saved-data-set-chip badge rounded-full flex p-0 border border-primary text-ui font-normal whitespace-nowrap text-center align-middle no-underline select-none cursor-pointer transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out data-[active]:bg-primary data-[active]:[&_.saved-data-set-name]:text-primary-foreground data-[active]:[&_.saved-data-set-delete]:text-primary-foreground hover:not-data-[active]:bg-primary-dampened data-[disabled]:hidden`.

Deviation from the brief: the active-state foreground color is targeted with `[&_.saved-data-set-name]`/`[&_.saved-data-set-delete]` class selectors instead of the suggested `[&_button]` tag selector — `LogSearchGroup`'s chip renders its name as a `<span>`, not a `<button>`, so a tag selector would miss it. The class selectors reproduce the original SCSS (`.saved-data-set-name, .saved-data-set-delete { color: ... }`) exactly regardless of element tag.

Name element: `p-2 text-white` (from `padding: var(--spacer-2)` / `color: $body-color`). Delete element: `py-2 pr-0 pl-0 mr-2 text-white` (from `padding: var(--spacer-2) 0` / `margin-right: var(--spacer-2)` / `color: $body-color`).

**Four sites, DOM kept identical at each:**
- `SavedDataChip.tsx` — thin wrapper over `Chip`; root `div`, name `button` (was `<Button variant="unstyled">`, now a native `<button>` via `Chip`'s default — same single-node DOM shape, base-ui's Button primitive dropped as an implementation detail), delete via `Chip`'s built-in `ConfirmPopover` (unchanged behavior).
- `RotationFabChip.tsx` — `as="button"`, `nameAs="span"`, no delete. Root carries `role="switch"`, `aria-checked`, `tabIndex`, `onFocus`, `onClick=onToggle` via `rootProps`.
- `LogSearchGroup.tsx:84` — `nameAs="span"` (was already a `<span>`, tag preserved). Its delete is **not** routed through `Chip`'s `ConfirmPopover`: the original site deletes a search value immediately, with no confirmation step, so adding a confirm-popover would be a behavior change, not a refactor. `Chip` gained a `deleteSlot?: ReactNode` prop for this: passing the pre-existing local `DeleteButton` verbatim keeps the exact same immediate-delete `<button>` node in the same position.
- `PresetConfigurationPicker.tsx:47` — `as="button"`, `nameAs="span"` with `nameProps={{ role: 'button' }}`, `onSelect` applies the build. The tooltip anchor moves with the root (`rootProps={ ...tooltipAnchorProps(tooltipId, build.name) }`) since it was on the root `<Button>` here, not on the name, unlike the `SavedDataChip` prototype.

**Deleted SCSS:** `ui/scss/core/components/_saved_data_manager.scss` lines 32-69 (`.saved-data-set-chip { @extend .btn; ... }`, whole block). `ui/features/results/components/LogRunner/LogRunner.scss`'s `.log-search-chip { white-space: nowrap }` rule (now covered by the chip's own `whitespace-nowrap`) — its accompanying "same control" comment was removed with it since the rule it explained no longer exists. `ui/features/results/components/Timeline/Timeline.scss` had no `rotation-fab-chip`/`saved-data-set-chip` rule to remove (grep confirmed).

**Tie checks:** grepped `saved-data-set-chip`, `rotation-fab-chip`, `log-search-chip` across every `.scss` file in the repo after the deletions — no other rule sets `border`, `background`, or `display` on the chip.

## Stage 4 — B-U2: IconButton

`ui/ui-kit/IconButton/IconButton.tsx`: `forwardRef<HTMLButtonElement, IconButtonProps>`, `{ label: string; tone?: 'inherit' | 'link' | 'danger' | 'warning'; className?: ClassValue; render?: ReactElement } & ButtonHTMLAttributes<HTMLButtonElement>`. Base bundle: `inline-flex items-center justify-center p-0 border-0 bg-transparent leading-none cursor-pointer`. `TONE = { inherit: '', link: 'text-link', danger: 'text-link-danger', warning: 'text-link-warning' }` — dropped `alt`, no site in this unit's scope needs it (`.link-alt` lives in `_global.scss`, out of scope). No hover utility: the built bundle's `.link-danger`/`.link-warning`/`.link-success` carry no `:hover` rule, so none was added. `render` prop clones the given element (Base UI `render`-prop convention used elsewhere in `ui/ui-kit`), else renders a plain `<button type="button">`. No `render` consumer needed this unit; kept for API parity with the brief.

Sites converted (raw `<button>`/`Button` → `IconButton`, old classes kept, tone added):
- `RotationRowLabel.tsx:19` — `rotation-row-hide fas fa-eye-slash`, tone `inherit`.
- `RotationToolbar.tsx:31-39` (4 buttons) — `rotation-zoom-button`, tone `inherit`.
- `BulkItemPicker.tsx:77-83` — `btn btn-link link-danger item-picker-actions-btn`, tone `danger`; added `label` (the existing tooltip text) since the raw button had no `aria-label`.
- `SimWarnings.tsx:26` — `warning link-warning`, tone `warning`.
- `TalentTreePicker.tsx:36-42` — was `Button variant={null}`; `btn` (previously implicit via `variant={null}`) made explicit in `className` alongside `talent-tree-reset link-danger`, tone `danger`; test updated to the new class set.

Piggyback (component not owned by this unit — tone utility applied directly at the callsite, no `IconButton`):
- `ListPickerItem.tsx:203` — `ListItemAction` (shared, not in scope) still renders `Button`; appended `text-link-danger` to the existing `['list-picker-item-delete', 'link-danger']` array.
- `SimToolbar.tsx:25` — `ToolbarItem` (not in scope, renders text + icon, not icon-only) — appended `text-link-danger` to `known-issues link-danger`.
- `SimToolbar.tsx:55` — same reason (icon-only but shared `ToolbarItem`) — appended `text-link-danger` to `downbin link-danger`.

Deferred, not touched this unit:
- `CooldownRow.tsx`, `CombinationsCount.tsx`, `Dialog.tsx`/`Toast.tsx` close buttons — explicitly out of scope (U5 / other workers).
- `MetricsActionCell.tsx` (`expand-toggle`) — file already has uncommitted edits from the concurrent `WowheadIcon` unit; left untouched to avoid clobbering another worker's in-flight change.
- `LandingHeader.tsx:43,49,55` — `<a className="nav-link link-alt">`; checked, they do carry a tone (`link-alt`) but are anchors with icon+text (not icon-only, so `IconButton` doesn't fit) and `.link-alt` lives in `_global.scss` (out of scope file). Left unchanged.
- `ui/scss/shared/_bootstrap_style_overrides.scss` `.link-danger`/`.link-warning`/`.link-success`: none deleted — every site keeps its literal `link-*` class alongside the new tone utility (per "a B unit never removes a class"), and `link-success` still has an unrelated emitter (`ListPicker.tsx:174`, out of scope). All three rules stay live.
- The transparent-icon-button SCSS bundle (`padding:0; border:0; background:transparent; cursor:pointer`) at `Timeline.scss` `.rotation-zoom-button`/`.rotation-row-hide` and `MetricsTable.scss` `.expand-toggle` now duplicates `IconButton`'s base bundle on the same elements — identified but **not deleted**: those `.scss` files are explicitly out of scope for this unit (owned by other Timeline/MetricsTable units this wave). Left for the unit that owns those files.

Tie check: no `!important` colour rule fights the tone utility at any converted site (the three `.link-*` rules are the only colour setters and are consistent with the tone chosen); no sibling `text-*` utility was already present at any site. Tree unchanged at every site — same element count/order, only attributes/classes changed.

## Stage 4 — B-U2: WowheadIcon

New `ui/ui-kit/WowheadIcon/{WowheadIcon.tsx,WowheadIcon.test.tsx,index.ts}`. API: `{ as?: 'a' | 'div'; iconUrl?; href?; actionId?; useBuffAura?; label?; className?; children? }`, forwardRef. Bundle: `relative inline-block bg-cover bg-center bg-no-repeat` + `style={{ backgroundImage }}` (only when `iconUrl` is set) + `rel={externalRel(href, undefined)}` on `as="a"` + `useActionIdWowheadDataset(ref, actionId ?? null, useBuffAura)` internally. `label` becomes `aria-label`. Size/border stay the caller's via `className` — the component sets none.

Converted sites (4 of the 10 `wowhead-background-icon` mixin carriers — the ones that are a bare anchor/div painting `style={{ backgroundImage }}` with no extra wrapper component):
- `RotationRowIcon.tsx` (`.rotation-row-icon`, `Timeline.scss:466`) — dropped its own `useRef`/`useActionIdWowheadDataset`/`externalRel` in favour of the component; tag stays `<a>`, same `href`/`rel`.
- `RotationRow.tsx`'s inline resource-row icon (`.rotation-row-icon`, same carrier) — `<a style={{backgroundImage}}/>` → `<WowheadIcon as="a" className="rotation-row-icon" iconUrl={row.icon} />`; no href/actionId before, none now.
- `CastItem.tsx` (`.rotation-item-icon`, `Timeline.scss:550`) — plain style-only anchor, no hook before or after.
- `MetricsActionCell.tsx` (`.metrics-action-icon`, `MetricsTable.scss:38`) — same verbatim 3-line pattern as RotationRowIcon; `aria-label` now flows through `label`.
- `BulkItemSearchRow.tsx` (`.bulk-item-search-item-icon`, `BulkItemSearch.scss:88`) — `as="div"`, no href/actionId (matches original div, which carried neither).

SCSS: removed the `@include wowhead-background-icon;` line from all four carriers above, keeping their own `width/height/border`/`flex` declarations untouched (caller's, per the component contract). The mixin's `background-position: center center !important` fought no `!important` counter-rule at any of these four sites (none of the four carriers, nor the component, ever set a competing `background-position`), so it is a plain `bg-center` now with no behavior change. `wowhead-background-icon` is **not** deleted from `_mixins.scss` — 6 of its 10 call sites remain (`.item-picker-icon` in `_gear_picker.scss`, `_item_list.scss` and `GlyphsPicker.scss`; `.talent-picker-icon`; `.gem-icon`/`.socket-icon` in `_gems.scss`).

Deferred (time-boxed out of this unit, left untouched): the six remaining mixin sites and the TSX sites that carry them (`ItemDetailCell`, `SlotRailIcon`, `ItemSwapIcon`, `GearChangeIcon`, `EnchantLabel`, `GemSocket`, `GlyphPicker`, `TalentPicker`, `ItemListRow`, `GemSummary`, `PetSpecPicker`), plus `ActionLink.tsx`, `ActionIdIcon.tsx`, `ReplayIcon.tsx`, and the `wowheadAnchorProps` family (`IconPicker`, `ImprovedAnchor`, `MultiIconPicker`, `IconEnumOption`, `IconEnumPicker`). These sites either (a) route their dataset through `useEquippedItemWowheadDataset`, which needs `player`/`isBlacksmithing` the component's prop list has no room for, (b) wrap the wowhead anchor in a feature-level `ItemCellAnchor`/`GemSocket` with its own ref/activation logic, (c) render the icon as an `<img src>` rather than a `style={{backgroundImage}}` div (the `wowhead-background-icon` mixin is dead CSS there — no background is ever set), or (d) pair the anchor with `wowheadAnchorProps()`'s static `data-whtticon`/`data-disable-wowhead-touch-tooltip` suppression rather than the dynamic `useActionIdWowheadDataset` tooltip. `TalentTreePicker.tsx` stays out of scope entirely (owned by U-talents). A follow-up B unit should decide whether `item?` (from the plan's prop list) becomes a real prop wiring `useEquippedItemWowheadDataset`, or whether those sites keep composing their own hook against the component's forwarded ref.

## Stage 4 — B-U2: FieldLabel, HelpText, TextArea, Spinner, Skeleton

Compiled Bootstrap declarations (read from the newest `dist/mop/bundle/spec_entry-*.style.css` and `_variables.scss`) vs. the utilities added beside the still-present Bootstrap classes:

| Selector | Compiled declaration | Utility added | Note |
| --- | --- | --- | --- |
| `.form-label` | `font-size:var(--text-ui)` | `text-ui` | |
| `.form-label` | `margin-bottom:.25rem` | `mb-1` | plan guessed `mb-2`; compiled value is `.25rem` |
| `.form-label` | `font-weight:400` | `font-normal` | plan guessed `font-bold`; `$form-label-font-weight: normal` in `_variables.scss` |
| `.form-label` | (none) | `inline-block` | so `FieldLabel as="span"/"div"` matches `label`'s default display |
| `.form-text` | `font-size:var(--text-ui)` | `text-ui` | |
| `.form-text` | `margin-top:.25rem` | `mt-1` | |
| `.form-text` | `color:#6c757d` | `text-gray-600` | `--color-gray-600:#6c757d` matches exactly; `--color-muted:#212529bf` does not — plan's `text-muted` guess was wrong |
| `.form-control` | `width:100%;display:block` | `w-full block` | |
| `.form-control` | `padding:.375rem .75rem` | `py-1.5 px-3` | |
| `.form-control` | `font-size:var(--text-ui);line-height:1.5` | `text-ui leading-normal` | |
| `.form-control` | `color:#fff` | `text-foreground` | `--color-foreground:#fff` |
| `.form-control` | `background-color:#1e2633` | `bg-surface` | `--color-surface:#1e2633` |
| `.form-control` | `border:1px solid #373d57` | `border border-surface-border` | `--color-surface-border:#373d57` |

Left to the still-present `.form-control` class (no matching theme token exists, so an added utility would either diverge or need a non-token arbitrary colour): `:focus` (`border-color:#5f6479` = `color-mix(in srgb, $input-border-color, white 20%)`, `box-shadow:0 0 .25rem #44454b` = `color-mix(in srgb, $body-bg, white 20%)` — not the site's `--focus-ring` ring shadow) and `:disabled` (`background-color:#44454b`, `opacity:1`, not the plan's guessed `disabled:opacity-65`). `INPUT_CLASSES` therefore omits focus/disabled utilities entirely this wave.

`INPUT_CLASSES` (`ui/ui-kit/FormControl/classes.ts`): `block w-full px-3 py-1.5 text-ui leading-normal text-foreground bg-surface border border-surface-border`.
`SELECT_CLASSES`: `INPUT_CLASSES` + `appearance-none pr-9 bg-no-repeat bg-[position:right_.75rem_center] bg-[size:16px_12px] bg-[url(...)]` (the Bootstrap select caret, verbatim data-URI from the compiled `.form-select`) — predefined for B-forms; not consumed at any site yet.

`Spinner` (`ui/ui-kit/Spinner`): reproduces `_global_old.scss`'s `.loader` (now deleted) — `rounded-full border-[#f3f3f3] border-t-[#3498db] animate-spin` at `w-[7.5rem] h-[7.5rem] border-[1rem]` (md, matches the old 120px/16px-border loader exactly) or `w-[3.75rem] h-[3.75rem] border-[0.5rem]` (sm, new, unused so far). Tailwind's default `animate-spin` (`spin 1s linear infinite`) is already identical to the old `@keyframes spin` — no new animation token needed. The `#f3f3f3`/`#3498db` colours have no matching `theme.css` token, so they stay as arbitrary values (kept verbatim, not tied to the app's `--color-primary`). `.loader` sites converted: `CombinationsCount.tsx`, `SimResultsPanel.tsx` (its test's `.results-pending .loader` selector updated to `.results-pending .animate-spin`). The 3 `<Icon name="spinner" spin>` sites are untouched.

`Skeleton` (`ui/ui-kit/Skeleton`): reproduces `CharacterStats.scss`'s `.character-stats-skeleton` (rule + its `@keyframes character-stats-skeleton-shimmer` + its `prefers-reduced-motion` override, all now deleted from that file) — `inline-block align-middle w-14 h-[0.85em] rounded-[3px]` + the gradient/size verbatim as arbitrary values (`--border-radius-sm` never resolves anywhere in `theme.css`, so the SCSS's `var(--border-radius-sm, 3px)` fallback is the real computed value) + `animate-skeleton motion-reduce:animate-none`. `--animate-skeleton: character-stats-skeleton-shimmer 1.2s ease-in-out infinite;` added to `@theme static` next to `--animate-shimmer`; the `@keyframes character-stats-skeleton-shimmer` block (verbatim) added to `theme.css` below `:root {}`, next to `@keyframes loading-shimmer`. Site converted: `StatRow.tsx`.

Sites converted (tag/attributes unchanged, Bootstrap class kept beside the new component's utilities): `CooldownRow.tsx` (`label` → `FieldLabel`), `ConsumeRow.tsx` (`span` → `FieldLabel as="span"`), `AplNameDialog.tsx` (`label` → `FieldLabel`), `RequiredSetBonuses.tsx` (`div` → `FieldLabel as="div"`), `ItemSwapPicker.tsx` (`span` → `FieldLabel as="span"`; `p` → `HelpText as="p"`), `SelectorModal.tsx` (`div` → `HelpText as="div"`), `SettingsDialog.tsx` (2× `div` → `HelpText as="div"`), `Importer.tsx`/`Exporter.tsx`/`CrashReportDialog.tsx` (`textarea` → `TextArea`).

## Stage 4 — C-U1.2: overlay class hooks dropped

Classes dropped (data-testid kept on every element that had one; utility strings kept as-is):

- **Dialog**: `sim-dialog-portal`, `sim-dialog-backdrop`, `sim-dialog-backdrop--elevated`, `sim-dialog-viewport`, `sim-dialog-viewport--elevated`, `sim-dialog-popup`, `` sim-dialog-popup--${size} ``, `sim-dialog-popup--scroll`, `sim-dialog-header`, `sim-dialog-header--bare`, `sim-dialog-title`, `sim-dialog-close`, `sim-dialog-body`, `sim-dialog-footer`. `Dialog.tsx`'s popup gains `data-size={size}` (a stable, always-present size signal for `stat-weights.mjs`'s and probes' regex reads, replacing the `sim-dialog-popup--sm|md|lg|xl` suffix). The backdrop and viewport gain `data-elevated={elevated}`; the header gains `data-bare={headerBare}` — both replace a dropped boolean-variant class for the `Dialog.test.tsx` assertions that used to read it off `classList`.
- **Popover**: `sim-popover-portal`, `sim-popover-positioner`, `sim-popover-popup`. The portal's `contents` utility is kept (unconditional layout utility, not a hook).
- **Toast**: `sim-toast`, `` sim-toast--${variant} `` (replaced by `data-variant={variant}` on `BaseToast.Root`, which `Toast.test.tsx` and any probe now reads instead), `sim-toast-header`, `sim-toast-icon`, `sim-toast-title`, `sim-toast-close`, `sim-toast-body`, `sim-toast-portal` (on `ToastArea`'s portal — its `contents` utility, if any, is unaffected since it carried none), `sim-toast-viewport`, `sim-toast-viewport--inline` (replaced by `data-inline={inline}` on `BaseToast.Viewport`, read the same way by `Toast.test.tsx`'s `standardViewport()` helper).
- **ProgressTrackerDialog**: the hardcoded `progress-tracker-dialog` class `ProgressTrackerDialog.tsx` used to put on every instance's `Dialog` is gone; `Dialog`'s `testId` now defaults to `'progress-tracker-dialog'` (`testId={testId ?? 'progress-tracker-dialog'}`) so every instance — including `ReforgePanel`, `BulkProgressDialog` and `calculate_combustion_thresholds.tsx`, none of which pass their own `testId` and which this unit may not edit — keeps a stable `data-testid="progress-tracker-dialog"` on its popup without touching those three out-of-scope call sites. Also dropped: `progress-tracker-modal-content`, `progress-tracker-modal-warning`, `progress-tracker-modal-time-display`, `progress-tracker-modal-message` (its conditional `hidden` utility class is kept, now applied without the hook name), `progress-tracker-modal-progress-container` (no reader, no testid, dropped outright), `progress-tracker-modal-progress-title`, `progress-tracker-bar-track`, `progress-tracker-bar-indicator`, `progress-tracker-modal-progress-text`.
- **ElapsedTime**: `time-elapsed` (its `data-testid="time-elapsed"` already existed and is unchanged).
- **SearchBar**: `search-bar-root`, `search-bar-input-group`, `search-bar-clear-btn`. `search-bar-input` was left alone — it was never in scope for this unit (not named in the class list) and carries no known reader either way.

Classes **kept**, with reader:

- `sim-confirm-popover`, `sim-confirm-popover-message`, `sim-confirm-popover-actions` (`ConfirmPopover.tsx`): readers are `document.querySelector('.sim-confirm-popover' …)` in `ui/ui-kit/SavedDataPanel/SavedDataPanel.test.tsx` and five feature `.test.tsx` files (`SavedSettings`, `SavedEpWeights`, `SavedEncounter`, `SavedGear`, `SavedTalents`) — all outside this unit's editable scope.
- `virtual-list`, `virtual-list-row` (`VirtualList.tsx`): readers in `ui/features/results/components/LogRunner/LogRunner.test.tsx` and `ui/features/gear/components/SelectorModal/ItemList.test.tsx` — feature tests outside scope, still using raw class selectors instead of `data-testid`.
- `progress-tracker-modal-cancel-btn` (`ProgressTrackerDialog.tsx`): reader in `ui/specs/mage/fire/calculate_combustion_thresholds.test.tsx` (`ui/specs/**` is explicitly off-limits). `data-testid="progress-tracker-modal-cancel-btn"` already existed alongside it.

**`sim-tooltip`/`sim-tooltip--unpadded` exemption**: left untouched everywhere (`Tooltip` component, `sidebar-popover.mjs`, `reforge-popover.mjs`, `header-toolbar.mjs`'s `.tippy-box, .sim-tooltip` reads) — `ui/styles/vendor.css` keys on it directly, and `Tooltip/**` was out of scope for this unit regardless.

**Known out-of-scope break**: `ui/features/stat-weights/components/EpWeightsDialog/EpWeightsDialog.test.tsx:402,408` still assert `popup().classList.contains('sim-dialog-popup--lg' | '--xl')`; these now fail (`sim-dialog-popup--<size>` is dropped from `Dialog`, replaced by `data-size`). This file is a feature test outside this unit's scope (`ui/features/**`) and was not edited; whoever owns `EpWeightsDialog` should switch these two assertions to `popup().getAttribute('data-size')`.

Probe rewrites (file:line → new form):

- `browser.mjs:317`: `'.modal-backdrop, .sim-dialog-backdrop'` → `` `.modal-backdrop, ${q('sim-dialog-backdrop')}` `` (using the page-context `q` local to `PROBE`).
- `gear-tab.mjs:66,148`, `bulk-tab.mjs:176`, `selector-modal.mjs:27,150`: `.sim-dialog-popup.selector-modal[data-open]` → `[data-testid="sim-dialog-popup"].selector-modal[data-open]`.
- `selector-modal.mjs:476`: `.sim-dialog-popup.filters-menu[data-open]` → `[data-testid="sim-dialog-popup"].filters-menu[data-open]`.
- `selector-modal.mjs:508`: `.btn-close, .sim-dialog-close` → `.btn-close, [data-testid="sim-dialog-close"]`.
- `stat-weights.mjs`'s `DIALOG()`: the `sim-dialog-popup--(sm|md|lg|xl)` classList regex read → `dialog.dataset.size ?? modalSizeClass?.replace(/^modal-/, '') ?? 'default'`, reading the new `data-size` attribute on the port and keeping the `modal-*` branch for the master port.
- `stat-weights.mjs:52`(ish, `footerDisplay`): `.sim-dialog-footer, .modal-footer` → `[data-testid="sim-dialog-footer"], .modal-footer`.
- `stat-weights.mjs`'s `PROGRESS()` and every later `.progress-tracker-dialog`/`.progress-tracker-modal-progress-text` read (the `waitForFunction` after clicking Calculate, the centring check, the cancel-button locator, the running check, and the final `waitForFunction`): each now ORs the existing baseline class with `[data-testid="progress-tracker-dialog"]` (and, for descendants, `[data-testid="progress-tracker-modal-progress-text"]` / `[data-testid="progress-tracker-modal-progress-title"]` / `[data-testid="time-elapsed"]`) rather than the class alone. `progress-tracker-modal-cancel-btn` itself is unchanged (class kept, see above).
- `reforge-popover.mjs:29`: `.sim-popover-popup.reforge-optimiser-popover` → `[data-testid="sim-popover-popup"].reforge-optimiser-popover`.
- `reforge-popover.mjs:37`: `PROGRESS = '.progress-tracker-modal, .progress-tracker-dialog'` → adds `, [data-testid="progress-tracker-dialog"]`.
- `bulk-tab.mjs:201`: `.progress-bar, .progress-tracker-bar-track` → `.progress-bar, [data-testid="progress-tracker-bar-indicator"]` (the track carries no testid; the indicator is the equivalent "is a bar drawn" signal).
- `sidebar-popover.mjs:36`, `reforge-popover.mjs:101,236`, `header-toolbar.mjs:166`: `.tippy-box, .sim-tooltip` — unchanged, per the `sim-tooltip` exemption.
- `parity.mjs`'s `MODAL`, `PORTED_DIALOG_REACT`, `TOAST_PORTAL`, `TOAST_AREA` regexes — unchanged. Verified against `browser.mjs`'s `SERIALIZE`: it already unions each element's `data-testid` into its token list before sorting/joining, so a class-anchored regex keeps matching once the class itself is gone, as long as the `data-testid` stays unconditional (it does, on every element these regexes name).

**Correction to the section above**: `sim-dialog-popup` and `sim-dialog-header` (the bare names, not their `--<size>`/`--scroll`/`--bare` suffixes) are **not** dropped after all — re-checking `ui/features/**/*.scss` (out of scope to edit) turned up two live selectors this unit's own step-1 grep had missed on the first pass: `ui/features/gear/components/SelectorModal/SelectorModal.scss:11`'s `.selector-modal.sim-dialog-popup { .gear-picker-modal-slots { position: absolute; … } }`, and `ui/scss/core/components/gear_picker/_selector_modal.scss:31`'s `.selector-modal .sim-dialog-header .btn-danger { margin: … }`. Both classes are restored on `Dialog.tsx`'s popup and header `<div>`; everything else in this unit's changes (the `--<size>`/`--scroll`/`--bare` suffixes, `data-size`, `data-elevated`, `data-bare`, and all the probe rewrites) is unaffected, since those two rules never depended on the suffixed variants.

### Correction — Spinner sizing (must read var()-with-fallback, not a literal width)

The `Spinner` paragraph above is superseded for sizing: `1rem` in this app's root font-size is not `16px`, so `w-[7.5rem]`/`h-[7.5rem]` (105px) did not reproduce the old rule's `120px`, and a literal `!important` width/height/border also defeated `_bulk_tab.scss:45`'s scoped `--loader-width: 60px` override (that override only ever reached the DOM through the old rule's `width: var(--loader-width)`, not a fixed value). Fixed by reproducing the old rule verbatim as `var()` reads with the old rule's own defaults as CSS fallbacks, so an ancestor's `--loader-width`/`--loader-height` still resolves on the element exactly as it did before: `w-[var(--loader-width,120px)] h-[var(--loader-height,120px)] border-[calc(var(--loader-width,120px)/7.5)]` for `size="md"` (`60px` fallback for `size="sm"`, matching the bulk tab's own override value). `border-[#f3f3f3] border-t-[#3498db]` and `animate-spin` are unchanged from the earlier note.

**Correction (post-probe):** re-checked every `.btn`/`.badge`-derived utility against the actual compiled cascade order in the built bundle (`.btn`-derived rule at its `@extend` position → `.badge` rule, which is authored after buttons in `bootstrap.scss` → the chip's own custom rule, last). Findings:
- `vertical-align`: `.btn` sets `middle`, but `.badge` (later, same specificity) overrides it to `baseline` — and neither ever mattered anyway, since `vertical-align` has no effect on a `display: flex` box. Removed `align-middle` from the bundle; no replacement needed.
- `line-height`: `.btn` sets `var(--bs-btn-line-height)` (1.5), but `.badge` (later) overrides it to `1`, and the chip's own custom rule never set `line-height`, so `1` was the true final computed value. Added `leading-none` (was missing).
- `text-decoration`: `.btn`'s declaration is `if($link-decoration == none, null, none)`, and this project sets `$link-decoration: none` in `ui/scss/shared/_variables.scss`, so the ternary evaluates to `null` — the declaration was never emitted at all (confirmed absent from the compiled `.saved-data-set-chip{--bs-btn-padding-x...}` rule in the bundle). The root is a `div`/`button`, whose default `text-decoration` is already `none`, so `no-underline` reproduced nothing real. Removed it.
- `text-align: center` — set by both `.btn` and `.badge` (same value, so cascade order is moot); true final value is `center`. Kept `text-center`, though it is inert here too (no direct text node on the flex root).
- `white-space: nowrap` — `.btn`'s own declaration is null in this project ($btn-white-space is unset), so `.badge`'s `nowrap` is the only real source and the final value. Kept `whitespace-nowrap` — this one has real effect (labels don't wrap) and must survive `badge` removal in C-U2.2.
- `cursor: pointer`, `user-select: none` — set only by `.btn`, not touched by `.badge` or the chip's own rule; final values `pointer`/`none`. Kept `cursor-pointer` / `select-none`.

Final root bundle: `saved-data-set-chip badge rounded-full flex p-0 border border-primary text-ui font-normal whitespace-nowrap text-center leading-none select-none cursor-pointer transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out data-[active]:bg-primary data-[active]:[&_.saved-data-set-name]:text-primary-foreground data-[active]:[&_.saved-data-set-delete]:text-primary-foreground hover:not-data-[active]:bg-primary-dampened data-[disabled]:hidden`.

### Stage 4 — B-U2 correction (probe finding)

A probe caught the initial base bundle (`inline-flex …`) landing on non-transparent `.btn`/native-button sites, blockifying children and zeroing real padding/border. Fixed: `IconButton`'s base bundle is `inline-block p-0 border-0 bg-transparent leading-none cursor-pointer` (no flex) — matches the built bundle's computed `display: inline-block` for `.rotation-row-hide`/`.rotation-zoom-button` (the global `button{}` reset plus those two rules never set `display`). `BulkItemPicker.tsx`, `SimWarnings.tsx`, `TalentTreePicker.tsx` (+test) reverted to their original elements (`<button>`/`Button variant=null`/`Button variant="unstyled"`) with only the tone colour utility (`text-link-danger`/`text-link-warning`) added beside the existing `link-*` class — no `IconButton`, since their old computed style (real `.btn` padding/border/display) was never the transparent-icon-button pattern. `IconButton` now converts only `RotationRowLabel`'s hide button and `RotationToolbar`'s four zoom buttons, confirmed against the built bundle to have been `display:inline-block; padding:0; border:0; background:transparent` already.

## Stage 4 — token rename: --spacing-block → --spacing-stack

`theme.css`'s `--spacing-block: 0.75rem` made `block` a valid Tailwind spacing-scale key. Tailwind v4 registers a static display utility `inline-block` (`display: inline-block`) AND a separate functional utility family `inline-<key>` (`inline-size: var(--spacing-<key>)`, sourced from `--spacing-*`/`--container-*`). With `block` present in the spacing scale, the candidate string `inline-block` became ambiguous between the two, and Tailwind emitted **both** rules for the same selector — confirmed in the built CSS: `.inline-block{display:inline-block!important}` immediately followed by `.inline-block{inline-size:var(--spacing-block)!important}` (`0.75rem` = `12px` at the root font size, matching the probe's reported computed width). Any element carrying the plain `inline-block` utility anywhere in the app silently picked up a forced `inline-size: 0.75rem`.

Renamed the token to `--spacing-stack` everywhere so `inline-block` is unambiguous again (`stack` is not a Tailwind display keyword). Checked the rest of the `--spacing-*` scale (`icon-sm`, `icon-md`, `gutter`, `gutter-sm`, `page`, `section`, `cell`) against the full list of Tailwind static display keywords (`flex`, `grid`, `table`, `block`, `inline`, `contents`, `hidden`, `flow-root`, `list-item`) — none of the others collide, so only `block` needed renaming.

Sites changed (`var(--spacing-block)` → `var(--spacing-stack)`, `gap-block` → `gap-stack`, `mb-(--spacing-block)` → `mb-(--spacing-stack)`): `ui/styles/theme.css`; `ui/ui-kit/ConfirmPopover/ConfirmPopover.tsx`; `ui/features/encounter/components/AdvancedEncounterModal/AdvancedEncounterModal.tsx` and `ui/features/gear/components/FiltersMenu/FiltersMenu.tsx` (`bodyGap="gap-block"` → `"gap-stack"`); and the SCSS reads in `CooldownsPicker.scss`, `EpWeightsDialog.scss`, `BulkItemSearch.scss`, `BulkPickerGroups.scss`, `DpsHistogram.scss`, `GlyphsPicker.scss`, `_sidebar.scss`, `_encounter_picker.scss`, `_list_picker.scss`, `_input.scss`, `_settings_tab.scss`, `_bulk_tab.scss`, `_consumes_picker.scss`, `_item_swap_picker.scss`, `_gear_picker.scss`, `_filters_menu.scss`, `_detailed_results.scss`, `_saved_data_manager.scss`, `_content_block.scss`, `_talents_picker.scss`, `_global.scss`, `_mixins.scss`. `FieldLabel.tsx`/`Skeleton.tsx`/`ConsumeRow.test.tsx`'s `[display:inline-block]` workaround was reverted to plain `inline-block` since the rename makes it unambiguous again.

### Stage 4 — B-U2 correction 2 (padding/line-height are per-site)

Second probe: `rotation-zoom-button`'s built rule is `padding: 0 var(--spacer-1); line-height: 1` — horizontal padding only, not `padding: 0`. `IconButton`'s base had `p-0 leading-none`, wiping the toolbar buttons' horizontal padding (`--spacer-1` = Tailwind's `1` = `0.25rem`, so `px-1` reproduces it exactly) and adding a `line-height:1` the row-hide button's rule (`padding: 0` only, no line-height) never had. Fixed: removed `p-0`/`leading-none` from the component base (padding and line-height are per-site, not component properties) — base is now `inline-block border-0 bg-transparent cursor-pointer`. `RotationRowLabel.tsx` gets `p-0` at the call site (its rule is `padding: 0`); `RotationToolbar.tsx` gets `py-0 px-1 leading-none` (its rule is `padding: 0 var(--spacer-1); line-height: 1`). Both untouched `Timeline.scss` rules still supply colour/hover/`background`/`border`/`flex` unchanged.

## Stage 4 — B-U2 follow-ups: IconButton close slots; ItemCell/SummaryTableRow to ui-kit

`IconButton`'s base bundle dropped `inline-block` (now `border-0 bg-transparent cursor-pointer`). Both call sites (`RotationRowLabel`, `RotationToolbar`) still compute `display: inline-block` regardless — that comes from the plain `<button>` UA default, not from a `button{}` rule in the built stylesheet (`/usr/bin/grep -oE 'button\{[^}]*\}'` on the bundle shows no `display` declaration at all) — so removing the utility changes nothing there, and it frees `Dialog`'s and `Toast`'s close buttons to ask for `flex` instead.

`Dialog.tsx`'s and `Toast.tsx`'s `BaseDialog.Close`/`BaseToast.Close` now render an `IconButton` via the `render` prop (`render={<IconButton label="Close" className="…" />}`) instead of rendering their own `<button>`-equivalent directly, with `border-0`/`bg-transparent`/`cursor-pointer` dropped from each `className` string since `IconButton`'s base now supplies them; `data-testid`, `aria-label="Close"` (kept on the Base UI part so Base UI still merges it onto the rendered element) and the icon children are unchanged, and Base UI clones its own props onto the `IconButton` element so the final DOM is still one `<button type="button" aria-label="Close">` carrying the same class list and `data-testid` as before.

`ItemCell.tsx` (+ test) and `SummaryTableRow.tsx` moved to `ui/ui-kit/ItemCell/` and `ui/ui-kit/SummaryTableRow/` via `git mv` — neither imported anything feature-specific (`GemSocket`, `ItemCellAnchor`, `ItemDetailCell`, `GemSummary`, `ReforgeSummary`, `UpgradeCostsSummary` stay in `ui/features/gear/components/`). New `index.ts` added in each ui-kit dir. The gear `ItemCell/index.ts` and `SummaryTable/index.ts` re-export `ItemCell`/`SummaryTableRow` from `@ui-kit/ItemCell`/`@ui-kit/SummaryTableRow` respectively, so every existing importer (`ui/features/bulk/**`, `ui/app/tabs/GearTabBody.tsx`, and the gear siblings) keeps compiling unchanged.

## Stage 4 — A-U-input part 1: picker shells as utilities

Converted the shell-level rules in `_input.scss`, `_boolean_picker.scss`, `_enum_picker.scss`,
`_number_list_picker.scss` and `_unit_picker.scss` to utilities on `PickerShell` and its picker
callers. No element added/removed/reordered; every legacy class (`input-root`, `input-inline`,
`input-description`, `boolean-picker-root`, `enum-picker-root`, `unit-picker-item-icon`, …) kept.

**`PickerShell.tsx` root** — `Field.Root` className, picked once per `config.inline`:
- not inline: `flex flex-col items-start` (was `.input-root { display:flex; flex-direction:column; align-items:flex-start }`)
- inline: `flex flex-row justify-between items-center` (was `.input-inline { flex-direction:row; justify-content:space-between; align-items:center }`)
- always: `data-[disabled]:[filter:opacity(0.5)]` (was `.input-root.disabled { filter:opacity(.5) }`; `PickerShell` already emits `data-disabled` when `disabled`)
- `config.description && 'flex-wrap'` (was `.input-root:has(.input-description) { flex-wrap:wrap }`)
- `!config.inline && !isIconPicker && 'max-md:gap-2'` (was the `md`-down branch of `.input-root:not(.input-inline):not(.icon-picker)`; the root is already `flex-col items-start` so only `gap` changed at that breakpoint). `isIconPicker` is `className.split(' ').includes('icon-picker')` — `icon-picker` is a plain className token IconPicker/IconEnumPicker pass in, not a config flag, so PickerShell reads it off its own `className` prop.

**Label (`Field.Label`)**:
- `config.inline && 'mr-2 mb-0'` (was `.input-inline label { margin-right: var(--spacer-2); margin-bottom:0 }`)
- `!config.inline && !isIconPicker && 'whitespace-nowrap overflow-hidden text-ellipsis max-w-full'` (was `.input-root:not(.input-inline):not(.icon-picker) label {...}`)

**`!important` fights, both resolved by making the utility conditional (never kept an `!important`)**:
- `.input-root.input-inline label, .input-root.icon-picker label { overflow:unset!important; text-overflow:unset!important }` — checked the compiled bundle (`spec_entry-*.style.css`) for every other selector touching `.form-label`/label `overflow`/`text-overflow` (`_settings_tab.scss`, `_bootstrap_style_overrides.scss`, `_apl_rotation_picker.scss`, `.icon-picker` rules in `_icon_picker.scss`): none of them set `overflow`/`text-overflow`. The `:not(.input-inline):not(.icon-picker)` selector this `!important` was defending against is mutually exclusive with `.input-inline`/`.icon-picker` by construction, so no genuine collision exists in the built cascade — the `!important` was vestigial. Converting to "the truncation utilities only apply when not inline and not icon-picker" reproduces the cascade exactly with no `!important` needed.
- `.input-root:not(.input-inline):not(.icon-picker) { @include media-breakpoint-down(md) { flex-direction:column!important; align-items:flex-start!important; ... } }` — same reasoning: `.input-inline` (`flex-direction:row`, unconditional) can never match an element this selector also matches, so there is no real fight in-scope. `flex-direction`/`align-items` are already the non-inline base value (`flex-col`/`items-start`), so only `max-md:gap-2` needed carrying over.

**`.input-description`** → `mt-1 order-3 p-2 w-full bg-surface text-ui [&_*:last-child]:mb-0` on both `Field.Description` branches in `PickerShell.tsx`. `$input-bg: #1e2633` matches `--color-surface: #1e2633` in `theme.css` exactly → `bg-surface`.

**`.boolean-picker-root`** (`_boolean_picker.scss`, deleted) → `BooleanPicker.tsx` prepends `max-xl:flex-row max-xl:justify-between` to the className string it already builds (`--breakpoint-xl: 1200px` matches the SCSS `media-breakpoint-down(xl)`).

**`.enum-picker-selector`** (`_enum_picker.scss`, deleted) → `EnumPicker.tsx`'s `<select>` gets `max-w-full` always, plus `config.inline ? 'w-20' : 'w-auto'`.
- **Collision found and resolved**: `.enum-picker-selector { width:auto }` (specificity 0,1,0) loses to `.input-inline select { width:5rem }` (0,1,1) whenever both would apply (an inline enum picker) — the compiled bundle confirms `width:5rem` wins there. The utility reproduces the tie by never applying `w-auto` and `w-20` at once: `w-auto` only when not inline, `w-20` only when inline.

**`.input-inline input:not(.form-check-input), select { width:5rem }`** → `w-20` (5rem = 20 × the default 0.25rem `--spacing` unit), applied conditionally on `config.inline` to the rendered `<input>`/`<select>` in `NumberPicker.tsx`, `NumberListPicker.tsx`, `AdaptiveStringPicker.tsx` and (see above) `EnumPicker.tsx`. `BooleanPicker.tsx`'s checkbox (`.form-check-input`) is untouched, matching the `:not(.form-check-input)` exclusion. `DropdownField`/`DropdownPicker` render neither `<input>` nor `<select>`, so nothing to carry there. No `StringPicker.tsx` exists (empty in scope — only `AdaptiveStringPicker` does).

**`.picker-group`** (18 hand-rolled feature sites) — left as the only rule remaining in `_input.scss`, unchanged, for U5's `PickerGroup` component to finish.

**`.number-list-picker-root {}` and its `@import './input'`** (`_number_list_picker.scss`) — file deleted (the rule was empty); `_input.scss` is now imported directly from `ui/scss/core/individual_sim_ui/index.scss` (added `@import '../components/input';`, since it was previously only reached transitively through `number_list_picker`) so the surviving `.picker-group` rule keeps compiling. The four now-empty imports (`boolean_picker`, `enum_picker`, `number_list_picker`, `unit_picker`) were removed from that same `index.scss`.

**`.unit-picker-item-icon`** (`_unit_picker.scss`, deleted) → `flex justify-center items-center size-icon-sm mr-1` on all three branches of `UnitIcon.tsx` (`--spacing-icon-sm: 1rem` is a named entry in the `--spacing-*` namespace, confirmed elsewhere in this file (§2, `--spacing-icon-sm`/`--spacing-icon-md`) to generate real `size-*`/`w-*`/`h-*` utilities, so `size-icon-sm` compiles to `width/height: var(--spacing-icon-sm)`).

**Out-of-scope collateral break, not fixed here (scope forbids touching `ui/features/**`)**: `ui/features/encounter/components/TargetsPicker/TargetsPicker.test.tsx` asserts the exact literal class list on `PickerShell`-rendered roots (`root().className.split(' ').sort()` against `['input-root', 'list-picker-root', 'mb-0', 'targets-picker']`, and a per-child `className.split(' ')` against `['number-picker-root', ...]`). Both now fail because the shared shell legitimately carries the new utility classes. These two tests need updating by whoever owns `ui/features/encounter` (or a later stage) to either use `arrayContaining`/substring checks or list the new utility tokens, the same way the in-scope `ui/ui-kit` tests here were updated.

## Stage 4 — C-U3.1: app shell located by role and test-id

Additive `data-testid="<class>"` on every app-shell wrapper element a test or probe locates by class; no element added/removed/reordered, no class removed, no styling change.

**`SimShell.tsx`** — root: `sim-ui`; `sim-root`, `sim-bg`, `notices-banner`, `sim-container`, `sim-sidebar`, `sim-title`, `sim-sidebar-content`, `sim-sidebar-actions`, `sim-sidebar-results`, `sim-sidebar-stats`, `sim-sidebar-socials`, `sim-content`, `sim-header`, `sim-header-container`, `sim-tabs-mount`, `import-export`, `sim-toolbar`, `sim-main`.

**`SimTabs.tsx`** — `Tabs.List` (`role=tablist` unchanged): `sim-tabs`; each `Tabs.Tab`: `data-testid={tab.id}` (the identifying token tests and probes already read off `className={clsx('sim-tab-link', tab.id)}`); `Tabs.Panel`: `sim-tab-panel`.

**Header** — `ToolbarItem.tsx`: wrapper `sim-toolbar-item`; the inner `Button` gets `data-testid={className?.split(' ')[0]}` so `known-issues`/`downbin`/`sim-options` resolve without a new prop. `SimToolbar.tsx`: `sim-toolbar-socials`, per-social `sim-toolbar-item`. `ImportExportMenu.tsx`: `sim-dropdown-menu`, `${kind}-link` (i.e. `import-link`/`export-link`), `sim-dropdown-positioner`, `sim-dropdown-popup`, `sim-dropdown-item`. `SimTitleDropdown.tsx`: `sim-title-dropdown-root`, `sim-link` (trigger, submenu trigger, and each `Menu.LinkItem`), `sim-title-positioner`, `sim-title-popup`.

**`SettingsDialog.tsx`** — `picker-group`, `fixed-rng-seed-container`, `fixed-rng-seed`, `last-used-rng-seed`, `language-picker`, `show-threat-metrics-picker`, `show-experimental-picker`, `show-quick-swap-picker`, `use-concurrency-container`, `use-concurrent-workers-picker`. **Not done**: the two `.form-text` `HelpText` notes — `HelpText` (`ui/ui-kit/FormControl/HelpText.tsx`) destructures only `as`/`hidden`/`className`/`children` and drops any other prop, so a `data-testid` passed to it never reaches the DOM; adding one needs a `ui-kit` change, out of scope this wave. `SettingsDialog.test.tsx`'s `.form-text` lookup stays class-based for that reason.

**Not done (out of scope / no path this wave)**: `NoticeNativeSim.tsx`'s `toast-notice-native-download` — `ToastArea`'s `className` only reaches `ToastViewport`, which has no test-id passthrough either; same `ui-kit` constraint as `HelpText` above. `ui/app/tabs/*` wrapper classes (`tab-panel-left/right/col`, `settings-left-col-N`, `gear-tab-*`, `bulk-*`) and `PresetConfigurationPicker` — not reached this pass; `SettingsTabBody.test.tsx` and `RotationTabBody.test.tsx` still locate by class there.

**Tests rewritten**: `SimShell.test.tsx` (`container.querySelector('.sim-sidebar-actions')` → `getByTestId('sim-sidebar-actions')`, both cases). `SimApp.test.tsx` (`.sim-ui` → `[data-testid="sim-ui"]`, `.sim-sidebar-stats .character-stats-root` / `.sim-sidebar-results .results-viewer` → testid-scoped, 5 call sites). `SimTabs.test.tsx` (`tab(id)` now matches `[data-testid="${id}"]`; `selectedIds()`/roving-tabindex `stops()` read `data-testid` instead of splitting `className`). `SettingsDialog.test.tsx` (`container()`, `last-used-rng-seed` reads switched to `[data-testid=...]`; `.form-text` left as class, see above).

**Probe rewrites** (class selector → tolerant `[data-testid], .class` form, `q()` from `browser.mjs` where the call site is in Node scope, a local page-context `q` copy where it runs inside `page.evaluate`):
- `browser.mjs:186,197,200,203,211,231` (`PROBE`'s `tabsOf`/`idOf`/`paneChain`/`panes`) — `.sim-tabs [role=tab]` → `` `:is(${q('sim-tabs')}) [role=tab]` ``, `.sim-main` → `q('sim-main')`, `.sim-main > [role=tabpanel]` → `` `:is(${q('sim-main')}) > [role=tabpanel]` ``.
- `header-toolbar.mjs:37-89` (`structure`, local `q` added) — `.sim-header`, `.sim-header-container`, `.sim-tabs` (`matches`), `.sim-toolbar`, `.sim-toolbar-socials` (`matches` + descendant with `.sim-toolbar-item`), `.known-issues`. `:103` `selector: '.sim-header'` → `q('sim-header')`. `:125-126` `.import-link`/`.export-link` → `q('import-link')`/`q('export-link')`. `:159` `.sim-toolbar .sim-toolbar-item` locator → tolerant `:is()` pair. `:179` `stuck()` inline bracket form for `.sim-header`.
- `sim-title.mjs` — imports `q`; `MENUS`/`ROWS` get a local page-context `q` copy for `.sim-title`/`.sim-title-popup`/`.sim-link`; `openSpec` selector, the trigger-read `evaluate`, `page.click`, and `rowSelector` all converted.
- `sidebar-loading.mjs` — imports `q`; `READ`'s `.sim-sidebar-actions` (local `q`), the two `waitForSelector` calls (module `q`).
- `sidebar-popover.mjs:68` — `.sim-sidebar-content` → inline bracket form (single use, `geometry` runs via `page.evaluate`).
- `sim-progress.mjs` — `.sim-sidebar-actions .dps-action` (9 sites) and `.warning-zone .sim-toolbar-item` (2 sites) → inline `:is([data-testid=...], .class)` form (mixed Node/browser contexts, so no `q` import needed).
- `tabs-a11y.mjs`, `tabs-behaviour.mjs`, `mount-once.mjs`, `panes-parity.mjs` — every `.sim-tabs [role=tab]` / bare `'.sim-tabs'` → inline tolerant form; `mount-once.mjs` additionally for `.sim-sidebar-actions .sim-sidebar-action-button` and `.sim-sidebar-stats .character-stats-root`.
- `a11y.mjs` — `REGIONS`' four selectors and the `.sim-sidebar` `waitForSelector` converted; the tab-body selectors (`.settings-tab`, `#gear-tab`, `#bulk-tab`) left alone — out of this wave's scope.
- `parity.mjs` — **no change**: its class-anchored regexes (`SOCIALS`, `IMPORT_EXPORT`, `SIM_TITLE`, `SIDEBAR_ACTIONS`, `SIM_UI_ROOT`, …) already tolerate a test-id because `SERIALIZE` (`browser.mjs`) unions each element's class list with its `data-testid` before matching, and every class this wave touched was kept, never removed.

**Remaining class locators in `ui/app/**/*.test.tsx`** (grep: `querySelector(All)?\('.` / `closest\('.`):
- `SimApp.test.tsx:134,143,159` — `.gear-tab-left`, `.character-stats-root`, `.built-imperatively`: all test-authored mock class names (the real components are `vi.mock`ed), not shell locators.
- `SimTabs.test.tsx:85` — `.sim-tab`: the test's own fixture markup (`<div id={id} className="sim-tab">`), not `SimTabsSection`'s real pane.
- `ui/app/tabs/SettingsTabBody.test.tsx`, `ui/app/tabs/RotationTabBody.test.tsx`, `ui/app/PresetConfigurationPicker/PresetConfigurationPicker.test.tsx` — tab-body wrapper classes (`tab-panel-left/right/col`, `settings-left-col-N`, `rotation-tab-apl`, `preset-configuration-picker-root`, …): not reached this pass, see "Not done" above.

## Cheap gates (C-U3.1)
`npm run type-check` clean. `npx oxlint ./ui` → 251 warnings (was 255), 0 errors (ran `--fix` on the files this wave touched to settle import order). `npx vitest run ui/app` → 12 files / 76 tests, all green. `node --check` on every touched `.mjs` (`browser`, `header-toolbar`, `sim-title`, `sidebar-loading`, `sidebar-popover`, `sim-progress`, `tabs-a11y`, `tabs-behaviour`, `mount-once`, `a11y`) → OK. `sidebar-reference.mjs` and `panes-parity.mjs`'s already-tolerant `sim-tabs`/`sim-ui` lines needed no `node --check` beyond the syntax check above.

**Follow-up (structural fix)**: the hazard was in `q()` itself (`browser.mjs`) — a bare `[data-testid="x"], .x` comma list binds a later-appended descendant/attribute suffix (`` `${q(x)} …` ``) to its last alternative only, matching the region root as a false positive. `q()` and every page-context copy of it (`browser.mjs`'s `PROBE`, `header-toolbar.mjs`, `sidebar-loading.mjs`, `sim-title.mjs`) now return `` `:is([data-testid="${name}"], .${name})` ``; `a11y.mjs`'s `REGIONS` were simplified to call `q()` directly, and the remaining hand-written bare-comma literals within this wave's scoped files (`header-toolbar.mjs`, `sidebar-popover.mjs`, `sidebar-reference.mjs`, `mount-once.mjs`) were wrapped in `:is(...)` for consistency, even where not currently compounded. Bare `[data-testid="sim-ui"], .sim-ui` literals remain in several `.mjs` files outside this wave's scope (`apl-tab.mjs`, `combat-replay.mjs`, `log-runner.mjs`, `reforge-popover.mjs`, `results-filter.mjs`, `rotation-row-toggle.mjs`, `stat-weights.mjs`, `talents.mjs`, `timeline.mjs`, `topline-metrics.mjs`, `tw-bold.mjs`, `tw-elixir.mjs`) — none currently compound a selector onto them, so they are not hazardous today, but they were not touched here and should be swept the same way if a future wave appends to them.

### Follow-up — non-`PickerShell` `.input-root` emitters and the `!important` utility layer

`ui/styles/tailwind.css:5` imports `tailwindcss/utilities.css` with the `important` keyword, so **every**
Tailwind utility in this app compiles `!important`. That means any plain (non-`!important`) SCSS rule
anywhere that still touches an `.input-root`/`.input-inline`/`.form-label` carrier now unconditionally
loses to a utility landed on the same element, regardless of specificity or source order — the earlier
`!important` analysis in this stage's section only checked whether two *SCSS* rules collided; it did not
need to check plain-vs-utility because the utilities in scope were all made conditional. This follow-up
found the carriers that are **not** conditional, and the carriers PickerShell doesn't reach at all.

**New shared module**: `ui/ui-kit/PickerShell/classes.ts` — `INPUT_ROOT`, `INPUT_ROOT_INLINE`,
`INPUT_ROOT_MAX_MD_GAP`, `INPUT_ROOT_DISABLED_FILTER`, `INPUT_LABEL`, `INPUT_LABEL_INLINE`,
`INPUT_DESCRIPTION` — re-exported from `ui/ui-kit/PickerShell/index.ts`. `PickerShell.tsx` now sources
its own literals from it.

**Fixed, in `ui-kit` (in scope)**:
- `ui/ui-kit/SearchBar/SearchBar.tsx` — its root only ever carried bare `input-root` (never `.input-inline`
  or `.icon-picker`), so it gets `INPUT_ROOT` + `INPUT_ROOT_MAX_MD_GAP` on the root and `INPUT_LABEL` on
  its label — the same bundle `PickerShell` gives a non-inline, non-icon-picker instance.
- `ui/ui-kit/ListPicker/ListPicker.tsx` — `_list_picker.scss:121` `.list-picker-compact:not(:has(.list-picker-items > *)) { display: none }`
  (plain, not `!important`) used to win over `.input-root`'s plain `display:flex` by specificity; it now
  loses to the shell's `!important` `flex`. `ListPicker` already knows both `config.isCompact` and
  `value.length`, so `extraClassNames` gains a `'hidden'` class exactly when both hold — the same
  established idiom the file already used for `config.hideUi`, and `[hidden]{display:none!important}`
  (Tailwind's own reset, confirmed in the built bundle) beats the shell's `!important` `flex`.

**Enumerated, not fixed — out of this unit's scope (`ui/features/**`, forbidden by the A-U-input brief;
also risks colliding with other workers' concurrent edits in those directories)**:
- `ui/features/settings/components/ConsumesPicker/ConsumeRow.tsx:31` — hand-written `<div className="consumes-row input-root input-inline">`, needs `INPUT_ROOT_INLINE`/`INPUT_ROOT_DISABLED_FILTER` on the root and `INPUT_LABEL_INLINE` on its `FieldLabel`. Checked for the `!important display:block` rule the probe reported on that row's label span: not found in `_consumes_picker.scss`, `_settings_tab.scss` (individual_sim_ui), `_bootstrap_style_overrides.scss`, or `shared/_global.scss` (none of them set `display` on `.form-label`/`label`/`span`) — `FieldLabel` already carries its own `inline-block` Tailwind class, so the source of a `block` baseline is still unaccounted for and needs a wider search (possibly Bootstrap's own un-overridden `.form-label` base, or a rule outside `ui/scss`) by whoever owns this file.
- `ui/features/apl/components/FieldGroup/utils.ts:12` — only contributes an `'input-inline'` string into an `extraClassNames`-style array consumed by a `PickerShell` picker, so it is not a raw emitter and needs no fix.
- `ui/features/encounter/components/TargetsPicker/TargetInputPicker.tsx:29` and `TargetPicker.tsx:52` — both hand-written `<div className="input-root ...">`, non-inline, need `INPUT_ROOT` (+ `INPUT_ROOT_MAX_MD_GAP` unless they're always icon-picker-like) and `INPUT_LABEL` on any label inside.
- `ui/features/encounter/components/TargetsPicker/utils/configs.ts:339` — `extraClassNames: ['input-inline']` feeds a `PickerShell` picker; not a raw emitter, no fix needed.
- `ui/features/item-swap/components/ItemSwapPicker/ItemSwapPicker.tsx:41,53` — `extraClassNames: ['input-inline']` (feeds a shell picker, fine) alongside a second hand-written `<div className="input-root input-inline input-item-swap-container">` at line 53, which does need `INPUT_ROOT_INLINE`/`INPUT_ROOT_DISABLED_FILTER` and its label needs `INPUT_LABEL_INLINE`.
- `ui/features/gear/components/SelectorModal/ItemList.tsx:170,190` — both `extraClassNames` feeding `PickerShell` pickers; not raw emitters, no fix needed.
- `_settings_tab.scss` (`ui/scss/core/individual_sim_ui/_settings_tab.scss:12-13,49`) is explicitly out of scope for this unit (reserved for a later one) but is a genuine, now-real collision: `.settings-tab .rotation-settings/.other-settings .input-root label { width:60%; padding-right:.5rem }` and `... input:not(.form-check-input), select, .picker-group { min-width:40% }` are both plain rules that used to win inside the settings tab and now lose to the shell's `!important` label-truncation utilities and to `EnumPicker`'s `!important` `w-auto`/`w-20`/`max-w-full` on its `<select>`. Whoever picks up `_settings_tab.scss` needs to either drop those SCSS declarations in favour of Tailwind utilities passed down through `extraClassNames`, or make the shell's utilities conditionally absent for that carrier.

**Gates after this follow-up**: `type-check` clean; `lint:css` clean; `oxlint ./ui` → 0 errors, 251 warnings (≤280); `npx vitest run ui/ui-kit ui/features ui/app` → 198 files / 1627 tests, all passing.

### Follow-up 2 — descendant selectors reproduced via `group/input` + data attributes

The remaining diffs traced to old rules being **descendant selectors keyed on ancestor class**
(`.input-inline label`, `.input-root:not(.input-inline):not(.icon-picker) label`), which per-element
`config.inline` conditionals cannot reproduce — a nested picker's own label needs to react to an
*ancestor's* inline/truncate state, not its own. Reworked around Tailwind's named `group` variant,
which (like the old plain-CSS descendant combinator) matches **any** ancestor carrying the marker, not
just the nearest one — so the old cascade's "bleed-through" through nested non-inline/non-icon roots is
reproduced automatically without extra code.

**`classes.ts` (updated)**:
```
INPUT_ROOT = 'flex flex-col items-start'
INPUT_ROOT_INLINE = 'flex flex-row justify-between items-center'
INPUT_ROOT_MAX_MD_GAP = 'max-md:gap-2'
INPUT_ROOT_DISABLED_FILTER = 'data-[disabled]:[filter:opacity(0.5)]'
INPUT_ROOT_GROUP = 'group/input'
INPUT_ROOT_INLINE_WIDTH = 'group-data-[layout=inline]/input:w-20'
INPUT_LABEL_INLINE = 'group-data-[layout=inline]/input:mr-2 group-data-[layout=inline]/input:mb-0'
INPUT_LABEL_TRUNCATE = 'group-data-[truncate]/input:whitespace-nowrap group-data-[truncate]/input:overflow-hidden group-data-[truncate]/input:text-ellipsis group-data-[truncate]/input:max-w-full'
INPUT_DESCRIPTION = 'mt-1 order-3 p-2 w-full bg-surface text-ui [&_*:last-child]:mb-0'
isInputInline(classes) = /\binput-inline\b/.test(classes)
```

**`PickerShell.tsx`**: `isInline = !!config.inline || isInputInline(clsx(className, config.extraClassNames))`
(class-based detection, per item 1 — a caller shipping `input-inline` only in `extraClassNames`, e.g.
`FieldGroup/utils.ts`, now sets `data-layout="inline"` correctly even though `config.inline` is false).
`isIconPicker` is the same `className`-token check as before. `truncate = !isInline && !isIconPicker`.
Root now carries `INPUT_ROOT_GROUP`, `data-layout={isInline ? 'inline' : undefined}`,
`data-picker={isIconPicker ? 'icon' : undefined}`, `data-truncate={truncate ? '' : undefined}`. The
label's className is now **unconditional**: `clsx('form-label', INPUT_LABEL_INLINE, INPUT_LABEL_TRUNCATE)`
on every instance — the group-data variants decide applicability at the CSS layer, not JS.

**Inputs** (`NumberPicker`, `NumberListPicker`, `AdaptiveStringPicker`): the input's `w-20` is now the
static `INPUT_ROOT_INLINE_WIDTH` (`group-data-[layout=inline]/input:w-20`), not `config.inline && 'w-20'`.

**`EnumPicker`**: reverted to always `enum-picker-selector form-select max-w-full w-auto` — its own
`.enum-picker-root .enum-picker-selector { width: auto }` was at (0,2,0) and always beat
`.input-inline select` at (0,1,1), so the select was never actually `w-20` even when inline; the earlier
per-instance conditional was wrong and is now removed entirely (dropped the now-unused `clsx` import).

**`IconEnumPicker.tsx`**: its hand-rendered `<label className="form-label">{selected?.text}</label>`
(bypasses `PickerShell`'s own `Field.Label`) now also carries `INPUT_LABEL_INLINE`, since old
`.input-inline label` matched it too whenever an `IconEnumPicker` is nested inside an inline ancestor
(e.g. `ConsumeRow`'s consumable rows) — this is the concrete case the probe's evidence (b) pointed at.
Did not add `INPUT_LABEL_TRUNCATE` there: this root always carries `icon-picker`/`data-picker="icon"`,
so its own `data-truncate` is never set; a truncate bleed-through from some *further-out* non-inline
ancestor is a theoretical residual gap, not evidenced by the probe, left unaddressed.

**`SearchBar.tsx`**: never carries `input-inline` and is never nested (it isn't reachable as a
descendant of another `.input-root`), so its truncate condition is statically always true — kept as a
plain, unconditional `whitespace-nowrap overflow-hidden text-ellipsis max-w-full` on its label rather
than wiring up the group machinery for a condition that never varies.

**Reverted** (item 2's tag-only correction): `FieldLabel`'s `margin` prop (added in the prior follow-up)
is removed again — `ConsumeRow.tsx`/`ItemSwapPicker.tsx`'s `<FieldLabel as="span">` labels never matched
`.input-inline label` (`label` is a tag selector, spans were never in scope), so both revert to plain
`className="form-label"` with `FieldLabel`'s own default margin. Both rows' outer `input-inline`
container still gets `INPUT_ROOT_GROUP` + a hardcoded `data-layout="inline"` (they are unconditionally
inline, not driven by a `config.inline` flag), so their *nested* pickers' labels correctly pick up
`INPUT_LABEL_INLINE` through the ancestor-matching group variant — item (b)'s exact scenario.
`TargetPicker.tsx`/`TargetInputPicker.tsx` are never inline, so `data-layout` stays absent on them
(no change needed there this round).

**Gates**: `type-check` clean; `lint:css` clean; `oxlint ./ui` → 0 errors, 251 warnings (≤280);
`npx vitest run ui/ui-kit ui/features ui/app` → 198 test files, 1627 tests, all passing.

### A-U-input part 1 — cascade bridges (2026-09-13)

Course-corrected mid-task: no `!important` and no bridge rules. Every contested property (one where
some SCSS rule outside `ui/specs/**` targets the same property on a picker root, its label, or its
inline input/select) was moved back to SCSS verbatim, and the corresponding utility was deleted from
`PickerShell`/`classes.ts`/the picker components — the plain, non-important SCSS then wins the cascade
exactly as it did before Wave 3, since nothing utility-side contests it anymore.

- `ui/scss/core/components/_input.scss` (restored `.input-root` flex-direction/align-items, the
  `.input-root:not(.input-inline):not(.icon-picker)` md-breakpoint block + label truncation, the
  `&.input-inline, &.icon-picker label { overflow: unset !important; ... }` cancel, and the whole
  `.input-inline` block incl. `input:not(.form-check-input), select { width: 5rem }`) — overrides
  `PickerShell.tsx`'s removed `flex-col/flex-row/justify-between/items-center`, the removed
  `INPUT_ROOT_MAX_MD_GAP` gap, and the removed `INPUT_LABEL_INLINE`/`INPUT_LABEL_TRUNCATE`/
  `INPUT_ROOT_INLINE_WIDTH` utilities used by `NumberPicker.tsx`, `NumberListPicker.tsx`,
  `AdaptiveStringPicker.tsx`, `IconEnumPicker.tsx`, `SearchBar.tsx`. Retiring unit: whichever unit next
  ports `_input.scss`'s picker rules — not scheduled in this pass.
- `ui/scss/core/components/_boolean_picker.scss` (restored in full: `.boolean-picker-root` max-xl
  `flex-direction: row; justify-content: space-between`) — overrides `BooleanPicker.tsx`'s removed
  `max-xl:flex-row max-xl:justify-between`. Re-added its `@import` to
  `ui/scss/core/individual_sim_ui/index.scss`.
- `ui/scss/core/components/_enum_picker.scss` (restored in full: `.enum-picker-root .enum-picker-selector
  { width: auto; max-width: 100% }`) — found via audit, not in the known-contested list:
  `ui/scss/core/components/_suggest_reforges_action.scss:83` sets `.enum-picker-selector { width: 100% }`
  under `.reforge-optimizer-stat-cap-table`, a plain (non-important) SCSS rule that the removed
  `max-w-full w-auto` utility on `EnumPicker.tsx`'s select would have permanently beaten regardless of
  specificity. Re-added its `@import` to `index.scss`.
- `ui/scss/core/talents/_talents_picker.scss:10` (`.talents-picker-root { flex-direction: row }`,
  >=1921px) and the APL/list-picker family (`_apl_rotation_picker.scss`, `_list_picker.scss`) needed no
  direct edits — restoring `.input-root`'s plain flex-direction/align-items/gap in `_input.scss` and
  removing the utilities that fought them was sufficient; the cascade among plain SCSS rules is
  unchanged from pre-Wave-3 baseline (talents → U5, APL/list pickers → U6 own these files going
  forward for any further picker-root work).
- `ui/scss/sims/mage_fire.scss:3` (`.fire-mage-sim-ui .number-picker-input[id^='combust'] { width: 7rem
  }`) needed no edit either — its selector specificity (0,3,0) already beats the restored
  `.input-inline input:not(.form-check-input)` (0,2,1) on plain SCSS terms, same as baseline. Later
  `specs.css` step owns this file if it ever needs to move.
- `ui/scss/core/components/_unit_picker.scss` and `_number_list_picker.scss` were audited and left
  deleted: no other SCSS file sets `width`/`height`/`margin-right`/`display`/`justify-content`/
  `align-items` on `.unit-picker-item-icon`, and `_number_list_picker.scss` carried no properties of its
  own (just an `@import` and an empty selector) — both conversions are uncontested.
- `ui/ui-kit/ListPicker/ListPicker.tsx`'s `hidden` class (added when `config.isCompact && value.length
  === 0`) reproduces the baseline `.list-picker-root.list-picker-compact:not(:has(.list-picker-items >
  *)) { display: none }` exactly: `.list-picker-items` is only rendered at all when `value.length > 0`,
  so "no items box, or an items box with no children" and "value is empty" are the same condition here.
  No bridge needed.

**Gates**: `type-check` clean; `lint:js` 0 errors (pre-existing warnings elsewhere untouched);
`lint:css` clean; `npx vitest run ui/ui-kit` → 47 files, 444 tests, all passing.
`git diff -- ui | grep -c '^+.*!important'` = 0.

### A-U-input part 2 — display deferred (2026-09-13)

`display: flex` on the picker root turned out contested too, just outside the rest-state probe's
reach (it never opens the advanced encounter dialog): `ui/scss/core/components/_encounter_picker.scss:46`
`.target-picker-root { display: grid }` and `:73`
`.hide-threat-metrics .advanced-encounter-picker-modal .target-picker-section3.threat-metrics .input-root
{ display: none }` would both have lost to the removed `flex` utility. Restored `display: flex;` as the
first declaration in `.input-root` in `_input.scss` (verbatim position), deleted `INPUT_ROOT`,
`INPUT_ROOT_INLINE`, `INPUT_ROOT_MAX_MD_GAP` from `classes.ts`/`index.ts`, and dropped the `layout`
utility from `PickerShell.tsx`'s root className. `ConsumeRow.tsx`, `ItemSwapPicker.tsx`,
`TargetPicker.tsx`, `TargetInputPicker.tsx` reverted to HEAD (they only imported the now-empty
constants and added `data-layout`). Deferred to U5 (encounter) for whenever `_encounter_picker.scss`'s
`display` rules move.

### A-U-input part 1 — final state (2026-09-13, orchestrator)

The entries above record the attempts; this is what ships. Rule applied (coordinator's steer):
a declaration converts only if nothing in the SCSS tree overrides it, checked per rule; no
`!important` is added or kept, and a contested property stays in SCSS verbatim until the unit that
owns its overrider converts both sides together.

Converted (uncontested): `.input-root.disabled { filter }` → `data-[disabled]:[filter:opacity(0.5)]`
on `PickerShell`'s root; `.input-root:has(.input-description) { flex-wrap }` → `flex-wrap` when
`config.description` is set; the `.input-description` block →
`mt-1 order-3 p-2 w-full bg-surface text-ui [&_*:last-child]:mb-0`; `_unit_picker.scss` →
`flex justify-center items-center size-icon-sm mr-1` on `UnitIcon`; `_number_list_picker.scss`
(an empty rule plus `@import './input'`) deleted with `_input.scss` imported directly in the same
slot of `individual_sim_ui/index.scss` (source order matters: `.input-root { align-items }` must
still follow `.list-picker-root { align-items }`); `ListPicker` emits `hidden` for an empty compact
list, which equals the old `:not(:has(.list-picker-items > *))` condition because the items box only
renders when the value is non-empty.

Left in SCSS, with the unit that converts each: root `display` (U5 — `_encounter_picker.scss:46`
`.target-picker-root { display: grid }`, `:73` `display: none` under `.hide-threat-metrics`);
root `flex-direction`/`align-items`/`justify-content` (U5 `_talents_picker.scss:10`, U6
`_apl_rotation_picker.scss` + `_list_picker.scss`, U7 `EpWeightsDialog.scss:62`); the
`:not(.input-inline):not(.icon-picker)` md `gap` (U6 `_apl_rotation_picker.scss:16`); every label
rule incl. the inline/icon `overflow: unset !important` cancel (U6, APL `label { margin: 0 }`);
`.input-inline input, select { width: 5rem }` (the late `specs.css` step — `sims/mage_fire.scss:3`
sets 7rem on the combust pickers of a frozen spec); `.boolean-picker-root` max-xl block (with the
Checkbox commit); `.enum-picker-selector` (U7 — `_suggest_reforges_action.scss:83` sets
`width: 100%`); `.picker-group` (U5). Wave-3 tests that asserted exact class arrays were loosened
to membership checks. `group/input`, `data-truncate`, `data-picker` were removed again: no CSS
reads them.

## Stage 4 — B-U3a: TabNav/TabPanel

New `ui/ui-kit/TabNav/{TabNav,TabPanel}.tsx` wrap Base UI `Tabs.List`/`Tabs.Tab`/`Tabs.Panel`; `tab_pane_class.ts` and `SimTabs.scss` deleted, the `.nav-tabs { .nav-item … .nav-link … }` block of `_bootstrap_style_overrides.scss` deleted (every declaration it set is now in the tab string). Five list sites (`SimTabs`, `AplNavbar`, `DetailedResultsTabs`, `SelectorModal`, `BulkTabBody`) and three panel sites (`BulkTabBody`, `RotationTabBody`, `DetailedResultsPane`). No tree change: `ul > li > button` and the panel `div` are unchanged, `TabBadge` renders nothing without a label.

**Strings.** Tab (both variants): `flex items-center m-0 border-0 py-(--tab-padding-y) px-(--tab-padding-x) bg-transparent text-(--tab-color) [font-family:inherit] text-[length:var(--tab-font-size)] font-bold whitespace-nowrap no-underline cursor-pointer [transition:var(--tab-transition)] hover:text-(--tab-color-hover) focus-visible:outline-0 focus-visible:focus-ring data-[active]:relative data-[active]:text-(--tab-color-active) data-[active]:after:… h-[2px] bg-(--tab-color-active)`; the nav-tabs variant adds `h-full focus:text-(--tab-color-hover)` (Bootstrap's `.nav-link:focus`) and `border-current`: the deleted override's `border: 0` was a shorthand, which resets the colour to `currentColor`, while `border-0` sets only the widths — without it Bootstrap's `.nav-tabs .nav-link { border: 1px solid transparent }`/`.active { border-color }` showed through on `border-top-color`/`border-left-color` (the second probe run, 63 sections, nothing else). The 2px full-width active bar is written inline: the `active-underline` utility is the 1px inset border-colour bar of the sticky header, a different computed result. List, nav-tabs variant: `nav nav-tabs flex mb-0 pl-0 list-none` + `bordered ? 'border-b border-b-border' : 'border-b-0'` + `wrap ? 'flex-wrap' : 'flex-nowrap'`; sim variant: `sim-tabs m-0 flex list-none flex-nowrap items-end p-0`. `li`: `nav-item flex items-center`. Panel: `tab-pane fade-in-out` + `active`/`show` staged exactly as `tab_pane_class.ts` did, plus `opacity-0` while not `show` (Bootstrap's `.fade:not(.show)`).

**Why the props select whole strings.** `bordered={false}` sites (`AplNavbar`, `DetailedResultsTabs`, `SelectorModal`) used to win by feature SCSS (`border-bottom: 0` in `_rotation_tab.scss:65`, `_detailed_results.scss:82`, `_selector_modal.scss:6`); those declarations are deleted here and the kit emits `border-b-0` instead. Same for `wrap={false}` (`_rotation_tab.scss`'s `flex-wrap: nowrap; display: flex` deleted) and for `_selector_modal.scss`'s `.selector-modal-tab-gem { height: 100% }` (now `h-full` on every nav-tabs link). `border-b-border`, not `border-border`: Bootstrap coloured only the bottom edge, the top/left computed `currentColor` — the first probe run showed 54 lists with white→#6c757d on those sides.

**Bootstrap `nav` and `transitions` stay imported.** The first probe run (66/66 sections) showed why: `.nav-link` still styles `LandingHeader`'s three links and `LandingLanguageMenu`'s trigger (padding, font-size, colour — every landing section diffed), and `.nav` still lays out `SimShell`'s `import-export`/`sim-toolbar` divs where `_header.scss:57-60` overrides `flex-wrap` to `nowrap` (a `flex-wrap` utility beat it in 21 sections). Both partials die with the unit that converts their last reader: A-U-shell for the two toolbar divs, A-U-landing for the landing header. The kit strings already set every property those partials put on the tab sites, so the later deletion is a no-op there.

**Behaviour kept:** `keepMounted` on every panel; `SelectorModal` keeps its selection-driven `active show` (it gains `fade-in-out` + `opacity-0` when inactive); `#noResultsTab` (a static div wearing `fade active show`) carries `transition-[opacity] duration-150 ease-linear opacity-100` inline; the shell panes (`sim-tab-panel`) keep their **enter-only** fade as `[transition:var(--transition-fade)] data-[starting-style]:opacity-0` — not `fade-in-out`, whose `[data-ending-style]` rule would keep the outgoing pane laid out for a 150 ms exit fade the SCSS never had (the third probe run showed exactly that: the results tab's sticky toolbar computing `stuck` on a pane about to be hidden, one section at 700px); `sim-tabs-mount`/`sim-tabs-root` carry `contents`. Every legacy class hook (`nav`, `nav-tabs`, `nav-item`, `nav-link`, `active`, `show`, `tab-pane`, `tab-content`, `sim-tab-link` + the tab id, `sim-tab-panel`, `dr-tab-tab`, `selector-modal-*`) is still emitted — the probes read them until C-U3.2.

## Stage 4 — B-U3b: Menu/MenuItem

New `ui/ui-kit/Menu/{Menu,MenuItem}.tsx` + `classes.ts` (the surface/positioner/item strings exported for the sites whose tree the wrapper cannot own: `DropdownMenu`'s radio group and submenus, `SimTitleDropdown`'s `SubmenuRoot`/`LinkItem`). Deleted `DropdownPicker.scss`, `ImportExportMenu.scss`, `SimTitleDropdown.scss`. `ImportExportMenu` is the one site fully on `<Menu surface="menu">`/`<MenuItem layout="block">`.

**Strings.** Surface `menu`: `min-w-(--dropdown-min-width) py-0 border border-surface-border bg-surface-raised text-white text-[length:var(--dropdown-font-size)]` (`--color-surface-border` = `--dropdown-border-color`, `--color-surface-raised` = `--dropdown-bg`; `text-[length:…]` because `text-base` would also emit a 1.5 line-height the SCSS never set). Surface `plain` (`SimTitleDropdown`): `border-0 bg-background`, width `anchor` → `w-(--anchor-width)`, specs popup `w-auto min-w-[300px]`. Positioner: `menu` → `z-(--z-dropdown)`, `plain` → `z-[1500]` (its own value, a whole-string variant, never a second z utility). Item: `w-full py-1 px-4 border-0 bg-transparent text-white font-normal text-left whitespace-nowrap cursor-pointer transition-colors duration-200 ease-in-out data-[highlighted]:bg-surface-hover data-[checked]:bg-surface-raised data-[disabled]:pointer-events-auto data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed` + layout `block` | `flex items-center` (`transition-colors` replaces `all 0.2s`, unprobed). Sim-title links: `block w-full border-0 bg-background text-left no-underline hover:bg-surface-hover focus:bg-surface-hover data-[highlighted]:bg-surface-hover data-[popup-open]:bg-surface-hover`.

**Relocated, not converted:** `.sim-title-popup .sim-link-content { padding-left/right: var(--spacing-gutter) }` (a descendant rule; `SimLinkContent` takes no root className — converts with its component) and `.sim-title-positioner[data-base-ui-inert] { pointer-events: auto !important }` (Base UI `markOthers`; vendor case, candidate for `vendor.css`) — both now in `_sim_title_dropdown.scss`.

**Bootstrap `dropdown` stays imported.** Readers outside this unit: `DropdownPicker`/`DropdownField` roots (`dropdown` → `position: relative`), `IconEnumPicker`/`MultiIconPicker` (`dropend`, `.dropdown-menu`+`.show` in `_icon_picker.scss`/`_multi_icon_picker.scss`), `BulkItemSearch` (`dropdown-menu … show`, `dropdown-item`), `DropdownMenuItems`' submenu trigger (`dropdown-item`, the `dropdown-toggle` caret on `DropdownMenu`'s button), both landing menus. The two root conversions tried here (`dropdown` → `relative` on `ImportExportMenu`/`SimTitleDropdown`) were reverted: `_header.scss:111-113` sets `.sim-dropdown-menu { position: unset }` and a utility beat it (21 sections in the first probe run). The import and those roots convert with A-U-icon at the earliest, after `BulkItemSearch` at the latest. The two landing menus (`LandingLanguageMenu`, `LandingClassMenu`) are untouched: their item look is Bootstrap's generic `.dropdown-item` plus `_homepage.scss` — A-U-landing.

`UnitPicker.test.tsx:74` narrowed from `not.toContain('text-')` to `not.toContain('text-class-')`: the guard is against a class colour leaking onto an option without one; `text-white` is now a legitimate item utility.

## Stage 4 — A-U-shell: the shell tree as utilities, TabPanelColumns, ContentBlock flush, sticky toolbar

Three disjoint workers, one commit. No tree change anywhere (the probe compares by position).

**Shell core** (`core/sim_ui/{_shared,_sidebar,_header,_main}.scss`, `_sim_title_dropdown.scss`): the root, `sim-root`, `sim-bg`, `sim-container`, `sim-sidebar` + its five zones and the action button, `sim-header` (+ its `::after` bar and `data-[stuck]` width, written inline — the `active-underline` utility also sets `position: relative`, which would fight the header's `sticky` on the same importance), `sim-header-container`, the two toolbar divs (`flex flex-nowrap items-end mb-0 pl-0 list-none font-bold`, reproducing Bootstrap `.nav` + `_header.scss`'s nowrap; the `nav` class is off them, the `nav` **import** stays for the landing header), `import-link`/`export-link`, `sim-toolbar-item/-socials`, `sim-dropdown-menu` (`static`, `_header.scss`'s `position: unset` over Bootstrap's `.dropdown`), `sim-content`, `sim-main`, `sim-title`, `sim-title-dropdown-root`, `sim-link-dropdown`, `sim-ui-unlaunched-container`. `--spacer-N` reads became scale steps (`mb-6`, `gap-4`, `ml-4`). **Kept in SCSS, each with its owner:** `.sim-sidebar-action-button` / `.loading` / `.sim-sidebar-action-button-loading-icon` (the first probe run showed the two hand-copied buttons in `ReforgePanel.tsx:170-198` going `relative → static` with their loading spans `none → inline`; the frozen `calculate_combustion_thresholds.test.tsx` also asserts the button's exact class list — parked for the user, see above; `SidebarActionButton.tsx` reverted), `.hide-*-metrics .x-metrics { display: none }` (carriers in the results tables → U8a; the root already emits `data-hide-*`), `.iterations-picker`/`.number-picker-input` (U-input/U5), `.sim-tabs { font-weight: bold }` (TabNav's list string, C-U3.2 or the next TabNav touch), `.sim-crash-report*` (CrashReportDialog), `.sim-title .sim-link` (interacts with `_sim_links.scss` and B-U3b's `SIM_LINK_CLASSES`; winner not proved), `:root`/`td,th` base rules (A-U-base), and B-U3b's two relocated rules.

**TabPanelColumns** (`ui/ui-kit/TabPanelColumns/`): `Root` (`as`, `gap: 'default'|'apl'` → `gap-(--spacing-page)` | `gap-y-(--spacing-gutter) gap-x-(--spacing-page)`, `fullWidth`), `Left` (`variant: 'default'|'auto-columns'|'settings-columns'|'stacked'` — the grid template is the one property the four tab files varied: `repeat(auto-fit,minmax(220px,1fr))` | `auto` (gear, bulk) | `2fr 2fr 3fr` (settings) | flex-column (rotation auto/simple)), `Right`, `Col`; each bakes its legacy class in. `_sim_tab.scss` and `_gear_tab.scss` emptied and deleted with their imports; `_bulk_tab.scss:4-9` deleted (its `calc(var(--spacing-gutter) - $nav-link-padding-y)` is a constant 0.5rem → `pt-2`); `_rotation_tab.scss` loses the `@extend`, `.rotation-tab { width }`, the auto/simple column rules and `.rotation-tab-apl { gap }`; `_settings_tab.scss` loses `.tab-panel-left { grid-template-columns }`. The `flex-direction: column !important` at lg-down is gone with the rules it fought (`_rotation_tab.scss:34`, the auto pane); the utility form `max-lg:flex max-lg:flex-col` needs no `!important`. **`display` stays in SCSS on the rotation panes:** `#rotation-tab.rotation-type-X .rotation-tab-Y { display: none }` toggles which of the auto/simple/apl panes is visible, so a `flex` utility on `Root` beat it and every hidden pane laid out live (the first probe run: 34 hidden divs per page turning into flex items, columns losing `gap`/grid). `Root` takes `externalDisplay` (no `display` utility) at those three sites and `.rotation-tab { display: flex }` stays in `_rotation_tab.scss` below the toggles' specificity. `Col` takes `externalGap` at `GearPicker`'s two columns, where `_gear_picker.scss:16-21` sets `gap: var(--spacing-stack)` (contested → U4). `Left` also lacked `gap-(--spacing-section)` on the first pass; the `stacked` variant carries the base grid template as an inert declaration for computed-value fidelity. Kept in `_settings_tab.scss`: the xxl-down `flex-direction: column` on the container (agrees with `max-xl:flex-col` where both fire, covers xl→xxl alone) and the xl-down `flex-wrap`/`flex-basis` rules (properties no variant sets) → U5.

**ContentBlock** (`_content_block.scss` shrunk): root `flex flex-col` (+ `mb-0` when `flush`), header `flex items-baseline gap-2`, title `flex items-center font-bold mb-0`, body `flex-col`. **`gap` stays in SCSS on the root and the body**: the first probe run showed 150+ blocks per page at the wrong gap — `GlyphsPicker.scss:17` sets the root to `gap: 0`, `SummaryTable.scss:26` the body to `var(--spacer-1)` — a `gap-stack` utility beat both (contested → U5/U4). The root's class order is `content-block, <site className>, mb-0?, flex flex-col` so a test reading the site's own class still finds it first. `flush` replaces the two `margin-bottom: 0 !important` on ContentBlock roots (`BulkItemSearch.scss:4`, `BulkPickerGroups.scss:4`, both deleted; nothing in the compiled cascade gives a `.content-block` a bottom margin, so the `!important` guarded nothing and `mb-0` is plain). `GlyphsPicker.scss:26` is a `PickerShell` root, not a ContentBlock → U5. Kept in SCSS: header `padding-bottom`/`border-bottom` (zeroed by the two bulk stylesheets → U4/U7), body `display: flex` (`_settings_tab.scss:39` makes buffs/debuffs a grid → U5).

**Sticky toolbar** (`_sticky_toolbar.scss` shrunk to `.dropdown-picker-button { padding }`, contested by `_apl_rotation_picker.scss:155,222` → U6): one exported `STICKY_TOOLBAR_CLASSES` in `ui/ui-kit/hooks/useStickyToolbar.ts` worn by `AplNavbar` and `DetailedResults`' `dr-toolbar` — `sticky top-(--sim-header-height) -mx-(--spacing-page) w-[calc(100%+var(--spacing-page)*2)] flex px-(--spacing-page) z-[calc(var(--z-header)-1)] transition-[background-color] duration-150 ease-in-out` + the `after:` bar + `data-[stuck]:bg-[color-mix(in_srgb,var(--theme-background-color)_calc(var(--theme-background-opacity)*100%),transparent)] data-[stuck]:after:w-full`. `.apl-rotation-navbar { gap; flex }` in `_rotation_tab.scss` is U6's and untouched.

**`individual_sim_ui/_shared.scss` deleted:** `.glyphs-picker` had no carrier (dead); the `:empty` elixir wrappers wear `empty:hidden` (`ConsumesPicker.tsx`).

## Stage 4 — U8a: results core

**Composition classes** (`ui/features/results/components/MetricsTable/MetricsTable.apply.css`, `ui/features/character-stats/components/CharacterStats/CharacterStats.apply.css`, both `@import`ed from `tailwind.css` after `./theme.css`, unlayered): `ui-metrics-table`/`ui-metrics-header-row`/`ui-metrics-header-cell`/`ui-metrics-row`/`ui-metrics-cell`/`ui-metrics-tooltip` cover the `<table>`/`<thead>`/`<tr>`/`<td>` bundle repeated at the three `.metrics-table` JSX sites (`MetricsTable.tsx`, `MetricsCombinedTooltip.tsx`, `ResultMetricList.tsx`) and the tooltip's `thead th` padding override; `metrics-table-tooltip` renamed to `ui-metrics-tooltip` at its seven call sites in `Damage/Healing/DtpsMetricsTable.tsx`. `ui-character-stats-row`/`-label`/`-value` cover the row bundle repeated at `StatRow.tsx` and `CritCapRow.tsx`. New tokens (additive, end of the `--color-*` group in `theme.css`): `--color-white-5`, `--color-white-20`, `--color-white-80` (the SCSS's `rgb(255 255 255 / N)` literals; `bg-scrim` — an existing token — covers the 50%-black row hover).

**Repo trap confirmed:** Bootstrap's reboot resets `border-style: solid` only on `button,input,optgroup,select,textarea`, not on `table/tr/td/th`. Every new `border`/`border-x`/`border-b`/`border-t` utility on a table or table-cell element in this unit is paired with `border-solid`, since preflight (which would otherwise reset `border-style` globally) is not imported yet.

**Single-JSX-site conversions** (utilities directly on the element, not `@apply`): `MetricsActionCell.tsx` (`metrics-action`, `metrics-action-icon`, `expand-toggle`; the two caret icons collapsed into one, chosen by the existing `expanded` prop, retiring `tr:not(.parent-metric) .expand-toggle{display:none}` and the `.parent-metric.expand .fa-caret-*` toggle as dead selectors), `MetricsTableRow.tsx` (`ui-metrics-row`/`ui-metrics-cell` plus `cursor-pointer` on `parent-metric` and a literal `pl-[20px]` on the first `child-metric` cell), `MetricsTotalBar.tsx` (all four rules; the three static custom properties — `7ch`, `7ch`, `50px` — stay as inline arbitrary values with no theme token, consumed via `-(--x)`/`[calc(...)]`), `DpsHistogram.tsx`, `ResourceMetricsSection.tsx`'s title span, `ToplineResults.tsx`'s `pb-6`, `DetailedResults.tsx`'s `detailed-results-manager-root`/`detailed-results-controls-div`, `SimResultsPanel.tsx`/`AbortButton.tsx`/`SimWarnings.tsx` (`[&_.loader]:m-auto`, `focus-visible:focus-ring` — the existing `@utility focus-ring` in `tailwind.css`, not a new rule), `CharacterStats.tsx` root/label/table, `TooltipRow.tsx`, `BonusStatsLink.tsx` (`[&_.number-picker-root]:flex-col` etc. on the Tooltip wrapper, since `NumberPicker` takes no `inputClassName` yet — that lands with forms-tail).

**Kept in SCSS, contested (not converted this unit):**
- `_sim_action.scss` in full: `[class^='results-sim-']` styles font sizes keyed on the dynamic, externally-frozen `results-sim-*` classnames `tools/browser-perf` and `topline_metrics.test.ts` select on (`ui/features/results/model/sim_results.ts`); a per-metric utility can't be attached without template-literal class construction, which the token policy forbids. `.results-sim`/`.results-metric` nesting exists only to scope those rules.
- `_detailed_results.scss`'s `.dr-root`/`.dr-toolbar`/`#noResultsTab` block: the pane-filling rules for `.timeline-content.active`/`.replay-content.active` reach into Timeline/CombatReplay's own pane content (out of scope here per the brief), and `#noResultsTab`'s `display: flex` is only ever shown through the `.dr-root:not(.dr-no-results) #noResultsTab { display: none }` override in the same block — converting the base rule to an important utility while the override stays non-important in SCSS would invert the hide/show state. Left for U8b/U8c/U8d.
- `.metrics-table-header-row .metrics-table-header-cell { color: var(--color-foreground) !important }`: the `!important` exists because a header cell also carries a column's `text-success` utility class; `@apply` never emits `!important` (docs), so a composition class here would lose to that sibling utility on rate columns. Owner: whichever unit normalises column coloring.
- `.metrics-table { table-layout: auto; td,th{width:0} th{white-space:nowrap} td{@include media-breakpoint-up(1080p){...}} .metrics-table-cell--primary-metric{width:400px} }` and `.damage-content/.healing-content .metrics-table { font-size: 12px }`: column-sizing and font-size overrides scoped to specific tab wrappers, left unconverted for lack of a browser to verify layout parity (no builds/browsers allowed this pass).
- `.dr-toolbar .nav-tabs`/`.input-root` sub-rules: unresolved reader census (TabNav's Bootstrap classes, ResultsFilter's `input-root`), left as-is.

**Not built this pass** (brief calls for them; deferred, no tree change attempted without a way to verify): the `Bar` primitive (`fillRef`), `MetricsTableShell`, `SectionTitle`, `DrToolbarContext`.

**Test/probe updates:** `MetricsActionCell.test.tsx` (single caret icon), `Damage/Healing/DtpsMetricsTable.test.tsx` (header-cell class string gains `ui-metrics-header-cell`; two Dtps row-class exact-string assertions gain `ui-metrics-row`), `SimResultsPanel.test.tsx` (`results-pending` gains `[&_.loader]:m-auto`). `tools/react-migration/*.mjs` **not** touched this pass — the probes still select by `.dr-root`/`.dr-toolbar`/`.metrics-table`/`.parent-metric`/`.child-metric`/`.expand`/`.resource-metrics-table-title`/`.topline-results-root`/etc., and every one of those class names was kept (only additive `ui-*`/utility classes were layered alongside), so no probe or gate script needed a selector change in what this pass actually converted.

## Follow-up — the `important` utilities flag is gone

`ui/styles/style.css:7` (the entry file was later renamed from `tailwind.css`) no longer imports
`tailwindcss/utilities.css` with `important`. It was added in `98d1416180` to beat Bootstrap's own
`!important` utilities and unlayered SCSS; both are gone from this app, so the flag now only causes
harm — any co-located component `.css` that forgot its `@layer components` wrapper (unlayered CSS
beats every layer) loses to a plain utility regardless of source order or specificity. The import is
now `@import 'tailwindcss/utilities.css' layer(utilities);`. `Toast.css`, `Tooltip.css` and
`UnitIcon.css` were the three co-located files still unlayered; they now wrap their rules in
`@layer components { … }` like every other file `style.css` imports. Every statement above this
section that says "every Tailwind utility in this app compiles `!important`" describes the state at
the time it was written, not the current cascade.
