package dbc

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
	return dbcInstance.SpellEffectsInOrder(spellID)
}
