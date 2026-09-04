# ui/ layout

Target tree:

```
ui/
  worker/            NOT MOVED (Go package, go:embed highs.wasm). alias @worker
  generated/         proto/*, *_auto_gen.ts — tool output only. alias @generated
                     (*_auto_gen.ts still sit beside their consumers)
  domain/            DOM-free, node-runnable model: sim/player/raid/party/encounter facades,
                     state/, proto_utils/, player_classes/, player_specs/, talents data + trees,
                     bulk request builders, wasm/, constants, utils, worker_pool, reforge_cache,
                     wowhead, cache_handler. alias @domain
  ui-kit/            sim-agnostic widgets + base classes: component, input, sim_tab,
                     sim_host (SimUIHost/SimHeaderHost — the shell slice ui-kit is allowed to name),
                     base_modal, content_block, toast, copy_button, tooltip_button, sticky_toolbar,
                     saved_data_manager, progress_tracker_modal, input_helpers, icon_inputs,
                     css_utils, dom_utils, pickers/, vendor/. alias @ui-kit
  features/<name>/   one folder per capability, split model/ (DOM-free) + view/ (tsx-vanilla).
                     apl/ (model/ action_id_sets + unit_sets + field_descriptors +
                     the value_kinds/action_kinds registries, view/ the pickers),
                     gear/ (gear_picker/* flattened in, plus
                     gem_summary/reforge_summary/upgrade_costs_summary/item_notice; plus
                     quick_swap/gear_change_icon), reforge/, results/ (plus
                     view/results_viewer), stat-weights/ (plus view/saved_ep_weights),
                     talents/, item-swap/ (view/, item_swap_picker),
                     character-stats/ (view/, character_stats), encounter/ (view/,
                     encounter_picker), settings/ (model/ buffs_debuffs/consumables/
                     stat_options/other_inputs, view/ cooldowns_picker + consumes_picker +
                     other_inputs + spec_change_warning_toast), bulk/ (model/ core_sim, view/
                     bulk_tab + bulk_item_search/bulk_item_picker/bulk_item_picker_group/
                     bulk_sim_results_renderer flattened), import-export/ (view/
                     importer/exporter + importers/ + exporters/); plus two top-level
                     type files: sim_host.ts (SimHost/IndividualSimHost) and spec_config.ts
                     (IndividualSimUIConfig + registerSpecConfig). alias @features
  app/               shells + chrome that compose features. browser_env.ts,
                     header/ (sim_header, sim_title_dropdown, social_links), settings_menu.tsx,
                     tabs/ (gear_tab, talents_tab, rotation_tab, settings_tab),
                     notice_native_sim.tsx, preset_configuration_picker.tsx,
                     sim_ui.tsx, individual_sim_ui.tsx, preset_utils.ts. alias @app
  i18n/              LEAF: framework-agnostic i18next config + localization tables
                     (config.ts, entity_mapping.ts, locale_service.ts, localization.tsx), at
                     the top level rather than under app/. alias @i18n
  sims/<class>/<spec>/   spec data, presets. alias @specs. No html on disk: the one page at
                     ui/index_template.html is served (dev) and emitted (build) at every
                     /mop/<class>/<spec>/ by tools/vite/spec_pages.mts
  scss/              unchanged, except sims/: one shared sims/sim.scss + sims/mage_fire.scss
                     replace the 34 per-spec sims/<class>/<spec>/{index,_sim}.scss (PR 8a)
  index.ts, index.html, index_template.html, shared/, types/, tracking/   root, unchanged
```

## Placement rules

- `domain/`: if it needs `window`/`document`, it doesn't belong here — inject an `Env` adapter instead.
- `ui-kit/`: reusable widgets with zero knowledge of sims (no `Player`/`Sim` types except through generic params).
- `features/<x>/model/`: DOM-free logic of one capability; `features/<x>/view/`: its tsx-vanilla rendering. Features never import another feature's `view/`. The two halves may share a
  filename when a capability has both: `settings/model/other_inputs.ts` holds the picker config
  constants (`InputDelay`, `TankAssignment`, the healing-model inputs — data a spec declares),
  `settings/view/other_inputs.ts` the `make*Selector(parent, sim)` DOM constructors.
- `app/`: composes features; the only place that knows the tab layout.
- `sims/<class>/<spec>/`: data; the only code allowed is `features/` escape hatches and `shared/derived.ts` rules.

## Dependency direction

```
generated → worker → {domain, i18n} → ui-kit → features → app → specs → pages
```

