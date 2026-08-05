package dbc

// The SpellItemEnchantment row an item points at through Socket_match_enchantment_ID: the
// bonus granted for matching every socket colour.
//
// Field names mirror Enchant so both go through processEnchantmentEffects. EffectPoints is
// read from EffectPointsMin; min and max are equal on every socket bonus an item references,
// so the choice does not matter here (the enchant query happens to read the max).
type SocketBonus struct {
	ID           int
	Effects      []int
	EffectPoints []int
	EffectArgs   []int
}
