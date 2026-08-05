---
name: wowsims-bulk-sim-handoff
description: 'Use when continuing, debugging, validating, or modifying WoWSims MoP Bulk Sim, local/server bulk sim, browser WASM concurrent bulk sim, BulkSimRequest/BulkSimResult protos, candidate generation, IndexedDB reforge caching, progress, abort behavior, or backend reforge integration for bulk candidates.'
argument-hint: 'Describe the Bulk Sim bug, candidate flow, reforge/cache behavior, or validation task to continue.'
---

# WoWSims Bulk Sim Handoff

## Scope
- Bulk candidate generation and staged simulation flow.
- Bulk reforge pre-pass integration and cache behavior.
- Progress, abort semantics, and local vs WASM orchestration.

## Architecture
- Shared messages: proto/api.proto (BulkSimRequest, BulkSimResult, ReforgeOptimizeRequest).
- Core staged runner: sim/core/bulk/bulk_sim.go.
- Local/server reforge pre-pass wrapper: sim/web/bulk.go.
- Web endpoint registration: sim/web/main.go (/bulkSimAsync uses sim/web.BulkSimAsync wrapper).
- Frontend orchestration and cache partitioning: ui/core/sim.ts.
- Bulk utilities and cache helpers: ui/core/components/individual_sim_ui/bulk/utils.ts.
- Generic cache storage: ui/core/reforge_cache.ts.
- Browser WASM Bulk Sim path: ui/core/wasm/bulk_sim.ts.

## Core Invariants
- Baseline gear source is base_request.raid.parties[0].players[0].equipment.
- Candidate identity is stable via BulkGearCandidate.index.
- With reforge_request enabled:
  - Cache hits go to optimized_candidates.
  - Work to optimize goes to candidates.
- Before staged sim:
  - Reforge pre-pass merges cache hits + newly optimized candidates.
  - request.ReforgeRequest is cleared.
- Dedup rules for sim input:
  - Exclude baseline-equivalent gear.
  - Exclude duplicate gear across optimized candidates.
- For cache writes:
  - Keep full optimized_candidates (including duplicates/baseline-equivalent results) so every input key can be written.

## Local/Server Reforge Flow
- Candidate generation runs unless request is fully cache-restored (candidates empty, optimized_candidates populated).
- Reforge optimization emits BulkSimStageReforge progress before low/medium/high stages.
- Reforge failures for an individual candidate fall back to original candidate gear instead of failing the entire request.
- Abort returns partial optimized candidates that already completed.

## Frontend/WASM Flow
- WASM reforge path is frontend-orchestrated and uses per-gear optimizer calls.
- IndexedDB cache values store optimized output gear, not just metadata.
- Cache key is input-identity hash; output is restored from cache value.

## Candidate Counting and Filtering
- rawCombinations is the raw mixed-radix index space.
- combinations is the filtered runnable count.
- Required set-bonus matching scans raw index space, then filters.
- Progress/reporting should reflect filtered candidate counts for user-visible totals.

## Performance Guardrails
- Avoid per-candidate allocations in hot loops.
- Prefer preallocated imperative loops in candidate/cache helpers.
- For backend reforge optimizer cache:
  - Use read-friendly locking for hit-heavy paths.
  - Reuse computed gear hash across includeGems fallback attempts.
- Throttle progress emission frequency to avoid contention.

## Logging Expectations
- Candidate generation stage should log started and completed with duration.
- Reforge stage should log a single started event (no duplicates) and completed summary.

## Validation Commands
```bash
make proto
npm run type-check
go test -count=1 ./sim/core/bulk ./sim/web
```

For reforge-integration changes:
```bash
go test -count=1 ./sim/core/reforge_optimizer ./sim/web
```

## Fast Search Aids
```bash
rg -n "BulkSimReforge|reforge_request|optimized_candidates|BulkSimStageReforge" proto sim ui
rg -n "bulkSimAsync|/bulkSimAsync" sim/web
```
