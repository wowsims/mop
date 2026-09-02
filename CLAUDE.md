# CLAUDE.md

## Frontend (ui/)

Before touching `ui/`, load `.github/skills/wowsims-ui/SKILL.md`: it documents the layer rules
(`ui/domain/state` is UI-free and lint-enforced), the Zustand store + `Emitter` notification model,
the verification commands (`npm run type-check`, `npm run lint:js`, `npm run test:snapshots`,
`vite build`), and the dev-server traps (generated files, worker bundles, how to run real sims
locally). The raid sim UI was removed; only individual sims exist.
