# Bulk Sim + Reforge Benchmark Analysis

Date: 2026-05-24, updated 2026-05-25

## Purpose

This report measures local Go `sim/web.BulkSimAsync` performance when Bulk Sim includes the backend reforge optimizer pre-pass. It uses `frost-mage-curl.txt` as the replay fixture and compares the original full-request benchmark with the later HiGHS runtime-cap sweeps after the recent bulk reforge and wazero pooling work.

The measured path includes:

- backend bulk reforge optimization in `sim/web/bulk_reforge.go`
- HiGHS/wazero solving through `sim/core/reforge_optimizer`
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

The follow-up env override is also available as a runtime tuning escape hatch. Production code now defaults the native HiGHS runtime slot cap to about two-thirds of logical CPUs, based on the post-pooling sweep below.

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

### Native Solver Bridge Microbenchmark

After migrating the native HiGHS bridge from wasmtime to wazero, the same warmed tiny-MIP benchmark was run against both implementations on the same Linux machine. The wasmtime comparison used a detached temporary worktree at `HEAD`, where the old bridge still existed, plus the same benchmark body and the old `-tags highs` build tag. Both benchmarks perform one warm-up solve and then call `b.ResetTimer()` so module compilation is excluded.

Fixed `-benchtime=100x -count=3` samples:

| Runtime | ns/op range | Approx ms/op | B/op | allocs/op |
|---|---:|---:|---:|---:|
| wazero, fresh instance per solve | 1,975,215 - 2,560,918 | 1.98 - 2.56 ms | ~21,818,064 | 5,602 |
| wasmtime, fresh store/instance per solve | 2,904,047 - 3,351,316 | 2.90 - 3.35 ms | ~32,000 | 1,041 |
| wazero, pooled instance after bridge optimization | 485,962 - 561,326 | 0.49 - 0.56 ms | ~16,248 | 622 |

Initial interpretation: wazero was faster for this tiny steady-state solve, but the first bridge implementation allocated far more Go memory per solve. Reusing bounded wazero instances, buffering WASI stdout/stderr as bytes, and removing bridge argument boxing made the wazero bridge both faster and lower-allocation than the old wasmtime bridge for this microbenchmark.

## 2026-05-25 Rerun After Wazero Pooling

I reran the full captured Bulk Sim + backend reforge replay after the wazero bridge optimization. The harness was temporarily recreated, run with `-tags with_db`, and updated to recursively normalize all TypeScript `oneofKind` wrappers before Go `protojson` replay. This matters: an earlier partial normalizer only lifted `spec` and `unitStat`, which discarded most captured APL oneofs and produced an invalid 77.74s result. The numbers below use the corrected `fulloneof` replay.

Command shape:

```bash
WOWSIMS_BULK_PROFILE_BENCHMARK=1 \
WOWSIMS_BULK_PROFILE_BENCHMARK_OUTPUT=../../tmp/bulk_reforge_profile_benchmark_result_20260525_fulloneof.json \
WOWSIMS_BULK_PROFILE_CPU=../../tmp/bulk_reforge_profile_20260525_fulloneof.cpu.pprof \
WOWSIMS_BULK_PROFILE_ALLOCS=../../tmp/bulk_reforge_profile_20260525_fulloneof.allocs.pprof \
WOWSIMS_BULK_PROFILE_HEAP=../../tmp/bulk_reforge_profile_20260525_fulloneof.heap.pprof \
go test -tags with_db -run TestBulkSimReforgeProfileBenchmarkCapture -count=1 -timeout=90m ./sim/web
```

### Latest Full-Request Result

| Scenario | Candidates Parsed | HiGHS Runtime Cap | Wall Time | Core Bulk Sim Time | Implied Reforge Pre-Pass | Total CPU | Avg Cores Used | Peak RSS | Peak Go Heap | Output Results |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Previous profiled full request | 863 | 4 | 239.15s | 120.74s | 118.41s | 2266.01s | 9.48 | 9.15 GiB | 624.99 MiB | 5 |
| Latest profiled full request, corrected oneofs | 864 captured / 863 low-stage input | 4 | 197.61s | 142.49s | 55.12s | 2790.57s | 14.12 | 867.87 MiB | 648.75 MiB | 5 |

### Post-Pooling Runtime Cap Sweep

After the pooled wazero bridge landed, I reran a clean unprofiled cap sweep with the same full captured request and `-tags with_db`. This sweep is more relevant for production defaults than the older pre-pooling cap sweep because the previous memory/runtime plateau is gone.

