# Bulk Sim + Reforge Benchmark Analysis

Date: 2026-05-24

## Purpose

This report measures local Go `sim/web.BulkSimAsync` performance when Bulk Sim includes the backend reforge optimizer pre-pass. It uses `frost-mage-curl.txt` as the replay fixture and compares the original full-request benchmark with the later HiGHS runtime-cap sweep after the recent bulk reforge performance work.

The measured path includes:

- backend bulk reforge optimization in `sim/web/bulk_reforge.go`
- HiGHS/Wasmtime solving through `sim/core/reforge_optimizer`
- core Bulk Sim low/medium/high stages in `sim/core/bulk_sim.go`

## Method

The fixture is a UI diagnostic JSON capture. The benchmark harness normalized TypeScript `oneofKind` wrappers before Go `protojson` replay so the player spec and oneof fields were preserved.

Initial baseline command shape:

```bash
WOWSIMS_BULK_BENCHMARK=1 \
WOWSIMS_BULK_BENCHMARK_OUTPUT=../../tmp/bulk_reforge_benchmark_results.json \
go test -run TestBulkSimReforgeBenchmarkCapture -count=1 -timeout=90m ./sim/web
```

Follow-up cap-sweep command shape:

```bash
for cap in 2 4 8 18; do
  WOWSIMS_HIGHS_WASM_RUNTIME_CONCURRENCY=$cap \
  WOWSIMS_BULK_CONCURRENCY_BENCHMARK=1 \
  WOWSIMS_BULK_CONCURRENCY_BENCHMARK_OUTPUT=../../tmp/bulk_reforge_concurrency_cap_${cap}.json \
  go test -run TestBulkSimReforgeConcurrencyBenchmarkCapture -count=1 -timeout=90m ./sim/web
done
```

The follow-up env override was temporary measurement scaffolding only. Production code uses `runtime.NumCPU()/4` for the HiGHS runtime slot cap.

Full-request profile replay command shape:

```bash
WOWSIMS_BULK_PROFILE_BENCHMARK=1 \
WOWSIMS_BULK_PROFILE_BENCHMARK_OUTPUT=../../tmp/bulk_reforge_profile_benchmark_result.json \
WOWSIMS_BULK_PROFILE_CPU=../../tmp/bulk_reforge_profile_cap4.cpu.pprof \
WOWSIMS_BULK_PROFILE_ALLOCS=../../tmp/bulk_reforge_profile_cap4.allocs.pprof \
WOWSIMS_BULK_PROFILE_HEAP=../../tmp/bulk_reforge_profile_cap4.heap.pprof \
go test -run TestBulkSimReforgeProfileBenchmarkCapture -count=1 -timeout=90m ./sim/web
```

The profile replay used the production cap-4 default and collected CPU, allocation, and heap profiles. The temporary harness was removed after collecting the artifacts.

## Executive Summary

The current best measured configuration remains the default HiGHS runtime cap of `runtime.NumCPU()/4`. On the 18-logical-CPU benchmark machine this lands at cap 4, which produced the best clean full-request wall time: 237.51s. The profiled cap-4 replay completed in 239.15s, close enough to confirm that the previous cap-4 result is stable.

Compared with the original full-request measurement, the tuned cap-4 run improved wall time from 260.59s to 237.51s and reduced the inferred reforge pre-pass from 141.47s to 119.11s. The remaining bottleneck is split roughly evenly between reforge optimization and the core Bulk Sim stages.

Peak resident memory remains the largest operational risk. The clean follow-up runs all peaked around 8.50-8.70 GiB RSS while Go heap stayed below 640 MiB. The profiled run peaked higher at 9.15 GiB RSS, likely due to profiling overhead, but it reinforced the same conclusion: RSS is far above Go heap accounting and is not solved by simple concurrency changes.

The full-request profiles change the optimization priority. Cumulative Go allocation is dominated by core sim setup/execution, especially Mage pet/spell setup and spell-result paths, not by the bulk reforge wrapper itself. The end-of-run heap profile still shows a reforge-specific live heap issue: `solveMIPWithHiGHS` retained 168.61 MiB cumulative live heap, including 63.04 MiB from converting the LP model to bytes and 95.57 MiB attributed to solution output through `highsWriteSolutionPretty`.

