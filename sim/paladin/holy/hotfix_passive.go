package holy

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/paladin"
)

// Holy specific Hotfix Passive https://www.wowhead.com/mop-classic/spell=137029/hotfix-passive
func (holy *HolyPaladin) registerHotfixPassive() {
	// EffectIndex 4: hit and expertise equal to 50% of Spirit gained from items or
	// effects. Base Spirit is excluded, so its share is taken back as a flat debit.
	// https://wago.tools/db2/SpellEffect?build=5.5.0.61496&filter%5BSpellID%5D=137029&page=1
	baseSpiritShare := -0.5 * holy.GetBaseStats()[stats.Spirit]

	core.MakePermanent(holy.RegisterAura(core.Aura{
		Label:      "Hotfix Passive" + holy.Label,
		ActionID:   core.ActionID{SpellID: 137029},
		BuildPhase: core.CharacterBuildPhaseTalents,
	})).AttachStatDependency(
		holy.NewDynamicStatDependency(stats.Spirit, stats.HitRating, 0.5),
	).AttachStatDependency(
		holy.NewDynamicStatDependency(stats.Spirit, stats.ExpertiseRating, 0.5),
	).AttachStatsBuff(stats.Stats{
		stats.HitRating:       baseSpiritShare,
		stats.ExpertiseRating: baseSpiritShare,
	}).AttachSpellMod(core.SpellModConfig{
		// Beta changes 2025-06-13: https://www.wowhead.com/mop-classic/news/some-warlords-of-draenor-pre-patch-class-changes-coming-to-mists-of-pandaria-377239
		// - Eternal Flame’s periodic healing lowered by 28%. 5.4 Revert
		// EffectIndex 1 on the Holy specific Hotfix Passive https://wago.tools/db2/SpellEffect?build=5.5.0.61411&filter%5BSpellID%5D=137029&page=1
		Kind:       core.SpellMod_DotDamageDone_Pct,
		ClassMask:  paladin.SpellMaskWordOfGlory,
		FloatValue: -0.28,
	}).AttachSpellMod(core.SpellModConfig{
		// Beta changes 2025-06-16: https://www.wowhead.com/mop-classic/news/blood-death-knights-buffed-and-even-more-class-balance-adjustments-mists-of-377292
		// - Crusader Strike’s cost for Holy Paladins has been decreased by 20%, bringing it to 12% of base mana (was 15% of base mana). [New]
		// EffectIndex 3 on the Holy specific Hotfix Passive https://wago.tools/db2/SpellEffect?build=5.5.0.61496&filter%5BSpellID%5D=137029&page=1
		Kind:       core.SpellMod_PowerCost_Pct,
		ClassMask:  paladin.SpellMaskCrusaderStrike,
		FloatValue: -0.2,
	})
}