| HiGHS Runtime Cap | Wall Time | Core Bulk Sim Time | Reforge Pre-Pass | Total CPU | Avg Cores Used | Peak RSS | Peak Go Heap |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 180.23s | 131.33s | 48.89s | 2537.31s | 14.08 | 905.50 MiB | 639.96 MiB |
| 6 | 175.87s | 127.56s | 48.31s | 2545.85s | 14.48 | 1.01 GiB | 781.39 MiB |
| 8 | 171.11s | 126.93s | 44.18s | 2501.79s | 14.62 | 1.19 GiB | 946.49 MiB |
| 12 | 165.47s | 125.28s | 40.19s | 2480.38s | 14.99 | 1.32 GiB | 1.17 GiB |
| 18 | 194.36s | 138.76s | 55.60s | 2781.71s | 14.31 | 1.60 GiB | 1.48 GiB |

Cap 12 is the best measured point for this fixture. It improves wall time by 14.76s versus cap 4 and by 32.14s versus the profiled cap-4 corrected run, while staying far below the old 8-9 GiB RSS failure mode. Cap 18 regresses sharply, increasing both wall time and memory, so using all logical CPUs for HiGHS runtimes is a poor default.

Stage metrics:

| Stage | Input Gear Sets | Survivors | Iterations | Concurrency | Duration | Target Error | Observed Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| Low | 863 | 200 | 112 | 36 | 12.30s | 1.00% | 0.9692% |
| Medium | 200 | 13 | 1772 | 18 | 45.51s | 0.20% | 0.1997% |
| High | 13 | 13 | 50000 | 1 | 84.68s | 0.05% | 0.0251% |

Memory and allocation metrics:

| Metric | Latest Result |
|---|---:|
| Peak Go heap alloc | 648.75 MiB |
| Peak Go heap sys | 918.59 MiB |
| Peak Go sys | 947.68 MiB |
| Peak RSS | 867.87 MiB |
| Peak VSZ | 3.78 GiB |
| Total allocated | 323.11 GiB |
| Mallocs | 3.72B |
| GC cycles | 1373 |
| Max goroutines | 189 |

The biggest outcome is that the reforge pre-pass dropped from about 118s to 55s while preserving the same 863 low-stage input shape and 13 high-stage survivors. End-to-end wall time improved by about 41.5s versus the prior profiled cap-4 replay, despite core sim time increasing to 142.5s. The increase in total CPU and average core usage shows the new run is doing much more useful parallel work instead of sitting in the old solver/runtime plateau.

The peak RSS result is the other major change. The latest harness sampled a maximum of 867.87 MiB RSS, down from the earlier profiled 9.15 GiB RSS. Live `ps` samples during the run stayed around 520-560 MiB RSS while the benchmark was in the long core-sim stretch. That strongly suggests the pooled wazero runtime work removed the earlier multi-GiB resident-memory failure mode for this fixture.

### Latest CPU Profile Observations

The corrected CPU profile is now dominated by normal sim execution rather than the native HiGHS bridge:

- `core.RunSim` / `Simulation.run` accounted for about 82.5% cumulative CPU.
- `Simulation.Step` accounted for about 79.4% cumulative CPU.
- APL execution is the largest visible gameplay-level CPU area: `APLRotation.DoNextAction` 31.0%, `APLRotation.getNextAction` 25.2%, `APLAction.IsReady` 24.2%, `APLValueAnd.GetBool` 15.4%, and `APLValueCompare.GetBool` 12.8% cumulative.
- Spell and proc flow is the next large area: `Spell.Cast` 25.8%, `Spell.applyEffects` 19.9%, `Dot.periodicTick` 19.5%, `Spell.dealDamageInternal` 12.8%, and aura proc callbacks around 10% cumulative.
- Reforge stat-delta construction is still visible but no longer controls wall time: `reforge_optimizer.computeChoiceDeltas.func1` 6.9% cumulative, mostly through `ComputeStats` / `NewEnvironment`.
- HiGHS wasm execution appears as `runtime._ExternalCode` at 4.6% of samples, much lower than the old end-to-end profile impact.

### Latest Allocation And Heap Observations

Allocation churn is still large at 323 GiB total, but it is mostly core sim churn:

- `Mage.NewMirrorImage`: 61.1 GiB allocated.
- `SpellResultCache.Get`: 38.6 GiB allocated.
- `RegisterSpell.(*Spell).makeCastFunc.func6`: 35.0 GiB allocated.
- `NewCharacter`, `mage.NewMage`, and `NewAgent`: about 20.4 GiB each.
- `Spell.RegisterTravelTimeCallback`, `UnitMetrics.addSpellMetrics`, `Spell.finalize`, and `Unit.RegisterSpell`: each remain multi-GiB allocation sites.

