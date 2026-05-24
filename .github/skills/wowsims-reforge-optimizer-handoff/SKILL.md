---
name: wowsims-reforge-optimizer-handoff
description: 'Use when continuing, debugging, validating, or modifying the WoWSims MoP reforge optimizer, /reforgeOptimize endpoint, HiGHS solver integration, gem/socket/cap logic, softcap breakpoints, or Rune of Re-Origination relative stat caps.'
argument-hint: 'Describe the reforge optimizer bug, fixture, or behavior to continue.'
---

# WoWSims Reforge Optimizer Handoff

## When to Use
- Continue work on `sim/core/reforge_optimizer` or `/reforgeOptimize`.
- Debug reforge, gem, socket bonus, hard cap, soft cap, breakpoint, or relative stat cap behavior.
- Validate HiGHS-backed optimizer behavior through the shared Go backend path.
- Reproduce fixture-driven optimizer mismatches from pasted `/reforgeOptimize` requests.

## Current Architecture
- Backend package: `sim/core/reforge_optimizer`.
- Frontend caller: `ui/core/components/suggest_reforges_action.tsx`.
- Endpoint: `/reforgeOptimize`.
- Request/response protos: `ReforgeOptimizeRequest`, `ReforgeOptimizeResult`, `ReforgeSettings`, `StatCapType`, `StatCapConfig`, `EquipmentSpec`, `ItemSpec`.
- Final stats must be validated through `core.ComputeStats`; MIP deltas are approximate and are not the final source of truth.
- HiGHS is the required default solver in dev/release flows. Local/server builds use the embedded `ui/worker/highs.wasm` asset through `github.com/bytecodealliance/wasmtime-go`; browser WASM builds call the worker-provided HiGHS JS bridge. Do not reintroduce the native HiGHS C binding.
- HiGHS bridges: `sim/core/reforge_optimizer/highswasm.go` for non-browser Go builds and `sim/core/reforge_optimizer/highs_js.go` for `js && wasm` builds.
- Detailed backend reforge logging is opt-in through `ReforgeOptimizeRequest.debug`; leave it false for normal requests and set it true when capturing solver/request diagnostics.

## Main Files
- `optimizer.go`: main `Optimize(request *proto.ReforgeOptimizeRequest)` flow. Validates settings, computes baseline stats, builds caps/choices, solves with HiGHS, applies choices, recomputes final stats, and logs diagnostics.
- `types.go`: shared choice, cap, search, and relative-cap structs.
- `choices.go`: reforge/gem/socket bonus choice construction. Preserve raw Crit/Haste/Mastery deltas for relative stat cap constraints.
- `gear.go`: gear cloning, applying selected choices, clearing reforges, and minimizing regem churn after the solver. Meta sockets are restored from original gear during regem minimization and should not participate in swap minimization.
- `gems.go`: gem options, socket colors, eligibility, current gem clearing.
- `caps.go`: settings validation, hard caps, soft caps, breakpoint normalization, inferred threshold limits.
- `solver.go`: MIP model, mutually exclusive choice groups, socket bonus link constraints, iterative cap refinement, relative stat cap rows.
- `relative_stat_cap.go`: Rune of Re-Origination and relative stat cap construction plus forced-stat EP adjustment.
- `search.go`: choice evaluation and softcap scoring helpers.
- `stats.go`: `core.UnitStats` conversion/access helpers.
- `logging.go`: terminal logging for request config, cap evaluation, selected choices, and optimized gear summary.
- Most detailed `optimizer.go` / `solver.go` logs should be guarded by `request.GetDebug()` so production requests keep only concise lifecycle/error lines.
- `relative_stat_cap_test.go`, `gems_test.go`, `gear_test.go`, `caps_test.go`: focused regression coverage.

## Optimizer Behavior to Preserve
1. Start from the user's current gear and settings.
2. Clear reforges and/or gems only according to `ReforgeSettings`.
3. Compute baseline character stats with `core.ComputeStats`.
4. Build available choices for reforges, gems, and socket bonuses.
5. Solve a binary-choice MIP with HiGHS.
6. Enforce one selected option per mutually exclusive choice group.
7. Link socket bonus decisions to matching socket color choices.
8. Enforce hard caps and breakpoint-derived limits through MIP rows.
9. Score soft caps piecewise by pre-cap and post-cap EP.
10. Apply selected choices to gear.
11. Recompute optimized stats with `core.ComputeStats`.
12. Validate final stats and tighten existing MIP cap rows if final real deltas violate bounds.
13. Return an error if HiGHS fails; do not fall back to a weaker optimizer.