`domain` and `i18n` are peers: both are leaves everything above them may depend on, and each
may depend on the other (i18n's entity/status label maps name domain enums; domain in turn calls
into i18n for label lookups). Each layer may only import from layers to its left. `.oxlintrc.json` enforces this with
`no-restricted-imports` on the alias forms (see overrides for `ui/domain/**`, `ui/ui-kit/**`,
`ui/features/**`, `ui/app/**`), plus `no-restricted-globals` (window/document/localStorage/
location/navigator) on `ui/domain/**` and `ui/features/*/model/**`.

The `no-restricted-imports` groups use `**` (not `*`): oxlint matches these patterns one
path segment at a time, so `@features/*` would not catch `@features/gear/view/item_list`.
`ui/features/**` may not import the store writers (`patchSlice` / `patchKeyed` / `seedKeyed` /
`deleteKeyed`) — go through a facade.

Features, ui-kit and domain must not name the app shells (`SimUI`, `IndividualSimUI`) even as a
type: `import type` is erased at runtime but the lint bans the specifier either way. They use
narrow host interfaces instead — `@ui-kit/sim_host` (`SimUIHost`, `SimHeaderHost`) and
`@features/sim_host` (`SimHost`, `IndividualSimHost<Spec>`, `SimWarning`, `ActionGroupItem`,
plus the `isIndividualSimHost()` predicate that replaces `instanceof IndividualSimUI`). The
shells declare `implements SimHost` / `implements IndividualSimHost` so the interfaces stay
honest. The per-spec config schema lives in `@features/spec_config` (`IndividualSimUIConfig`,
`InputSection`, `OtherDefaults`, `Settings`, `registerSpecConfig`, `itemSwapEnabledSpecs`); it
cannot sit in `domain/` because it names ui-kit picker configs and `EncounterPickerConfig`.
It also holds the declarative spec surface (`SpecDefinition`, `SpecBehaviors`, `DerivedSetting`,
`CustomSection`, `defineSpec` — see "How to author a spec"); `app/individual_sim_ui.tsx` re-exports all of it as a
convenience. The preset shapes
(`PresetGear`, `PresetEpWeights`, …) live in `domain/presets/types.ts`; `app/preset_utils.ts`
holds the `make*` builders and re-exports the types.

