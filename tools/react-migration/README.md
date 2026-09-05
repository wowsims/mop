# React migration checks

The goldens (`npm run test:snapshots`) never construct the shell — `tools/state-snapshots/snapshot.ts`
imports `IndividualSimUIConfig` as a *type* and mirrors `applyDefaults` by hand. They prove no state
write leaked into a component; they say nothing about whether anything rendered. The checks below
are what the view layer is actually gated on.

They compare a build of the migration branch against a build of its parent, so both have to be built
and served first:

```bash
# in the parent worktree
node_modules/.bin/vite build && npx http-server dist -p 3401 --silent &
# in this worktree
node_modules/.bin/vite build && npx http-server dist -p 3402 --silent &

node tools/react-migration/parity.mjs
node tools/react-migration/panes-parity.mjs
node tools/react-migration/tabs-a11y.mjs
node tools/react-migration/tabs-behaviour.mjs
node tools/react-migration/landing.mjs
node tools/react-migration/sidebar-popover.mjs

# mount-once needs a dev server, not a build — see the table
node_modules/.bin/vite --port 3403 --strictPort &
REACT_PORT=3403 node tools/react-migration/mount-once.mjs
```

Each takes an optional comma-separated spec list (`node …/parity.mjs warrior/arms,mage/fire`) and
defaults to five specs from different classes. Ports come from `BASE_PORT` / `REACT_PORT`.

| Check | What it would catch |
|---|---|
| `parity.mjs` | any change to the rendered tree, at load — every SCSS selector depends on it. Two class diffs are expected and listed in the file |
| `panes-parity.mjs` | a tab body that renders differently once opened. `parity.mjs` only ever sees the tab open on load |
| `tabs-a11y.mjs` | the attributes and keyboard behaviour Bootstrap's tab plugin used to add on `window load`: roving `tabindex`, `role="tabpanel"`, arrow/Home/End navigation |
| `tabs-behaviour.mjs` | more than one open tab, a click opening the wrong pane, a pane that never fades in |
| `landing.mjs` | a regression on `/mop/` itself — the homepage has no sim, so every other check skips it, and it is the one page that still depends on localization's `[data-i18n]` DOM walk |
| `sidebar-popover.mjs` | everything about the sidebar that only exists after an interaction: the bonus-stat popover (where it mounts, whether the sidebar's `overflow-y: auto` clips it, whether each close path commits a half-typed value), that the table re-renders once the worker returns, and the two stat-value tooltips. Set `PORT` to pick a build — the entire output should be identical on both |
| `mount-once.mjs` | a shell constructed twice by StrictMode's double-invoked effects — **run it against a dev server**; every build embeds React's production bundle, where StrictMode is a no-op |

Two notes from building them:

- Use Playwright, not the Chrome extension. The extension reports false "renderer frozen" on this
  app (see `tools/browser-perf/README.md`).
- StrictMode only double-invokes under the dev server or vitest. `vite build --mode development`
  does not help — it still resolves React's production bundle.
- Under a static server the Go host's `/version` endpoint 404s and GitHub rate-limits the release
  check. Both happen identically on either side, so console errors matching `Failed to load resource`
  are filtered out.
