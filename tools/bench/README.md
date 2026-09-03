# Log pipeline benchmarks

Baselines and regression harness for `logs_parser.tsx` → `sim_result.ts` → the detailed-results
renderers. Nothing in that stack should change without a before/after row here.

## Why these fixtures

The UI splits the log array per unit, and recurses into every pet
(`sim_result.ts:520`, filtering `petLogs` again at `:526`/`:529`). A petless single-target profile
never touches that path, so the reference specs are the two with the most pets:

| fixture | spec | pets | lines | bytes |
|---|---|---|---|---|
| `unholy` | Unholy DK — Ghoul, Gargoyle, Army of the Dead | 10 | 20,394 | 2.4 MB |
| `demonology` | Demonology Warlock — Felguard + 15 Wild Imps | 27 | 16,267 | 2.0 MB |
| `raid25` | 25× Unholy DK | 10 each | 496,015 | 60 MB |

## Regenerating the fixtures

Deterministic given the seed, so they are gitignored rather than committed.

```sh
go run -tags with_db ./tools/bench/gen_logs --spec unholy      --out tools/bench/logs/unholy.log      --json tools/bench/logs/unholy.json
go run -tags with_db ./tools/bench/gen_logs --spec demonology  --out tools/bench/logs/demonology.log  --json tools/bench/logs/demonology.json
go run -tags with_db ./tools/bench/gen_logs --spec unholy --players 25 --out tools/bench/logs/raid25.log --json tools/bench/logs/raid25.json
```

The `--json` bundle carries the `RaidSimRequest` and `RaidSimResult` as protojson so the node
bench can rebuild both with the UI's own generated proto classes and exercise
`SimResult.makeNew`, not just the parser.

## Running the node bench

```sh
npx vite build --config vite.bench.mts          # rebuild after touching any ui/core source
node --expose-gc tools/bench/parse_bench.mjs --full
node --expose-gc --max-old-space-size=12288 tools/bench/parse_bench.mjs --fixture raid25 --full --runs 1
```

`--sanity` prints the unit/pet/derived-array counts for one fixture. Run it after regenerating:
a protojson round-trip that silently drops `raidMetrics` makes `makeNew` look free.

## Correctness gate

```sh
node --expose-gc tools/bench/parse_bench.mjs --dump before.txt --fixture unholy --fixture demonology
# ...change the parser...
npx vite build --config vite.bench.mts
node --expose-gc tools/bench/parse_bench.mjs --dump after.txt --fixture unholy --fixture demonology
cmp before.txt after.txt
```

The dump carries every scalar field of every log plus the derived arrays, and the fields are
discovered rather than listed. That is deliberate: the failure mode of replacing the parser's
13-branch alternation with `indexOf` classification is a misclassification that still yields a
plausible class name and timestamp — `CriticalBlock` collapsing to `Block`, a lost `tick` flag —
so a hand-written field list would miss whichever field the rewrite happens to break.

## Baseline — master @ fd8335d2f, node 20.19.4

`parse` is `SimLog.parseAll` alone; `makeNew` is `SimResult.makeNew` *minus* parse, i.e. the
per-unit fan-out and the eager derives. Both run on every Simulate press, because
`sim.ts:300` sets `debugFirstIteration: true` on every request.

| fixture | lines | parse ms | lines/s | promises | parse heap MB | makeNew ms | makeNew heap MB |
|---|---|---|---|---|---|---|---|
| unholy | 20,394 | 209.7 | 97,250 | 40,790 | 10.7 | 66.5 | 0.1 |
| demonology | 16,267 | 175.2 | 92,832 | 32,536 | 8.9 | 60.6 | 0.1 |
| raid25 | 496,015 | 5,749.8 | 86,267 | 992,032 | 266.3 | 3,637.5 | 563.4 |

Two promises per log line: `ActionId.fromLogString(...).fill()` plus the `.then()` that builds
the log object. A 25-man raid sim therefore blocks the main thread for **~9.4 seconds** and
allocates **992k promises** and **830 MB** before a single tab renders.

## After branch 2 — `perf/log-data-pipeline`

| fixture | parse ms | lines/s | promises | parse heap MB | makeNew ms | derives ms | heap MB |
|---|---|---|---|---|---|---|---|
| unholy | 78.6 | 259,483 | 1,060 | 9.1 | 0 | 25.0 | 0 |
| demonology | 59.8 | 272,076 | 604 | 7.4 | 8.2 | 19.2 | 0 |
| raid25 | 2,346.5 | 211,382 | 25,496 | 222 | 0 | 1,003.2 | 274 |

| | master | branch 2 | |
|---|---|---|---|
| raid25 parse | 5,750 ms | 2,346 ms | 2.45× |
| raid25 promises | 992,032 | 25,496 | 39× fewer |
| raid25 blocking total | 9,387 ms | 2,347 ms (nothing read) / 3,350 ms (everything read) | 4.0× / 2.8× |
| raid25 heap | 563 MB | 274 MB | |
| unholy parse | 209.7 ms | 78.6 ms | 2.7× |
| unholy derive | 66.5 ms eager | 25.0 ms on read, 0 if unread | |

`derives ms` is new and exists so the lazy getters cannot flatter the result: it times reading
every derived view on every unit, which is exactly what the old constructor did up front. Even
paying all of it, the total beats master; a tab that reads none of it pays nothing.

Promises no longer scale with line count. They are now one per distinct `(action id, player
index)` pair — 1,060 for a fight with 20,394 log lines.

### What did not move

The browser's Simulate long task is ~1.2–1.6 s before and after. Phase A removes ~140 ms of
parse from it; the rest is the timeline building 95 rows, 13k nodes and 7.4k tippy instances
into a hidden tab, which is branch 4's work. Note also that the in-browser figure varies run to
run because the sim seed does — compare node numbers for the parser, not browser ones.

## Result — full stack, node

| fixture | parse ms | lines/s | promises | parse heap MB | makeNew ms | derives ms |
|---|---|---|---|---|---|---|
| unholy | 68.9 | 296,182 | 1,060 | 7.9 | 2.3 | 24.0 |
| demonology | 63.4 | 256,593 | 604 | 6.4 | 0 | 19.4 |
| raid25 | 2,227.2 | 222,711 | 25,496 | 191.7 | 69.0 | 1,283.2 |

| raid25 | master | after | |
|---|---|---|---|
| parse | 5,749.8 ms | 2,227.2 ms | 2.6× |
| promises | 992,032 | 25,496 | 39× fewer |
| blocking before a tab renders | 9,387 ms | 2,296 ms | **4.1×** |
| ...with every derived view read | 9,387 ms | 3,579 ms | 2.6× |
| parse heap | 266 MB | 192 MB | |

The parity dump over the unholy and demonology fixtures is byte-identical to master across
the whole stack, including the discriminating per-subclass fields and active-aura ordering.
