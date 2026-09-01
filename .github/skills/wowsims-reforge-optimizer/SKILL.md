---
name: wowsims-reforge-optimizer
description: 'Use when working on the WoWSims MoP reforge optimizer, /reforgeOptimizeAsync endpoint, HiGHS solver integration, gem/socket/cap logic, softcap breakpoints, or Rune of Re-Origination relative stat caps.'
argument-hint: 'Describe the reforge optimizer bug, fixture, or behavior to work on.'
---

# WoWSims Reforge Optimizer Guide

## Scope
- Core optimizer behavior in sim/core/reforge_optimizer.
- Endpoint path /reforgeOptimizeAsync and worker integration.
- HiGHS-backed MIP solving for reforge + gem + socket-bonus choices.
- Relative stat cap logic (including Rune of Re-Origination behavior).

## Architecture
Files (all under sim/core/reforge_optimizer/):
- Main flow + optimizer state (EP internalization, stat rules, amp/bearform multipliers): optimizer.go.
- LP model build — decision variables, gem options, applyReforgeStat (objective coeffs) + resolveCapCoeffs (cap coeffs): model.go.
- Byte-exact deterministic CPLEX LP text serialization for HiGHS: lp.go (rows are <=/>= only; term/sign formatting goes through appendLPTerm — the byte layout is load-bearing for HiGHS tie-breaking).
- Solve + cap-refinement loop (solveModel, checkCaps): solver.go.
- Soft caps / gap-to-cap conversion + cap-detection helpers: caps.go.
- Stat/UnitStat math (resolveStatDelta, EP-internalization inputs): reforge_stats.go.
- Gear/gem/reforge sim wrappers, applyLPSolution, minimizeRegems, Amplification-trinket helpers: gear.go.
- Relative cap modeling (Rune of Re-Origination): relative_stat_cap.go.
- Spec/profession predicates: utils.go.
- HiGHS bridge:
  - Go non-browser (embedded, pooled wazero): highswasm.go. (Do NOT rename to highs_wasm.go — the `_wasm.go` suffix is an implicit GOARCH=wasm constraint that breaks the native build.)
  - Browser wasm: highs_js.go.
- Frontend caller: ui/core/components/suggest_reforges_action.tsx. The 14-day IndexedDB cache key contract lives in cacheRelevantPlayerProto / cacheRelevantReforgeRequest there — any new field that affects a solve must be reflected in those two functions, and any irrelevant field must be excluded, or caches go silently stale / get needlessly busted. Hashing is synchronous via hashString in ui/core/utils.ts.

## Key Backend Concepts (rewrite)
- Objective/cap coefficient split: the objective uses EP-calibrated applyReforgeStat (objByName); cap-constraint rows use full-SDM resolveStatDelta (byName), so Int->crit%, Agi->crit%/AP, the haste speed multiplier, etc. all count toward caps.
- EP internalization: incoming raw EP weights are divided by epDivisor (Amplification on Haste/Mastery/Spirit; Guardian Bear Form on crit) so applyReforgeStat's re-multiply cancels in the objective while caps still see the amplified contribution. Applied to pre-cap weights (internalizeEPOffsets) AND soft-cap post-cap EPs (internalizeSoftCapEPOffsets). Exception: a crit-target soft cap on a non-Guardian is not amp-internalized (crit isn't amp-scaled).
- Prefer-Hit-over-Expertise pruning for true casters (drops the dominated Expertise->spell-hit reforge).
- Relative-cap solve precision: settings.relative_stat_cap_mip_gap (FE "Precision") loosens the HiGHS MIP gap for RoRo specs; 0 = HiGHS default ("Precise").
- Deterministic LP text: modelToLPFormat is byte-exact and stable, so HiGHS tie-breaking among equal-objective solutions stays reproducible.

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
- Preserve raw Crit/Haste/Mastery deltas in the relative-cap model for feasibility checks.
- Validate relative-cap outcome with exact final stats and tighten rows if needed.
- The forced (highest) stat is constrained against the other two of Crit/Haste/Mastery — e.g. forced Mastery constrains Mastery vs Crit and Mastery vs Haste. Avoid adding unnecessary cross constraints unless fixture semantics require it.

## Gem and Meta Rules
- Meta gems are not normal swap targets.
- Meta socket state must be preserved/restored during regem minimization.
- Keep gem order stable in EquipmentSpec output.
- Preserve class-specific stat dependency semantics used by scoring.

## Bulk Sim Integration Contract
- Bulk Sim uses ReforgeOptimizeRequest mode for bulk operations.
- Bulk pre-pass may call optimizer twice per candidate when includeGems fallback is enabled.
- Cache keys should represent input identity; cached values are optimized output gear (plain `equipmentSpec:` proto JSON).
- Bulk runs derive their RNG seed from content including the cache-relevant reforge config — see the wowsims-bulk-sim skill for the staged/finalist pipeline.

## Performance Guardrails
- Keep solver model/build overhead low and allocation-aware.
- Keep selected-choice validation and hot helpers allocation-light.
- Avoid adding debug timers/alloc-heavy tracing outside debug mode.

## Validation Commands
```bash
go test -tags with_db -count=1 ./sim/core/reforge_optimizer
npm run type-check
```
Fixtures require the `with_db` tag. They live in sim/core/reforge_optimizer/test-fixtures/ and run for the REGISTERED coverage specs only (registerSpecFixtures — abstract names: soft-caps-multi, stat-conversions, hybrid-caster, relative-stat-cap, haste-thresholds, tank-caps). Non-coverage specs keep their fixture funcs but are deregistered (manual-only); re-register + `GENERATE_FIXTURES=1` to regenerate one. `UPDATE_FIXTURES=1` bakes the optimizer's own output instead of the master-gear reference.

For bulk integration changes:
```bash
go test -tags with_db -count=1 ./sim/core/reforge_optimizer ./sim/web
```

## Fast Search Aids
```bash
rg -n "ReforgeOptimizeRequest|relativeStatCap|softCap|breakpoint|HiGHS" proto sim ui
rg -n "reforgeOptimizeAsync|ReforgeOptimize" sim ui
```
