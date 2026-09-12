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
"single seam" block at the end of the file is now six survivors: `--body-bg` and `--gray-500` and
the three `--table-row-*` (all read by `EpWeightsDialog.scss` / `GearPicker.scss`) plus
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