The reforge-only profile isolated optimizer behavior from the full Bulk Sim run. Easy Arcane reforging completed in 0.72s after the callback-memory improvement. Hard Windwalker RoRo completed in 14.36s after the improvement, down from 18.14s before the change. The remaining hard-case wall time is still dominated by HiGHS/Wasmtime solve time, while cumulative Go allocation is dominated by repeated `ComputeStats` environment construction for per-choice stat deltas.

## Primary Results

| Scenario | Candidates Parsed | HiGHS Runtime Cap | Wall Time | Core Bulk Sim Time | Implied Reforge Pre-Pass | Total CPU | Avg Cores Used | Peak RSS | Peak Go Heap | Output Results |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Initial 32-candidate slice | 32 | pre-cap-sweep code | 42.77s | 38.14s | 4.63s | 616.88s | 14.42 | n/a | 116.54 MiB | 5 |
| Initial full request | 864 captured / 863 low-stage input | pre-cap-sweep code | 260.59s | 119.12s | 141.47s | 2270.34s | 8.71 | ~7.8-8.0 GiB sampled | 637.22 MiB | 5 |
| Tuned full request | 863 | 2 | 250.68s | 119.56s | 131.13s | 2237.27s | 8.92 | 8.67 GiB | 623.56 MiB | 5 |
| Tuned full request | 863 | 4 | 237.51s | 118.39s | 119.11s | 2240.84s | 9.43 | 8.66 GiB | 542.30 MiB | 5 |
| Profiled full request | 863 | 4 | 239.15s | 120.74s | 118.41s | 2266.01s | 9.48 | 9.15 GiB | 624.99 MiB | 5 |
| Tuned full request | 863 | 8 | 238.37s | 120.80s | 117.57s | 2300.23s | 9.65 | 8.50 GiB | 601.73 MiB | 5 |
| Tuned full request | 863 | 18 | 241.46s | 124.43s | 117.03s | 2365.04s | 9.79 | 8.70 GiB | 639.78 MiB | 5 |

Notes:

- The initial full request contained 864 captured candidates; after normalization/dedupe the core low stage received 863 gear sets. The follow-up harness parsed 863 `BulkGearCandidate`s from the same full capture.
- The initial RSS value came from live process snapshots. The follow-up RSS values came from in-harness `/proc/self/statm` sampling, so memory comparisons should be treated as directional rather than exact apples-to-apples deltas.
- The profiled run should be treated as diagnostic rather than the clean best-time result because CPU and heap profiling add overhead and retained profile state.
- `Core Bulk Sim Time` is `BulkSimResult.timings.total_seconds`. The reforge pre-pass runs in the web wrapper before core timings start, so `Implied Reforge Pre-Pass = wall - core total`.

## Cap Sweep Analysis

| HiGHS Runtime Cap | Wall Time | Reforge Pre-Pass | Delta vs Cap 4 Wall | Peak RSS | CPU vs 18 Logical CPUs |
|---:|---:|---:|---:|---:|---:|
| 2 | 250.68s | 131.13s | +13.18s | 8.67 GiB | 49.6% |
| 4 | 237.51s | 119.11s | baseline | 8.66 GiB | 52.4% |
| 8 | 238.37s | 117.57s | +0.87s | 8.50 GiB | 53.6% |
| 18 | 241.46s | 117.03s | +3.96s | 8.70 GiB | 54.4% |

Findings:

- Cap 4 was the fastest measured end-to-end setting.
- Caps 8 and 18 slightly reduced inferred reforge time, but did not improve full-run wall time enough to justify the extra CPU/system overhead.
- Cap 2 reduced solver parallelism too much and added about 13s wall time compared with cap 4.
- Peak RSS stayed in a narrow 8.50-8.70 GiB range for every cap. This falsifies the expectation that a lower HiGHS runtime cap alone would substantially lower resident memory.
- Live sampling during the high-cap runs showed RSS ramping quickly while CPU was often near 3 cores during the reforge phase. That suggests the reforge path is not simply slot-starved on HiGHS concurrency.

## CPU Analysis

The initial 32-candidate slice used more CPU per wall-clock second than the full request because its workload stayed more uniformly parallel. The full request spends substantial time in phases that do not saturate all logical CPUs.

