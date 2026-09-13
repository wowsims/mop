# Layers: where code goes and what may import what

**Source of truth:** `.oxlintrc.json` (the bans) and `tsconfig.json` `paths` (the aliases). Both are
machine-enforced on every `npm run lint:js` / `npm run type-check`, so they cannot drift from the
build the way prose can. Dump the current bans rather than trusting this file:

```
node -e "const c=require('./.oxlintrc.json'); c.overrides.forEach(o => { const r = o.rules?.['no-restricted-imports'] ?? o.rules?.['no-restricted-globals']; if (r) console.log(JSON.stringify(o.files), JSON.stringify(r)); })"
```

`ui/README.md` has the orientation prose — the target tree, placement rules, how to author a spec.
Read it for shape, but prefer `.oxlintrc.json` for rules: the README is enforced by nothing and is
currently wrong in two places (it names `@features/spec_config`, which is `@sim/spec_config` now,
and `tools/restructure/move.mjs`, which no longer exists).

## The bans, as configured

| Scope                       | May not import                                                                 | Notes                                                |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `ui/sim/**`                 | `@ui-kit` `@features` `@app` `@specs`                                          | **`allowTypeImports: true`** — see below             |
| `ui/i18n/**/*.{ts,tsx}`     | `@app` `@features` `@ui-kit` `@specs/**`                                       | `@sim` is allowed; no type-import escape hatch       |
| `ui/ui-kit/**`              | `@features` `@app` `@specs`, plus `react-dom/client`                           | only the shell may create a React root               |
| `ui/features/**`            | `@app` `@specs`, plus `react-dom/client`                                       |                                                      |
| `ui/features/*/model/**`    | `@app` `@specs`, plus `react` and `react-dom`                                  | a model layer is framework-free, not merely DOM-free |
| `ui/features/**/*.{ts,tsx}` | `patchSlice` `patchKeyed` `seedKeyed` `deleteKeyed` from `**/state/sim_store*` | write through a facade instead                       |
| `ui/app/**`                 | `@specs`                                                                       | specs import app, never the reverse                  |

Global bans (`no-restricted-globals`, error): `window` `document` `localStorage` `location`
`navigator` in `ui/sim/**` and in `ui/features/*/model/**`. Anything that needs one takes an
injected `Env` (`ui/sim/state/env.ts`; `sim.env` at runtime, `ui/app/browser_env.ts` in the browser,
`tools/state-snapshots/memory_env.ts` in the harness).

**Naming a DOM type is not the same as being a view.** `ui/sim/proto/action_id/dom.ts` sits in the
sim layer on purpose: every function there takes an `HTMLElement` it is _handed_ and enriches it
with an icon, an href or a Wowhead dataset. It never creates an element and it touches no browser
global, so it satisfies the rule and belongs beside the `ActionId` value object it serves. Do not
"tidy" it into `features/` — the test for this layer is browser globals and element _creation_, not
whether `HTMLElement` appears in a signature.

## Three ways these rules surprise people

**`import type` helps in `ui/sim/**` and nowhere else.** That block, and only that block, sets
`allowTypeImports: true`, so `ui/sim` may name an `@app`/`@features`/`@ui-kit` type as long as the
import is erased. No other block sets it, and `no-restricted-imports` bans the _specifier_ rather
than the binding, so `import type { SimHostObject } from '@app/individual_sim_ui'` inside
`ui/ui-kit` is still a violation even though nothing survives to runtime. Confirm which blocks have
it before you rely on it:

```
node -e "console.log(require('./.oxlintrc.json').overrides.filter(o => o.rules?.['no-restricted-imports']).map(o => [o.files, JSON.stringify(o.rules['no-restricted-imports']).includes('allowTypeImports')]))"
```

**Patterns must use `**`, not `*`.** oxlint matches one path segment per `*`, so `@features/*`
silently misses `@features/gear/components/SelectorModal/ItemList` and the ban looks like it is
working when it is not.

**Scoping is an explicit file list.** Negated globs in `overrides.files` break scoping in oxlint, so
a new top-level `ui/` directory needs its own override block — you cannot exclude it with `!`. And
`categories` is `{"correctness": "off"}`: a rule that is not listed explicitly does not run at all.
That is why `react-hooks/rules-of-hooks` appears in the root `rules` block by name; deleting the
line silently disables it.