Proto-serialisable preset data lives as JSON, never as a TS literal: gear (`gear_sets/*.gear.json`),
APLs (`apls/*.apl.json`), builds (`builds/*.build.json`), EP weights (`presets/ep/*.ep.json`) and
talents (`presets/talents/*.talents.json`) under `ui/sims/<class>/<spec>/`. EP/talent JSON stores enum
fields by name (e.g. `"StatCritRating"`, `"GlyphOfBullRush"`) rather than numeric value, so the
file stays stable across proto regenerations; `PresetUtils.makePresetEpWeightsFromJSON` /
`makePresetTalentsFromJSON` resolve the names back through the enum (`Stat`/`PseudoStat`, and the
per-class glyph enums passed in as `{ major, minor }`) and build the preset the same way the old
literal call did. Anything that references a TS symbol or a callback (a computed EP preset built
from another via `.withStat()`, an `onLoad` handler, talents that spread another preset's glyphs)
stays a TS literal instead.

`@i18n/*` resolves into `ui/i18n/*`, a top-level leaf (not owned by `app/`) — domain, ui-kit and
features reach it through that alias. `ui/i18n/**/*.{ts,tsx}` has its own `no-restricted-imports`
override banning `@app`/`@features`/`@ui-kit`/`@specs/**` (domain is allowed).

## Aliases

| Alias          | Resolves to      |
| -------------- | ---------------- |
| `@domain/*`    | `ui/domain/*`    |
| `@generated/*` | `ui/generated/*` |
| `@worker/*`    | `ui/worker/*`    |
| `@ui-kit/*`    | `ui/ui-kit/*`    |
| `@features/*`  | `ui/features/*`  |
| `@app/*`       | `ui/app/*`       |
| `@specs/*`     | `ui/specs/*`     |
| `@i18n/*`      | `ui/i18n/*`      |

Configured via `tsconfig.json` (`paths`) and `resolve.alias` in `vite.config.mts`
(`getBaseConfig`, inherited by worker builds) and `vite.harness.mts`. Node's `package.json`
`imports` field was tried first but rejected: `tsc` under `moduleResolution: "bundler"` does not
resolve `#foo/*` subpaths (it only works under `node16`/`nodenext`, and even then requires an
explicit extension on every specifier).

## How to author a spec

A spec is data. `ui/sims/<class>/<spec>/spec.ts` default-exports one `defineSpec({...})` call and is
the only code file the spec owns (besides `presets.ts` / `inputs.ts`):

```ts
import { defineSpec } from '@features/spec_config';

export default defineSpec<Spec.SpecArmsWarrior>({
    spec: Spec.SpecArmsWarrior,          // identity
    cssClass, cssScheme, epStats, displayStats, …,   // everything IndividualSimUIConfig declares
    defaults: { … },
    presets: { … },
    reforge: { getEPDefaults, updateSoftCaps },      // optional — wires ReforgeOptimizer
    enableHealing: false,                            // optional — overrides the tank/healer default
    derivedSettings: [{ subscribe, apply }],         // optional — settings derived from others
    features: [host => new Thing(host)],             // optional — spec-local escape hatch
});
```

`SpecDefinition` is `IndividualSimUIConfig` plus `spec` plus the optional `SpecBehaviors`
(`reforge`, `enableHealing`, `derivedSettings`, `features`) — the four things spec constructors
used to do by hand. `defineSpec` is an identity function; it exists only so the object is
checked without an annotation that would widen the literal spec type. Pass the spec as an
explicit type argument so `Player<Spec.SpecX>` callbacks keep their narrow type.

### Custom settings sections

A custom section is data, never DOM. A spec that needs an extra block on the settings tab
declares it as a `CustomSection` in `sections`, and `app/tabs/settings_tab.tsx`
(`buildCustomSection`) renders it through the same `ContentBlock` + picker path the standard
sections use:

```ts
sections: [{
    id: 'totems',                                    // ContentBlock css class when cssClass is unset
    title: 'Totems',
    tooltip: '…',                                    // optional — header tooltip button
    cssClass: 'totems-settings',                     // what the stylesheet hooks on
    iconGroupCssClass: 'totem-dropdowns-container',  // layout hook for the icon row
    iconInputs: [ … ],                               // same configs as `playerIconInputs`
    inputs: [ … ],                                   // same configs as `otherInputs.inputs`
    when: player => …,                               // optional — hides the section, like `showWhen`
}],
```

`iconInputs` land in a `picker-group icon-group` container above `inputs`, and every
`.input-root` in the body then gets `input-inline` — exactly what the Other Settings block does.
`when` is re-evaluated on `subscribePlayerChange`. The older `customSections` (an array of
functions returning a `ContentBlock`) is deprecated and now unused; do not add to it.

`reforge` may also be a function of the sim host, for options that need to call back into it.
The `getEPDefaults` / `updateSoftCaps` callbacks receive `(…, player, ctx)` where
`ctx = { player, reforger, defaults }` — that is how a spec reads `ctx.reforger.preCapEPs` or
`ctx.defaults` without a `this`.

### The entry flow

`ui/app/spec_entry.ts` is the single page entry for every spec, referenced from
`ui/index_template.html`. It derives the module key from `location.pathname`
(`/mop/<class>/<spec>/` → `../sims/<class>/<spec>/spec`), loads it from a lazy
`import.meta.glob('../sims/*/*/spec.{ts,tsx}')` — `.tsx` is only for the two specs whose reforge
tooltips need real JSX — so each spec ships its own chunk and only the visited one is fetched
— then:

```
registerSpecConfig(def.spec, def)  →  new Sim  →  new Player  →  (enableHealing)  →
sim.raid.setPlayer  →  new IndividualSimUI(document.body, player, def)
```

**Ordering constraint:** `registerSpecConfig` must run _before_ `new Player()`, which resolves
the spec's config out of the registry in its own constructor. This is the only place that
ordering matters, and `spec_entry.ts` is the only place it is expressed.

`IndividualSimUI` is concrete — a spec does not subclass it. Its constructor takes a
`SpecDefinition<S>`, and runs the behaviour slots (reforge → derivedSettings → features) as its
last statements, exactly where a subclass constructor body used to run. `derivedSettings` runs
`apply` once there (before defaults load, mirroring the old constructor timing) and then again
whenever `subscribe`'s source fires — including when the defaults land.

All 34 specs are converted: there is no `sim.ts`, no per-spec `index.ts` and no `IndividualSimUI`
subclass anywhere. Adding a spec is:

1. `ui/sims/<class>/<spec>/spec.ts` (or `.tsx`) default-exporting `defineSpec({...})`, plus its
   `presets.ts` / `inputs.ts`.
2. An entry in `ui/domain/player_specs/index.ts`, i.e. a `PlayerSpec` class (in
   `ui/domain/player_specs/<class>.ts`) with a `launch: { phase, status }` field — this is the
   single source of truth for launch status, read by the sim dropdown and the landing page
   (`ui/index.ts` renders the landing page's sim links from `PlayerSpecs`, no hand-written list).
3. An entry in the `$sim-themes` map in `ui/scss/sims/sim.scss` (cssClass, class color, background
   image), which the spec page links unconditionally.

The page itself is not one of the steps: there is no per-spec `index.html`, in the source tree or
anywhere else. `ui/index_template.html` is the _one_ spec page, and `tools/vite/spec_pages.mts`
(the `spec-pages` vite plugin) puts it at all 34 URLs — `configureServer` answers
`/mop/<class>/<spec>/` and `.../index.html` with it through `transformIndexHtml` in dev, and a
`post` `generateBundle` takes the page vite already processed, drops its own output path from the
bundle, and re-emits it as `<class>/<spec>/index.html` for every spec. Both halves discover the
spec list from `ui/sims/*/*/spec.ts(x)` (`discoverSpecPages`) — the same glob `PAGE_INDECES` used
before the makefile stopped generating pages — and `spec_entry.ts`'s `import.meta.glob` then picks
the spec module up from the URL. A new spec's page therefore appears with no build-config edit.

Copying one page 34× is only sound because the page is constant: `ui/index_template.html` carries
no `@@CLASS@@`/`@@SPEC@@` placeholders and every asset reference is root-absolute (`/scss/...`,
`/index.ts`, `/app/spec_entry.ts`, `/i18n/localization.tsx`), so vite rewrites them all to
`/mop/...` and nothing in the built page depends on where it is served from. It is also the reason
the 34 pages share one entry chunk (`bundle/spec_entry-<hash>.entry.js`, from the `spec_entry` key
in `rollupOptions.input`) instead of the 34 near-identical ones the old per-page inputs produced.
`ui/i18n/localization.tsx`'s `extractClassAndSpecFromDataAttributes`
derives class/spec from `location.pathname` the same way `specModuleKey` does above, falling back
to `data-class`/`data-spec` attributes only if present (the landing page has neither and keeps its
`data-i18n` behaviour).

Rules shared by several specs of the same class live in `ui/sims/<class>/shared/` (e.g.
`rogue/shared/derived.ts`, `monk/shared/derived.ts`, `death_knight/shared/{derived,inputs}.ts`).
A shared `DerivedSetting` is declared `DerivedSetting<any>` because `Player<S>` is invariant in
`S`, so a rule typed against a spec union is not assignable into any one spec's
`derivedSettings`; annotate the callback parameters to keep the bodies checked.

Every class now has fixed-name class-level shared files: `<class>/shared/{inputs,presets}.ts`
(plus `derived.ts` and, for monk, `settings.ts`/`derived.ts` where a class-level helper only had
one caller) hold what used to sit at `<class>/inputs.ts`, `<class>/shared.ts`, or
`<class>/presets.ts`. `presets.ts` holds encounter presets, EP-breakpoint tables, and a class's
`DefaultRaidBuffs` where all (or a class-consistent subset of) that class's specs share one
raid-buff default. Cross-spec constants used by more than one class (the melee hit/expertise and
spell-hit `statCaps` builders, the single-target and Malkorok encounter protos) live in
`ui/domain/presets/{stat_caps,encounters}.ts` instead — `domain/` can't import `@app`, so these
export raw protos/`Stats` for a class's `shared/presets.ts` to wrap with `PresetUtils`.

## How to move a file

Use the move tool — it does the `git mv` (or a plain rename for a gitignored generated file)
and then repairs every import specifier across `ui/` and `tools/`, emitting alias form where
the importer and the target end up in different top-level `ui/` directories and a relative
specifier otherwise:

```
node tools/restructure/move.mjs <moves-file> [--dry-run] [--verbose]
```

`<moves-file>` is a list of `from -> to` pairs, one per line (`#` comments allowed) or the JSON
equivalent; either side may be a file or a whole directory. Always `--dry-run` first.

Then run the gates: `npx tsc --noEmit -p .`, `npx oxlint -c .oxlintrc.json ui tools`
(`--fix` sorts the imports the rewrite disturbed), `npx vite build`,
`npx tsx vite.build-workers.mts`, `npm run test:snapshots`.