The retained heap profile is now modest. Total in-use heap at the snapshot was 243 MiB. The largest retained item remains the bounded wazero pool's linear memory: `wazero/internal/wasm.NewMemoryInstance` retained 81 MiB, consistent with four pooled runtimes. That is now an acceptable bounded cost rather than the previous multi-GiB RSS issue.

### Updated Recommendations From The Rerun

1. Keep the pooled wazero runtime design and raise the native HiGHS runtime cap default to about two-thirds of logical CPUs.

   The latest full replay shows the previous resident-memory problem is materially improved, and the post-pooling sweep moved the best measured cap from 4 to 12 on this 18-logical-CPU machine. Cap 12 cut the full run to 165.47s and the reforge pre-pass to 40.19s; cap 18 regressed to 194.36s and 1.60 GiB RSS.

2. Treat reforge as improved, but still optimize `computeChoiceDeltas` when focusing specifically on reforging.

   `ComputeStats` during stat-delta construction still costs about 6.9% cumulative CPU and about 60.6% cumulative allocation through `NewEnvironment` in the allocation profile. A raw stat/rating delta fast path for simple gem/reforge choices remains a good targeted improvement, as long as final optimized stats still use exact `ComputeStats` validation.

3. Move the main end-to-end performance focus to APL and spell/proc hot paths.

   The corrected profile says the biggest wall-time wins are now in `APLAction.IsReady`, boolean APL evaluation, spell casts, periodic ticks, and aura proc callbacks. This is a broader sim-core optimization area rather than a Bulk Sim wrapper issue.

4. Investigate `SpellResultCache.Get` and spell-cast allocation churn before touching Bulk Sim scheduling again.

   `SpellResultCache.Get` alone allocated 38.6 GiB in the latest replay. If this can reuse result objects or avoid per-event allocations safely, it should reduce GC pressure across all sim modes, not only Bulk Sim.

5. Keep high-stage survivor count under watch.

   The high stage is still 84.68s of the 142.49s core sim time because 13 survivors run at 50000 iterations with concurrency 1. Any change that increases survivors will now be very visible in wall time.

6. Downgrade the old RSS risk for the current build, but keep a regression benchmark around privately.

   The latest run peaked under 1 GiB RSS. Since the previous failure mode was severe, future solver/runtime changes should rerun this same full fixture before release. The temporary harness should stay out of the repo unless we decide to formalize it.

## Executive Summary

The latest clean full-request cap sweep now has the best end-to-end measurement: 165.47s wall time at HiGHS runtime cap 12 on this 18-logical-CPU machine. That improves wall time by 14.76s versus the post-pooling cap-4 run, by 32.14s versus the profiled cap-4 corrected run, and by about 95s versus the original full-request baseline.

The reforge pre-pass is no longer the dominant half of the run. It dropped from about 118.41s in the prior profiled cap-4 run to 40.19s in the best post-pooling cap-12 run, while core Bulk Sim took 125.28s. The remaining end-to-end bottleneck is now primarily normal sim execution, especially APL readiness/evaluation plus spell/proc handling.

Peak resident memory is also materially improved in the current build. The best cap-12 run peaked at 1.32 GiB RSS and 1.17 GiB Go heap, versus the earlier profiled 9.15 GiB RSS plateau. The retained heap profile still shows the bounded wazero pool as the largest single retained object class, but the process now stays in a bounded range for this fixture.

The optimization priority has shifted. For reforge-specific work, `computeChoiceDeltas` still spends time and allocation in repeated `ComputeStats`. For end-to-end Bulk Sim performance, the bigger targets are core sim hot paths: `APLAction.IsReady`, boolean APL values, spell casts/effects, aura proc callbacks, and allocation churn from `SpellResultCache.Get` / spell-cast result paths.

The reforge-only profile isolated optimizer behavior from the full Bulk Sim run. Easy Arcane reforging completed in 1.62s under profiling, with 1.56s in HiGHS solve time. Hard Windwalker RoRo completed in 29.92s under profiling, with 29.72s in HiGHS solve time. The remaining hard-case wall time is solver-bound; Go-side initialization and choice-delta construction were under 0.2s in the timed phase breakdown.

## Primary Results

