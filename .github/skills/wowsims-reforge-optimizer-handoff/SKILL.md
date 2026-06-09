---
name: wowsims-reforge-optimizer-handoff
description: 'Use when continuing, debugging, validating, or modifying the WoWSims MoP reforge optimizer, /reforgeOptimizeAsync endpoint, HiGHS solver integration, gem/socket/cap logic, softcap breakpoints, or Rune of Re-Origination relative stat caps.'
argument-hint: 'Describe the reforge optimizer bug, fixture, or behavior to continue.'
---

# WoWSims Reforge Optimizer Handoff

## Scope
- Core optimizer behavior in sim/core/reforge_optimizer.
- Endpoint path /reforgeOptimizeAsync and worker integration.
- HiGHS-backed MIP solving for reforge + gem + socket-bonus choices.
- Relative stat cap logic (including Rune of Re-Origination behavior).

## Architecture
- Main flow: sim/core/reforge_optimizer/optimizer.go.
- MIP model and constraints: sim/core/reforge_optimizer/solver.go.
- Choice/cap/stat support: choices.go, caps.go, search.go, stats.go.
- Gear apply/minimize regems: gear.go.
- Gem/socket logic: gems.go.
- Relative cap modeling: relative_stat_cap.go.
- HiGHS bridge:
  - Go non-browser: highswasm.go.
  - Browser wasm: highs_js.go.
- Frontend caller: ui/core/components/suggest_reforges_action.tsx.

## Core Invariants
- Final correctness is based on exact stats from core.ComputeStats, not only MIP deltas.
- Optimizer must include reforge + gems + socket bonus decisions when enabled.
- Socket bonus feasibility must be modeled with explicit link constraints.
- On HiGHS failure, return error; do not silently downgrade to weaker fallback behavior.
- Debug-heavy logs stay behind ReforgeOptimizeRequest.debug.

## Cap and Breakpoint Rules
- Validate and normalize cap settings before solve.
- Enforce hard caps and breakpoint-derived rows directly in the MIP.
- For exact-stat post-check failures, tighten relevant existing cap rows and re-solve.
- Soft-cap scoring remains piecewise (pre-cap EP / post-cap EP).

## Relative Stat Cap Rules
- Use explicit linear constraints for forced-vs-constrained stat deltas.
- Preserve raw Crit/Haste/Mastery deltas in choices for feasibility checks.
- Validate relative-cap outcome with exact final stats and tighten rows if needed.
- Windwalker forced-Mastery should constrain Mastery vs Crit and Mastery vs Haste; avoid adding unnecessary cross constraints unless fixture semantics require it.

## Gem and Meta Rules
- Meta gems are not normal swap targets.
- Meta socket state must be preserved/restored during regem minimization.
- Keep gem order stable in EquipmentSpec output.
- Preserve class-specific stat dependency semantics used by scoring.

## Bulk Sim Integration Contract
- Bulk Sim uses ReforgeOptimizeRequest mode for bulk operations.
- Bulk pre-pass may call optimizer twice per candidate when includeGems fallback is enabled.
- Cache keys should represent input identity; cached values are optimized output gear.

## Performance Guardrails
- Keep solver model/build overhead low and allocation-aware.
- Keep selected-choice validation and hot helpers allocation-light.
- Avoid adding debug timers/alloc-heavy tracing outside debug mode.

## Validation Commands
```bash
go test -count=1 ./sim/core/reforge_optimizer
npm run type-check
```

For bulk integration changes:
```bash
go test -count=1 ./sim/core/reforge_optimizer ./sim/web
```

## Fast Search Aids
```bash
rg -n "ReforgeOptimizeRequest|relativeStatCap|softCap|breakpoint|HiGHS" proto sim ui
rg -n "reforgeOptimizeAsync|ReforgeOptimize" sim ui
```
