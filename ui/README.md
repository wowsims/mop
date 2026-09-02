# ui/ layout

Target tree (in progress — most dirs below don't exist yet; this is where new code lands):

```
ui/
  worker/            NOT MOVED (Go package, go:embed highs.wasm). alias @worker
  generated/         proto/*, *_auto_gen.ts — tool output only. alias @generated
  domain/            DOM-free, node-runnable model: sim/player/raid/party/encounter facades,
                     state/, proto_utils/, player_classes/, talents data, bulk request builders,
                     wasm/, constants, presets/. alias @domain
  ui-kit/            sim-agnostic widgets + base classes. alias @ui-kit
  features/<name>/   one folder per capability, split model/ (DOM-free) + view/ (tsx-vanilla).
                     alias @features
  app/               shells + chrome that compose features; i18n/. alias @app
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

1. `git mv old/path.ts ui/<layer>/new/path.ts`
2. Rewrite its imports to alias form where they now cross a layer boundary, and update every
   importer that referenced the old relative path.
3. Run the gates: `npx tsc --noEmit -p .`, `npx oxlint -c .oxlintrc.json ui tools`,
   `npx vite build`, `npm run test:snapshots`.
