---
name: wowsims-bulk-sim-handoff
description: 'Use when continuing, debugging, validating, or modifying WoWSims MoP Bulk Sim, local/server bulk sim, browser WASM concurrent bulk sim, BulkSimRequest/BulkSimResult protos, candidate generation, IndexedDB reforge caching, progress, abort behavior, or backend reforge integration for bulk candidates.'
argument-hint: 'Describe the Bulk Sim bug, candidate flow, reforge/cache behavior, or validation task to continue.'
---

# WoWSims Bulk Sim Handoff

## When to Use
- Continue work on Bulk Sim candidate generation, staged/culling simulation, result ranking, progress, aborts, or reforge candidate caching.
- Debug local/server `/bulkSimAsync`, browser WASM concurrent Bulk Sim, or shared `BulkSimRequest` / `BulkSimResult` behavior.
- Modify the backend reforge pre-pass that reuses `ReforgeOptimizeRequest` for Bulk Sim candidates.

## Architecture
- `proto/api.proto`: shared Bulk Sim and reforge API messages. `BulkSimRequest.reforge_request` reuses `ReforgeOptimizeRequest`; do not add a duplicate bulk-specific reforge config.
- `sim/core/bulk_sim.go`: core staged runner. It owns validation, low/medium/high sim stages, culling, baseline handling, timings, and progress. Keep it independent of `sim/core/reforge_optimizer` to avoid an import cycle.
- `sim/web/bulk_reforge.go`: local/server Bulk Sim reforge pre-pass. It clones the shared reforge request, injects each candidate gear into a cloned raid, runs the Go optimizer, emits `BulkSimStageReforge`, dedupes optimized gear, clears `request.ReforgeRequest`, then delegates to `core.BulkSimAsync`.
- `sim/web/main.go`: `/bulkSimAsync` must call `sim/web.BulkSimAsync`, not `core.BulkSimAsync`, so the local backend reforge wrapper runs.
- `ui/core/sim.ts`: builds `BulkSimRequest`, merges candidate item/reforge/gem data into the player database, sets the baseline gear on the raid player, partitions reforge cache hits/misses, and dispatches local vs WASM paths.
- `ui/core/components/individual_sim_ui/bulk/utils.ts`: Bulk Sim feature utilities, including reforge cache partition/write helpers. Keep Bulk Sim cache helpers here, not in `sim.ts` or generic `reforge_cache.ts`.
- `ui/core/reforge_cache.ts`: generic IndexedDB storage only. It should not know Bulk Sim candidate semantics.
- `ui/core/components/suggest_reforges_action.tsx`: `ReforgeOptimizer.getReforgeGemOptions` owns gem-option selection shared by single reforge and Bulk Sim request creation.
- `ui/core/wasm/bulk_sim.ts`: browser concurrent Bulk Sim and sequential FE-orchestrated WASM reforge pre-pass.
- `ui/core/wasm/reforge_optimizer.ts`: reusable per-gear WASM optimizer request construction and `workerPool.reforgeOptimize` dispatch. Bulk Sim passes `ReforgeOptimizeModeBulk`.

## Candidate and Reforge Flow
- Baseline gear comes from `base_request.raid.parties[0].players[0].equipment`; generated candidates are carried by stable `BulkGearCandidate.index` values.
- With `reforge_request`, frontend IndexedDB cache hits go in `BulkSimRequest.optimized_candidates`; cache misses/raw work go in `BulkSimRequest.candidates`.
- Local/server mode runs the reforge pre-pass in `sim/web/bulk_reforge.go` using Go concurrency from `core.GetBulkSimStageConcurrency` for `BulkSimStageReforge`.
- Browser/WASM mode cannot share one Go runtime across workers, so it runs a sequential FE > WASM reforge > FE pass, then sends optimized candidates into the TypeScript concurrent Bulk Sim stages.
- After reforge optimization, merge cache hits and newly optimized candidates, dedupe against baseline and each other, clear `optimized_candidates` for the sim input, and clear `reforge_request` before staged simming.
- If a candidate's backend reforge fails, log it and use the original candidate gear instead of failing the entire Bulk Sim.
- If there are zero post-dedupe candidates, still run/preserve the baseline simulation path.