## Gems and Sockets
- Gem logic is required for correctness; do not treat reforging as the only optimization surface.
- Socket bonuses must be modeled explicitly because they can change cap feasibility and score.
- Gem color eligibility must support secondary colors correctly.
- Preserve gem order in `EquipmentSpec` output.
- Meta gems are not solver choices. `clearGems` preserves existing meta gems, and `minimizeRegems` must explicitly restore meta socket gems from the original gear before attempting ordinary gem swaps. This prevents intermittent head-slot meta loss or replacement when regem minimization tries to preserve socket positions.
- The optimizer should be able to consider Eye of the Black Prince socket behavior when settings allow it.
- Preserve established stat dependency semantics when scoring gem candidates. In particular, `Spirit` converts to `PseudoStatSpellHitPercent` only for hybrid casters (`BalanceDruid`, `ShadowPriest`, `ElementalShaman`, `MistweaverMonk`); non-hybrid casters such as Arcane Mage must not treat Spirit as spell hit.
- Arcane Mage T16 hit-cap behavior depends on keeping hit/mastery gems available. If non-hybrid Spirit gems are scored as spell-hit gems, they can crowd out `Sensei's Wild Jade` during capped-gem pruning, causing the optimizer to choose hard hit gems instead of hit/mastery gems.

## Hard Caps, Soft Caps, and Breakpoints
- Validate settings before optimization.
- Sort and normalize breakpoints before building caps.
- Breakpoint limits can become explicit softcaps with post-cap EP `0` when needed.
- If the final `core.ComputeStats` result undershoots a requested breakpoint, tighten the existing MIP cap row and solve again rather than adding unrelated constraints.
- Balance Druid T16 no-limit breakpoint behavior was previously fixed through this cap-row tightening path; keep that regression intact.

## True-Caster Spell Hit and Expertise
- Preserve the simple Hit-over-Expertise preference: when building available reforges for a true caster item, filter out an Expertise reforge if the same source stat also has a Hit reforge available.
- Do not implement the Hit-over-Expertise preference as inferred caps, score bias, or broad stat-conversion config; hard caps should continue to come from request settings.
- `Spirit` still converts to spell hit only for hybrid casters; true non-hybrid casters such as Mage and Warlock should not score Spirit as spell hit.
- Current focused tests:
  - `TestPreferHitOverExpertiseReforgesFiltersSameSourceExpertise`
  - `TestPreferHitOverExpertiseReforgesKeepsExpertiseWithoutHitAlternative`

## Relative Stat Caps and Rune of Re-Origination
- Relative stat caps cannot be modeled with EP weights alone.
- Add explicit linear constraints of the form:

```text
forcedStat - constrainedStat >= requiredDelta
```

- Lower the forced stat EP so the solver does not keep stacking the forced stat after it is safely dominant.
- Use raw Crit/Haste/Mastery rating deltas for relative cap feasibility, including gem, reforge, and socket bonus deltas.
- Mastery comparisons must account for base mastery and the mastery raid buff.
- Validate relative cap results with final `core.ComputeStats`, not only MIP deltas. If exact final stats violate a relative cap, tighten the existing relative cap row and solve again.
- Relative cap quality is not only feasibility. For forced Mastery RoRo cases, the desired result is Mastery at least 1 rating higher than every constrained stat, with constrained stats as close below Mastery as practical.
- Windwalker Monk forced Mastery should add only `Mastery - Crit` and `Mastery - Haste` constraints. Do not add a Crit-vs-Haste or Haste-vs-Crit hard constraint for Windwalker.
- Feral Druid forced Mastery is a special case that may add the extra Haste/Crit ordering constraint captured by existing regression fixtures.
- After cap refinement and exact `core.ComputeStats` validation, return the accepted HiGHS candidate without a backend-only balance pass.
- Do not reintroduce the removed balance-limit MIP plumbing or local surplus-balancing search unless a fresh replay proves the behavior is explicitly desired.
- Relevant constants:
  - `core.MasteryRatingPerMasteryPoint = 600`
  - `core.MasteryRaidBuffStrength = 3000`