| Scenario | Candidates Parsed | HiGHS Runtime Cap | Wall Time | Core Bulk Sim Time | Implied Reforge Pre-Pass | Total CPU | Avg Cores Used | Peak RSS | Peak Go Heap | Output Results |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Initial 32-candidate slice | 32 | pre-cap-sweep code | 42.77s | 38.14s | 4.63s | 616.88s | 14.42 | n/a | 116.54 MiB | 5 |
| Initial full request | 864 captured / 863 low-stage input | pre-cap-sweep code | 260.59s | 119.12s | 141.47s | 2270.34s | 8.71 | ~7.8-8.0 GiB sampled | 637.22 MiB | 5 |
| Tuned full request | 863 | 2 | 250.68s | 119.56s | 131.13s | 2237.27s | 8.92 | 8.67 GiB | 623.56 MiB | 5 |
| Tuned full request | 863 | 4 | 237.51s | 118.39s | 119.11s | 2240.84s | 9.43 | 8.66 GiB | 542.30 MiB | 5 |
| Profiled full request | 863 | 4 | 239.15s | 120.74s | 118.41s | 2266.01s | 9.48 | 9.15 GiB | 624.99 MiB | 5 |
| Latest profiled full request, corrected oneofs | 864 captured / 863 low-stage input | 4 | 197.61s | 142.49s | 55.12s | 2790.57s | 14.12 | 867.87 MiB | 648.75 MiB | 5 |
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
| Latest profiled full request, corrected oneofs | 2790.57s | 14.12 | 78.5% |
| Tuned full request, cap 18 | 2365.04s | 9.79 | 54.4% |

Interpretation:

- The latest corrected run uses substantially more CPU per wall-clock second than the earlier full runs, which is consistent with the pooled wazero bridge removing a low-utilization reforge/runtime bottleneck.
- The tuned cap-4 run improved wall time without materially increasing total CPU versus the initial full run; the later pooled run improves wall time further by spending more CPU in parallel core sim work.
- Raising the cap to 18 increases total CPU but does not improve wall time. That is a poor trade.
- The core high stage is still expensive and naturally less parallel at the candidate level: the full request ended with 13 high-stage survivors at 50000 iterations.
- The latest cap-4 CPU profile shows core sim dominates the profiled request. `Simulation.Step` accounted for 2070.71s cumulative CPU, 79.41% of sampled CPU. APL readiness/rotation work, spell casts/effects, and aura/proc callbacks are the top visible Go-side CPU areas. HiGHS wasm execution now appears as `runtime._ExternalCode` at 120.10s / 4.61% of samples.

## Memory Analysis

Go runtime memory remained modest compared with process RSS.

| Scenario | Peak Go Heap | Peak Go Sys | Peak RSS / Sampled RSS | Total Allocated | Mallocs | GC Cycles |
|---|---:|---:|---:|---:|---:|---:|
| Initial 32-candidate slice | 116.54 MiB | 278.18 MiB | n/a | 39.54 GiB | 771,897,059 | 1319 |
| Initial full request | 637.22 MiB | 755.16 MiB | ~7.8-8.0 GiB sampled | 322.76 GiB | 3,726,766,402 | 2405 |
| Tuned full request, cap 4 | 542.30 MiB | 762.79 MiB | 8.66 GiB | 322.76 GiB | 3,726,781,557 | 2635 |
| Profiled full request, cap 4 | 624.99 MiB | 785.54 MiB | 9.15 GiB | 322.80 GiB | 3,727,031,300 | 2563 |
| Latest profiled full request, corrected oneofs | 648.75 MiB | 918.59 MiB | 867.87 MiB | 323.11 GiB | 3,718,572,544 | 1373 |
| Tuned full request, cap 18 | 639.78 MiB | 823.85 MiB | 8.70 GiB | 322.86 GiB | 3,727,675,797 | 2601 |

Interpretation:

- In the earlier full requests, the main memory issue was outside Go heap accounting: RSS was roughly an order of magnitude larger than Go `Sys`.
- The latest corrected rerun no longer reproduces that RSS plateau. Peak RSS was 867.87 MiB, close to Go `Sys`, while the retained heap profile showed a bounded 81 MiB wazero linear-memory footprint.
- The very large VSZ values observed during the old native-runtime runs were likely linear-memory reservation behavior. VSZ was not itself the immediate limit, but the old 8.5 GiB RSS plateau was real resident pressure.
- The initial full run allocated about 323 GiB cumulatively and performed 3.7B mallocs. Even when peak Go heap is moderate, this allocation churn can contribute meaningful GC and system CPU overhead.