## Required Set Bonus Filtering
- `BulkRequiredSetBonus` stores the required `setId` and piece count. The Bulk UI derives display names from selected item data.
- Bulk set-bonus UI state in `bulk_tab.tsx` is keyed by numeric `setId`. The available set-bonus list keeps `setName` only for labels and sorting.
- Required set-bonus `BooleanPicker`s are rendered only when enough selected set pieces exist to satisfy that requirement: 2P requires at least 2 available pieces and 4P requires at least 4.
- Compatibility conflicts between otherwise-available requirements, including overlapping item slots or another set blocking 4P, should keep the picker visible but disabled with `enableWhen`.
- 2P compatibility must consider slot overlap, not just per-set piece count. Use the same raw-combo matcher path to verify the current requirements plus the candidate 2P/4P have at least one satisfiable combination before enabling a picker.
- Keep `rawCombinations` and `combinations` distinct. `rawCombinations` is the mixed-radix index space used by `getItemsForCombo(comboIdx)` and the matcher cache; `combinations` is the filtered runnable count after required set-bonus constraints.
- Candidate generation still scans raw combo indexes, skips nonmatching set-bonus combos with `RequiredSetBonusComboMatcher`, and reports build progress using the filtered candidate count (`this.combinations` / `candidateGearSets.length`), not the raw scan count.
- `requiredSetBonusCombinationCount.matches` is a `Uint8Array` indexed by raw combo index. Its signature must include raw combination count, required set IDs/pieces, and matcher dimensions so stale match caches are not reused.

## Cache Invariants
- `ReforgeGearCache` keys are hashes of input identity: API/cache version, optimizer/player/raid config, and input gear fingerprint. They are not reversible; never try to decode gear from the key.
- Cache values are the optimized output gear. On a cache hit, Bulk Sim needs this value to build `optimizedCandidates`; a timestamp-only value is insufficient.
- New direct `setSpec()` writes should store the compact Gear-only link hash produced by `IndividualLinkExporter.createLink(..., [SimSettingCategories.Gear])`, then store only `new URL(link).hash`.
- Keep `IndividualLinkImporter` parsing for compact link-hash values. Keep the temporary `equipmentSpec:` parser only as backward compatibility for cache rows written during the short-lived JSON-value format.
- Cache records only need `gear` and `lastAccessedAt`; `createdAt` is dead weight because pruning and recency use `lastAccessedAt`.
- `writeBulkSimReforgeCacheResults` should only write candidates whose index maps to a cache-miss key. Do not cache original unprocessed candidates.

## Abort and Progress Invariants
- Reforge progress uses `ProgressMetrics.bulk_stage = BulkSimStageReforge` with completed/total candidate counts before low/medium/high sim stages begin.
- Aborting during the reforge pre-pass must return a final aborted `BulkSimResult` whose `optimized_candidates` contains cache hits plus candidates whose reforge work actually completed before the abort.
- Local/server abort handling lives in `sim/web/bulk_reforge.go`; do not drop partial `request.OptimizedCandidates` when returning `ErrorOutcomeAborted`.
- WASM abort handling should also carry partial `optimizedCandidates` in the aborted result, even though successful misses are written to IndexedDB as each candidate completes.
- Frontend cache writes happen before checking `result.error`, so aborted results with partial optimized candidates can still preserve progress.

## Proto and API Notes
- `BulkSimRequest.optimized_candidates` sits directly after `candidates`; `BulkSimResult.optimized_candidates` sits directly after `top_results`.
- `ReforgeOptimizeRequest.mode` sits directly after `request_id`.
- `ReforgeGemOption` is the shared API gem-option message for backend optimizer requests. Do not use UI-only `UIGem` in `api.proto` or Go optimizer request paths.
- Preserve existing `ReforgeGemOption` field numbers when adding UIGem-parity metadata; frontend/server proto skew can surface as invalid wire-format parse errors.
- `ReforgeOptimizeRequest.debug` should stay false for normal Bulk Sim requests unless explicitly debugging optimizer internals.
- Worker/HTTP request name is `reforgeOptimizeAsync`; browser Go WASM export remains `reforgeOptimize` behind the worker bridge.