- Mastery raid buffs include `RoarOfCourage`, `SpiritBeastBlessing`, `BlessingOfMight`, and `GraceOfAir`.
- Current RoRo tests:
  - `TestApplyRelativeStatCapWeightsLowersForcedStat`
  - `TestBuildChoiceMIPModelAddsRelativeStatCapConstraint`
  - `TestUpdateHiGHSCapPassTightensRelativeStatCap`
  - `TestBuildRelativeStatCapsOnlyForcesConfiguredStatForWindwalker`

## HiGHS Relative-Cap Solver Notes
- Relative stat cap requests use a longer timeout budget than ordinary reforges; keep the target around 2 minutes and hard cap around 3-5 minutes unless the user asks otherwise.
- Use `mip_rel_gap` for relative-cap solves so HiGHS does not spend excessive time proving tiny objective gaps after finding a good feasible result.
- The Go HiGHS bridge writes the MIP as CPLEX LP text and calls the Emscripten exports from `highs.wasm` (`Highs_readModel`, option setters, `Highs_run`, `Highs_writeSolutionPretty`). Keep LP line wrapping conservative because HiGHS can reject very long LP lines.
- The current Go MIP model uses binary choice variables; if continuous/helper variables are added later, update the LP writer and parser before relying on them.
- `choicesFromMIPSolution` must ignore non-choice/non-integer variables if future models add helper variables.
- Exact post-solve cap validation should use `selectedChoicesCapDelta`, `exactRelativeCapViolation`, and `search.evaluate` before accepting a candidate.
- Cleanup/performance notes from 2026-05-23:
  - `selectedChoicesValid` exists because candidate validation only needs legality checks; do not reintroduce a discarded delta computation there.
  - Solver pass timing should remain behind request debug mode so normal requests avoid extra `time.Now` calls.
  - `mipSolution` intentionally does not store HiGHS objective value because callers recompute and validate score from exact deltas.
  - `canAddChoice` has allocation-free fast paths for zero/one unique gem IDs; keep this for selected-choice legality validation.
  - The disabled relative-stat-cap balance pass was removed in the final merge cleanup. `buildChoiceMIPModel` takes `(search, weights, statConstraints, relativeCaps)`; there is no `relativeBalanceLimit` parameter and no `shouldRunRelativeStatCapBalance` gate.
  - After modifying Go helpers, explicitly sweep touched function parameters and call sites for `unusedparams`-style analyzer warnings. `get_errors` and `go vet` can miss gopls/staticcheck hints, as with the removed `includesCappedStat(..., softCaps)` parameter.

## Frontend Integration Notes
- `ui/core/components/suggest_reforges_action.tsx` routes suggest-reforges to the Go optimizer when supported.
- Browser WASM mode should use the same backend optimizer exported from `sim/wasm/main.go`; JS should only provide worker plumbing and the HiGHS bridge, not duplicate reforge optimization logic.
- The Go optimizer path should allow `relativeStatCap`.
- Do not run `gofmt` on `.tsx` files. Use TypeScript tooling for frontend validation.

## Validation Commands
Run the narrowest relevant check first, then broaden if needed.

```bash
go test -count=1 ./sim/core/reforge_optimizer
```

```bash
npm run type-check
```

Replay a captured binary request with:

```bash
go run -tags with_db /tmp/replay_reforge.go /tmp/reforge-request-name.bin > /tmp/reforge-output.txt 2> /tmp/reforge-log.txt
```

Useful log filter:

```bash
grep -E "request config|built [0-9]+ choice groups|adding breakpoint|tightening|min cap|softcap stat|optimized gear contains|HiGHS solved|failed" /tmp/reforge-log.txt | sed -n '1,180p'
```

## Reforge-Only Profiling Harness
- Keep `sim/core/reforge_optimizer/optimizer_profile_test.go` out of the repository unless the user explicitly asks to check it in.
- The current gated profile harness source is stored in repo memory at `/memories/repo/reforge-profile-harness.md`.
- The memory copy was refreshed after the 2026-05-24 reforge-only profile run and includes `sim.RegisterAll()` plus JSON fixture defaults.
- To profile easy vs hard reforges, temporarily recreate that file from memory, run the profile command, collect `tmp/reforge_profiles`, then delete the file before finishing.
- Use explicit current fixtures when possible; old `/tmp/reforge-arcane-request.bin` or `/tmp/reforge-ww-request.bin` captures can become proto-incompatible after API changes. The latest successful profile used `/tmp/reforge-arcane-request.json` and `/tmp/reforge-ww-request.json`.

