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
