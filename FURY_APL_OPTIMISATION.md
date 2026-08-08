# Fury Warrior APL optimisation (p5 fixture)

Working notes. Test bed: `p5-fury-fixture.test.json` (Orc, SoO HWF gear, 2×Xal'atoh → SMF,
T16 2pc only, Evil Eye of Galakras + Thok's Tail Tip, 300 s ±60 s single target, reaction time 100 ms).

Harness: `sim/warrior/fury/zz_apl_fixture_test.go` (temporary, deleted at the end) — loads the fixture
as `IndividualSimSettings`, swaps in an APL JSON, runs `core.RunRaidSimConcurrent`.
Always `go test --tags=with_db`.

## Baseline

| rotation | DPS (20 000 iters) |
| --- | --- |
| `ui/warrior/fury/apls/default.apl.json` (committed) | **508 368 ± 96** |
| rotation embedded in the fixture | 507 239 ± 96 (−0.222 %) |

The committed APL is the better starting point, so all candidates are measured against it.
SEM ≈ 96 DPS at 20 k iters (fixture has `durationVariation: 60`, so noise is higher than a fixed
300 s fight); ≥2σ ⇒ |Δ| > ~270 DPS ≈ 0.05 %.

## Spell / mechanic map (what interacts with what)

Rage economy (max 120 via Glyph of Unending Rage):

| source | amount | notes |
| --- | --- | --- |
| Charge (1250619) | 25 + up to 10 by distance | 12 s CD (Juggernaut −8 s), **off-GCD**, Glyph of Bull Rush +15 |
| Bloodthirst (23881) | +10 on land | 4.5 s CD, no cost |
| Enrage (12880) gain | +10 | on BT/CS/MS crit; also on Berserker Rage |
| Berserker Rage (18499) | +10 (via Enrage) | 30 s CD, **off-GCD** |
| T16 2pc "Colossal Rage" (144436) | +5 per melee special | only while Colossus Smash debuff is up |
| autos / white hits | small | |

Rage sinks, measured value on the fixture (dps per rage):

| spell | cost | dps / rage | notes |
| --- | --- | --- | --- |
| Raging Blow (85288) | 10 | **≈172** | needs a `Raging Blow!` (131116) stack; max 2 stacks, 12 s |
| Execute (5308) | 30 | ≈64 | only < 20 % HP (or T16 4pc Death Sentence, not equipped) |
| Wild Strike (100130) | 30 (0 w/ Bloodsurge) | ≈18.6 | costs a GCD; Bloodsurge also cuts its GCD to 1 s |
| Heroic Strike (78) | 30 | ≈18 | **off-GCD**, 1.5 s shared CD with Cleave |

Damage/buff couplings:

- **Enrage** (6 s, +10 % physical) is the mastery carrier — Unshackled Fury only multiplies physical
  damage *while Enrage is up*. Triggered by BT/CS crit (BT effectively double-crit-rolls) and by
  Berserker Rage. Every Enrage gain also grants a `Raging Blow!` stack (500 ms ICD).
- **Colossus Smash** (20 s CD, 6.5 s debuff) = 100 % armor ignore + Phys Vulnerability + T16 2pc rage
  flood ⇒ the burst window everything else is aligned to.
- **Bloodsurge** (20 % on BT land, 3 stacks, 15 s) ⇒ free 1 s-GCD Wild Strikes.
- **Storm Bolt** (107570, 30 s CD, 5× weapon MH+OH) and **Bladestorm** (46924, 1 min channel, 6×1 s
  ticks MH+OH) are the big burst GCDs; both carry `SpellFlagReadinessTrinket`, so Evil Eye of
  Galakras' CDR shortens them (SB lands every ~20 s in practice, BS every ~45 s).
- **Heroic Leap** (6544) 45 s − 15 s (Glyph of Death from Above) − readiness CDR ⇒ ~20 s, off-GCD,
  0.5×AP: free damage.
- **Flurry** 9 % on melee hit → +25 % melee speed, 3 charges consumed by white hits.
- **Meat Cleaver** (Whirlwind) only matters for multi-target; single-target lines are gated on
  `numberTargets > 1`.

Dead / inert lines with this fixture (confirmed by parse validations):

- `[6] castAllStatBuffCDs(Crit+Str)` — "will not cast any spells" (every stat-buff CD is cast
  manually elsewhere). Note the committed line omits `statType2`, which means **Strength**, not
  "unused" — the fixture's own copy writes `-1` explicitly.
- `[12] Dragon Roar` — not talented (talents `133133` = Bladestorm + Storm Bolt).
- `$Feather:*` variables and the `SkullrenderMed`/`HelmbreakerMed` clauses — those items aren't
  equipped, so the aura lookups are dropped with warnings.
- `[1]` Shattering Throw — the player doesn't know it (raid-external only).

## Measured state of the rotation (single 308 s debug iteration)

| metric | value | reading |
| --- | --- | --- |
| Enrage uptime | 94.9 % | ~15.6 s of downtime = mastery + 10 % phys offline |
| rage gained / wasted to cap | 4901 / 95 (1.9 %) | 16 cap events, minor |
| `Raging Blow!` stacks wasted | 1 expiry with 2 stacks | stack usage already tight |
| Berserker Rage casts | 7.5 per 300 s | 30 s CD ⇒ ~10 possible: **under-used** |
| rotation is GCD-saturated | ~190 GCD casts / 300 s | ⇒ off-GCD damage (HS, Heroic Leap) is free |

## Hypotheses to test

1. Berserker Rage more aggressively (off-GCD, +Enrage, +rage, +RB! stack).
2. Drop the Storm-Bolt-alignment gate on `[21] Colossus Smash`.
3. Bladestorm channel interrupt at 2/4/6 ticks instead of 3.
4. Heroic Strike thresholds (simplify; and stop HS from eating Execute's rage in execute phase).
5. Charge gating (`rage <= maxRage - 35`) vs. charge-on-CD.
6. Remove dead lines (no DPS change expected, hygiene only).

## Results

### Shipped change

`ui/warrior/fury/apls/default.apl.json` — 6 lines changed, 1 removed, 2 added. One APL covers both
level-60 talents (see the talent section). Tunings that help at low target counts but cost at high ones
are gated on `numberTargets <= 3`; the two AoE changes are gated the other way (`numberTargets > 1`).
No configuration regresses:

Two fixtures are used from here on, identical in every slot (all 16 items `UpgradeStepTwo`, same gems,
enchants, reforges and the Synapse Springs tinker) except the first trinket: **Evil Eye of Galakras**
(readiness/CDR) in `p5-fury-fixture.test.json` versus **Skeer's Bloodsoaked Talisman** in
`p5-fury-fixture-nocdr.test.json`. Without the CDR, Storm Bolt goes 30 s (was ~20 s), Heroic Leap 30 s
(was ~20 s) and Bladestorm 60 s (was ~45 s) — Storm Bolt drops from 14.9 to 10.0 casts per fight and
Heroic Leap from 14.9 to 7.7, with the freed globals going to Raging Blow (63.2 → 69.3).

Because the builds differ only by that one item, the absolute numbers are directly comparable, and
**Evil Eye of Galakras is ahead of Skeer's Bloodsoaked Talisman throughout**:

| targets | Galakras | Skeer's | Δ |
| --- | --- | --- | --- |
| 1 | **512 658** | 499 261 | +2.68 % |
| 3 | **598 199** | 587 721 | +1.78 % |
| 6 | **692 623** | 681 652 | +1.61 % |
| 20 | **1 010 738** | 978 737 | +3.27 % |

The same gap shows on the pre-optimisation APL (508 452 vs 496 324, +2.44 % at one target), so it is the
trinket, not the rotation.

| config | Galakras (CDR) | Skeer's (no CDR) |
| --- | --- | --- |
| 1 target | 508 452 → 512 658 (**+0.83 %**) | 496 324 → 499 261 (**+0.59 %**) |
| 3 targets | 570 944 → 657 093 (**+15.09 %**) | 562 093 → 653 415 (**+16.25 %**) |
| 6 targets | 638 422 → 909 468 (**+42.46 %**) | — |
| 20 targets | 809 656 → 1 984 565 (**+145.1 %**) | 793 296 → 1 922 458 (**+142.3 %**) |

Single target moved barely at all; cleave and AoE roughly doubled, almost entirely from finally playing
Meat Cleaver (see the cleave section).
| `p4_fury_tg` (TG, 1 target) | 297 126 | 297 802 | **+0.228 %** |
| `p2_fury_smf` (SMF, 1 target) | 173 281 | 174 351 | **+0.618 %** |
| `p4_fury_tg`, 3 targets | 329 644 | 336 993 | **+2.229 %** |
| `preraid_fury_tg`, 3 targets | 349 944 | 354 998 | **+1.444 %** |
| `preraid_fury_tg` (1 target) | 295 738 | 296 843 | **+0.374 %** |
| `p4_fury_tg` + Dragon Roar talents, NoBuffs, 1 target | 227 025 | 229 897 | **+1.265 %** |
| same, 21 targets (suite's `LongMultiTarget`) | 389 115 | 436 304 | **+12.126 %** |

The eleven edits:

1. **Bladestorm: interrupt after 2 ticks instead of 3.** Biggest single win on the fixture
   (+0.43 %). The channel freezes the rest of the rotation, and Bladestorm ticks are worth less than
   Bloodthirst/Raging Blow, so the tail of the channel is a loss. Monotone in the tick count:
   1 tick −0.21 %, 2 ticks +0.43 %, 3 ticks (old) 0, 4 ticks −0.51 %, 6 ticks −1.65 %; not casting it
   at all on single target is −1.54 %, so 2 is a genuine optimum.
2. **Allow Bladestorm while Bloodsurge is up** (drop `IsInactive(Bloodsurge)` from
   `$Bladestussy: Should Cast`): +0.15 % on top of (1).
3. **Bug fix: gate `$Bladestussy: Should Cast` on `spellIsKnown(Bladestorm)`.** With Dragon Roar
   talented instead of Bladestorm, the channel action inside the group is dropped at parse time but
   the strict sequence keeps its leading `cast Heroic Strike`, and `spellIsReady(Bladestorm)` is also
   dropped from the condition — so the group degenerated into a rogue 30-rage Heroic Strike. Worth
   **+1.19 %** on `p2_fury_smf` (Dragon Roar build) and exactly 0 everywhere Bladestorm is talented.
4. **Recklessness aligned to the Colossus Smash window — at ≤3 targets** (`CS up, or CS ready within
   1.5 s, or last 15 s`) instead of on cooldown: +0.05…0.31 %. Above 3 targets it goes back on cooldown
   (aligning costs −0.22 % there).
5. **Heroic Leap only inside the CS window — at ≤3 targets.** CS grants 100 % armour ignore, and Heroic
   Leap is a physical off-GCD nuke, so its damage scales with the armour-ignore window: +0.08 %. Above 3
   targets the original gate is kept: Heroic Leap carries `SpellFlagAoE`, so at 20 targets it is a
   *major* damage source and starving it costs **−2.0 %** (see the AoE section below).
6. **Heroic Strike thresholds — at ≤3 targets**: 40 rage (was 60) inside the CS window, 80 rage (was 90)
   outside it. Rage that would otherwise cap is worth ~18 dps/rage through HS, and HS costs no GCD.
   Above 3 targets the original 60/90 thresholds stay: rage is better spent on Whirlwind and Execute
   there, and the lowered gates cost −0.86 %.
7. **Front-load the CS window above one target**: Storm Bolt, then Raging Blow (with a stack), ahead of
   Bloodthirst while Colossus Smash is up and `numberTargets > 1`. Inert on one target, and worth
   +0.96 % at 2 targets rising to +10.7 % at 20. See the CS-window section below for why single target
   wants the opposite.
8. **Hold Raging Blow for the CS window above one target**: outside the window, only cast it at 2
   stacks (i.e. about to overcap). Inert on one target, **+2.5 % at 3 targets, +4.7 % at 6 and +12.7 % at
   20** — and near-identical on the no-CDR build (+2.1 / +4.8 / +12.6 %). Multi-target Raging Blow hits
   `Meat Cleaver stacks + 1` targets, so a stack spent outside the window on one target is a stack not
   spent on five inside it. Thresholds are monotone up to "never outside CS": >3 s +3.0 %, >6 s +7.7 %,
   >10 s +10.6 %, >15 s ≡ never +12.7 % (at 20 targets).
9. **Dragon Roar's own line, target-gated** — skip the Colossus Smash window at ≤3 targets and
   Recklessness on a single target (it always crits, so the crit buff is wasted and armour ignore is
   redundant); otherwise cast on cooldown. Worth +0.36 % at one target and +0.13 % at twenty versus the
   old ungated line, and provably ±0.0 for Bladestorm builds because the line is dropped at parse time.
10. **Whirlwind gated on Meat Cleaver stacks and promoted** to the top of the multi-target block, with
    Bladestorm above it; **Raging Blow waits for full stacks** at multi-target, both in the filler slot
    and inside the Colossus Smash window. This is the cleave rework — +9.8 % at 3 targets, +31.3 % at 6,
    +96.3 % at 20, and 0.000 % on a single target.
11. Removed `castAllStatBuffCDs(Crit+Str)` — proven to cast nothing on all five configs (every
   stat-buff cooldown is cast manually elsewhere in the list).

### What did not work

| change | verdict |
| --- | --- |
| Colossus Smash on cooldown (drop the `Raging Blow!`-stack gate) | +0.03 % on the fixture, but **−0.69 / −0.82 / −0.83 %** on p4 TG, p2 SMF, preraid → discarded |
| Skull Banner into the CS window | +0.17 % fixture, −0.11 % p4 TG → discarded |
| Berserker Rage more often (on CD / when out of RB! stacks / stacks < 2) | −0.44 to −0.94 %: it overwrites a live Enrage and converts rage into extra 10-rage Raging Blows |
| Bladestorm only during CS | −1.72 % (wastes the 1 min cooldown) |
| Raging Blow before Bloodthirst at ≥1 stack instead of 2 | −1.49 % |
| Execute after Raging Blow | −0.32 % |
| Wild Strike filler removed / Bloodsurge-only | −0.10 / −0.58 % |
| Charge gating (`rage ≤ max−25`, `≤ max−45`, unconditional) | −0.14 to −0.005 %; the shipped `≤ max−35` is already right |
| Heroic Leap / Storm Bolt / Heroic Throw on cooldown | −0.22 %, 0 %, −0.09 % |
| Simplified Heroic Strike condition | −0.13 % |
| Potion or Blood Fury forced into the CS window | ±0.02 % (noise) |
| Synapse Springs requiring CS *active* | −0.52 % (it should fire when CS is *ready*) |
| `allowRecast` on the Bladestorm channel | exactly 0 |

### Traps hit along the way

- **Single-fixture tuning overfits.** The first stacked candidate was +1.34 % on the p5 fixture and
  −0.55 / −2.45 / −0.35 % on the other three gear sets. Every candidate has to be run across a
  gear/talent/target matrix before it can be called a win.
- **Deleting "dead" lines is only safe once you know why they're dead.** Removing the fallback
  Colossus Smash line `[21]` is free *only* when line `[16]` casts CS unconditionally; keeping the
  stack gate and deleting `[21]` cost −3.5 to −5.4 %. Removing the Dragon Roar line is free only for
  Bladestorm builds.
- `go test` caches results — the second sweep silently replayed the first one until `-count=1`.
- **A ≤6-target matrix is not an AoE check.** The first shipped stack was positive at 1–20 targets on
  the p5 fixture but **−3.09 %** on the suite's own 21-target case with different gear and talents.
  Heroic Leap was −2.0 % of it (10.0 → 7.3 casts) and the Heroic Strike / Recklessness tunings the rest.
  The repo's `LongMultiTarget` fixture was what caught it — run the spec's own suite before believing an
  APL change, not only your own harness.

## Talent row 4: one APL for both

Row 4 is `1` Bladestorm / `2` Shockwave / `3` Dragon Roar. Dragon Roar is a different animal: 1 min CD,
one GCD, no rage, `BonusCritPercent: 100` (**always** crits) and `SpellFlagIgnoreArmor`, with AoE falloff
(1 / 0.75 / 0.65 / 0.55 / 0.50 by target count).

`default.apl.json` now covers both talents, so there is no separate Dragon Roar preset:

- the Bladestorm block (group, group reference, AoE line, `Bladestussy` variables) is gated on
  `spellIsKnown(Bladestorm)`, which folds to false at parse time for a Dragon Roar build — the whole
  block goes inert, including the stray Heroic Strike that used to leak out of it;
- the Dragon Roar line is dropped at parse time when Bladestorm is talented, so its condition can be
  tuned freely without touching Bladestorm builds (verified: **exactly ±0.0 DPS** at 1/3/20 targets on
  both fixtures);
- Dragon Roar's own condition is
  `currentTime >= 1.5s AND (numberTargets > 3 OR !ColossusSmash) AND (numberTargets > 1 OR !Recklessness OR remainingTime <= 15s)`.
  It always crits, so Recklessness' +30 % crit is wasted on it, and its armour ignore is redundant while
  Colossus Smash is up — but both avoidances only pay at low target counts, so they are gated. Measured
  (Dragon Roar talents, Galakras / Skeer's):

  | Dragon Roar line | 1 target | 3 targets | 20 targets |
  | --- | --- | --- | --- |
  | on cooldown | 506 288 / 493 582 | 600 662 / 588 082 | 1 068 385 / 1 014 743 |
  | avoid CS window (old default) | 506 469 / 493 673 | **601 154 / 588 712** | 1 066 928 / 1 013 208 |
  | avoid CS + Recklessness | **508 288 / 495 555** | 600 620 / 588 079 | 1 054 913 / 1 002 244 |
  | **shipped, target-gated** | **508 288 / 495 555** | **601 154 / 588 712** | **1 068 385 / 1 014 743** |

The merged APL versus the pre-optimisation original, at 50 000 iterations per arm:

| build | talent | 1 target | 3 targets | 20 targets |
| --- | --- | --- | --- | --- |
| Galakras | Bladestorm | +0.825 % | +4.774 % | +24.782 % |
| Galakras | Dragon Roar | +1.200 % | +3.430 % | +18.401 % |
| Skeer's | Bladestorm | +0.583 % | +4.594 % | +23.403 % |
| Skeer's | Dragon Roar | +1.080 % | +3.421 % | +17.885 % |

Which talent to pick, on the merged APL (Galakras / Skeer's): Bladestorm leads by 0.83 % / 0.74 % on one
target; Dragon Roar leads by 0.49 % / 0.15 % at three and 5.76 % / 3.67 % at twenty. Shockwave is never
competitive (−2.33 % at one target, −0.09 % at three).

## Cleave and AoE: actually playing Meat Cleaver

Meat Cleaver was the biggest hole in the list. The mechanic (`sim/warrior/fury/passives.go`,
`raging_blow.go`):

- each **Whirlwind** hit adds one Meat Cleaver stack (max 3, 10 s, 500 ms trigger ICD);
- **Raging Blow** with the aura up hits `min(stacks + 1, active targets)` targets — and **consumes the
  whole aura**, all stacks, on that one cast.

So the cleave engine is: Whirlwind up to `min(3, targets - 1)` stacks, then spend one Raging Blow across
that many targets. The old list had `numberTargets > 1 → cast Whirlwind` as the *second-to-last* line,
below every single-target filler, and Raging Blow with no stack awareness at all — so Raging Blow was
usually spent with the aura down or half-built.

Four changes, all gated `numberTargets > 1` and therefore provably inert on a single target
(**exactly 0.000 %** on the p5 fixture, `p4_fury_tg` and Skeer's):

1. **Whirlwind gated and promoted**: cast it while
   `MeatCleaver stacks < min(3, numberTargets - 1)` *and* a `Raging Blow!` stack is banked to spend,
   moved to the top of the multi-target block. Never cast at the cap (a capped stack is a wasted GCD).
2. **Bladestorm first** in the multi-target block, above Whirlwind — it is exempt from the AoE cap.
3. **Filler Raging Blow waits for the stacks**: at multi-target it requires
   `MeatCleaver stacks >= min(3, numberTargets - 1)`, or 2 `Raging Blow!` stacks (about to overcap), or
   the Colossus Smash window.
4. **The CS-window Raging Blow also requires full stacks**, so the front-load doesn't dump a 1-target
   Raging Blow inside the window.

Result on the p5 (Galakras) fixture:

| targets | before | after | Δ |
| --- | --- | --- | --- |
| 1 | 512 658 | 512 658 | 0.000 % |
| 2 | 547 688 | 566 178 | **+3.376 %** |
| 3 | 598 199 | 657 093 | **+9.845 %** |
| 4 | 632 035 | 742 150 | **+17.422 %** |
| 6 | 692 623 | 909 469 | **+31.308 %** |
| 10 | 784 084 | 1 216 698 | **+55.174 %** |
| 20 | 1 010 738 | 1 984 565 | **+96.348 %** |

How the whole pass accumulated, versus the original APL (30 000 iterations per point):

| targets | original | + single-target tuning | + CS front-load & RB banking | + cleave rework |
| --- | --- | --- | --- | --- |
| 1 | 508 452 | +0.83 % | +0.83 % | +0.83 % |
| 2 | 541 510 | +0.38 % | +1.14 % | +4.56 % |
| 3 | 570 944 | +0.37 % | +4.77 % | +15.09 % |
| 4 | 598 414 | 0.00 % | +5.62 % | +24.02 % |
| 6 | 638 422 | 0.00 % | +8.49 % | +42.46 % |
| 10 | 687 218 | 0.00 % | +14.10 % | +77.05 % |
| 20 | 809 656 | 0.00 % | +24.84 % | +145.11 % |

And on every other bed: Skeer's +11.18 % at 3 / +96.42 % at 20; `p4_fury_tg` +12.38 % at 3 / +32.77 % at
6; `preraid_fury_tg` +10.18 % at 3; `p2_fury_smf` +5.71 % at 3; Dragon Roar talents +7.43 % at 3 /
+51.15 % at 20; the suite's 21-target no-buffs case +59.89 %.

The cast profile at 6 targets shows the engine running (per 300 s iteration):

| | before | after |
| --- | --- | --- |
| Whirlwind casts | 30.7 | **75.6** |
| Raging Blow casts | 57.4 | 29.8 |
| Raging Blow MH hits | 87.3 | **102.3** |
| targets per Raging Blow | 1.5 | **3.4** |
| Bloodthirst / Heroic Strike / Wild Strike casts | 50.6 / 87.1 / 21.1 | 31.5 / 45.2 / 2.3 |

Fewer Raging Blow casts, more Raging Blow hits — the globals and rage move into Whirlwind, and each
Raging Blow is spent across ~3.4 targets instead of 1.5.

What did not help: requiring 3 stacks regardless of target count (−7.9 % at 2 targets, since 1 stack
already covers 2 targets), suppressing Heroic Strike above 3 or 6 targets (−1.5 pp at 10 targets),
suppressing Wild Strike or Execute at multi-target, and moving Bladestorm above Bloodthirst
(−5 pp at 6 targets).

## Packing the Colossus Smash window

The 6.5 s armour-ignore window is ~4 globals wide. Per-cast damage on the fixture makes the ordering
look obvious — Storm Bolt ≈ 1 465 k per cast, Execute ≈ 575 k, Raging Blow ≈ 518 k, Bloodthirst ≈ 169 k,
Wild Strike ≈ 167 k, Heroic Strike ≈ 163 k — and yet the shipped list casts **Bloodthirst first** inside
the window. So: is front-loading the big hits better? Measured, 30 000 iterations per arm:

| in-CS change (ungated) | p5 1 target | p5 3 targets | p4_fury_tg 1 target |
| --- | --- | --- | --- |
| Storm Bolt before Bloodthirst | −0.518 % | +1.000 % | −0.171 % |
| Raging Blow before Bloodthirst | −0.585 % | +1.184 % | −1.013 % |
| Execute before Bloodthirst | −0.164 % | −0.137 % | −0.111 % |
| Storm Bolt + Raging Blow first | −2.136 % | +1.826 % | −1.240 % |
| Storm Bolt + Execute + Raging Blow first | −2.261 % | +1.739 % | −1.285 % |
| no Wild Strike inside CS | +0.007 % | +0.011 % | −0.043 % |
| hold Storm Bolt for the CS window | 0.000 % | +0.002 % | −0.940 % |
| hold Raging Blow for the CS window | −0.378 % | +0.960 % | −0.584 % |

**On one target the existing order is already optimal** — every front-load variant loses. Bloodthirst
is not in front for its damage: it is a 4.5 s cooldown that pays +10 rage, an Enrage refresh (mastery,
+10 % physical) and a `Raging Blow!` stack, plus the Bloodsurge and Deep Wounds rolls. Delaying it
inside a 6.5 s window pushes that whole engine back, and the ~35 % armour-ignore bonus on one big hit
does not cover the loss. Holding Storm Bolt or Raging Blow *for* the window is likewise a wash or worse:
their cooldowns are short relative to CS's 20 s, so they land in a window anyway.

Above one target the arithmetic flips, so the front-load is shipped **gated on `numberTargets > 1`**:

| targets | Δ from gating Storm Bolt + Raging Blow ahead of Bloodthirst inside CS |
| --- | --- |
| 1 (p5, `p4_fury_tg`, `p2_fury_smf`) | 0.000 % — the gate is inert |
| 2 | +0.958 % |
| 3 | +1.826 % (and +2.153 % on `p4_fury_tg`) |
| 6 | +3.633 % |
| 20 | +10.742 % |
| 21, `p4_fury_tg` + Dragon Roar, no buffs | +4.907 % |

## Dragon Roar and the AoE cap

The original design note for Dragon Roar reads: 100 % / 75 % / 65 % / 55 % / 50 % per target at
1/2/3/4/5+ targets, and a cap where the *total* stops growing and is split among everyone.

Measured (p5 fixture, damage per Dragon Roar cast, 2000 iterations per point) — the falloff table is
implemented correctly, the cap was not implemented at all:

| targets | dmg/cast | × single target | per target |
| --- | --- | --- | --- |
| 1 | 518 303 | 1.00× | 100 % |
| 2 | 758 494 | 1.46× | 73 % |
| 3 | 980 549 | 1.89× | 63 % |
| 4 | 1 104 182 | 2.13× | 53 % |
| 5 | 1 251 733 | 2.42× | 48 % |
| 10 | 2 501 278 | 4.83× | 48 % |
| 12 | 2 993 365 | 5.78× | 48 % ← should have stopped growing |
| 20 | 4 992 680 | 9.63× | 48 % ← 1.93× too much |

Cause: the encounter AoE cap (`min(20/activeTargets, 1)`, `sim/core/target.go:107`) is applied only to
spells carrying `SpellFlagAoE` (`spell_result.go:240`), and Dragon Roar did not carry it. In warrior,
only Whirlwind, Heroic Leap, Shockwave and Thunder Clap did.

Fix: `SpellFlagAoE` added to Dragon Roar (`sim/warrior/talents.go`). Verified — total damage now
plateaus at 9.63× from 20 targets on (21 → 9.64×, 25 → 9.63×, 30 → 9.64×) with the per-target share
falling 48 % → 46 % → 39 % → 32 % as it splits. Behaviour at ≤20 targets is bit-identical, and the
Arms and Protection suites pass untouched.

**Bladestorm is exempt from the AoE cap** and keeps no `SpellFlagAoE`; the threshold is 20 targets, not
the 10 in the original note.

## Structural pass: groups and variables

A second, **behaviour-free** pass reorganised the list into action groups and value variables. It moves
no priority, changes no threshold and adds no line — it only names things and removes duplication.
Priority list: **36 → 25 lines**; `valueVariables` 6 → 17; `groups` 1 → 8.

### New variables

| variable | value | replaces |
| --- | --- | --- |
| `AoE: Multi Target` | `numberTargets > 1` | 6 inline copies |
| `AoE: Cleave Or Less` | `numberTargets <= 3` | 7 inline copies (`> 3` written as `not(...)`) |
| `RB: Stacks` | `auraNumStacks(131116, reaction)` | **16** inline copies |
| `MC: Stacks` | `auraNumStacks(85739, reaction)` | 3 |
| `MC: Stacks Wanted` | `min(3, numberTargets - 1)` | 3 |
| `MC: Stacks Full` | `MC: Stacks >= MC: Stacks Wanted` | 3 (one as `not(...)`) |
| `CS: Applied` | `auraIsActive(86346, target)` — **no** reaction delay | 4 |
| `CS: Active` | `auraIsActive(86346, target, reaction)` | **12** |
| `CS: Remaining` | `auraRemainingTime(86346, target)` | 5 |
| `CS: Time To Ready` | `spellTimeToReady(86346)` | 8 |
| `CS: Dump Window` | `CS: Last GCDussy or remainingTime <= 3s` | 3 |

`CS: Applied` and `CS: Active` are the same aura and are **not** interchangeable: the reacted form
(`includeReactionTime`) is what every gate outside the `CS: Last *` family uses, and the raw form is what
the `CS: Last *` variables and the Heroic Strike line use. Keep them apart.

The three `CS: Last * GCDussy` variables and `Bladestussy: Should Cast` were rewritten on top of
`CS: Applied` / `CS: Remaining` / `CS: Active`, so the debuff id `86346` now appears **4 times** in the
file instead of 29. Same for `131116` (1 instead of 16) and `85739` (1 instead of 3) — retuning a
threshold is now a one-place edit.

### New groups

| group | lines folded in | hoisted condition |
| --- | --- | --- |
| `CDs: Buffs` | potion, Synapse Springs, Blood Fury, `126734` | — |
| `CDs: Offensive` | Berserker Rage, Recklessness, Heroic Leap | — |
| `CS: Last GCD Dump` | Storm Bolt, Execute | — |
| `AoE: Cleave Builders` | Bladestorm, Whirlwind | **`AoE: Multi Target`** |
| `CS: Last 2 GCDs Dump` | Storm Bolt, Execute, Raging Blow | — |
| `CS: Multi-Target Front Load` | Storm Bolt, Raging Blow | **`AoE: Multi Target and CS: Active`** |
| `Filler: Utility` | Heroic Throw, Battle Shout | — |

Only consecutive lines were folded, because ordering *is* the logic. Two groups additionally factor out
a condition that every member shared, which is exactly equivalent: a group reference is ready when
`condition && any(inner ready)` and executes the first ready inner action
(`apl_action_group_reference.go`), so `{C, group[(c1,a1),(c2,a2)]}` ≡ the inlined
`{C∧c1,a1}, {C∧c2,a2}`.

### Why this is free

- `removeFromMajorCooldowns` walks `allAPLActions()`, which **includes group actions** (`apl.go:400`),
  so moving the potion / Synapse Springs / Blood Fury / Recklessness / Berserker Rage / Heroic Leap casts
  into groups keeps them out of `autocastOtherCooldowns`. Verified: the `Autocast Other Cooldowns will
  cast the following spells:` validation is character-for-character identical before and after.
- All refs to one variable share a cache invalidated once per `getNextAction`, so a variable used 16
  times is evaluated once — strictly cheaper than the inline version, never different.
- `nextActionWouldRecastChannel` only recognises `castSpell` / `channelSpell` impls in the priority list,
  so wrapping casts in groups could in principle change a channel-interrupt decision. It cannot here:
  the Bladestorm `channelSpell` already lives inside a group, so that function can never detect a
  Bladestorm recast, and `allowRecast` is unset — the interrupt outcome is fixed either way.

### Parity evidence

Deterministic A/B (seed 1, 3 000 iterations, `p4_fury_tg`, Engineering, full buffs), pre-refactor file
versus post-refactor file:

| talents | 1 tgt | 2 | 3 | 6 | 20 |
| --- | --- | --- | --- | --- | --- |
| Bladestorm (TG) | 295 482.026 | 331 267.959 | 374 935.883 | 510 228.719 | 1 117 614.948 |
| Dragon Roar (SMF) | 293 462.271 | 325 790.921 | 362 625.510 | 458 925.922 | 902 741.370 |

**Δ = +0.000000 DPS in all ten cases** — bit-identical, not within-noise. The full `TestFury` suite output
(674 assertion lines across every race / gear set / talent / buff / target combination) is also
byte-identical before and after, and the APL parse validations are the same eight warnings, merely
re-attributed from priority lines to group lines.

### Left alone deliberately

- `numberTargets == 1` on the Bladestorm group reference was **not** rewritten to `not(AoE: Multi Target)`.
  The two are equal for any encounter, but the literal form is already readable and rewriting it buys
  nothing.
- `isExecutePhase(E20)` (11 uses) stayed inline — it is already a single leaf node, so a variable would
  add a hop without shortening anything.
- No group was factored for reuse across two call sites. `CS: Last GCD Dump` and `CS: Last 2 GCDs Dump`
  look like the same Storm-Bolt-then-Execute pair, but their per-action gates differ (`Feather: Last HS`
  vs `Feather: Last`, and the third member), so parameterising them with `variablePlaceholder` would need
  three placeholders and read worse than two explicit groups.

### Discrepancy to settle

Shipped edit **1** above (Bladestorm interrupt after **2** ticks, +0.43 %) is **not** in the file — both
`interruptIf` conditions in `Bladestussy: Cast` still read `spellChanneledTicks == 3`, unchanged from
`HEAD`. Edits 2 and 3 (allow Bladestorm during Bloodsurge, `spellIsKnown(Bladestorm)` gate) *were*
already in `HEAD` before this pass. So either edit 1 was reverted or never applied; if the +0.43 % is
wanted, both `"val":"3"` occurrences in that group need to become `"2"`.

### Fixtures

`sim/warrior/fury/TestFury.results` is now stale by design (`Average-Default` 294 715 → 295 292,
+0.20 %). Regenerate with `make update-tests` when you're happy with the change — I did not touch it.
The `LongMultiTarget` cases are unchanged, and `sim/warrior/arms` + `sim/warrior/protection` pass as-is.

