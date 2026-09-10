# Conventions, spec authoring, and decisions already made

**Source of truth:** `.oxfmtrc.json` for formatting, `ui/README.md` for authoring a spec,
`.oxlintrc.json` for anything that is actually enforced.

## Formatting

`oxfmt` is the formatter, not prettier — prettier is not a dependency of this repo. Its scope is
`ui/` only (`npm run fmt` is `npx oxfmt ui --check`), so `tools/`, the makefile and the markdown in
`.github/skills/` are formatted by hand.

```
node -e "console.log(require('./.oxfmtrc.json'))"
```

Today that is tabs, width 4, `printWidth` 160, single quotes, semicolons, trailing commas
everywhere, `arrowParens: "avoid"`. Import order is `simple-import-sort` through oxlint, so
`npm run lint:js:fix` sorts and `npm run fmt:fix` formats; run both on files you touched and on
nothing else.

`.oxfmtrc.json` deliberately ignores the preset JSON (`ui/**/apls/*.apl.json`,
`gear_sets/*.gear.json`, `builds/*.build.json`, `presets/**/*.json`, `ui/sim/talents/trees/*.json`).
Reformatting one of those is a diff nobody can review. Its ignore list also still names
`ui/worker/highs.js`, which no longer exists — the solver comes from the npm `highs` package now.

Stylesheets: a React component owns its SCSS in its own folder
(`ui/ui-kit/<Name>/{<Name>.tsx, <Name>.scss, index.ts}`); `ui/scss/` keeps everything not owned by one
component, including `ui/scss/sims/sim.scss`. `npm run lint:css` is stylelint over `ui/**/*.scss`.

## JSX dialect

React is the default (`tsconfig.json` is `jsx: react-jsx` / `jsxImportSource: react`, and both vite
configs use the automatic runtime), so a **new `.tsx` file is a React file**. A file that still
builds real DOM nodes opts out on line 1 with `/** @jsxImportSource @jsx-vanilla */`, routed to the
shim in `ui/shared/jsx-vanilla/`. Porting a file to React means deleting that pragma; the pragma
count only goes down. A `.tsx` file with no JSX in it should be `.ts`.

## Fixtures and generated files

- **Never** regenerate `tools/state-snapshots/golden.json`, a `.results` file or a `.test.json`
  reforge fixture to make a gate pass, and never commit one without asking. Diff first, then ask.
- **Never** hand-edit anything under `ui/generated/` or any `*_auto_gen.ts` — regenerate through the
  makefile.
- **Never** run `gen_db` concurrently with another copy of itself.

## Authoring a spec

`ui/README.md`'s "How to author a spec" is the full version and is current; this is the shape and
the traps.

A spec is **data**. `ui/specs/<class>/<spec>/spec.ts` default-exports one `defineSpec({...})` and is
the only code file the spec owns besides `presets.ts` / `inputs.ts`. There is no `sim.ts`, no
per-spec `index.ts`, and no `SimHostObject` subclass anywhere — `SimHostObject` is concrete and
takes a `SpecDefinition<S>`, running the behaviour slots (`features` → `reforge` →
`derivedSettings`) as its last constructor statements, exactly where a subclass body used to run.

Adding one is three edits and no page:

1. `ui/specs/<class>/<spec>/spec.ts` (or `.tsx` — only `mage/arcane` and `warlock/demonology` need
   real JSX, for their reforge tooltips).
2. A `PlayerSpec` class in `ui/sim/player/specs/<class>.ts` with its `launch: { phase, status }`,
   exported through `ui/sim/player/specs/index.ts`. That field is the single source of truth for
   launch status — the sim dropdown and the landing page both read it, and `ui/index.ts` renders the
   landing page's sim links from `PlayerSpecs` rather than a hand-written list.
3. An entry in the `$sim-themes` map in `ui/scss/sims/sim.scss` (className, class colour, background
   image), which every spec page links unconditionally.

`tools/vite/spec_pages.mts` globs `ui/specs/*/*/spec.ts(x)`, so the page at `/mop/<class>/<spec>/`
appears with no build-config edit and no html anywhere. Check the count with
`/usr/bin/find ui/specs -name 'spec.ts' -o -name 'spec.tsx' | wc -l`; the golden harness covers the
same set.

Two traps:

- **A shared `DerivedSetting` must be typed `DerivedSetting<any>`.** `Player<S>` is invariant in
  `S`, so `DerivedSetting<A | B>` is not assignable to `DerivedSetting<A>` and tsc rejects it via
  `autoRotationGenerator`. Annotate the callback's `player` parameter to keep the body checked
  against the union. The input helpers _are_ generic-friendly across a union; only `DerivedSetting`
  is not.
- **A custom settings section is data, never DOM.** Declare `sections: [CustomSection]` (typed in
  `ui/sim/spec_config.ts`) and `ui/features/settings/components/CustomSection/CustomSection.tsx`
  renders it, from `ui/app/tabs/SettingsTabBody.tsx`, through the same `ContentBlock` + picker path
  the standard sections use. The older `customSections` (an array of functions returning a
  `ContentBlock`) is deprecated and has no callers; do not add to it. `ui/README.md` still points at
  a `buildCustomSection` in `app/tabs/settings_tab.tsx`; that file is gone.

Rules shared by several specs of one class live in `ui/specs/<class>/shared/`
(`{inputs,presets,derived}.ts`). Constants used by more than one class — the melee-hit/expertise and
spell-hit `statCaps` builders, the single-target and Malkorok encounter protos — live in
`ui/sim/presets/{stat_caps,encounters}.ts` and export raw protos/`Stats` for a class's
`shared/presets.ts` to wrap, because `ui/sim` cannot import `@app`.

Proto-serialisable preset data lives as JSON, never a TS literal: gear, APLs, builds, EP weights and
talents under `ui/specs/<class>/<spec>/`. EP and talent JSON store enum fields **by name**
(`"StatCritRating"`, `"GlyphOfBullRush"`) so the file survives a proto regeneration. Anything that
references a TS symbol or a callback — a computed EP preset via `.withStat()`, an `onLoad` handler,
talents that spread another preset's glyphs — stays a TS literal.

## Localization

Every new user-facing string ships in both `assets/locales/en/` and `assets/locales/fr/`, and a new
key needs a matching property in `schemas/<name>.schema.json` (`additionalProperties: false`). See
`verification.md`. Match the French file's existing register; a key added to `en` alone is an
unfinished change.

## MoP quirks that look like bugs

- `PartyBuffs` is an **empty proto message** in MoP (`proto/common.proto`). Party-buff code paths
  are vestigial — the slice, the subscription and the picker all still exist and none of them do
  anything.
- The raid sim UI was removed entirely for complexity reasons. The `Raid` and `Party` model classes in `ui/sim`
  stay, because an individual sim is a one-party raid.

## Decisions already made — do not re-litigate without new evidence

| Decision                                                     | Why                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `import/no-cycle` is off                                     | 188 warnings across `ui/` when evaluated; cycles are caught by the harness |
| Aliases are `tsconfig` `paths`, not `package.json` `imports` | `tsc` under `moduleResolution: "bundler"` does not resolve `#foo/*`        |
| Only `ui/app` may `createRoot`                               | lint-banned in ui-kit and features; createRoot-per-leaf was rejected       |
| `customSections` stays deprecated rather than deleted        | one renderer, not two; new specs use `sections`                            |
| The move tool is gone                                        | the restructure landed; move by hand and re-sort imports (see `layers.md`) |
| `oxfmt`, not prettier                                        | prettier is not a dependency; do not add a second formatter for `ui/`      |