## Aliases

| Alias            | Resolves to               |
| ---------------- | ------------------------- |
| `@sim/*`         | `ui/sim/*`                |
| `@generated/*`   | `ui/generated/*`          |
| `@worker/*`      | `ui/worker/*`             |
| `@ui-kit/*`      | `ui/ui-kit/*`             |
| `@features/*`    | `ui/features/*`           |
| `@app/*`         | `ui/app/*`                |
| `@specs/*`       | `ui/specs/*`              |
| `@i18n/*`        | `ui/i18n/*`               |

Check with `node -e "console.log(require('./tsconfig.json').compilerOptions.paths)"`. The same table
is `resolve.alias` in `vite.config.mts` (`getBaseConfig`, inherited by the worker builds) and in
`vite.harness.mts`. All three must agree; a mismatch shows up as a type-check that passes and a
build that cannot resolve.

Node's `package.json` `imports` field was tried first and rejected: `tsc` under
`moduleResolution: "bundler"` does not resolve `#foo/*` subpaths.

## Crossing layers without importing downward

A lower layer that needs to talk to a shell uses a **narrow host interface**, never the class. They
all live in `@sim/sim_host` (`ui/sim/sim_host.ts`) — today `SimWarning`, `SimHost`,
`IndividualSimHost<Spec>`, and the `isIndividualSimHost()` predicate that replaces
`instanceof SimHostObject` (a runtime check an interface cannot express).
`SimHostObject implements IndividualSimHost` (`ui/app/individual_sim_ui.tsx:73`) — the `implements`
clause is what keeps the interfaces honest, so add to the interface and let the compiler find the
host. From React the host arrives through context rather than a prop: `useSimHost()`, `usePlayer()`,
`useSim()` in `ui/sim/context/SimHostContext.tsx`, which is why `ui/sim` owns React context despite
being the bottom layer.

The per-spec config schema is `@sim/spec_config` (`ui/sim/spec_config.ts`): `IndividualSimUIConfig`,
`InputConfig`, `InputSection`, `CustomSection`, `OtherDefaults`, `Settings`, `SpecDefinition`,
`SpecBehaviors`, `DerivedSetting`, `defineSpec`, `registerSpecConfig`, `itemSwapEnabledSpecs`. It
used to sit in `@features/` because it names ui-kit picker configs; check where it is before
importing, with `/usr/bin/grep -rn "from '@sim/spec_config'" ui/ | wc -l`.

## The module-evaluation-order trap

`ui/sim/player/specs/<class>.ts` calls `getSpecSitePath()` (from `@sim/constants/other`) at **module
scope**, to build each `PlayerSpec`'s `simLink`. If one of those files ever imports a _value_ from a
non-leaf module, the resulting cycle lets a bundler evaluate `ui/sim/player/specs/index.ts` before the
class modules it aggregates, `specToPlayerSpec` gets built from `undefined`s, and every
`PlayerSpecs.fromProto` silently returns `undefined` — which surfaces as a crash inside
`new Player`, far from the cause.

Rule: `player/specs/*` and `player/classes/*` import leaf modules only. Check it after a harness
build (`npm run test:snapshots` leaves the bundle behind):

```
/usr/bin/grep -nE '^//#region ' tmp/harness/snapshot.js
```

Every `player/specs/<class>.ts` region must be emitted before `ui/sim/player/specs/index.ts`.

`import/no-cycle` is deliberately **not** enabled: it reported 188 warnings across `ui/` when it was
evaluated, so cycles are caught by the check above and by review, not by lint.

## Moving a file

There is no move tool any more (`tools/restructure/move.mjs` was deleted once the restructure
landed; `ui/README.md` still documents it). Move by hand with `git mv`, then repair specifiers:
emit alias form when the importer and the target end up in different top-level `ui/` directories and
a relative specifier otherwise, and run `npx oxlint ./ui --fix` to re-sort the imports the rewrite
disturbs. Then the gates in `verification.md` — a move is exactly the change that passes
`type-check` and fails `test:snapshots`.
