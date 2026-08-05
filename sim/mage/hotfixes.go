package mage

import "github.com/wowsims/mop/sim/core"

func (mage *Mage) registerHotfixes() {
	// 2025-09-22 - Frostbolt/Frostfire bolt damage increased by 15%
	// 2025-11-13 - Frostbolt/Frostfire bolt damage decreased to 5% (was 15%)
	mage.AddStaticMod(core.SpellModConfig{
		ClassMask:  MageSpellFrostbolt | MageSpellFrostfireBolt | MageSpellIceLance,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.05,
	})
}
