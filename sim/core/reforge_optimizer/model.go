package reforgeoptimizer

import (
	"cmp"
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// This file builds the LP model: buildYalpsVariables, buildGemOptions, applyReforgeStat,
// buildYalpsConstraints, updateReforgeScores. Variable/constraint INSERTION ORDER is
// load-bearing, because it drives x-index assignment and therefore HiGHS tie-breaking.

// gemData bundles a gem with the data the LP needs: the gem, whether it's a JC gem, its
// OBJECTIVE stat coefficients (applyReforgeStat output; LP coefficient map, no 'score' key —
// the score is recomputed per solver pass), the gem's RAW stats (fed to resolveStatDelta to
// build the cap-space coefficients), the CAP coefficients resolved once from those raw stats
// (a gem's stats are fixed, so this is reused for every socket instead of re-resolving), and
// the pre-computed sort score (from the pre-cap weights).
type gemData struct {
	gem       *proto.ReforgeGemOption
	isJC      bool
	coeffs    map[string]float64
	rawStats  stats.Stats
	capCoeffs map[string]float64
	score     float64
}

var gemBuildSocketColors = []proto.GemColor{
	proto.GemColor_GemColorPrismatic,
	proto.GemColor_GemColorShaTouched,
	proto.GemColor_GemColorCogwheel,
	proto.GemColor_GemColorRed,
	proto.GemColor_GemColorBlue,
	proto.GemColor_GemColorYellow,
}

// buildGemOptions builds the candidate gem pool for each socket color.
func (o *reforgeOptimizer) buildGemOptions(preCapEPs core.UnitStats, reforgeCaps core.UnitStats, reforgeSoftCaps []*reforgeSoftCap) map[proto.GemColor][]gemData {
	gemsToInclude := map[proto.GemColor][]gemData{}
	if !o.includeGems {
		return gemsToInclude
	}

	for _, socketColor := range gemBuildSocketColors {
		allGemsOfColor := o.gemsForColorKey(socketColor)
		filtered := make([]gemData, 0, len(allGemsOfColor))

		weightsForSorting := preCapEPs
		if o.relativeCap != nil {
			constrained0 := stats.UnitStatFromStat(stats.Stat(int32(o.relativeCap.constrainedStats[0])))
			weightsForSorting = setUnitStat(weightsForSorting, o.relativeCap.forcedUnitStat, getUnitStat(weightsForSorting, constrained0))
		}

		for _, gem := range allGemsOfColor {
			isJC := gem.GetRequiredProfession() == proto.Profession_Jewelcrafting
			if (isJC && !o.hasJC) ||
				// Force non-tank specs to use exclusively primary-stat JC gems to speed up calculations.
				(isJC && !o.isTankSpec && !gemHasAnyStat(gem, stats.Strength, stats.Agility, stats.Intellect)) ||
				// Hybrid casters use Spirit instead of hit gems.
				(o.isHybridCaster && gemStatValue(gem, stats.HitRating) != 0) ||
				strings.Contains(gem.GetName(), "Perfect") ||
				!gemMatchesSocket(gem.GetColor(), socketColor) {
				continue
			}

			allStatsValid := true
			coeffs := map[string]float64{}
			var rawStats stats.Stats
			for statIdx, statValue := range gem.GetStats() {
				if statValue == 0 {
					continue
				}
				stat := stats.Stat(statIdx)
				if !o.epStatsSet[proto.Stat(statIdx)] && stat != stats.ExpertiseRating {
					allStatsValid = false
					break
				}
				rawStats[statIdx] = statValue
				o.applyReforgeStat(coeffs, proto.Stat(statIdx), statValue, weightsForSorting)
			}
			if !allStatsValid {
				continue
			}

			filtered = append(filtered, gemData{
				gem:       gem,
				isJC:      isJC,
				coeffs:    coeffs,
				rawStats:  rawStats,
				capCoeffs: o.resolveCapCoeffs(rawStats),
				score:     computeCoeffScore(coeffs, weightsForSorting),
			})
		}

		// Sort from highest to lowest pre-cap EP. The sort is stable so tied gems keep their
		// candidate-pool order.
		slices.SortStableFunc(filtered, func(a, b gemData) int {
			return cmp.Compare(b.score, a.score)
		})

		maxGemOptionsForStat := 4
		if o.isTankSpec {
			maxGemOptionsForStat = 3
		}
		if socketColor == proto.GemColor_GemColorYellow && o.relativeCap == nil {
			foundCritOrHasteCap := false
			for _, parent := range []stats.Stat{stats.CritRating, stats.HasteRating} {
				for _, child := range childPseudoStats(parent) {
					if pseudoStatHasCap(child, reforgeCaps, reforgeSoftCaps) {
						foundCritOrHasteCap = true
					}
				}
			}
			if !foundCritOrHasteCap {
				maxGemOptionsForStat = 1
			}
		}

		included := make([]gemData, 0, len(filtered))
		foundUncappedJCGem := false
		foundUncappedNormalGem := false
		numUncappedNormalGems := 0
		numGemOptionsForStat := map[string]int{}

		for _, gd := range filtered {
			cappedStatKeys := getCappedStatKeys(gd.coeffs, reforgeCaps, reforgeSoftCaps)
			isRedundantGem := false
			for _, statKey := range cappedStatKeys {
				if numGemOptionsForStat[statKey] == maxGemOptionsForStat {
					isRedundantGem = true
					break
				}
			}

			if (!gd.isJC || !foundUncappedJCGem) && !isRedundantGem && (len(cappedStatKeys) == 0 || !foundUncappedNormalGem) {
				included = append(included, gd)
				// Only gems that actually made it into the candidate list consume per-stat
				// option slots.
				if !gd.isJC {
					for _, statKey := range cappedStatKeys {
						numGemOptionsForStat[statKey]++
					}
				}
			}

			if len(cappedStatKeys) == 0 && socketColor != proto.GemColor_GemColorCogwheel {
				if gd.isJC {
					foundUncappedJCGem = true
				} else {
					foundUncappedNormalGem = true
					numUncappedNormalGems++
					if o.relativeCap == nil || numUncappedNormalGems == 3 {
						break
					}
				}
			}
		}

		gemsToInclude[socketColor] = included
	}

	return gemsToInclude
}

// gemsForColorKey returns the request's gems that are eligible to be socketed into socketColor
// (via gemEligibleForSocket); buildGemOptions then applies the stricter gemMatchesSocket filter.
func (o *reforgeOptimizer) gemsForColorKey(socketColor proto.GemColor) []*proto.ReforgeGemOption {
	var out []*proto.ReforgeGemOption
	for _, gem := range o.gemOptions {
		if gemEligibleForSocket(gem.GetColor(), socketColor) {
			out = append(out, gem)
		}
	}
	return out
}

// applyReforgeStat applies stat dependencies (Human Spirit, Amplification Trinket, Guardian
// Crit/Agility, hybrid Spirit->SpellHit, Expertise->SpellHit) then sets the LP coefficients,
// routing a rating stat to its school-specific percent pseudo-stats when the root rating has no
// direct EP weight.
func (o *reforgeOptimizer) applyReforgeStat(coeffs map[string]float64, stat proto.Stat, amount float64, preCapEPs core.UnitStats) {
	if stat == proto.Stat_StatSpirit {
		amount *= o.spiritSelfMult
	}
	if stat == proto.Stat_StatHasteRating || stat == proto.Stat_StatMasteryRating || stat == proto.Stat_StatSpirit {
		amount *= o.ampModifier
	}
	if stat == proto.Stat_StatCritRating && o.isGuardianDruid {
		amount *= o.bearFormMult
	}

	// Spirit->SpellHit (hybrid casters) and Expertise->SpellHit conversions.
	spellHitPseudo := proto.PseudoStat_PseudoStatSpellHitPercent
	if getUnitStat(preCapEPs, stats.UnitStatFromPseudoStat(spellHitPseudo)) != 0 &&
		((stat == proto.Stat_StatSpirit && o.isHybridCaster) || stat == proto.Stat_StatExpertiseRating) {
		o.setPseudoStatCoefficient(coeffs, spellHitPseudo, amount/core.SpellHitRatingPerHitPercent)
	}

	// Guardian Druid Agility -> Attack Power + Physical Crit%, scaled by the combined Mark-of-the-Wild
	// and Heart-of-the-Wild Agility multiplier resolved from the stat-dependency graph.
	if stat == proto.Stat_StatAgility && o.isGuardianDruid {
		amount *= o.guardianAgilityMult
		o.setStatCoefficient(coeffs, proto.Stat_StatAttackPower, amount*2)
		o.setPseudoStatCoefficient(coeffs, proto.PseudoStat_PseudoStatPhysicalCritPercent, amount*core.CritPerAgiMaxLevel[proto.Class_ClassDruid])
		return
	}

	if o.relativeCap != nil {
		o.relativeCap.updateCoefficients(coeffs, stat, amount)
	}

	// If the root stat has a direct EP weight, apply it directly and don't expand children.
	if preCapEPs.Stats[stat] != 0 {
		o.setStatCoefficient(coeffs, stat, amount)
		return
	}

	// Otherwise expand into any child pseudo-stat that carries an EP weight.
	for _, child := range childPseudoStats(stats.Stat(int32(stat))) {
		if getUnitStat(preCapEPs, stats.UnitStatFromPseudoStat(child)) != 0 {
			o.setPseudoStatCoefficient(coeffs, child, convertRatingToPercent(child, amount))
		}
	}
}

func (o *reforgeOptimizer) setStatCoefficient(coeffs map[string]float64, stat proto.Stat, amount float64) {
	coeffs[statCoeffKey(stat)] += amount
}

func (o *reforgeOptimizer) setPseudoStatCoefficient(coeffs map[string]float64, pseudoStat proto.PseudoStat, amount float64) {
	coeffs[pseudoStatCoeffKey(pseudoStat)] += amount
}

// resolveCapCoeffs builds a variable's cap-space coefficient map from a raw stat delta by
// resolving it through the full stat-dependency graph (resolveStatDelta) and keying every
// nonzero resolved stat/pseudo-stat by its coefficient-key name. These feed the LP cap
// constraint rows and checkCaps, so every dependency (e.g. Intellect -> SpellCrit%, a Guardian's
// Agility -> Crit%, the haste speed multiplier) counts toward the caps.
func (o *reforgeOptimizer) resolveCapCoeffs(rawDelta stats.Stats) map[string]float64 {
	resolved := resolveStatDelta(o.statDeps, o.baseStats, rawUnitStatsFromStats(rawDelta))
	coeffs := map[string]float64{}
	eachUnitStat(resolved, func(unitStat stats.UnitStat, value float64) {
		if value != 0 {
			coeffs[coeffKeyForUnitStat(unitStat)] = value
		}
	})
	return coeffs
}

// buildYalpsVariables builds the LP decision variables. Insertion order per slot: reforge
// variables, then (if gems) per-socket gem variables, then the socket-bonus variable.
//
// Each variable is built in two coefficient spaces: capCoeffs (fully SDM-resolved, plus the
// structural/constraint keys) go into byName; objCoeffs (the EP-calibrated applyReforgeStat
// output) go into objByName. See lpVariables for how the two are consumed.
func (o *reforgeOptimizer) buildYalpsVariables(equipment core.Equipment, preCapEPs core.UnitStats, reforgeCaps core.UnitStats, reforgeSoftCaps []*reforgeSoftCap) *lpVariables {
	variables := newLPVariables()
	gemsToInclude := o.buildGemOptions(preCapEPs, reforgeCaps, reforgeSoftCaps)
	reforgeIDs := core.GetSortedReforgeStatIDs()

	// setVar stores a variable's cap and objective coefficients. It first carries any non-stat
	// constraint key applyReforgeStat emits (the relative-cap "*Minus*" ordering keys) from the
	// objective map into the cap map, where the LP constraint rows read them; every other
	// objective key is a stat/pseudo-stat coefficient that belongs only to the score.
	setVar := func(key string, capCoeffs, objCoeffs map[string]float64) {
		for k, v := range objCoeffs {
			if _, isStat := unitStatFromCoeffKey(k); !isStat {
				capCoeffs[k] += v
			}
		}
		variables.set(key, capCoeffs)
		variables.setObj(key, objCoeffs)
	}

	for slotIdx := 0; slotIdx < int(core.NumItemSlots); slotIdx++ {
		slot := proto.ItemSlot(slotIdx)
		item := equipment.GetItemBySlot(slot)
		if item.ID == 0 || o.frozenSlots[slot] {
			continue
		}

		// Prefer Hit over Expertise for true casters: when the same source stat can reforge to
		// Hit, drop its Expertise-target reforge. Hit strictly dominates Expertise's spell-hit
		// proxy, so keeping the Expertise variable only lets the solver settle a strictly worse tie
		// (mirrors the old backend's preferHitOverExpertiseReforges).
		var hitReforgeSources map[proto.Stat]bool
		if o.isTrueCaster {
			hitReforgeSources = map[proto.Stat]bool{}
			for _, reforgeID := range reforgeIDs {
				reforge := core.GetReforgeStatByID(reforgeID)
				if stats.Stat(int32(reforge.ToStat)) == stats.HitRating && core.ValidateReforging(item, reforge) {
					hitReforgeSources[reforge.FromStat] = true
				}
			}
		}

		// Reforge variables.
		for _, reforgeID := range reforgeIDs {
			reforge := core.GetReforgeStatByID(reforgeID)
			toStat := stats.Stat(int32(reforge.ToStat))
			if !o.epStatsSet[reforge.ToStat] && toStat != stats.ExpertiseRating {
				continue
			}
			if !core.ValidateReforging(item, reforge) {
				continue
			}
			if toStat == stats.ExpertiseRating && hitReforgeSources[reforge.FromStat] {
				continue
			}
			delta := reforgeRawStats(*item, reforge)
			variableKey := strconv.Itoa(slotIdx) + "_" + strconv.Itoa(int(reforge.ID))
			objCoeffs := map[string]float64{}
			o.applyReforgeStat(objCoeffs, reforge.FromStat, delta[stats.Stat(int32(reforge.FromStat))], preCapEPs)
			o.applyReforgeStat(objCoeffs, reforge.ToStat, delta[toStat], preCapEPs)
			capCoeffs := o.resolveCapCoeffs(delta)
			capCoeffs[slotCoeffKey(slot)] = 1
			setVar(variableKey, capCoeffs, objCoeffs)
		}

		if !o.includeGems {
			continue
		}

		socketColors := currentSocketColors(*item, o.isBlacksmithing, o.settings)

		socketBonusNormalization := len(socketColors)
		if socketBonusNormalization == 0 {
			socketBonusNormalization = 1
		}
		if socketBonusNormalization > 1 && len(socketColors) > 0 && socketColors[0] == proto.GemColor_GemColorMeta {
			socketBonusNormalization--
		}

		distributedSocketBonus := item.SocketBonus.Multiply(1.0 / float64(socketBonusNormalization))
		fullSocketBonus := item.SocketBonus

		// Determine whether the socket bonus should be force-matched.
		forceSocketBonus := false
		socketBonusAsCoeff := map[string]float64{}
		eachBuffedStat(distributedSocketBonus, func(stat stats.Stat, value float64) {
			o.applyReforgeStat(socketBonusAsCoeff, proto.Stat(int32(stat)), value, preCapEPs)
		})

		if len(socketBonusAsCoeff) > 0 {
			if includesStatWithCap(socketBonusAsCoeff, reforgeCaps, reforgeSoftCaps) &&
				!includesCappedStat(socketBonusAsCoeff, reforgeCaps, reforgeSoftCaps) &&
				socketBonusNormalization > 1 {
				forceSocketBonus = true
			}

			matchedCoeffs := map[string]float64{}
			unmatchedCoeffs := map[string]float64{}
			for _, socketColor := range socketColors {
				if !isColoredSocket(socketColor) {
					break
				}
				matchedPool := gemsToInclude[socketColor]
				if len(matchedPool) > 0 {
					worstMatched := matchedPool[len(matchedPool)-1]
					for key, value := range worstMatched.coeffs {
						matchedCoeffs[key] += value
					}
				}
				for key, value := range socketBonusAsCoeff {
					matchedCoeffs[key] += value
				}
				prismaticPool := gemsToInclude[proto.GemColor_GemColorPrismatic]
				if len(prismaticPool) > 0 {
					worstUnmatched := prismaticPool[0]
					for key, value := range worstUnmatched.coeffs {
						unmatchedCoeffs[key] += value
					}
				}
			}

			matchedScore := computeCoeffScore(matchedCoeffs, preCapEPs)
			unmatchedScore := computeCoeffScore(unmatchedCoeffs, preCapEPs)
			if matchedScore > unmatchedScore &&
				(socketBonusNormalization > 1 ||
					(includesStatWithCap(socketBonusAsCoeff, reforgeCaps, reforgeSoftCaps) &&
						!includesCappedStat(socketBonusAsCoeff, reforgeCaps, reforgeSoftCaps))) {
				forceSocketBonus = true
			}
		}

		for socketIdx, socketColor := range socketColors {
			var gemColorKeys []proto.GemColor
			switch {
			case socketColor == proto.GemColor_GemColorPrismatic || socketColor == proto.GemColor_GemColorCogwheel || socketColor == proto.GemColor_GemColorShaTouched:
				gemColorKeys = []proto.GemColor{socketColor}
			case socketColor == proto.GemColor_GemColorRed || socketColor == proto.GemColor_GemColorBlue || socketColor == proto.GemColor_GemColorYellow:
				gemColorKeys = []proto.GemColor{socketColor}
				if !forceSocketBonus {
					gemColorKeys = append(gemColorKeys, proto.GemColor_GemColorPrismatic)
				}
			default:
				continue
			}

			constraintKey := strconv.Itoa(slotIdx) + "_" + strconv.Itoa(socketIdx)

			for _, gemColorKey := range gemColorKeys {
				for _, gd := range gemsToInclude[gemColorKey] {
					variableKey := constraintKey + "_" + strconv.Itoa(int(gd.gem.GetId()))
					objCoeffs := make(map[string]float64, len(gd.coeffs)+2)
					for key, value := range gd.coeffs {
						objCoeffs[key] = value
					}
					rawStats := gd.rawStats
					socketBonusAdded := false

					useSocketBonusLink := false
					if gemMatchesSocket(gd.gem.GetColor(), socketColor) {
						if forceSocketBonus {
							eachBuffedStat(distributedSocketBonus, func(stat stats.Stat, value float64) {
								o.applyReforgeStat(objCoeffs, proto.Stat(int32(stat)), value, preCapEPs)
							})
							rawStats = rawStats.Add(distributedSocketBonus)
							socketBonusAdded = true
						} else {
							useSocketBonusLink = true
						}
					} else if gd.isJC {
						// Force socket-bonus matching for Jewelcrafting gems.
						continue
					}

					// A gem's stats are fixed, so its cap coefficients are resolved once in
					// buildGemOptions; clone them here. Only the (rare) force-socket-bonus case mutates
					// rawStats, so it re-resolves.
					var capCoeffs map[string]float64
					if socketBonusAdded {
						capCoeffs = o.resolveCapCoeffs(rawStats)
					} else {
						capCoeffs = maps.Clone(gd.capCoeffs)
					}
					capCoeffs[constraintKey] = 1
					if useSocketBonusLink {
						capCoeffs["SocketBonusLink_"+constraintKey] = -1
					}
					if gemColorKey == proto.GemColor_GemColorCogwheel {
						capCoeffs[strconv.Itoa(int(gd.gem.GetId()))] = 1
					}
					if gemColorKey == proto.GemColor_GemColorShaTouched {
						capCoeffs["ShaTouchedGem"] = 1
					}
					if gd.isJC {
						capCoeffs["JewelcraftingGem"] = 1
					}

					setVar(variableKey, capCoeffs, objCoeffs)
				}
			}
		}

		if !forceSocketBonus && socketBonusNormalization > 0 {
			socketBonusKey := "SocketBonus_" + strconv.Itoa(slotIdx)
			objCoeffs := map[string]float64{}
			eachBuffedStat(fullSocketBonus, func(stat stats.Stat, value float64) {
				o.applyReforgeStat(objCoeffs, proto.Stat(int32(stat)), value, preCapEPs)
			})
			capCoeffs := o.resolveCapCoeffs(fullSocketBonus)
			for socketIdx, socketColor := range socketColors {
				if isColoredSocket(socketColor) {
					capCoeffs["SocketBonusLink_"+strconv.Itoa(slotIdx)+"_"+strconv.Itoa(socketIdx)] = 1
				}
			}
			setVar(socketBonusKey, capCoeffs, objCoeffs)
		}
	}

	return variables
}

// isColoredSocket returns true for Red/Blue/Yellow/Prismatic (the sockets that participate in
// socket-bonus matching).
func isColoredSocket(socketColor proto.GemColor) bool {
	switch socketColor {
	case proto.GemColor_GemColorRed, proto.GemColor_GemColorBlue, proto.GemColor_GemColorYellow, proto.GemColor_GemColorPrismatic:
		return true
	default:
		return false
	}
}

// buildYalpsConstraints builds the LP constraints.
func (o *reforgeOptimizer) buildYalpsConstraints(equipment core.Equipment, baseStats core.UnitStats) *lpConstraints {
	constraints := newLPConstraints()

	var allCogwheelGems []*proto.ReforgeGemOption
	if o.includeGems {
		allCogwheelGems = o.gemsForColorKey(proto.GemColor_GemColorCogwheel)
	}

	for slotIdx := 0; slotIdx < int(core.NumItemSlots); slotIdx++ {
		slot := proto.ItemSlot(slotIdx)
		item := equipment.GetItemBySlot(slot)
		if item.ID == 0 || o.frozenSlots[slot] {
			continue
		}

		constraints.set(slotCoeffKey(slot), lessEq(1))

		if o.includeGems {
			for socketIdx := range currentSocketColors(*item, o.isBlacksmithing, o.settings) {
				constraints.set(strconv.Itoa(slotIdx)+"_"+strconv.Itoa(socketIdx), lessEq(1))
			}
			constraints.set("ShaTouchedGem", lessEq(1))
			constraints.set("JewelcraftingGem", lessEq(2))
			for _, cogwheelGem := range allCogwheelGems {
				if !cogwheelGem.GetUnique() {
					continue
				}
				constraints.set(strconv.Itoa(int(cogwheelGem.GetId())), lessEq(1))
			}
		}
	}

	if o.relativeCap != nil {
		o.relativeCap.updateConstraints(constraints, equipment, baseStats, o.raidBuffs())
	}

	return constraints
}

// updateReforgeScores returns a copy of the variables (cap coefficients + a fresh 'score'
// coefficient) with each variable's 'score' set to its EP under weights. The score is computed
// from the OBJECTIVE coefficients (objByName), not the cap coefficients, so the LP objective
// stays exactly as calibrated while the constraint rows read the SDM-resolved cap coefficients.
func (o *reforgeOptimizer) updateReforgeScores(variables *lpVariables, weights core.UnitStats) *lpVariables {
	updated := newLPVariables()
	variables.each(func(name string, coeffs map[string]float64) {
		out := make(map[string]float64, len(coeffs)+1)
		for key, value := range coeffs {
			out[key] = value
		}
		objCoeffs := variables.getObj(name)
		out["score"] = computeCoeffScore(objCoeffs, weights)
		updated.set(name, out)
		// Carry the objective coefficients forward so the cap-refinement recursion (which
		// re-invokes updateReforgeScores on this returned value) can re-score against the
		// tightened weights instead of collapsing every score to zero.
		updated.setObj(name, objCoeffs)
	})
	return updated
}

// computeCoeffScore sums weight*value over the stat/pseudo-stat coefficient keys. Non-stat keys
// (slot, SocketBonusLink, ShaTouchedGem, JewelcraftingGem, cogwheel IDs, *Minus*, score)
// contribute nothing.
func computeCoeffScore(coeffs map[string]float64, weights core.UnitStats) float64 {
	score := 0.0
	for key, value := range coeffs {
		if unitStat, ok := unitStatFromCoeffKey(key); ok {
			score += getUnitStat(weights, unitStat) * value
		}
	}
	return score
}

func gemStatValue(gem *proto.ReforgeGemOption, stat stats.Stat) float64 {
	gemStats := gem.GetStats()
	if int(stat) >= len(gemStats) {
		return 0
	}
	return gemStats[stat]
}

func gemHasAnyStat(gem *proto.ReforgeGemOption, candidates ...stats.Stat) bool {
	for _, stat := range candidates {
		if gemStatValue(gem, stat) > 0 {
			return true
		}
	}
	return false
}
