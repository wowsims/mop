package core

import "time"

// ImminentMagicAbilityProvider is an optional interface a TargetAI can implement so external
// systems (e.g. a player's reactive defensive-cooldown logic, like Death Knight Anti-Magic
// Shell) can ask "are you about to unleash harmful magic damage?" without needing to know this
// NPC's specific ability set. Implementations should return true if a harmful magic ability is
// either genuinely mid-cast (a real telegraph) or, absent one, close enough to its own CD
// becoming ready that it's likely to be cast on the NPC's next decision tick.
//
// This is checked via a type assertion against Target.AI, so encounters that don't implement it
// (including any boss AI not built for this reactive-AMS project) simply don't participate --
// callers should always have a non-reactive fallback for that case.
type ImminentMagicAbilityProvider interface {
	HasImminentMagicAbility(sim *Simulation, reactionWindow time.Duration) bool
}

// SpellbookHasImminentMagicAbility is the default building block most TargetAI implementations
// of ImminentMagicAbilityProvider can just delegate to (see e.g. any soo/*_ai.go boss file's own
// HasImminentMagicAbility method): true if any harmful (non-physical, damage-dealing) spell
// registered on target is either currently mid-cast (a real telegraph -- Target.Hardcast tracks
// any unit's in-progress cast generically) or has spell.TimeToReady(sim) within reactionWindow.
//
// Bosses whose rotation gates casting on something TimeToReady can't see on its own (e.g.
// Paragons of the Klaxxi's per-NPC active-window gating, since a gated ability's CD timer just
// sits "ready" indefinitely while skipped rather than being re-armed) must check that condition
// themselves before falling back to this helper -- see paragons_of_the_klaxxi_ai.go.
func SpellbookHasImminentMagicAbility(target *Target, sim *Simulation, reactionWindow time.Duration) bool {
	hardcasting := target.Hardcast.Expires > sim.CurrentTime

	for _, spell := range target.Spellbook {
		if !isHarmfulMagicSpell(spell) {
			continue
		}
		if hardcasting && spell.ActionID == target.Hardcast.ActionID {
			return true
		}
		if spell.TimeToReady(sim) <= reactionWindow {
			return true
		}
	}

	return false
}

func isHarmfulMagicSpell(spell *Spell) bool {
	return spell.ProcMask.Matches(ProcMaskSpellDamage) && !spell.SpellSchool.Matches(SpellSchoolPhysical)
}