| Scenario | Total CPU | Avg Cores Used | CPU vs 18 Logical CPUs |
|---|---:|---:|---:|
| Initial 32-candidate slice | 616.88s | 14.42 | 80.1% |
| Initial full request | 2270.34s | 8.71 | 48.4% |
| Tuned full request, cap 4 | 2240.84s | 9.43 | 52.4% |
| Profiled full request, cap 4 | 2266.01s | 9.48 | 52.6% |
| Tuned full request, cap 18 | 2365.04s | 9.79 | 54.4% |

Interpretation:

- The tuned cap-4 run improves wall time without materially increasing total CPU versus the initial full run.
- Raising the cap to 18 increases total CPU but does not improve wall time. That is a poor trade.
- The core high stage is still expensive and naturally less parallel at the candidate level: the full request ended with 13 high-stage survivors at 50000 iterations.
- The cap-4 CPU profile shows core sim dominates the profiled request. `Simulation.Step` accounted for 1782.34s cumulative CPU, 82.23% of sampled CPU. APL readiness/rotation work and aura/proc callbacks are the top visible Go-side CPU areas. The reforge/HiGHS path primarily appears as `runtime.cgocall` during wasm execution, with 80.34s cumulative CPU in the focused view.

## Memory Analysis

Go runtime memory remained modest compared with process RSS.

| Scenario | Peak Go Heap | Peak Go Sys | Peak RSS / Sampled RSS | Total Allocated | Mallocs | GC Cycles |
|---|---:|---:|---:|---:|---:|---:|
| Initial 32-candidate slice | 116.54 MiB | 278.18 MiB | n/a | 39.54 GiB | 771,897,059 | 1319 |
| Initial full request | 637.22 MiB | 755.16 MiB | ~7.8-8.0 GiB sampled | 322.76 GiB | 3,726,766,402 | 2405 |
| Tuned full request, cap 4 | 542.30 MiB | 762.79 MiB | 8.66 GiB | 322.76 GiB | 3,726,781,557 | 2635 |
| Profiled full request, cap 4 | 624.99 MiB | 785.54 MiB | 9.15 GiB | 322.80 GiB | 3,727,031,300 | 2563 |
| Tuned full request, cap 18 | 639.78 MiB | 823.85 MiB | 8.70 GiB | 322.86 GiB | 3,727,675,797 | 2601 |

Interpretation:

- The main memory issue is outside Go heap accounting. In the full request, RSS is roughly an order of magnitude larger than Go `Sys`.
- The very large VSZ values observed during runs are likely Wasmtime linear-memory reservation behavior. VSZ is not itself the immediate limit, but the 8.5 GiB RSS plateau is real resident pressure.
- The initial full run allocated about 323 GiB cumulatively and performed 3.7B mallocs. Even when peak Go heap is moderate, this allocation churn can contribute meaningful GC and system CPU overhead.

Full-request profile observations:

