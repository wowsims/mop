package priest

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (priest *Priest) registerSpiritualHealing() {

	if priest.Spec == proto.Spec_SpecShadowPriest {
		return
	}

	priest.AddStaticMod(core.SpellModConfig{
		ClassMask:  PriestSpellFlashHeal,
		FloatValue: 0.25,
		Kind:       core.SpellMod_DamageDone_Pct,
	})
}