```bash
go test -c -o tmp/reforge_optimizer_profile.test ./sim/core/reforge_optimizer
WOWSIMS_REFORGE_PROFILE=1 \
WOWSIMS_REFORGE_PROFILE_OUTPUT_DIR=tmp/reforge_profiles \
WOWSIMS_REFORGE_PROFILE_REQUESTS=easy=/tmp/reforge-arcane-request.json,hard=/tmp/reforge-ww-request.json \
./tmp/reforge_optimizer_profile.test -test.run TestReforgeOptimizerProfile -test.timeout 10m -test.v
```

For cleaner per-case pprof output, run one fixture at a time:

```bash
WOWSIMS_REFORGE_PROFILE=1 \
WOWSIMS_REFORGE_PROFILE_OUTPUT_DIR=tmp/reforge_profiles \
WOWSIMS_REFORGE_PROFILE_REQUESTS=hard=/tmp/reforge-ww-request.json \
./tmp/reforge_optimizer_profile.test -test.run 'TestReforgeOptimizerProfile/hard$' -test.timeout 10m -test.v
```

- The standalone harness must call `sim.RegisterAll()` before loading/running profile cases so `core.ComputeStats` can construct the captured player spec.

## Last Known Passing Validation
- Last checked on 2026-05-23 after removing inferred spell-hit cap leftovers and keeping only the Hit-over-Expertise reforge filtering pass.
- `go test -count=1 ./sim/core/reforge_optimizer` passed.
- Arcane Mage T16 replay still passed exact gear comparison after the cap cleanup:
  - command: `go run -tags with_db /tmp/replay_reforge.go /tmp/reforge-arcane-request.bin > /tmp/reforge-arcane-output.txt 2> /tmp/reforge-arcane-log.txt`
  - comparison: `node /tmp/compare_reforge_gear.mjs /tmp/reforge-arcane-expected.json /tmp/reforge-arcane-output.txt`
  - result: `EquipmentSpec matches expected gear.`
  - final exact stats include spell hit at or above cap.
- Windwalker Monk RoRo replay still passed the semantic relative-cap invariant after the cap cleanup:
  - command: `go run -tags with_db /tmp/replay_reforge.go /tmp/reforge-ww-request.bin > /tmp/reforge-ww-output.txt 2> /tmp/reforge-ww-log.txt`
  - stats command: `go run -tags with_db /tmp/check_reforge_output_stats.go /tmp/reforge-ww-request.bin /tmp/reforge-ww-output.txt`
  - result stats: `crit=11904`, `haste=11902`, `mastery=11905`, `masteryMinusCrit=1`, `masteryMinusHaste=3`.
  - exact gear still differs from `/tmp/reforge-ww-expected.json`; this is accepted for this fixture because the user-defined invariant is stat shape, not gear identity.
- `npm run type-check` passed.
- Balance replay after RoRo changes passed and solved quickly:
  - `includeGems=true`
  - `includeEotbGemSocket=true`
  - `useSoftCapBreakpoints=true`
  - `gemOptions=20`
  - `baselineItems=16`
  - `softCaps=2`
  - `47 choice groups / 524 choices in 138.895416ms`
  - `HiGHS solved in 184.93991ms score=5813.058`
  - optimized gear contained `reforges=10 gems=22`
  - Crit and Haste softcaps were reached.

## Arcane Mage T16 Fixture
This fixture validates non-relative hard/soft cap behavior, gem pruning, spell hit, and spell haste breakpoints.