- Allocation bytes were dominated by core sim construction/execution: `Mage.NewMirrorImage` allocated 61.34 GiB, `SpellResultCache.Get` 38.28 GiB, `Unit.RegisterSpell.(*Spell).makeCastFunc.func6` 35.09 GiB, `NewCharacter` 20.55 GiB, `mage.NewMage` 20.42 GiB, and `core.NewAgent` 20.32 GiB.
- Allocation object count showed the same pattern: `SpellResultCache.Get` accounted for 642.15M objects, `RegisterTravelTimeCallback` 518.25M, spell cast closure setup 336.44M, and Arcane Missiles registration 313.47M.
- The end-of-run heap profile was smaller than peak heap but highlighted reforge-specific retained memory. `solveMIPWithHiGHS` accounted for 168.61 MiB cumulative live heap, mostly the LP model byte slice at [sim/core/reforge_optimizer/highswasm.go](sim/core/reforge_optimizer/highswasm.go#L77) and solution output built during `highsWriteSolutionPretty` at [sim/core/reforge_optimizer/highswasm.go](sim/core/reforge_optimizer/highswasm.go#L135).

## Recommendation 3 And 4 Exploration

Recommendation 3 was partially implemented before the cap sweep:

- `sim/core/reforge_optimizer/highswasm.go` compiles the embedded `highs.wasm` module once through `highsWasmModuleOnce` and reuses the `wasmtime.Engine` / `wasmtime.Module`.
- The HiGHS solve path is bounded by `highsWasmRuntimePool`, with production concurrency set to `runtime.NumCPU()/4`.
- Each solve calls the wasm `Highs_destroy` export for the created HiGHS instance.
- Each solve still creates a fresh `wasmtime.Store` and `wasmtime.Instance` via `newHiGHSWasmRuntime`. The bridge also allocates wasm strings through `malloc` and does not currently wire an exported `free`/reset path for those allocations.

That means native solver lifetime has been improved enough to avoid unbounded concurrent runtime creation, but it has not been solved. The remaining memory question is whether per-solve store/instance creation, wasm linear-memory growth, or HiGHS-side allocations are retaining/reserving resident memory longer than expected.

Recommendation 4 has now been executed for the full cap-4 replay:

- `sim/web/main.go` imports `net/http/pprof` and has interactive `profile` and `heap_profile` console commands.
- `sim/core/reforge_optimizer/optimizer_benchmark_test.go` has allocation-reporting microbenchmarks for gem option iteration and MIP model construction.
- The temporary full-request harness captured CPU, `alloc_space`, `alloc_objects`, and heap profiles for the complete Bulk Sim + reforge replay.

The profile result suggests two different optimization tracks. For total wall time and allocation churn, core sim setup/execution is now the larger Go-side target. For reforge-specific memory, the HiGHS bridge still deserves attention because LP serialization and pretty-solution output remain live at the end of the profiled run.

## Reforge-Only Profile Results

The reforge-only harness was temporarily recreated from `/memories/repo/reforge-profile-harness.md`, updated to register sim agents for standalone `ComputeStats`, and run against JSON captures because the older `.bin` captures no longer unmarshal cleanly under the current proto schema.

Command shape used for symbolized profiles:

```bash
go test -c -o tmp/reforge_optimizer_profile.test ./sim/core/reforge_optimizer
WOWSIMS_REFORGE_PROFILE=1 \
WOWSIMS_REFORGE_PROFILE_OUTPUT_DIR=tmp/reforge_profiles_symbolized \
WOWSIMS_REFORGE_PROFILE_OUTPUT=tmp/reforge_profiles_symbolized/reforge_profile_results.json \
WOWSIMS_REFORGE_PROFILE_REQUESTS=easy=/tmp/reforge-arcane-request.json,hard=/tmp/reforge-ww-request.json \
./tmp/reforge_optimizer_profile.test -test.run TestReforgeOptimizerProfile -test.timeout 10m -test.v
```

| Fixture | Relative Cap | Choice Groups | Choices | Wall Before | Solve Before | Wall After | Solve After | Total Alloc After | Mallocs After | Peak RSS After |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Easy Arcane | no | 43 | 274 | 0.95s | 0.78s | 0.72s | 0.59s | 228.14 MiB | 1.08M | 391.95 MiB |
| Hard Windwalker RoRo | yes | 49 | 435 | 18.14s | 17.18s | 14.36s | 13.61s | 1.59 GiB | 16.63M | 456.93 MiB |

The implemented callback-memory improvement changed `highsWasmRuntime.callerMemoryBytes` to use the cached wasm memory export instead of calling `Caller.GetExport("t")` on every WASI callback. In the hard RoRo CPU profile, callback overhead dropped materially:

- `Caller.GetExport` disappeared from the hot path as a standalone 1.60s cumulative cost.
- `clockTimeGet` dropped from 2.05s cumulative to 0.33s cumulative.
- `importFunc` callback handling dropped from 2.21s cumulative to 0.60s cumulative.
- hard-case solve wall time dropped from 17.18s to 13.61s in the comparable symbolized runs.

Remaining bottlenecks:

- The hard RoRo case is still solver-bound. After the improvement, `solveMIPWithHiGHS` accounted for 13.40s cumulative CPU path time and almost all wall time. Most of that is native Wasmtime/HiGHS execution visible through `runtime.cgocall`.
- `ComputeStats` is the dominant cumulative Go allocation source during choice-delta construction: 1.71 GiB before the improvement and about 1.63 GiB after. The largest allocation sites are `NewTargetDummy`, APL value/action discovery, spell finalization, pet setup, and unit metrics.
- Wasmtime callback value construction remains visible. `mkVal`, `ValI32`, `goTrampolineNew`, and `SetFinalizer` still show up in CPU/allocation profiles, though less severely after removing repeated memory export lookup.
- Live Go heap is modest for single reforge profiles, so the reforge-only harness does not reproduce the full-request 8.5+ GiB RSS plateau. That larger memory issue likely depends on many concurrent/per-request Wasmtime runtimes and full Bulk Sim core activity.

Next optimizer-specific improvements to consider:

1. Reduce WASI callback volume or callback allocation in the HiGHS bridge.

   The hard solve still calls into Go frequently from wasm. After caching memory, the next visible callback costs are value construction/finalizers and clock callbacks. Investigate whether the HiGHS wasm module can run with less frequent clock polling, or whether the wasmtime-go callback return path can reuse lower-allocation values safely.

2. Avoid full `ComputeStats` for every simple choice delta.

   `computeChoiceDeltas` currently calls `ComputeStats` for each non-trivial reforge/gem choice. This keeps cap deltas exact, but it creates full sim environments hundreds of times for a single optimize request. A conservative fast path could compute raw stat/rating deltas directly for choices that only affect ordinary ratings and fall back to `ComputeStats` for class/stat-dependency-sensitive choices.

3. Keep the final exact `ComputeStats` validation.

   Even if choice-delta construction gets a fast path, final optimized stats and cap validation should still use `core.ComputeStats`; that is the correctness guard for mastery buffs, stat dependencies, caps, and relative-cap refinement.

4. Keep using JSON request captures for current profiling.

   The historical `.bin` fixtures failed before JSON fallback with parse errors. Use `/tmp/reforge-arcane-request.json` and `/tmp/reforge-ww-request.json` or regenerate fresh binary fixtures from the current proto before future profile runs.

## Stage Analysis

Initial 32-candidate slice:

| Stage | Input Gear Sets | Survivors | Iterations | Concurrency | Duration | Target Error | Observed Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| Medium | 32 | 5 | 1122 | 18 | 4.93s | 0.20% | 0.2003% |
| High | 5 | 5 | 50000 | 1 | 33.21s | 0.05% | 0.0237% |

Initial full request:

| Stage | Input Gear Sets | Survivors | Iterations | Concurrency | Duration | Target Error | Observed Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| Low | 863 | 200 | 112 | 36 | 9.98s | 1.00% | 0.9692% |
| Medium | 200 | 13 | 1772 | 18 | 39.84s | 0.20% | 0.1997% |
| High | 13 | 13 | 50000 | 1 | 69.30s | 0.05% | 0.0251% |

Tuned cap-sweep runs were stable in shape: low stage received 863 gear sets, medium received 200, high received 13, and the final output count stayed at 5 for every cap.

## Risks

1. Peak RSS is still high. A single full local Bulk Sim with reforges can sit around 8.5 GiB RSS, which is risky on 16 GiB machines when the browser, IDE, and dev server are also running.
2. Reforge optimization remains a major part of wall time. In the best tuned run, the implied reforge pre-pass was 119.11s of 237.51s.
3. Native Wasmtime/HiGHS memory behavior dominates peak resident memory. The code already reuses the compiled wasm module and caps concurrent runtimes, but still creates a fresh store/instance per solve.
4. Allocation churn is still a CPU contributor. The full-request profile captured about 322.80 GiB of cumulative allocation and 3.73B mallocs, mostly in core sim setup/execution.
5. High-stage sim time remains material after culling. Any future optimizer change that increases high-stage survivors will directly increase total wall time.

## Recommendations

1. Keep the current HiGHS runtime cap at `runtime.NumCPU()/4`.

   On the benchmark machine this maps to cap 4, the fastest measured point. Raising the cap to 8 or 18 does not improve wall time and does not reduce RSS.

2. Do not prioritize further simple concurrency increases for bulk reforge.

   The cap sweep and profiled replay show the current bottleneck is not solved by more HiGHS slots. Higher caps mostly increase CPU/system overhead while resident memory remains high. Recommendation 2 is therefore complete for now: keep concurrency unchanged and spend the next optimization pass on allocation/lifetime work.

3. Continue native solver lifetime work, but do not count the current runtime cap as a complete fix.

   Already implemented: the wasm module is compiled once, solves are bounded by `runtime.NumCPU()/4`, each solve calls `Highs_destroy`, and hot WASI callbacks reuse the cached memory export instead of repeatedly calling `Caller.GetExport("t")`. Still open: every solve creates a fresh Wasmtime store/instance, the wasm bridge allocates strings through `malloc` without a wired per-allocation `free`, and callback return-value construction/finalizers remain visible in hard relative-cap profiles. The next useful work is to determine whether HiGHS exposes a safe free/reset path, or whether a bounded long-lived solver-worker model can reuse stores/instances without leaking model state.

4. Reduce Go allocation churn in core sim setup/execution before adding more bulk reforge parallelism.

   The full-request allocation profile shows the biggest Go allocation wins are not in candidate scheduling. The next promising areas are Mage pet/spell construction, spell-result cache object churn, travel-time callback registration, and repeated agent/spec setup across low/medium/high-stage sims.

5. Treat pre-reforge dedupe as low priority for this fixture.

   The full request only dropped from 864 captured candidates to 863 low-stage inputs, so input dedupe is unlikely to be a large win for this case. It may still be worthwhile if other real user captures contain many duplicate candidate gears.

6. Keep monitoring high-stage survivor count and duration.

   The full request high stage processed 13 survivors at 50000 iterations. That is expected for accuracy, but it is a major downstream cost and should be watched when changing culling or reforge result ordering.

7. Use the memory-held reforge-only profiling harness for optimizer-specific passes.

   The harness is intentionally kept out of the repository and stored in workspace memory at `/memories/repo/reforge-profile-harness.md` for temporary recreation when needed. The full-request profile is good for end-to-end prioritization, but core sim allocation dominates the cumulative profile. The reforge-only harness runs `ReforgeOptimizeRequest` fixtures directly, captures phase timings plus CPU/allocs/heap profiles, and is better suited for comparing easy reforges against hard cases such as RoRo Windwalker.

   Command shape:

   ```bash
   go test -c -o tmp/reforge_optimizer_profile.test ./sim/core/reforge_optimizer
   WOWSIMS_REFORGE_PROFILE=1 \
   WOWSIMS_REFORGE_PROFILE_OUTPUT_DIR=tmp/reforge_profiles \
   WOWSIMS_REFORGE_PROFILE_REQUESTS=easy=/tmp/reforge-arcane-request.json,hard=/tmp/reforge-ww-request.json \
   ./tmp/reforge_optimizer_profile.test -test.run TestReforgeOptimizerProfile -test.timeout 10m -test.v
   ```

   For clean per-case `pprof` output, run one subtest at a time:

   ```bash
   WOWSIMS_REFORGE_PROFILE=1 \
   WOWSIMS_REFORGE_PROFILE_OUTPUT_DIR=tmp/reforge_profiles \
   WOWSIMS_REFORGE_PROFILE_REQUESTS=hard=/tmp/reforge-ww-request.json \
   ./tmp/reforge_optimizer_profile.test -test.run 'TestReforgeOptimizerProfile/hard$' -test.timeout 10m -test.v
   ```

## Implemented Improvements Reflected In The Follow-Up

- Bounded HiGHS/Wasmtime runtime slots with `runtime.NumCPU()/4` default cap.
- Single compiled HiGHS wasm module reused across solves.
- Per-solve `Highs_destroy` call for the created HiGHS instance.
- Cached HiGHS wasm memory export reused inside hot WASI callbacks, reducing hard RoRo reforge profile wall time from 18.14s to 14.36s.
- Bulk reforge batching with batch size `max(16, 2 * concurrency)`.
- Bulk optimizer request/raid template reuse and optimized-gear caching by gear/include-gems key.
- Existing webserver profiling commands: `profile` for CPU and `heap_profile` for heap snapshots.
- Existing optimizer microbenchmarks with `ReportAllocs` for selected hot paths.
- Full-request cap-4 CPU, allocation, and heap profiles captured under `tmp/bulk_reforge_profile_cap4.*.pprof`.
- Memory-held reforge-only profiling harness for easy/hard `ReforgeOptimizeRequest` fixtures, writing metrics and pprof files under `tmp/reforge_profiles` by default when temporarily recreated.

These changes improved the best full-request wall time from 260.59s to 237.51s. They did not solve peak RSS, so the next meaningful work should target native solver memory lifetime and allocation churn rather than more parallelism.
