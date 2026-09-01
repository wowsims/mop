---
name: wowsims-bulk-sim
description: 'Use when working on WoWSims MoP Bulk Sim: local/server bulk sim, browser WASM concurrent bulk sim, BulkSimRequest/BulkSimResult protos, candidate generation, staged simulation, the finalist tie-breaker stage, deterministic seeds, IndexedDB reforge caching, tie-group result display, progress, or abort behavior.'
argument-hint: 'Describe the Bulk Sim bug, candidate flow, staging/finalist behavior, cache behavior, or validation task.'
---

# WoWSims Bulk Sim Guide

## Scope
- Bulk candidate generation and staged simulation flow (low/medium/high + finalist).
- Bulk reforge pre-pass integration and cache behavior.
- Deterministic content-derived seeding and statistical result display.
- Progress, abort semantics, and local vs WASM orchestration.

## Architecture
- Shared messages: proto/api.proto (BulkSimRequest, BulkSimResult, BulkGearResult, ReforgeOptimizeRequest). BulkSimStage order: Reforge, Low, Medium, High, Finalist, Complete (Complete last).
- Core staged runner: sim/core/bulk/bulk_sim.go; per-stage logic + finalist stage: sim/core/bulk/stage.go; paired statistics: sim/core/bulk/statistics.go.
- Local/server reforge pre-pass wrapper: sim/web/bulk.go.
- Web endpoint registration: sim/web/main.go (/bulkSimAsync; per-handler errorProgress; isFinalProgress).
- Frontend orchestration, content seed, cache partitioning: ui/core/sim.ts (runBulkSim).
- Bulk utilities and cache helpers: ui/core/components/individual_sim_ui/bulk/utils.ts.
- Results display (tie groups, ±CI, change icons): ui/core/components/individual_sim_ui/bulk_tab.tsx + bulk/bulk_sim_results_renderer.tsx + ui/core/components/gear_change_icon.tsx.
- Generic cache storage: ui/core/reforge_cache.ts (sync hashString from ui/core/utils.ts; values are plain `equipmentSpec:`-prefixed proto JSON; age-index-ranged prune).
- Browser WASM Bulk Sim path: ui/core/wasm/bulk_sim/ (index, stage, batch, merge, statistics, progress, carry_over, estimate, types) — a deliberate line-for-line mirror of sim/core/bulk.
- Generated constants (never hand-edit; `go run ./tools/database/gen_db -gen=go-to-ts`): ui/core/components/individual_sim_ui/bulk/constants_auto_gen.ts (slot maps) and ui/core/wasm/bulk_sim/constants_auto_gen.ts (tuning constants + stage ladder), emitted by tools/database/gen_bulksim_constants.ts.go from the exported consts in sim/core/bulk.

## Determinism and Statistics
- Content-derived seed: runBulkSim hashes baseline gear + BulkSettings + cache-relevant reforge config into simOptions.randomSeed (utils hashString; per-part digests combined). Same setup → bit-identical results; any change → fresh sample. An explicit fixed RNG seed takes precedence; lastUsedRngSeed is updated to the seed actually used.
- Candidates share seed sequences (candidate N runs seed+N per stage; adaptive/finalist reruns offset by iterations already run). Comparisons between candidates therefore use PAIRED errors (bulkSimPairedDpsError over AllValues), far tighter than per-result stdev.
- Finalist stage (runBulkSimFinalistStage / runConcurrentBulkSimFinalistStage): after the high stage, the top `topResults` candidates + baseline get lockstep extra iterations until every adjacent pair separates under a paired z-test at Z95 (bulkSimZ95 / Z_95 — no cull conservatism factor), or the budget (BulkSimFinalistMaxExtraIterationMultiplier × high-stage iterations) is spent. Its returned results ARE the refined, DPS-sorted display set.
- Shipped per top result: paired_error_to_next_result and paired_error_to_baseline (computed before AllValues are stripped; 0 = could not pair).
- FE display: adjacent results still inside the paired tie threshold render in one labeled tie group (bulk_tab tie chains; unpaired zTest fallback when paired data is absent); each row shows a ±95% CI (stDevToConf95 — deliberately the unpaired per-row error, a different quantity from the pairwise grouping test).
- The single significance threshold lives in ui/core/utils.ts (Z_95, zTest) and sim/core/bulk/statistics.go (bulkSimZ95); keep them equal.

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
- Spec lookup goes through core.PlayerProtoToSpecSafe; eligible-slot logic through core.EligibleSlotsForItem / core.ItemTypeToSlotsMap (single source, shared with item swap). Non-weapon slot iteration uses bulkSimNonWeaponOrder; entry-point validation via newGeneratorFromRequest.

## Local/Server Reforge Flow
- Candidate generation runs unless request is fully cache-restored (candidates empty, optimized_candidates populated).
- Reforge optimization emits BulkSimStageReforge progress before low/medium/high stages.
- Reforge failures for an individual candidate fall back to original candidate gear instead of failing the entire request.
- Abort returns partial optimized candidates that already completed.

## Frontend/WASM Flow
- WASM reforge path is frontend-orchestrated and uses per-gear optimizer calls.
- IndexedDB cache values store optimized output gear; cache key is input-identity hash (sync, from utils hashString).
- Incremental cache writes are batched (setGearMany); the final write only covers keys not already written incrementally.
- Results tab: rows build into a DocumentFragment and attach once; changed items render the shared gear-change icon (gem/reforge deltas + a Wowhead cover link stacked behind the overlay markers) instead of a border; a slot-change renders the item plainly. Starting a new run returns to the Setup tab.

## Candidate Counting and Filtering
- rawCombinations is the raw mixed-radix index space.
- combinations is the filtered runnable count.
- Required set-bonus matching scans raw index space, then filters; FE feasibility checks are memoized per settings/items generation.
- Progress/reporting should reflect filtered candidate counts for user-visible totals.

## Performance Guardrails
- Avoid per-candidate allocations in hot loops.
- Prefer preallocated imperative loops in candidate/cache helpers.
- For backend reforge optimizer cache:
  - Use read-friendly locking for hit-heavy paths.
  - Reuse computed gear hash across includeGems fallback attempts.
- Progress emission is throttled (BulkSimProgressThrottle Go-side, 100ms mirror in wasm progress emitter).
- When stripping AllValues for proto output, detach the slice before cloning (see bulkSimCandidateResultToProto) — never clone megabytes just to discard them.

## Logging Expectations
- Candidate generation stage should log started and completed with duration.
- Reforge stage should log a single started event (no duplicates) and completed summary.
- Every stage (finalist included) reports metrics through the shared stage-metrics builder, so observed error and concurrency are always populated.

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

Reproducibility check: run the same BulkSimRequest twice through BulkSimAsync with the same seed — results must be bit-identical (the whole pipeline is deterministic given a seed).

## Fast Search Aids
```bash
rg -n "BulkSimReforge|reforge_request|optimized_candidates|BulkSimStageReforge|Finalist" proto sim ui
rg -n "bulkSimAsync|/bulkSimAsync" sim/web
rg -n "pairedErrorToNextResult|bulkSimPairedDpsError|Z_95|bulkSimZ95" sim ui
```