## Main Files
- `proto/api.proto`: Bulk Sim and shared reforge API messages.
- `sim/core/bulk_sim.go`: staged Bulk Sim runner.
- `sim/web/bulk_reforge.go`: local/server reforge pre-pass and abort partial-result handling.
- `sim/web/main.go`: async API handler registration.
- `ui/core/sim.ts`: frontend request creation, cache partitioning, dispatch, and cache writes.
- `ui/core/components/individual_sim_ui/bulk_tab.tsx`: candidate generation and UI metrics.
- `ui/core/components/individual_sim_ui/bulk/utils.ts`: Bulk Sim utilities and reforge cache helpers.
- `ui/core/reforge_cache.ts`: generic IndexedDB cache storage.
- `ui/core/wasm/bulk_sim.ts`: browser concurrent Bulk Sim plus WASM reforge pre-pass.
- `ui/core/wasm/reforge_optimizer.ts`: reusable per-gear WASM reforge helper.

## Cleanup Checks
Run focused stale-name searches after changing Bulk Sim or reforge proto wiring:

```bash
rg -n "BulkSimReforge|GetReforgeConfig|ReforgeConfig|reforge_config|postCapEp\b" proto sim ui
```

Check for reforge types imported from the old UI proto location:

```bash
rg -n "from ['\"][^'\"]*proto/ui(?:\.js)?['\"][^\n]*(ReforgeSettings|StatCapType|StatCapConfig|UIStat|ReforgeOptimizeRequest|ReforgeOptimizeResult)" ui
```

Check for direct core calls that bypass the local web wrapper:

```bash
rg -n "bulkSimAsync.*core\.BulkSimAsync|core\.BulkSimAsync\(msg|/bulkSimAsync" sim/web
```

Check touched Go helpers for unused parameters and dead branches. `get_errors` and `go vet` can miss gopls/staticcheck-style hints, so inspect changed signatures and call sites directly.

## Validation
Run the narrowest relevant check first, then broaden:

```bash
make proto
npm run type-check
go test -count=1 ./sim/core ./sim/web
```

For backend reforge integration, include the optimizer package:

```bash
go test -count=1 ./sim/core/reforge_optimizer ./sim/web
```

For browser WASM or worker-dispatch changes, also run:

```bash
make webworkers
```

## Bulk Sim Profiling Harness
- Keep full-request Bulk Sim profiling tests out of the repository unless explicitly asked to check one in.
- Recreate the temporary gated `sim/web` profile harness from prior notes when needed, run against `frost-mage-curl.txt`, collect results, then delete the harness before finishing.
- Use `results.md` as the benchmark report. Recent raw artifacts used `tmp/bulk_reforge_profile_cap4.*.pprof` and `tmp/bulk_reforge_profile_benchmark_result.json`.
- Normalize TypeScript `oneofKind` wrappers before `protojson.UnmarshalOptions{DiscardUnknown:true}` when replaying UI diagnostic JSON.

Full-request profile command shape:

```bash
WOWSIMS_BULK_PROFILE_BENCHMARK=1 \
WOWSIMS_BULK_PROFILE_BENCHMARK_OUTPUT=../../tmp/bulk_reforge_profile_benchmark_result.json \
WOWSIMS_BULK_PROFILE_CPU=../../tmp/bulk_reforge_profile_cap4.cpu.pprof \
WOWSIMS_BULK_PROFILE_ALLOCS=../../tmp/bulk_reforge_profile_cap4.allocs.pprof \
WOWSIMS_BULK_PROFILE_HEAP=../../tmp/bulk_reforge_profile_cap4.heap.pprof \
go test -run TestBulkSimReforgeProfileBenchmarkCapture -count=1 -timeout=90m ./sim/web
```

Summarize wall time, core sim time, inferred reforge pre-pass time, CPU, heap/sys, allocations, malloc count, RSS/VSZ, stage metrics, and top CPU/alloc/heap `pprof` entries.
