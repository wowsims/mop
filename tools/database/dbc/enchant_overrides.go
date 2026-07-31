package dbc

// Links an enchantment to the spells it applies.
//
// The MoP weapon enchants below apply their buff from server script. Their trigger spell
// carries a single A_DUMMY effect with EffectTriggerSpell = 0, so there is no edge in
// SpellEffect to follow and the stats are unreachable no matter how the chain is walked.
// Everything else about them *is* in DBC — the buff spells hold correct stat values and
// durations, and the trigger spell holds the RPPM rate and its modifiers — so only the
// link itself has to be supplied here.
//
// Ordering matters for readability only; each listed spell becomes its own proc effect.
var EnchantBuffSpellOverrides = map[int]([]int){
	4441: {104423, 104509, 104510}, // Windsong: haste / crit / mastery, one picked at random
	4442: {104993},                 // Jade Spirit: intellect, plus spirit below 25% mana
	4444: {118334, 118335},         // Dancing Steel: agility / strength, higher one chosen
	4445: {116631},                 // Colossus: damage absorb, so no stats resolve
	4446: {116660},                 // River's Song: dodge
	5124: {142535},                 // Spirit of Conquest: the 5.4 Jade Spirit reissue
	5125: {142530},                 // Bloody Dancing Steel: agility and strength on one spell
}