- Fixture request: `/tmp/reforge-arcane-request.bin`
- Historical expected gear snapshot: `/tmp/reforge-arcane-expected.json`
- Native output/log paths used during validation: `/tmp/reforge-arcane-output.txt`, `/tmp/reforge-arcane-log.txt`
- Helper programs used during validation: `/tmp/replay_reforge.go`, `/tmp/dump_reforge_stats.go`, `/tmp/compare_reforge_gear.mjs`
- Settings shape:
  - `includeGems=true`
  - `includeEotbGemSocket=true`
  - `useSoftCapBreakpoints=true`
  - hard cap: `PseudoStatSpellHitPercent=15`
  - breakpoint limit: `PseudoStatSpellHastePercent=24.97657`
  - soft caps include both spell-haste soft-cap and threshold-cap entries.
- Expected exact output after the Spirit-to-hit fix:
  - Gear comparison: `EquipmentSpec matches expected gear.`
  - `critRating: 5372`
  - `hasteRating: 12683.7042586423`
  - `hitRating: 4152`
  - `intellect: 31514.9625`
  - `masteryRating: 20208.0394784078`
  - `masteryRatingRaw: 23208.0394784078`
  - `spellHastePct: 45.879745257846174`
  - `spellHitPercent: 15.035294117647059`
  - `spirit: 313.9314907604832`
- Root-cause lesson: non-hybrid casters must not convert `Spirit` to `PseudoStatSpellHitPercent` during gem/socket scoring. Before this fix, the optimizer selected hard hit gems such as `Rigid River's Heart` (`76636`) instead of hit/mastery gems such as `Sensei's Wild Jade` (`76643`).

Replay the Arcane fixture with:

```bash
go run -tags with_db /tmp/replay_reforge.go /tmp/reforge-arcane-request.bin > /tmp/reforge-arcane-output.txt 2> /tmp/reforge-arcane-log.txt
```

Compare exact gear with:

```bash
node /tmp/compare_reforge_gear.mjs /tmp/reforge-arcane-expected.json /tmp/reforge-arcane-output.txt
```

Inspect exact stats with:

```bash
go run -tags with_db /tmp/dump_reforge_stats.go /tmp/reforge-arcane-request.bin /tmp/reforge-arcane-output.txt
```

## Windwalker Monk RoRo Fixture
This fixture validates backend relative-stat-cap behavior. Exact gear snapshots are useful for regression comparison, but the required semantic invariant is:

```text
Mastery > Crit
Mastery > Haste
Crit and Haste as close below Mastery as practical
```

- Fixture request: `/tmp/reforge-ww-request.bin`
- Historical expected gear snapshot: `/tmp/reforge-ww-expected.json`
- Native output/log paths used during validation: `/tmp/reforge-ww-output.txt`, `/tmp/reforge-ww-log.txt`
- Helper programs used during validation: `/tmp/replay_reforge.go`, `/tmp/check_reforge_output_stats.go`, `/tmp/compare_reforge_gear.mjs`
- Historical expected stats computed through native `core.ComputeStats`:
  - Crit: `11925`
  - Haste: `11928`
  - Mastery: `11929`
  - Mastery minus Crit: `4`
  - Mastery minus Haste: `1`
- Backend validated output from the HiGHS path:
  - Crit: `11904`
  - Haste: `11902`
  - Mastery: `11905`
  - Mastery minus Crit: `1`
  - Mastery minus Haste: `3`
  - Replay runtime: about `57s`
- The optimized gear may differ slightly from the historical gear snapshot as long as the exact final stats satisfy the invariant and remain tightly balanced.

Replay the Windwalker fixture with:

```bash
go run -tags with_db /tmp/replay_reforge.go /tmp/reforge-ww-request.bin > /tmp/reforge-ww-output.txt 2> /tmp/reforge-ww-log.txt
```

Then inspect exact stats with:

```bash
go run -tags with_db /tmp/check_reforge_output_stats.go /tmp/reforge-ww-request.bin /tmp/reforge-ww-output.txt
```

Optional gear comparison:

```bash
node /tmp/compare_reforge_gear.mjs /tmp/reforge-ww-expected.json /tmp/reforge-ww-output.txt
```

Historical request IDs seen for this fixture:
- URL query: `reforgeOptimize-8b2187e8965ffe57`
- request body: `reforgeOptimize-93d77a1c566c1952`

If the binary fixture is missing, search the full transcript for the original pasted payload:

```text
/home/lutz/.vscode-server/data/User/workspaceStorage/2a152bb4c08a66d8f7211da4b06ce0cd/GitHub.copilot-chat/transcripts/78bf0ee0-884b-42f2-a40c-ec9a58dd1e8a.jsonl
```

