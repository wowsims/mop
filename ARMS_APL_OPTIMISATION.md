# Arms Warrior APL optimisation (p5 fixture)

Working notes, same shape as `FURY_APL_OPTIMISATION.md`. Test bed: `p5-arms-fixture.test.json`
(Orc, SoO HWF gear, Xal'atoh 2H, talents `113132` = Bladestorm + Bloodbath, Glyphs of Bull Rush /
Unending Rage / Death from Above, Engineering + Blacksmithing, Thok's Tail Tip + Evil Eye of
Galakras, 300 s ±60 s, reaction time 100 ms).

Harness: `sim/warrior/arms/zz_apl_fixture_test.go` (temporary, deleted at the end). Reads a JSON job
list from `$ARMS_JOBS`, writes TSV to `$ARMS_OUT`; jobs can load an `IndividualSimSettings` fixture
*or* a committed gear set, swap in an APL, set the target count, dump parse validations, or dump a
per-spell/aura/resource behaviour profile. Always `go test --tags=with_db -count=1`.

Reports: [single-target pass](https://claude.ai/code/artifact/e2976a6b-138c-4692-81be-b6316ee1a54e) ·
[multi-target pass](https://claude.ai/code/artifact/3eccc581-6b56-49e0-ba35-ca6193d7dcdf).
Offline copies of both, self-contained and openable from disk: `arms-st-report.html`,
`arms-aoe-report.html` (same shape as `fury-trinket-report.html` — no CDN, no external assets, own
light/dark toggle).

## Fixtures

Three fixtures, identical in every slot except trinket 2:

| file | trinket 2 | what it does |
| --- | --- | --- |
| `p5-arms-fixture.test.json` (existing) | Evil Eye of Galakras `105491` | +1 %/stack cooldown recovery, 11 761 Str proc |
| `p5-arms-fixture-nocdr.test.json` (**new**) | Skeer's Bloodsoaked Talisman `105632` | Cruelty: +1 402 crit / 0.5 s, 20 stacks, 10 s |
| `p5-arms-fixture-ffc.test.json` (**new**) | Fusion-Fire Core `105459` | attacks cleave to 5 targets, 14 039 Str proc |

The two new fixtures are a one-line derivation of the existing one (trinket id swapped), so absolute
DPS is directly comparable. The fixture's embedded rotation is byte-identical to committed
`ui/warrior/arms/apls/arms.apl.json`, so there is a single baseline.

Baseline (20 000 iterations, seed 1):

| targets | Galakras | Skeer's | Fusion-Fire Core |
| --- | --- | --- | --- |
| 1 | 445 027 | **446 755** | 431 788 |
| 2 | **654 892** | 616 340 | 622 024 |
| 3 | **745 466** | 683 811 | 720 099 |
| 4 | **872 555** | 789 121 | 856 616 |
| 6 | 1 097 453 | 974 540 | **1 132 200** |
| 10 | **1 525 101** | 1 314 695 | 1 522 845 |
| 20 | **2 603 617** | 2 172 033 | 2 517 256 |

**On a single target Galakras is the worst of the three** (Skeer's +0.39 %, Fusion-Fire −2.98 %); from
two targets up it leads except at six, where Fusion-Fire's cleave passes it. Note the multi-target
column is contaminated by the rotation bug below — Skeer's and Fusion-Fire were never playing the AoE
rotation. See the corrected picture at the end.

## Spell / mechanic map

| spell | id | cost | notes |
| --- | --- | --- | --- |
| Mortal Strike | 12294 | free, +10 rage | 6 s CD, grants **2** Taste for Blood stacks on land |
| Overpower | 7384 | 10 | **GCDMin (1 s)**, +60 crit, needs a TfB stack, cuts MS CD by 0.5 s |
| Slam | 1464 | 25 | GCDDefault, ×1.1 inside Colossus Smash, cleaves at 35 % under Sweeping Strikes |
| Execute | 5308 | 30 | execute phase only |
| Heroic Strike | 78 | 30 | **off-GCD** |
| Cleave | 845 | 30 | **off-GCD**, hits every target |
| Colossus Smash | 86346 | free | 20 s CD, 6.5 s debuff, 100 % armour ignore; **Sudden Death resets it** |
| Sweeping Strikes | 1250616 | 30 | **off-GCD**, 10 s CD, 10 s duration; copies one non-AoE hit at 50 % |
| Thunder Clap | 6343 | 20 (−10 Seasoned Soldier) | 6 s CD, `SpellFlagAoE` |
| Heroic Leap | 6544 | free | **off-GCD**, `SpellFlagAoE` |
| Bladestorm | 46924 | free | 1 min channel |
| Bloodbath | 12292 | free | 1 min CD, bleed |

Passives that drive everything (`sim/warrior/arms/passives.go`):

- **Strikes of Opportunity** (mastery, `76858`) — 0.55 weapon damage on any melee land, 100 ms ICD.
  **16.0 % of single-target damage**, driven purely by melee hit count. This is why off-GCD filler and
  even the zero-damage Pummel are worth real DPS.
- **Sudden Death** (`52437`) — 10 % on white hits and mastery procs, **resets the Colossus Smash
  cooldown**. 46.2 procs per fight; CS is cast 33 times, so CS is proc-driven, not cooldown-driven.
- **Taste for Blood** (`60503`) — MS grants 2 stacks (max 5, 12 s), Overpower spends one.
- **Sudden Execute** (`139958`) — Execute land → Overpower cost reduction for 10 s.
- **Enrage** (`12880`) — +10 % physical and +10 rage, 6 s, on **crit** of MS or CS (or Berserker Rage).
  72.7 % uptime, and the crit rolls are what cap it, not the rotation.
- **Seasoned Soldier** (`12712`) — permanent +25 % physical with a 2H equipped.

Dead / pruned lines on this talent build (identical validations on all three fixtures):

- `[7]` Dragon Roar and `[19]` Storm Bolt — not talented, so pruned at parse time. `[17]`'s
  `!spellIsKnown(118000)` folds to true. **Not deletable** — live for other talent rows.
- `castAllStatBuffCooldowns(Strength)` and `(CritRating)` — both *"will not cast any spells"*: every
  stat-buff cooldown this character owns is cast manually elsewhere. See the AoE section for why this
  is more than cosmetic.
- Folded to false on this gear: `58356`, `58384` (Thunder Clap / Slam glyphs), `138126`/`138127`,
  `138759`, `123142`, item `81268`, items `93256`/`93261`.

## Measured state of the rotation (single target, Galakras, 3 000 iterations)

| metric | value | reading |
| --- | --- | --- |
| GCD-consuming casts | ~218 per 300 s (~1.37 s/global) | **saturated** — no spare global |
| rage generated / spent / wasted | 4 480 / 4 407 / 51 (1.1 %) | **balanced** — no spare rage |
| Colossus Smash debuff uptime | 68.7 % (33.0 casts × 6.5 s) | clipping already ≈ 0 |
| Deep Wounds uptime | 99.7 % | fine |
| Taste for Blood uptime | 95.5 % | fine |
| Enrage uptime | 72.7 % (48.3 procs) | crit-bound, not rotation-bound |
| Heroic Strike share of rage spent | 2 747 of 4 407 (62 %) | off-GCD, so it costs no globals |

Damage per rage: Overpower ≈ 17 960, Execute ≈ 17 020, Slam ≈ 16 070, **Heroic Strike ≈ 4 400**. The
obvious conclusion (move rage off Heroic Strike) is wrong, because the globals to spend it don't exist
and because Heroic Strike feeds mastery procs — suppressing it costs **9.5–10.1 %**.

## Single-target pass: nothing shipped

35 candidate edits, each measured alone on all three fixtures. Screening at 30 000 iterations
(2σ ≈ 0.053 %), anything near the threshold re-run at 100 000 (2σ ≈ 0.030 %).

Best candidates (Galakras / Skeer's / Fusion-Fire, 100 k):

| candidate | Δ |
| --- | --- |
| Heroic Strike floor 100 → 70 rage **+** Overpower during Recklessness | +0.108 / +0.083 / +0.144 % |
| same at 65 rage | +0.102 / +0.094 / +0.114 % |
| Heroic Strike floor 100 → 70 rage alone | +0.039 / +0.068 / +0.059 % |
| Overpower during Recklessness alone | +0.028 / −0.010 / +0.058 % |

Then the cross-bed check that the Fury pass insists on — same edits gated to `numberTargets == 1`,
60 000 iterations on the repo's own gear sets (2σ ≈ ±0.034 %):

| bed | baseline | Δ |
| --- | --- | --- |
| `p5_arms_bis`, full buffs | 439 554 | **+0.090 %** |
| `p5_arms_bis`, no buffs | 373 630 | **−0.077 %** |
| `p4_arms_bis`, full buffs | 267 496 | **−0.121 %** |
| `p4_arms_bis`, no buffs | 227 579 | **−0.250 %** |

Four wins, three losses, all past 2σ. A +0.1 % edit that flips sign with the buff set is a fit to one
bed, not a rotation improvement — **so the single-target list was left unchanged**.

### What the losses proved (all three fixtures)

| change | verdict |
| --- | --- |
| Never Heroic Strike on a single target | **−9.5 / −10.1 / −10.0 %** |
| Slam above Overpower inside the CS window | −2.67 / −2.35 / −2.69 % |
| Never Bladestorm on a single target | −2.68 / −2.24 / −2.31 % |
| Colossus Smash the moment it is ready | −1.39 / −1.22 / −1.25 % |
| Only recast Colossus Smash once expired | −1.02 / −0.77 / −0.77 % |
| **Drop the off-GCD Pummel filler** | **−0.79 / −0.76 / −0.83 %** — a zero-damage spell worth 0.8 % |
| Cap the Bladestorm channel at 1 / 2 ticks | −0.82 / −0.72 % (the existing `interruptIf` is better) |
| In-CS Heroic Strike floor 50 → 30 rage | −0.68 / −0.92 / −0.99 % |
| Refresh Colossus Smash at ≤ 1.5 s / 2 s / 3 s left | −0.09…−0.39 % (monotone; shipped ≤ 1 s is the peak) |
| Berserker Rage without the CS gate / 1 s early | −0.12…+0.01 % |
| Hold Recklessness or Bloodbath for the CS window | noise (the Bloodbath gate is provably inert, ±0.000 %) |
| Slam above Overpower in the trailing filler | noise |

Two traps worth recording:

- **Colossus Smash refresh timing is a genuine local optimum.** Both directions lose, monotonically.
  CS is reset by Sudden Death 46 times a fight but only cast 33 times; the wasted resets are
  unavoidable, because a reset only helps when the debuff is *not* already up.
- **Overpower must stay ahead of Slam.** Slam does 2.2× the damage per cast, but Overpower runs on a
  1 s global instead of 1.5 s, costs 10 rage instead of 25, and shortens Mortal Strike.

## Multi-target pass: the shipped change

Five edits, all target-gated, all **provably** inert on a single target — `TestArms` reports
byte-identical results for every single-target assertion.

### 1. The AoE Bladestorm block was gated on one trinket (the big one)

Priority line `[11]` is `numberTargets > 1 → group "AoE  BladestUwU"`. Five branches; a
`strictSequence` is ready only when its **first action is ready and every spell in it is off
cooldown** (`sim/core/apl_actions_sequences.go:156`):

| branch | why it can't run |
| --- | --- |
| `[0]` Synapse Springs → Bloodbath → Bladestorm | needs all three simultaneously, and `[6]` casts Synapse Springs on cooldown from a line above |
| `[1]` Bloodbath → Bladestorm | gated on `auraIsKnown(145990)` — **Evil Eye of Galakras' own readiness aura**, folded to false at parse time on any other trinket |
| `[2]` `[3]` `castAllStatBuffCDs(Crit)` → … | that action's spell list is empty here, so `IsReady` returns false forever and the sequence can never begin (also gated on a crit on-use trinket nobody has) |
| `[4]` Berserker Rage → Bladestorm | `currentTime < 5 s` — the opener |

So without Galakras only the opener fires. Measured (Skeer's, 6 targets): **Bladestorm 1.2 casts per
300 s, Bloodbath 1.2** — and at 20 targets that single Bladestorm is still 6.95 % of all damage.

Fix: delete `auraIsKnown(145990)` from branch `[1]`. Bladestorm and Bloodbath go to 5.4 casts;
Bladestorm's damage share at 6 targets goes 4.7 % → 13.0 %.

| targets | Galakras | Skeer's | Fusion-Fire |
| --- | --- | --- | --- |
| 1 | 0.000 % | 0.000 % | 0.000 % |
| 2 | 0.000 % | +6.02 % | +5.85 % |
| 3 | 0.000 % | +7.64 % | +7.42 % |
| 6 | 0.000 % | +10.51 % | +10.26 % |
| 20 | 0.000 % | **+16.11 %** | **+15.76 %** |

Exactly 0.000 % on Galakras at every target count — the gate was already true there, so this cannot
regress the build it was written for.

Also tested and **rejected**: additionally deleting branch `[0]` (marginally worse, so the
Synapse-bundling branch stays), and promoting the group above Sweeping Strikes / Thunder Clap
(−1.2…−2.3 %: it is a strict sequence, so promoting it stalls the rotation waiting for two cooldowns).

### 2. Cleave takes the off-GCD rage from 6 targets up (+0.4…3.8 %)

Both Cleave and Heroic Strike are off-GCD 30-rage dumps; Cleave hits everything. The shipped list only
let Cleave fire at 100+ rage outside the CS window, so it was cast **0.7 times per fight at six
targets**. Giving it Heroic Strike's slot above a threshold, per target count:

| targets | Galakras | Skeer's | Fusion-Fire |
| --- | --- | --- | --- |
| 2 | −5.59 % | −4.00 % | −3.84 % |
| 3 | −1.39 % | +0.28 % | +0.37 % |
| 4 | −0.57 % | +1.17 % | +1.27 % |
| 5 | −0.02 % | +1.68 % | +1.87 % |
| 6 | +0.38 % | +1.73 % | +1.96 % |
| 10 | +1.02 % | +2.36 % | +2.84 % |
| 20 | +1.83 % | +3.34 % | +3.77 % |

Shipped threshold: **6**, the lowest count where all three builds gain. 5 is a coin flip (Galakras
−0.02 % vs +1.7/+1.9 % elsewhere) and 2 is a disaster. Letting Cleave fire cheaply *without* taking
Heroic Strike's slot is −0.24…−0.38 % — they then compete for the same rage.

### 3. Heroic Leap on cooldown at 4–9 targets (+0.37…1.38 %)

`SpellFlagAoE` and off-GCD, so nearly free; the shipped list restricted it to the CS window.
+0.41 / +1.38 / +0.61 % at 4 targets and +0.37 / +1.38 / +0.58 % at 6. **Ungated it is −0.11 % on
Galakras at 20 targets** (the encounter AoE cap has eaten the extra casts), hence the `< 10` cap.

### 4. Reserve 30 rage for Sweeping Strikes (+0.06…0.21 %)

Sweeping Strikes is off-GCD, 30 rage, 10 s cooldown, 10 s duration — 100 % uptime is available, but
Heroic Strike spent the rage first and uptime sat at 86–89 %. Requiring 80 rage for Heroic Strike while
Sweeping Strikes is off cooldown lifts it to 90.9 %. Positive above 2σ on all three builds at 2, 3, 4,
6, 10 and 20 targets; 0.000 % at one.

### 5. No Execute from 6 targets up (+0.07…0.41 %)

+0.13 / +0.08 / +0.07 % at 6, +0.27 / +0.21 / +0.21 % at 10, +0.41 / +0.38 / +0.39 % at 20. At four
targets it is a loss (−0.06…−0.16 %), so the gate is 6, not 4.

### Thunder Clap: left alone

The shipped list casts it unconditionally from 6 targets. Lowering that threshold: −3.9…−4.5 % at 2,
−0.9…−1.2 % at 3, −0.27 / +0.04 / +0.15 % at 4, −0.08 / +0.37 / +0.58 % at 5. Already right.

## The stack

`ui/warrior/arms/apls/arms.apl.json` — **8 lines changed, none added or removed**. Same eight parse
warnings as before, minus the `145990` lookup.

p5 fixtures, 30 000 iterations per point:

| targets | Galakras | Skeer's | Fusion-Fire |
| --- | --- | --- | --- |
| 1 | **+0.000 %** | **+0.000 %** | **+0.000 %** |
| 2 | +0.06 % | +6.14 % | +6.02 % |
| 3 | +0.08 % | +7.74 % | +7.56 % |
| 4 | +0.51 % | +10.09 % | +9.25 % |
| 5 | +0.54 % | +11.19 % | +10.38 % |
| 6 | +0.74 % | +12.35 % | +11.67 % |
| 10 | +1.45 % | +15.29 % | +15.56 % |
| 20 | +2.60 % | +19.58 % | +19.81 % |

The repo's own gear sets, 60 000 iterations (`p5_arms_bis` has Galakras, `p4_arms_bis` does not):

| bed | 1 target | 2 | 3 | 21 |
| --- | --- | --- | --- | --- |
| `p5_arms_bis`, full buffs | **+0.000 %** | +0.07 % | +0.09 % | +2.85 % |
| `p5_arms_bis`, no buffs | **+0.000 %** | +0.09 % | +0.08 % | +3.59 % |
| `p4_arms_bis`, full buffs | **+0.000 %** | +7.97 % | +9.64 % | **+24.88 %** |
| `p4_arms_bis`, no buffs | **+0.000 %** | +8.55 % | +10.38 % | **+25.85 %** |

## Suite

`go test --tags=with_db -run 'TestArms$'` reports **8 DPS differences out of 2 203 assertions, and all
eight are the `LongMultiTarget` (21-target) cases**:

| case | expected | now | Δ |
| --- | --- | --- | --- |
| Orc `p4_arms_bis` FullBuffs | 1 448 301 | 1 808 336 | **+24.86 %** |
| Worgen `p4_arms_bis` FullBuffs | 1 457 891 | 1 771 827 | +21.53 % |
| Orc `p4_arms_bis` NoBuffs | 1 224 551 | 1 436 346 | +17.30 % |
| Worgen `p4_arms_bis` NoBuffs | 1 210 133 | 1 403 776 | +16.00 % |
| Orc `p5_arms_bis` FullBuffs | 2 579 496 | 2 674 833 | +3.70 % |
| Worgen `p5_arms_bis` FullBuffs | 2 561 459 | 2 642 300 | +3.16 % |
| Orc `p5_arms_bis` NoBuffs | 2 204 529 | 2 267 231 | +2.84 % |
| Worgen `p5_arms_bis` NoBuffs | 2 198 064 | 2 231 005 | +1.50 % |

Every single-target case, every `AllItems` case and `Average-Default` are byte-identical.

`sim/warrior/arms/TestArms.results` is therefore stale by design on those eight rows. Regenerate with
`make update-tests` when you're happy with the change — **I did not touch it**, and no `.test.json`
fixture was regenerated either.

The first attempt at the stack *did* include the two single-target edits and produced 308 DPS
differences with individual `AllItems` cases swinging ±1.6 %. Those cases run at a low iteration count,
so most of that spread was noise — but the 60 000-iteration cross-bed check above is what actually
killed the edits.

## Structural pass: variables, and the group fold that had to be reverted

A third, **behaviour-free** pass on top of the shipped rotation. It moves no priority, changes no
threshold and adds no line — it only names repeated sub-expressions.

Duplication census on the pre-pass file (33.5 KB): the Colossus Smash debuff id `86346` appeared
**45 times**, Deep Wounds `115768` 33 times, and one Thunder Clap sub-expression — *"at least two of
the three Deep Wounds are worth refreshing"* — appeared **twice as a 978-character byte-identical
subtree**.

### Eight new variables

| variable | body | uses | inline chars | chars saved |
| --- | --- | --- | --- | --- |
| `TC: Two Dots Worth Refreshing` | the three-way pair-of-pairs `>= -20 %` OR | 2 | 978 | 1 844 |
| `CS: Active` | `auraIsActive(86346, CurrentTarget, reaction)` | 14 | 110 | 1 022 |
| `CS: Remaining` | `auraRemainingTime(86346, CurrentTarget)` | 11 | 88 | 528 |
| `CS: Inactive` | `auraIsInactive(86346, CurrentTarget, reaction)` | 6 | 112 | 438 |
| `AoE: < 6` | `numberTargets < 6` | 6 | 76 | 222 |
| `Single Target` | `numberTargets == 1` | 6 | 76 | 216 |
| `AoE: >= 4` | `numberTargets >= 4` | 5 | 76 | 175 |
| `AoE: > 1` | `numberTargets > 1` | 4 | 76 | 128 |

The multi-target comparisons are named after the comparison they hold — `AoE: > 1`, `AoE: < 6`,
`AoE: >= 4` — rather than after an interpretation of it, so a reader never has to guess whether
"Multi Target" meant `> 1` or `>= 2` and the threshold is visible at every call site. `Single Target`
kept its prose name: at one target the name already says exactly what the comparison says. Renaming is a
pure string change and was re-verified as bit-identical.

`valueVariables` 11 → 19; file 34 289 → 31 612 bytes (−7.8 %); `86346` 45 → 17 occurrences and
`115768` 33 → 27. Retuning a Colossus Smash window threshold is now a one-place edit.

Substitution was done by **exact canonical-JSON match**, which is what makes it safe: the two
`Last CS GCD` variables use the **unreacted** `auraIsActive(86346, CurrentTarget)` — no
`includeReactionTime` — so they have a different canonical form and were left alone. This is the same
`CS: Applied` / `CS: Active` distinction the Fury pass called out; the 17 surviving `86346` uses are
5 `spellIsReady`, 3 `castSpell`, 3 `auraIsActive` (one being `CS: Active`'s own body plus those two
unreacted ones), 2 `spellCanCast`, 2 `spellTimeToReady`, and the `CS: Inactive` / `CS: Remaining`
bodies. Both `Last CS GCD` variables were rewritten on top of `$CS: Remaining`, so variables
referencing variables works as long as the new definitions are placed **first** in the array.

The remaining single-use variables (`$end 15s`, `$Can pot`) were left alone — a single-use variable
adds a hop without shortening anything — and `isExecutePhase(E20)` stayed inline for the same reason
Fury left it inline: it is already a single leaf, and `{"variableRef":…}` is *longer* than
`{"isExecutePhase":{"threshold":"E20"}}`.

### The group fold exposed a core bug, which is now fixed

Priority lines `[9]` Sweeping Strikes and `[10]` Thunder Clap both carried `numberTargets > 1`, so they
look like the textbook fold: one group, condition hoisted onto the reference. A group reference is
ready when `condition && any(inner ready)` and executes the first ready inner action
(`apl_action_group_reference.go:159`), so `{C, group[(c1,a1),(c2,a2)]}` ≡ `{C∧c1,a1}, {C∧c2,a2}` — the
fold is *logically* equivalent, and it made the priority list 39 → 38 with the same parse validations.

It was **not** behaviour-equivalent. Measured (seed 1, 3 000 iterations, p5 fixture):

| targets | variables only | group fold, before the core fix |
| --- | --- | --- |
| 2 | bit-identical | bit-identical |
| 3 | bit-identical | 745 559.142111 → 745 561.040630 |
| 6 | bit-identical | 1 105 138.828338 → 1 105 117.324966 |
| 20 | bit-identical | 2 671 142.542684 → 2 671 090.053509 |

Cause, in `nextActionWouldRecastChannel` (`sim/core/apl.go`): the walk had a `castSpell` branch, a
`channelSpell` branch, an `autocastOtherCooldowns` skip, and then a generic
`if action.impl.IsReady(sim) { return false }` fallback. A `groupReference` matched none of the
specific branches and so hit that fallback — and the two tests are **not** the same:

- the `castSpell` branch calls `spell.CanCast(...)`, deliberately *not* `CanCastOrQueue`, so that a
  spell merely queued inside the spell-queue window does not prematurely interrupt a channel (the
  comment in the function says exactly this);
- `APLActionCastSpell.IsReady` calls `spell.CanCastOrQueue(...)` **plus** an MCD/GCD gate.

So folding a cast into a group silently upgraded it from "castable right now" to "castable or
queueable", letting an SQW-queued Sweeping Strikes or Thunder Clap suppress a Bladestorm re-cast that
the inlined line would have allowed. Hence the divergence starts at three targets — that is where
Bladestorm channels while those two are castable — and one and two targets stay exact.

**Fix:** the per-action logic is now a helper, `inspectForChannelRecast`, returning a tri-state
(`undecided` / `yes` / `no`), and a `groupReference` **recurses into its group's actions in order**
under the same rules instead of falling through to the coarse check. A strict sequence deliberately
still uses its own readiness — unlike a group, a sequence's members are not independently castable —
and the recursion carries a depth cap so a malformed rotation cannot spin.

With the fix, the same fold is **bit-identical across all 33 cases** (three fixtures × 1/2/3/4/6/10/20
targets, plus `p5_arms_bis` / `p4_arms_bis` × buffs/no-buffs × 1/3/21). Folding consecutive `castSpell`
lines into a group is now genuinely behaviour-neutral.

Blast radius of the core change: **35 of 36 `./sim/...` packages pass**, and the only failing package is
`sim/warrior/arms` with the same eight `LongMultiTarget` rows and **byte-identical DPS values** as
before the core fix. No committed rotation changes behaviour — the fix removes a trap rather than
retuning anything. Fury, which already has Bladestorm inside a group, is unaffected.

The fold itself is **not** in the shipped APL: it is worth one priority line, and the shipped file was
already proven and suite-checked without it. It is now a safe option for a future pass.

### Parity evidence

Deterministic A/B, seed 1, 3 000 iterations, pre-pass file versus post-pass file:

- **27 of 27 cases bit-identical to 6 decimal places** — three p5 fixtures at 1/2/3/6/20 targets, plus
  `p5_arms_bis` and `p4_arms_bis` with and without buffs at 1/3/21 targets. Not "within noise": equal.
- Parse validations character-for-character identical at 1 and 6 targets (53 and 27 messages), so the
  `Autocast Other Cooldowns will cast the following spells:` line is unchanged and nothing slipped in
  or out of the major-cooldown list.
- `TestArms` reports the **same eight** `LongMultiTarget` failures with **byte-identical DPS values** as
  the run before this pass. The structural pass adds nothing to the fixture debt.

## Left for later

- Storm Bolt (`107570`) and Dragon Roar (`118000`) builds are untested. Both are pruned on `113132`, so
  the AoE group behaves differently for them and branch `[0]`/`[1]` reachability should be re-checked.
- Branches `[2]` and `[3]` of the AoE group are unreachable on *any* build without a crit on-use
  trinket, and their leading `castAllStatBuffCooldowns(Crit)` makes them unreachable even with one if
  every stat cooldown is cast manually. They were left in place — the Fury pass's lesson is that a
  "dead" line is only safe to delete once you know why it's dead for every build.
- Enrage sits at 72.7 % uptime on one target and is crit-bound. Nothing in the APL moved it; a real
  gain there would need a mechanic change, not a rotation change.