Full-request profile observations:

- Allocation bytes in the latest profile were dominated by core sim construction/execution: `Mage.NewMirrorImage` allocated 61.1 GiB, `SpellResultCache.Get` 38.6 GiB, `Unit.RegisterSpell.(*Spell).makeCastFunc.func6` 35.0 GiB, and `NewCharacter` / `mage.NewMage` / `core.NewAgent` each allocated about 20.4 GiB.
- The retained heap profile was smaller than peak heap and no longer showed large `solveMIPWithHiGHS` retained buffers. `wazero/internal/wasm.NewMemoryInstance` retained 81 MiB, matching the bounded pool.

## Recommendation 3 And 4 Exploration

Recommendation 3 was partially implemented before the cap sweep:

- `sim/core/reforge_optimizer/highswasm.go` compiles the embedded `highs.wasm` module once through `highsWasmModuleOnce` and reuses the wazero runtime / compiled module.
- The HiGHS solve path is bounded by `highsWasmRuntimePool`, with production concurrency set to `runtime.NumCPU()/4`.
- Each solve calls the wasm `Highs_destroy` export for the created HiGHS instance.
- Each solve still creates a fresh wazero module instance via `newHiGHSWasmRuntime`. The bridge also allocates wasm strings through `malloc` and does not currently wire an exported `free`/reset path for those allocations.

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

- The hard RoRo case is still solver-bound. After the improvement, `solveMIPWithHiGHS` accounted for 13.40s cumulative CPU path time and almost all wall time in the old native-runtime profile; this should be re-profiled after the wazero migration.
- `ComputeStats` is the dominant cumulative Go allocation source during choice-delta construction: 1.71 GiB before the improvement and about 1.63 GiB after. The largest allocation sites are `NewTargetDummy`, APL value/action discovery, spell finalization, pet setup, and unit metrics.
- The old native runtime callback value construction (`mkVal`, `ValI32`, `goTrampolineNew`, and `SetFinalizer`) should no longer apply after the wazero migration, though WASI callback volume may still matter.
- Live Go heap is modest for single reforge profiles, so the reforge-only harness does not reproduce the full-request 8.5+ GiB RSS plateau. That larger memory issue likely depended on many concurrent/per-request wasm runtimes and full Bulk Sim core activity.

Next optimizer-specific improvements to consider:

1. Reduce WASI callback volume or callback allocation in the HiGHS bridge.

   The hard solve still calls into Go frequently from wasm. After the wazero migration, re-profile whether clock callbacks or other WASI imports remain a measurable cost and whether the HiGHS wasm module can run with less frequent clock polling.

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

1. Peak RSS was the largest historical risk, but the latest corrected run peaked under 1 GiB. This should still be watched as a regression risk around solver/runtime lifetime changes.
2. Reforge optimization is improved but not free. In the latest run, the implied reforge pre-pass was 55.12s of 197.61s, with `computeChoiceDeltas` still visible through `ComputeStats`.
3. Native HiGHS wasm memory is now bounded by the pooled wazero runtime design. The retained heap profile shows about 81 MiB of wazero linear memory for the cap-4 pool.
4. Allocation churn is still a CPU contributor. The latest full-request profile captured about 323.11 GiB of cumulative allocation and 3.72B mallocs, mostly in core sim setup/execution.
5. High-stage sim time remains material after culling. Any future optimizer change that increases high-stage survivors will directly increase total wall time.

## Recommendations

1. Keep the current HiGHS runtime cap at `runtime.NumCPU()/4`.

   On the benchmark machine this maps to cap 4. Earlier cap-sweep data showed that raising the cap to 8 or 18 did not improve wall time enough to justify the added CPU/system overhead, and the latest pooled rerun confirms cap 4 is sufficient for the full fixture.

2. Do not prioritize further simple concurrency increases for bulk reforge.

   The cap sweep and profiled replay show the current bottleneck is not solved by more HiGHS slots. Recommendation 2 is therefore complete for now: keep concurrency unchanged and spend the next optimization pass on allocation churn and core sim hot paths.

3. Keep the pooled native solver lifetime model and monitor it for regressions.

   Already implemented: the wasm module is compiled once, solves are bounded by `runtime.NumCPU()/4`, hot WASI callbacks reuse the cached memory export, and bounded wazero instances are reused. The latest full replay suggests this fixed the old resident-memory plateau. Future changes should keep the same full fixture as a regression check.

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

- Bounded HiGHS/wazero runtime slots with `runtime.NumCPU()/4` default cap.
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
