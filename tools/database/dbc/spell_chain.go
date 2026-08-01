package dbc

import (
	"regexp"
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
// Returns 0 when the spell is not shaped like this, which is the overwhelming majority. Not a
// chainWalker method because it descends exactly one level and cannot recurse.
func referencedStatAura(containerSpellID int, itemLevel int) int {
	d := GetDBC()

	hasPeriodicDummy := false
	for _, se := range d.SpellEffectsInOrder(containerSpellID) {
		if se.EffectAura == A_PERIODIC_DUMMY {
			hasPeriodicDummy = true
			break
		}
	}
	if !hasPeriodicDummy {
		return 0
	}

	for _, match := range descriptionSpellRef.FindAllStringSubmatch(d.Spells[containerSpellID].Description, -1) {
		referenced, err := strconv.Atoi(match[1])
		if err != nil || referenced == containerSpellID {
			continue
		}
		if d.Spells[referenced].ID == 0 {
			continue
		}
		// A description can mention spells for all sorts of reasons. Only one that resolves to
		// actual stats is the aura being looked for.
		if len(collectStats(referenced, itemLevel).ToProtoMap()) > 0 {
			return referenced
		}
	}
	return 0
}

// Describes the stat aura a container aura accumulates, together with how often it gains a
// stack. Returns nil when the container has no such aura.
//
// The stat aura is itself a proto.ItemEffect: it has a buff, a duration, a stack cap and scaled
// stats, which is exactly that shape. The stack period belongs to the container's dummy tick
// rather than to the aura, so it is returned separately for the caller to put on the parent.
func buildStackingAura(containerSpellID int, itemLevel int) (*proto.ItemEffect, int32) {
	statAuraID := referencedStatAura(containerSpellID, itemLevel)
	if statAuraID == 0 {
		return nil, 0
	}

	var stackPeriodMs int32
	for _, se := range GetDBC().SpellEffectsInOrder(containerSpellID) {
		if se.EffectAura == A_PERIODIC_DUMMY {
			stackPeriodMs = int32(se.EffectAuraPeriod)
			break
		}
	}

	statAura := GetDBC().Spells[statAuraID]
	return &proto.ItemEffect{
		BuffId:              int32(statAuraID),
		BuffName:            statAura.NameLang,
		EffectDurationMs:    statAura.Duration,
		MaxCumulativeStacks: statAura.MaxCumulativeStacks,
		ScalingOptions:      map[int32]*proto.ScalingItemEffectProperties{},
	}, stackPeriodMs
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

	for _, se := range GetDBC().SpellEffectsInOrder(containerSpellID) {
		if se.EffectAura != A_PERIODIC_DUMMY || se.Coefficient == 0 {
			continue
		}
		amount := se.CalcCoefficientStatValue(itemLevel)
		for stat := range props.Stats {
			props.Stats[stat] = amount
		}
		break
	}
	return props
}
