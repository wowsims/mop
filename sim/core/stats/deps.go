package stats

import (
	"fmt"
	"math"
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

func isSafeDep(s Stat) bool {
	for _, v := range safeDepsOrder {
		if s == v {
			return true
		}
	}
	return false
}
func isValidDep(src Stat, dst Stat) bool {
	if !isSafeDep(src) || !isSafeDep(dst) {
		return false
	}

	// Check that src occurs before dst in the list
	for _, v := range safeDepsOrder {
		if v == src {
			return true
		} else if v == dst {
			return false
		}
	}
	return false
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
	fromEquipment bool

	// How ApplyStatDependencies treats this dep, computed once in sortDeps so
	// the per-stat-change hot loop does no table lookups.
	kind depKind
}

type depKind uint8

const (
	depMultiply depKind = iota
	depMultiplyRating
	depAdd
	depAddFlooredSrc
	depAddRoundedSrc
)

func (sd *StatDependency) computeKind() {
	switch {
	case sd.src == sd.dst && isRoundedGameStat[sd.dst]:
		sd.kind = depMultiplyRating
	case sd.src == sd.dst:
		sd.kind = depMultiply
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
// int32(amount * (attribute - srcOffset)), truncating toward zero.
func (sdm *StatDependencyManager) NewDynamicRatingFromStatDependency(src Stat, dst Stat, amount float64, srcOffset float64) *StatDependency {
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

// A rating multiplier that comes from equipment (the Amplification trinkets).
// On ratings it is applied, and the result rounded, before any class
// multiplier; see StatDependency.fromEquipment.
func (sdm *StatDependencyManager) NewDynamicMultiplyStatFromEquipment(s Stat, amount float64) *StatDependency {
	dep := sdm.NewDynamicMultiplyStat(s, amount)
	dep.fromEquipment = true
	return dep
}

func (sdm *StatDependencyManager) sortDeps() {
	deps := make([]*StatDependency, 0, len(sdm.deps))

	// By looping through the stats in order of safeDeps, we guarantee proper
	// sorting of dependencies.
	for i, srcStat := range safeDepsOrder {
		for _, dstStat := range safeDepsOrder[i:] {
			// Combine all static deps into 1 for performance.
			startAmount := 0.0
			if srcStat == dstStat {
				startAmount = 1
			}

			amount := startAmount
			// Equipment multipliers apply before class multipliers; see
			// StatDependency.fromEquipment.
			for _, dep := range sdm.deps {
				if dep.src == srcStat && dep.dst == dstStat && dep.dynamic && dep.fromEquipment {
					deps = append(deps, dep)
				}
			}
			for _, dep := range sdm.deps {
				if dep.src != srcStat || dep.dst != dstStat {
					continue
				}

				if dep.dynamic {
					// Dynamic deps need to remain separate, so
					// they can be turned on/off.
					if !dep.fromEquipment {
						deps = append(deps, dep)
					}
				} else {
					if srcStat == dstStat {
						amount *= dep.amount
					} else {
						amount += dep.amount
					}
				}
			}

			if amount != startAmount {
				deps = append(deps, &StatDependency{
					enabled: true,
					src:     srcStat,
					dst:     dstStat,
					amount:  amount,
				})
			}
		}
	}

	for _, dep := range deps {
		dep.computeKind()
	}
	sdm.deps = deps
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
// the game applies along the way.
func (sdm *StatDependencyManager) ApplyStatDependencies(s Stats) Stats {
	return sdm.applyStatDependencies(s, false)
}

// Resolves the dependencies on a stat delta (the reforge optimizer's per-item
// changes). Offsets and integer conversions belong to totals, not to deltas,
// so this path stays linear.
func (sdm *StatDependencyManager) ApplyStatDependenciesToDelta(s Stats) Stats {
	return sdm.applyStatDependencies(s, true)
}

func (sdm *StatDependencyManager) applyStatDependencies(s Stats, delta bool) Stats {
	for _, dep := range sdm.deps {
		if !dep.enabled {
			continue
		}
		switch dep.kind {
		case depMultiplyRating:
			if delta {
				s[dep.dst] *= dep.amount
			} else {
				// Ratings are integers in the game: each percent modifier
				// is applied and the rating converted back before the next
				// one (round half to even, the CPU's default float-to-int
				// conversion). Verified on logged Mistweaver haste, where
				// Stance of the Wise Serpent's x1.5 lands on x.5 exactly.
				s[dep.dst] = math.RoundToEven(s[dep.dst] * dep.amount)
			}
		case depMultiply:
			s[dep.dst] *= dep.amount
		default:
			src := s[dep.src]
			switch dep.kind {
			case depAddFlooredSrc:
				// The dep sort guarantees the source stat is final here, and
				// the game floors attributes before dependents consume them
				// (e.g. health is derived from the floored Stamina).
				src = math.Floor(src)
			case depAddRoundedSrc:
				// Ratings are stored rounded-to-nearest instead.
				src = math.Round(src)
			}
			if dep.truncate && !delta {
				s[dep.dst] += math.Trunc((src - dep.srcOffset) * dep.amount)
			} else {
				s[dep.dst] += src * dep.amount
			}
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
