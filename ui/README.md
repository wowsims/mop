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
                     base_modal, content_block, toast, copy_button, tooltip_button, sticky_toolbar,
                     saved_data_manager, progress_tracker_modal, input_helpers, icon_inputs,
                     css_utils, dom_utils, action_id_dom, pickers/, vendor/. alias @ui-kit
  features/<name>/   EXISTS. one folder per capability, split model/ (DOM-free) + view/ (tsx-vanilla).
                     Today: gear/, reforge/, results/, stat-weights/, talents/. alias @features
  app/               shells + chrome that compose features; i18n/. Today: browser_env.ts only —
                     sim_ui/individual_sim_ui/preset_utils/launched_sims and the rest of
                     components/ are still under ui/core/ (PR 4–6). alias @app
  core/              LEGACY. what has not been placed yet: proto/ (generated), components/,
                     sim_ui.tsx, individual_sim_ui.tsx, preset_utils.tsx, launched_sims.tsx. alias @core
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
generated → worker → domain → ui-kit → features → app → specs → pages
```

Each layer may only import from layers to its left. `.oxlintrc.json` enforces this with
`no-restricted-imports` on the alias forms (see overrides for `ui/domain/**`, `ui/ui-kit/**`,
`ui/features/**`, `ui/app/**`), plus `no-restricted-globals` (window/document/localStorage/
location/navigator) on `ui/domain/**` and `ui/features/*/model/**`.

The `no-restricted-imports` groups use `**` (not `*`): oxlint matches these patterns one
path segment at a time, so `@features/*` would not catch `@features/gear/view/action_id_dom`.
`ui/domain/**` additionally bans `@core/components/**`, which is where the legacy UI still lives.

What is left under `ui/core/` keeps its old rules: `ui/core/{preset_utils,launched_sims}.tsx`
may not import `ui/core/components/**`, and `ui/core/components/**` may not import the store
writers (`patchSlice` / `patchKeyed` / `seedKeyed` / `deleteKeyed`) — go through a facade.

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
| `@core/*` | `ui/core/*` |

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
