# ui/ layout

Target tree (in progress; `EXISTS` marks what is already in place):

```
ui/
  worker/            EXISTS. NOT MOVED (Go package, go:embed highs.wasm). alias @worker
  generated/         proto/*, *_auto_gen.ts — tool output only. alias @generated
                     (not yet: proto/ is still ui/core/proto, *_auto_gen.ts sit beside their consumers)
  domain/            EXISTS. DOM-free, node-runnable model: sim/player/raid/party/encounter facades,
                     state/, proto_utils/, player_classes/, player_specs/, talents data + trees,
                     bulk request builders, wasm/, constants, utils, worker_pool, reforge_cache,
                     wowhead, cache_handler. alias @domain
  ui-kit/            EXISTS. sim-agnostic widgets + base classes: component, input, sim_tab,
                     sim_host (SimUIHost/SimHeaderHost — the shell slice ui-kit is allowed to name),
                     base_modal, content_block, toast, copy_button, tooltip_button, sticky_toolbar,
                     saved_data_manager, progress_tracker_modal, input_helpers, icon_inputs,
                     css_utils, dom_utils, action_id_dom, pickers/, vendor/. alias @ui-kit
  features/<name>/   EXISTS. one folder per capability, split model/ (DOM-free) + view/ (tsx-vanilla).
                     Today: apl/ (model/ + view/), gear/ (gear_picker/* flattened in, plus
                     gem_summary/reforge_summary/upgrade_costs_summary/item_notice, PR 5a; plus
                     quick_swap/gear_change_icon, PR 5c), reforge/, results/ (plus
                     view/results_viewer, PR 5c), stat-weights/ (plus view/saved_ep_weights,
                     PR 5c), talents/, item-swap/ (view/, item_swap_picker, PR 5a),
                     character-stats/ (view/, character_stats, PR 5a), encounter/ (view/,
                     encounter_picker, PR 5a), settings/ (model/ buffs_debuffs/consumables/
                     stat_options, view/ cooldowns_picker + consumes_picker + other_inputs +
                     spec_change_warning_toast, PR 5a/5c), bulk/ (model/ core_sim, view/
                     bulk_tab + bulk_item_search/bulk_item_picker/bulk_item_picker_group/
                     bulk_sim_results_renderer flattened, PR 5b), import-export/ (view/
                     importer/exporter + importers/ + exporters/, PR 5b); plus two top-level
                     type files: sim_host.ts (SimHost/IndividualSimHost) and spec_config.ts
                     (IndividualSimUIConfig + registerSpecConfig, PR 6b). alias @features
  app/               EXISTS. shells + chrome that compose features. Today: browser_env.ts,
                     header/ (sim_header, sim_title_dropdown, social_links), settings_menu.tsx,
                     tabs/ (gear_tab, talents_tab, rotation_tab, settings_tab),
                     notice_native_sim.tsx, preset_configuration_picker.tsx (PR 6a),
                     sim_ui.tsx, individual_sim_ui.tsx, preset_utils.tsx, launched_sims.tsx
                     (PR 6b). alias @app
  i18n/              EXISTS. LEAF: framework-agnostic i18next config + localization tables
                     (config.ts, entity_mapping.ts, locale_service.ts, localization.tsx), at
                     the top level rather than under app/ (PR 6c). alias @i18n
  core/              LEGACY, proto only: ui/core/proto/ (generated). alias @core
  <class>/<spec>/    spec data, presets, generated index.html. alias @specs
  scss/              unchanged
  index.ts, index.html, index_template.html, shared/, types/, tracking/   root, unchanged
```

## Placement rules

- `domain/`: if it needs `window`/`document`, it doesn't belong here — inject an `Env` adapter instead.
- `ui-kit/`: reusable widgets with zero knowledge of sims (no `Player`/`Sim` types except through generic params).
- `features/<x>/model/`: DOM-free logic of one capability; `features/<x>/view/`: its tsx-vanilla rendering. Features never import another feature's `view/`.
- `app/`: composes features; the only place that knows the tab layout.
- `<class>/<spec>/`: data; the only code allowed is `features/` escape hatches and `shared/derived.ts` rules.

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
path segment at a time, so `@features/*` would not catch `@features/gear/view/action_id_dom`.
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
`app/individual_sim_ui.tsx` re-exports it for the 34 spec `sim.ts` files. The preset shapes
(`PresetGear`, `PresetEpWeights`, …) live in `domain/presets/types.ts`; `app/preset_utils.tsx`
holds the `make*` builders and re-exports the types.

`@i18n/*` resolves into `ui/i18n/*`, a top-level leaf (not owned by `app/`) — domain, ui-kit and
features reach it through that alias. `ui/i18n/**/*.{ts,tsx}` has its own `no-restricted-imports`
override banning `@app`/`@features`/`@ui-kit`/`@specs/**` (domain is allowed).

## Aliases

| Alias | Resolves to |
|---|---|
| `@domain/*` | `ui/domain/*` |
| `@generated/*` | `ui/generated/*` |
| `@worker/*` | `ui/worker/*` |
| `@ui-kit/*` | `ui/ui-kit/*` |
| `@features/*` | `ui/features/*` |
| `@app/*` | `ui/app/*` |
| `@specs/*` | `ui/specs/*` |
| `@i18n/*` | `ui/i18n/*` |
| `@core/*` | `ui/core/*` (proto only) |

Configured via `tsconfig.json` (`paths`) and `resolve.alias` in `vite.config.mts`
(`getBaseConfig`, inherited by worker builds) and `vite.harness.mts`. Node's `package.json`
`imports` field was tried first but rejected: `tsc` under `moduleResolution: "bundler"` does not
resolve `#foo/*` subpaths (it only works under `node16`/`nodenext`, and even then requires an
explicit extension on every specifier).

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
