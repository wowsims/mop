# React migration checks

The goldens (`npm run test:snapshots`) never construct the shell — `tools/state-snapshots/snapshot.ts`
imports `IndividualSimUIConfig` as a _type_ and mirrors `applyDefaults` by hand. They prove no state
write leaked into a component; they say nothing about whether anything rendered. The checks below
are what the view layer is actually gated on.

They compare a build of the migration branch against a build of its parent, so both have to be built
and served first:

**Name the worktrees.** "the parent worktree" is `~/personal/wowsims-mop-restructure`
(`feature/ui-restructure`) — *not* `~/personal/wowsims-mop`, which is `master`. Serving master on
3401 does not fail loudly: the comparison still runs, and every spec fails on a line 0 that differs
by one class, which reads like a regression in this branch. It has happened once. Check with
`git -C <worktree> branch --show-current` before trusting a red run.

```bash
# in ~/personal/wowsims-mop-restructure (feature/ui-restructure)
node_modules/.bin/vite build && npx http-server dist -p 3401 --silent &
# in ~/personal/wowsims-mop-react (this worktree)
node_modules/.bin/vite build && npx http-server dist -p 3402 --silent &

node tools/react-migration/parity.mjs
node tools/react-migration/panes-parity.mjs
node tools/react-migration/tabs-a11y.mjs
node tools/react-migration/tabs-behaviour.mjs
node tools/react-migration/landing.mjs
node tools/react-migration/sidebar-popover.mjs
node tools/react-migration/talents.mjs
node tools/react-migration/header-toolbar.mjs
node tools/react-migration/settings-tab.mjs

# mount-once needs a dev server, not a build — see the table
node_modules/.bin/vite --port 3403 --strictPort &
REACT_PORT=3403 node tools/react-migration/mount-once.mjs
```

Each takes an optional comma-separated spec list (`node …/parity.mjs warrior/arms,mage/fire`) and
defaults to five specs from different classes. Ports come from `BASE_PORT` / `REACT_PORT`.

| Check                 | What it would catch                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parity.mjs`          | any change to the rendered tree, at load — every SCSS selector depends on it. The tab strip and `.sim-main` are pruned to a placeholder and each pane is compared on its own `#id` with its root class list normalised; everything else stays byte-strict                                                                                                                           |
| `panes-parity.mjs`    | a tab body that renders differently once opened, and a tab whose click opens nothing. `parity.mjs` only ever sees the tab open on load                                                                                                                                                                                                                                              |
| `tabs-a11y.mjs`       | one tablist, one selected tab, one Tab stop and the two agreeing; every pane mounted whether open or not; every tab's `aria-controls` resolving to a top-level tabpanel that points back at it. Plus arrow/Home/End, still compared against the baseline                                                                                                                            |
| `tabs-behaviour.mjs`  | more than one open pane, a click opening the wrong pane, a pane that never fades in                                                                                                                                                                                                                                                                                                 |
| `landing.mjs`         | a regression on `/mop/` itself — the homepage has no sim, so every other check skips it, and it is the one page that still depends on localization's `[data-i18n]` DOM walk                                                                                                                                                                                                         |
| `sidebar-popover.mjs` | everything about the sidebar that only exists after an interaction: the bonus-stat popover (where it mounts, whether the sidebar's `overflow-y: auto` clips it, whether each close path commits a half-typed value), that the table re-renders once the worker returns, and the two stat-value tooltips. Set `PORT` to pick a build — the entire output should be identical on both |
| `talents.mjs`         | the talents tab, which is almost entirely click behaviour — the DOM at load says nothing about whether spending a point works. Records the pane's structure, then spends, unspends and resets points, reading the talents string out of the autosaved settings. Set `PORT` to pick a build; the whole output should be identical on both                                            |
| `settings-tab.mjs`    | the settings tab's **behaviour**, where `panes-parity.mjs` covers only its shape at rest. Records every picker keyed on its `id` — or, for the icon inputs that have none, the wowhead action its anchor points at — with the label text, `for=`, `size=` and inline styles `SERIALIZE` excludes, then operates a boolean, a number, a select and an icon input and reads the effect out of the autosaved settings blob rather than the picker's own DOM. Asserts the `showWhen` pair (`#simui-profession1` → the Engineering consumables row) in both directions, and the `enableWhen` pair (`#tank-assignment` → the healing-model inputs). Set `PORT` to pick a build; the whole output should be identical on both |
| `header-toolbar.mjs`  | the header, the toolbar and the two dropdowns — the region the shell migration rewrites. The menus open on **hover**, not click (`bootstrap_overrides.ts` adds a capturing `mouseover`; Bootstrap's click data-API then toggles), and the sticky `.stuck` class is an IntersectionObserver measured off the header's own height at construction — none of it visible at load. Set `PORT` to pick a build; the whole output should be identical on both |
| `mount-once.mjs`      | a shell constructed twice by StrictMode's double-invoked effects — **run it against a dev server**; every build embeds React's production bundle, where StrictMode is a no-op                                                                                                                                                                                                       |

The four tab checks read the strip and the panes through `window.simTabsProbe`, installed by
`openSpec` in `browser.mjs`. Its readers are shape-agnostic on purpose: they answer for the parent
branch's Bootstrap strip, this branch's React-authored copy of it, and the Base UI strip that
replaces both, so the gates can be proved green before the markup swap rather than alongside it. Two
consequences worth knowing:

- The identifier is found as a class token on the `[role=tab]` element or an ancestor `<li>` that
  names an element inside `.sim-main`. Base UI's `Tabs.Tab` emits no `data-value`, so the swap has to
  keep spelling the id into `className`.
- The pane `aria-labelledby` back-pointer in `tabs-a11y.mjs` is feature-detected on the attribute
  being present. Nothing sets it before the swap, so that one assertion is dormant until then.
- `tabs-a11y.mjs`'s keyboard sequence is the last two-sided comparison against the parent branch. If
  the parent is ever rebased past the point where Bootstrap's plugin owned the top strip, the
  baseline disappears and that half has to become an absolute assertion too.

Two notes from building them:

- Use Playwright, not the Chrome extension. The extension reports false "renderer frozen" on this
  app (see `tools/browser-perf/README.md`).
- StrictMode only double-invokes under the dev server or vitest. `vite build --mode development`
  does not help — it still resolves React's production bundle.
- Under a static server the Go host's `/version` endpoint 404s and GitHub rate-limits the release
  check. Both happen identically on either side, so console errors matching `Failed to load resource`
  are filtered out.
