package stats

import (
	"cmp"
	"fmt"
	"math"
	"slices"
)

// This stat list is arranged such that evaluating dependencies in this order
// is always safe, given the set of dependencies actually used in the game.
//
// Note that many stats are omitted from this list, because they are not used
// in any dependencies.
var safeDepsOrder = []Stat{
	Strength,
	Agility,
	Stamina,
	Intellect,
	Spirit,
	BonusArmor,
	Armor,
	AttackPower,
	RangedAttackPower,
	SpellPower,
	Health,
	Mana,
	MP5,
	HasteRating,
	CritRating,
	SpellCritPercent,
	PhysicalCritPercent,
	BlockPercent,
	DodgeRating,
	ParryRating,
	ExpertiseRating,
	HitRating,
	SpellHitPercent,
	PhysicalHitPercent,
	MasteryRating,
}

// Position of each stat in safeDepsOrder, -1 for stats no dependency may use.
var safeDepsIndex = func() [SimStatsLen]int {
	var index [SimStatsLen]int
	for i := range index {
		index[i] = -1
	}
	for i, s := range safeDepsOrder {
		index[s] = i
	}
	return index
}()

func isSafeDep(s Stat) bool {
	return safeDepsIndex[s] >= 0
}
func isValidDep(src Stat, dst Stat) bool {
	// src must not occur after dst in the list.
	return isSafeDep(src) && isSafeDep(dst) && safeDepsIndex[src] <= safeDepsIndex[dst]
}
func validateDep(src Stat, dst Stat) {
	if !isValidDep(src, dst) {
		panic("Invalid stat dependency: " + src.StatName() + " --> " + dst.StatName())
	}
}

type StatDependency struct {
	dynamic bool
	enabled bool
	src     Stat
	dst     Stat

	// Note that amount is treated differently depending on whether src and dst
	// stats are the same.
	amount float64

	// Cross-stat deps only. The game turns a share of an attribute into a
	// rating as int32(amount * (attribute - srcOffset)): the offset (the class
	// base value the passive excludes) comes off first and the result is
	// truncated toward zero, never rounded up.
	srcOffset float64
	truncate  bool

	// Same-stat deps on ratings only. Ratings are integers in the game and
	// every percent modifier is applied and converted back in turn, so the
	// order of the multipliers matters: equipment multipliers (the
	// Amplification trinkets) go before class multipliers (Stance of the Wise
	// Serpent's haste). Verified on logged Mistweaver haste with both active.
	// Set by Aura.AttachStatDependency for auras in the Gear build phase.
	fromEquipment bool

	// How ApplyStatDependencies treats this dep, computed once in sortDeps so
	// the per-stat-change hot loop does no table lookups.
	kind depKind
}

type depKind uint8

const (
	// dst *= amount
	depMultiply depKind = iota
	// dst = roundToEven(dst * amount)
	depMultiplyRating
	// dst += src * amount
	depAdd
	// dst += floor(src) * amount
	depAddFlooredSrc
	// dst += round(src) * amount
	depAddRoundedSrc
	// dst += max(0, trunc((floor(src) - srcOffset) * amount))
	depAddTruncatedShare
)

func (sd *StatDependency) computeKind() {
	switch {
	case sd.src == sd.dst && isRoundedGameStat[sd.dst]:
		sd.kind = depMultiplyRating
	case sd.src == sd.dst:
		sd.kind = depMultiply
	case sd.truncate:
		sd.kind = depAddTruncatedShare
	case isFlooredGameStat[sd.src]:
		sd.kind = depAddFlooredSrc
	case isRoundedGameStat[sd.src]:
		sd.kind = depAddRoundedSrc
	default:
		sd.kind = depAdd
	}
}

func (sd StatDependency) String() string {
	if sd.src == sd.dst {
		return fmt.Sprintf("%s *= %0.2f", sd.src.StatName(), sd.amount)
	} else if sd.truncate {
		return fmt.Sprintf("%s += trunc((%s - %0.2f) * %0.2f)", sd.dst.StatName(), sd.src.StatName(), sd.srcOffset, sd.amount)
	} else {
		return fmt.Sprintf("%s += %s * %0.2f", sd.dst.StatName(), sd.src.StatName(), sd.amount)
	}
}

