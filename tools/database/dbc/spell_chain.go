package dbc

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"

	"github.com/wowsims/mop/sim/core/proto"
)

// Walks the chain of spells reachable through SpellEffect.EffectTriggerSpell, visiting each
// spell at most once.
//
// The traversal policy differs per caller - some examine a whole level before descending, some
// interleave, some fall back to siblings - so each keeps its own recursion. What they share, and
// what used to be re-implemented four times over, is this: proc chains can loop back on
// themselves, and the effects of a spell have to be read in index order or any traversal that
// stops at the first match becomes non-deterministic across runs.
type chainWalker struct {
	visited map[int]bool
}

func newChainWalker() *chainWalker {
	return &chainWalker{visited: map[int]bool{}}
}

// Returns spellID's effects in index order the first time spellID is reached, and nil on every
// later visit so a cyclic chain terminates. Callers treat that the same way they treat a spell
// with no effects.
func (w *chainWalker) effects(spellID int) []SpellEffect {
	if w.visited[spellID] {
		return nil
	}
	w.visited[spellID] = true
	return GetDBC().SpellEffectsInOrder(spellID)
}

// A $<spellID><token> reference inside a spell description, e.g. the "$138737s1" in Blades of
// Renataki's "Grants $138737s1 Agility, increasing by $138737s1 every $t1 sec.". Four digits is
// the shortest real spell ID, which keeps the plain $s1 / $t1 / $d tokens out.
var descriptionSpellRef = regexp.MustCompile(`\$(\d{4,7})[a-zA-Z]`)

// The first of spellID's effects carrying aura, in effect index order, or nil if it has none.
func firstEffectWithAura(spellID int, aura EffectAuraType) *SpellEffect {
	for _, se := range GetDBC().SpellEffectsInOrder(spellID) {
		if se.EffectAura == aura {
			return &se
		}
	}

	return nil
}

// Resolves the stat aura a stacking container aura accumulates.
//
// The MoP stacking trinkets - Renataki's Soul Charm and the four others shaped like it - apply a
// container aura that holds the duration and ticks A_PERIODIC_DUMMY, and name the aura carrying
// the actual stats only in their description text. There is no EffectTriggerSpell edge to follow,
// so a chain walk cannot reach it.
//
// Reading the container's own coefficient instead is not an option: it happens to match, but its
// MiscValue is 0, which is Strength, while the referenced aura's is 1, Agility. The stat identity
// exists only on the referenced aura.
//
// Only meaningful for a spell that ticks a periodic dummy, which buildStackingAura establishes
// before calling. Returns 0 when no referenced spell resolves to stats. Not a chainWalker method
// because it descends exactly one level and cannot recurse.
// Container spells whose accumulating stat aura is stated outright instead of being mined out of
// the description, the same way the enchant buff links in tools/database/overrides.go state a link
// SpellEffect cannot carry. Empty because every shipping stacking trinket offers one candidate; this is where the
// answer goes the first time one offers more, which referencedStatAura refuses to guess at.
var StackingStatAuraOverrides = map[int]int{}

func referencedStatAura(containerSpellID int, itemLevel int) int {
	if statAuraID, ok := StackingStatAuraOverrides[containerSpellID]; ok {
		return statAuraID
	}

	d := GetDBC()

	candidates := []int{}
	for _, match := range descriptionSpellRef.FindAllStringSubmatch(d.Spells[containerSpellID].Description, -1) {
		referenced, err := strconv.Atoi(match[1])
		if err != nil || referenced == containerSpellID || slices.Contains(candidates, referenced) {
			continue
		}
		if d.Spells[referenced].ID == 0 {
			continue
		}
		// A description can mention spells for all sorts of reasons. Only one that resolves to
		// actual stats is the aura being looked for.
		if len(collectStats(referenced, itemLevel).ToProtoMap()) > 0 {
			candidates = append(candidates, referenced)
		}
	}

	if len(candidates) == 0 {
		return 0
	}
	if len(candidates) == 1 {
		return candidates[0]
	}

	// Taking the first would bake whichever spell the wording happens to mention earliest into
	// db.json with no diagnostic, and a reworded description - this repo carries a hotfix overlay -
	// could change that answer silently. Reading English prose is a guess; it should not be a
	// silent one.
	panic(fmt.Sprintf("spell %d (%q) description names %v as candidate stat auras; add the intended one to StackingStatAuraOverrides",
		containerSpellID, d.Spells[containerSpellID].NameLang, candidates))
}

// Describes the stat aura a container aura accumulates, together with how often it gains a
// stack. Returns nil when the container has no such aura.
//
// The stat aura is itself a proto.ItemEffect: it has a buff, a duration, a stack cap and scaled
// stats, which is exactly that shape. The stack period belongs to the container's dummy tick
// rather than to the aura, so it is returned separately for the caller to put on the parent.
func buildStackingAura(containerSpellID int, itemLevel int) (*proto.ItemEffect, int32) {
	// The dummy tick is both what marks the spell as a container and where the stack period
	// comes from, so it is resolved once here rather than looked for again further down.
	dummy := firstEffectWithAura(containerSpellID, A_PERIODIC_DUMMY)
	if dummy == nil {
		return nil, 0
	}

	statAuraID := referencedStatAura(containerSpellID, itemLevel)
	if statAuraID == 0 {
		return nil, 0
	}

	statAura := GetDBC().Spells[statAuraID]
	return &proto.ItemEffect{
		BuffId:              int32(statAuraID),
		BuffName:            statAura.NameLang,
		EffectDurationMs:    statAura.Duration,
		MaxCumulativeStacks: statAura.MaxCumulativeStacks,
		ScalingOptions:      map[int32]*proto.ScalingItemEffectProperties{},
	}, int32(dummy.EffectAuraPeriod)
}

// The per-stack stats of a stacking aura, at one item level.
//
// The referenced aura says which stat is granted and how many stacks are possible, but not always
// how much. On Skeer's Bloodsoaked Talisman it carries a flat 520 that is only right at base item
// level, while the container's periodic dummy carries the real coefficient; on Renataki's the two
// agree, which is why the difference is easy to miss. Where the container has a coefficient it
// wins - the same "identity from one effect, amount from another" rule buildScalingProps already
// applies to A_PROC_TRIGGER_SPELL_WITH_VALUE.
func buildStackingProps(containerSpellID, statAuraID, itemLevel, itemSpellID int) *proto.ScalingItemEffectProperties {
	props := buildScalingProps(statAuraID, itemLevel, itemSpellID)

	// Not firstEffectWithAura: what is wanted here is the first dummy tick that carries a
	// coefficient, and a container may hold an earlier one that does not.
	for _, se := range GetDBC().SpellEffectsInOrder(containerSpellID) {
		if se.EffectAura != A_PERIODIC_DUMMY || se.Coefficient == 0 {
			continue
		}

		// A single coefficient cannot say what each stat of a multi-stat aura is worth, and
		// assigning it to every one of them would multiply the total rather than split it. Every
		// shipping stacking trinket grants exactly one stat, so this is a guard, not a case.
		if len(props.Stats) > 1 {
			panic(fmt.Sprintf("spell %d accumulates %d stats but container %d carries one coefficient; per-stat amounts have to be resolved before this can be generated",
				statAuraID, len(props.Stats), containerSpellID))
		}

		amount := se.CalcCoefficientStatValue(itemLevel)
		for stat := range props.Stats {
			props.Stats[stat] = amount
		}
		break
	}
	return props
}