Look for an existing request blob or transcript payload:

```bash
find /tmp -maxdepth 1 -type f \( -name 'reforge-request-*.bin' -o -name '*reforge*.bin' \) -printf '%f %s bytes\n'
grep -R "reforgeOptimize-93d77a1c566c1952" /tmp /home/lutz/.vscode-server/data/User/workspaceStorage/2a152bb4c08a66d8f7211da4b06ce0cd/GitHub.copilot-chat/transcripts/78bf0ee0-884b-42f2-a40c-ec9a58dd1e8a.jsonl 2>/dev/null
```

Expected optimized Windwalker gear from the user:

```json
{
  "items": [
    {"id":99393,"gems":[95346,76659],"reforging":145,"upgradeStep":"UpgradeStepTwo"},
    {"id":105407,"upgradeStep":"UpgradeStepTwo"},
    {"id":99395,"enchant":4804,"gems":[76659,76659],"reforging":158,"upgradeStep":"UpgradeStepTwo"},
    {"id":102248,"enchant":4424,"gems":[76659],"upgradeStep":"UpgradeStepTwo"},
    {"id":105452,"enchant":4419,"gems":[76659,76700,76641],"reforging":147,"upgradeStep":"UpgradeStepTwo"},
    {"id":105616,"enchant":4416,"gems":[76699],"reforging":151,"upgradeStep":"UpgradeStepTwo"},
    {"id":99392,"enchant":4433,"gems":[76659,76659,76700],"reforging":167,"upgradeStep":"UpgradeStepTwo","tinker":4898},
    {"id":105635,"gems":[76659,76697,76699],"reforging":154,"upgradeStep":"UpgradeStepTwo"},
    {"id":99394,"enchant":4822,"gems":[76699,76643],"reforging":147,"upgradeStep":"UpgradeStepTwo"},
    {"id":105582,"enchant":4428,"gems":[76641],"reforging":151,"upgradeStep":"UpgradeStepTwo"},
    {"id":105451,"gems":[76641],"reforging":140,"upgradeStep":"UpgradeStepTwo"},
    {"id":105624,"gems":[76659],"reforging":152,"upgradeStep":"UpgradeStepTwo"},
    {"id":96546,"upgradeStep":"UpgradeStepTwo"},
    {"id":105527,"upgradeStep":"UpgradeStepTwo"},
    {"id":105685,"enchant":4444,"gems":[76659,76659],"reforging":145},
    {"id":105685,"enchant":4444,"gems":[76659,76659],"reforging":145}
  ]
}
```

## If Windwalker Output Mismatches
Debug in this order:
1. Confirm the request was decoded exactly and replayed with `-tags with_db`.
2. Inspect optimizer logs for relative cap construction and selected choices.
3. Check final Crit/Haste/Mastery ratings after `core.ComputeStats`.
4. Verify Mastery baseline and raid buff subtraction.
5. Verify raw gem, reforge, and socket bonus deltas in the MIP rows.
6. Verify exact relative cap tightening happened if a MIP-feasible result was exact-invalid.
7. Verify exact relative cap tightening happens when a MIP-feasible solution is exact-invalid.
8. Inspect the Go relative-cap construction, cap tightening, and selected-choice application paths before changing broad solver behavior.
9. Add the smallest regression test that captures the mismatch before changing broad solver behavior.

## Common Pitfalls
- Do not assume a request replay happened just because a previous agent said it was about to run one.
- Do not compare only EP scores; compare exact `EquipmentSpec` output for golden gear fixtures and exact final stats for semantic fixtures.
- Do not require an exact Windwalker gear match when exact stats satisfy the Mastery-over-Crit/Haste invariant with tight surplus.
- Do not remove HiGHS errors or introduce fallback behavior.
- Do not reintroduce backend-only relative-cap balancing or continuous max-surplus helpers without replay validation; the final merged path intentionally removed the disabled balance pass.
- Do not let `minimizeRegems` treat meta sockets as ordinary swappable sockets. Restore the original meta gem directly and mark the socket finalized before swap minimization.
- Do not reformat unrelated frontend files while touching Go optimizer code.
- Be careful with untracked files; some optimizer work may not appear in a simple `git diff` if files are new.
