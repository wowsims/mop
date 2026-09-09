# Running the sim locally

**Source of truth:** `vite.config.mts`, `vite.build-workers.mts`, `tools/vite/spec_pages.mts`, and
the `devserver` / `rundevserver` / `devmode` / `host` targets in the makefile. Read the target before
copying a command out of here:

```
/usr/bin/grep -n "^devserver:\|^rundevserver:\|^devmode:\|^host:" -A6 makefile
```

## The normal path

`npm start` is `cross-env WATCH=1 make devmode`: it builds the Go dev server, starts
`vite serve --host` and `vite.build-workers.mts` alongside it, and reloads the Go binary through
`air`. Use it unless you need something the sections below describe.

## Two things a plain `vite` dev server cannot do

**It cannot run sims.** The worker's backend fetch fails on localhost. Sims need the Go host.

**It half-renders spec pages with ZERO console errors unless the worker bundles exist first.**
`ui/sim/workers/worker_pool.ts` resolves the worker at `/mop/sim_worker.js`, and the dev server has
middleware that serves `/mop/**` out of `dist/mop/`. With no bundle there the probe simply hangs:
`waitForInit()` never resolves → `loadSettings` never runs → defaults are never applied → the page
looks structurally fine and is empty of settings. Build them first:

```
npx tsx vite.build-workers.mts     # → dist/mop/{local,net,sim}_worker.js (+ highs.wasm)
```

A fresh worktree also needs the gitignored generated files before anything type-checks or builds —
see the last section of `verification.md`.

Copying per-spec `ui/**/index.html` from a built checkout is **not** a step and has not been for a
while: `tools/vite/spec_pages.mts` serves every spec URL itself from `ui/index_template.html`
through `transformIndexHtml`, and 301s the bare `/mop/<class>/<spec>` to the trailing-slash form the
way the production static host does. Only an _unknown_ spec URL falls through to vite's SPA
fallback, which serves the landing page — so "I got the landing page" means the URL is not in
`discoverSpecPages()`, i.e. there is no `ui/specs/<class>/<spec>/spec.ts(x)`.

## Running REAL sims

The Go host serves `dist/mop` from disk and answers the worker's sim requests natively — stats,
Simulate, reference swap and timeline tooltips all work.

```
make binary_dist/dist.go          # stub package so ./sim/web compiles — no built checkout needed
make wasm                         # dist/mop/lib.wasm.gz (needs Go)
npx tsx vite.build-workers.mts    # dist/mop/*_worker.js
npx vite build                    # dist/mop bundle + the 34 per-spec index.html
cp -r assets dist/mop/assets      # `make` does this; a plain `vite build` does not
make devserver                    # go build -o wowsimmop ./sim/web
./wowsimmop --usefs=true --launch=false --host=":3333"
```

Then `http://localhost:3333/mop/<class>/<spec>/`. `make rundevserver` runs the last two steps for
you, and `make dist/mop/.dirstamp` replaces the middle three (it also copies the assets).

Without `dist/mop/assets` the page half-renders with JSON parse errors from the DB fetch — that
error text is the signature of a missing asset copy, not of a broken database.

Do not `rm -rf dist`. `vite build` restores the bundles only; the database and assets come from
other tooling, and you will have broken the worktree. Copy `dist` to a scratch directory and serve
that on its own port if you need an isolated measurement.

## What to look at once it is up

A spec page that came up correctly has its settings pickers populated and its sidebar stats filled
in. An empty settings tab is the worker-probe hang above, not a rendering bug. Get the expected
shape by serving a known-good build of the parent branch on a second port and comparing the same
URL, rather than trusting a remembered element count — those numbers rot faster than anything else
in a document like this.

There is no committed browser or perf harness on this branch. `tools/browser-perf/` is listed in
`.git/info/exclude`, which is per-clone and never committed, so it exists only in the checkout whose
owner made it — not in a fresh clone, not in another worktree, not in CI. If you need
reference-swap or APL-edit timings, drive the page with Playwright yourself and record the protocol
in the PR; do not send someone to a path that will not be there.