// Updates the "amount" field for a previously defined dep. Note that if this is
// called after the stats measurement phase, then ApplyStatDependencies() must
// be immediately called afterwards!
func (dep *StatDependency) UpdateValue(newAmount float64) {
	dep.amount = newAmount
}

// Marks a same-stat rating multiplier as coming from equipment, so it is
// applied (and rounded) before any class multiplier on the same rating; see
// StatDependency.fromEquipment. Must be called before the deps are sorted.
func (dep *StatDependency) MarkFromEquipment() {
	dep.fromEquipment = true
}

// Manages dependencies between stats.
//
// Some examples:
// Increases your AP by 30% of your Int
// Increases agility by X%
// Reduces armor by 50%
type StatDependencyManager struct {
	deps      []*StatDependency
	finalized bool
}

func NewStatDependencyManager() StatDependencyManager {
	return StatDependencyManager{}
}

func (sdm *StatDependencyManager) AddStatDependency(src Stat, dst Stat, amount float64) {
	validateDep(src, dst)
	if sdm.IsFinalized() {
		panic("StatDependencyManager already finalized!")
	}
	if src == dst {
		panic("For same-stat dependencies, use MultiplyStat instead!")
	}

	sdm.deps = append(sdm.deps, &StatDependency{
		dynamic: false,
		enabled: true,
		src:     src,
		dst:     dst,
		amount:  amount,
	})
}

func (sdm *StatDependencyManager) MultiplyStat(s Stat, amount float64) {
	validateDep(s, s)
	if sdm.IsFinalized() {
		panic("StatDependencyManager already finalized!")
	}

	sdm.deps = append(sdm.deps, &StatDependency{
		dynamic: false,
		enabled: true,
		src:     s,
		dst:     s,
		amount:  amount,
	})
}

func (sdm *StatDependencyManager) NewDynamicStatDependency(src Stat, dst Stat, amount float64) *StatDependency {
	validateDep(src, dst)
	if sdm.IsFinalized() {
		panic("StatDependencyManager already finalized!")
	}
	if src == dst {
		panic("For same-stat dependencies, use NewDynamicMultiplyStat instead!")
	}

	dep := &StatDependency{
		dynamic: true,
		enabled: false,
		src:     src,
		dst:     dst,
		amount:  amount,
	}
	sdm.deps = append(sdm.deps, dep)
	return dep
}

// A rating granted as a share of an attribute above a base value, e.g. the
// Holy Paladin and Mistweaver hit and expertise from Spirit: the game computes
// int32(amount * (attribute - srcOffset)), truncating toward zero, and never
// takes anything away when the attribute sits below the base.
func (sdm *StatDependencyManager) NewDynamicRatingFromStatDependency(src Stat, dst Stat, amount float64, srcOffset float64) *StatDependency {
	if !isFlooredGameStat[src] {
		panic("Rating shares are only defined on attributes: " + src.StatName())
	}
	dep := sdm.NewDynamicStatDependency(src, dst, amount)
	dep.srcOffset = srcOffset
	dep.truncate = true
	return dep
}

func (sdm *StatDependencyManager) NewDynamicMultiplyStat(s Stat, amount float64) *StatDependency {
	validateDep(s, s)
	if sdm.IsFinalized() {
		panic("StatDependencyManager already finalized!")
	}

	dep := &StatDependency{
		dynamic: true,
		enabled: false,
		src:     s,
		dst:     s,
		amount:  amount,
	}
	sdm.deps = append(sdm.deps, dep)
	return dep
}

// Within one stat pair, equipment multipliers come first, then the other
// dynamic deps, then the single merged static dep.
func (dep *StatDependency) sortRank() int {
	switch {
	case !dep.dynamic:
		return 2
	case dep.fromEquipment:
		return 0
	default:
		return 1
	}
}

