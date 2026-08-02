package frost

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/mage"
)

func (frost *FrostMage) registerHotfixes() {
	// 2013-09-23 Ice Lance's damage has been increased by 20%
	frost.AddStaticMod(core.SpellModConfig{
		ClassMask:  mage.MageSpellIceLance,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.2,
	})
}