// Orders the deps so every source stat is final before its dependents read
// it (safeDepsOrder), and merges the static deps of each stat pair into one
// for performance. Runs once per stat measurement, so it is a single stable
// sort over the list rather than a scan per stat pair.
func (sdm *StatDependencyManager) sortDeps() {
	slices.SortStableFunc(sdm.deps, func(a, b *StatDependency) int {
		return cmp.Or(
			cmp.Compare(safeDepsIndex[a.src], safeDepsIndex[b.src]),
			cmp.Compare(safeDepsIndex[a.dst], safeDepsIndex[b.dst]),
			cmp.Compare(a.sortRank(), b.sortRank()),
		)
	})

	// Static deps of a pair are now adjacent and last; fold each run into
	// its first member. Static deps are never handed out by pointer, so
	// mutating one in place is safe, and folding again on the next sort is a
	// no-op for the already merged dep.
	deps := sdm.deps[:0]
	for _, dep := range sdm.deps {
		if !dep.dynamic && len(deps) > 0 {
			merged := deps[len(deps)-1]
			if !merged.dynamic && merged.src == dep.src && merged.dst == dep.dst {
				if dep.src == dep.dst {
					merged.amount *= dep.amount
				} else {
					merged.amount += dep.amount
				}
				continue
			}
		}
		deps = append(deps, dep)
	}
	sdm.deps = deps

	for _, dep := range sdm.deps {
		dep.computeKind()
	}
}

func (sdm *StatDependencyManager) FinalizeStatDeps() {
	if sdm.IsFinalized() {
		panic("StatDependencyManager already finalized!")
	}
	sdm.sortDeps()
	sdm.finalized = true
}

func (sdm *StatDependencyManager) ResetStatDeps() {
	for _, dep := range sdm.deps {
		if dep.dynamic {
			dep.enabled = false
		}
	}
}

func (sdm *StatDependencyManager) IsFinalized() bool {
	return sdm.finalized
}

// Resolves the dependencies on a full stat total, with the integer conversions
// the game applies along the way. This runs on every stat change during a
// sim, so each dep is one switch on its precomputed kind.
func (sdm *StatDependencyManager) ApplyStatDependencies(s Stats) Stats {
	for _, dep := range sdm.deps {
		if !dep.enabled {
			continue
		}
		switch dep.kind {
		case depMultiplyRating:
			// Ratings are integers in the game: each percent modifier is
			// applied and the rating converted back before the next one
			// (round half to even, the CPU's default float-to-int
			// conversion). Verified on logged Mistweaver haste, where Stance
			// of the Wise Serpent's x1.5 lands on x.5 exactly.
			s[dep.dst] = math.RoundToEven(s[dep.dst] * dep.amount)
		case depMultiply:
			s[dep.dst] *= dep.amount
		case depAddFlooredSrc:
			// The dep sort guarantees the source stat is final here, and the
			// game floors attributes before dependents consume them (e.g.
			// health is derived from the floored Stamina).
			s[dep.dst] += math.Floor(s[dep.src]) * dep.amount
		case depAddRoundedSrc:
			// Ratings are stored rounded-to-nearest instead.
			s[dep.dst] += math.Round(s[dep.src]) * dep.amount
		case depAddTruncatedShare:
			s[dep.dst] += max(0, math.Trunc((math.Floor(s[dep.src])-dep.srcOffset)*dep.amount))
		default:
			s[dep.dst] += s[dep.src] * dep.amount
		}
	}
	return s
}

// Resolves the dependencies on a stat delta (the reforge optimizer's per-item
// changes). Offsets and integer conversions belong to totals, not to deltas,
// so every dep is linear here.
func (sdm *StatDependencyManager) ApplyStatDependenciesToDelta(s Stats) Stats {
	for _, dep := range sdm.deps {
		if !dep.enabled {
			continue
		}
		if dep.src == dep.dst {
			s[dep.dst] *= dep.amount
		} else {
			s[dep.dst] += s[dep.src] * dep.amount
		}
	}
	return s
}

func (sdm *StatDependencyManager) SortAndApplyStatDependencies(s Stats) Stats {
	sdm.sortDeps()
	return sdm.ApplyStatDependencies(s)
}

// Returns whether the state changed.
func (sdm *StatDependencyManager) EnableDynamicStatDep(dep *StatDependency) bool {
	if !dep.enabled {
		dep.enabled = true
		return true
	}
	return false
}

// Returns whether the state changed.
func (sdm *StatDependencyManager) DisableDynamicStatDep(dep *StatDependency) bool {
	if dep.enabled {
		dep.enabled = false
		return true
	}
	return false
}
