package demonology

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

func (demonology *DemonologyWarlock) registerHotfixes() {

	// 2025-07-31 - Chaos Wave damage increased by 70%.
	demonology.AddStaticMod(core.SpellModConfig{
		ClassMask:  warlock.WarlockSpellChaosWave,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.7,
	})

	// 2025-07-31 - Hellfire damage increased by 25%.
	// 2025-07-31 - Immolation Aura damage increased by 25%.
	// 2025-11-13 - Hellfire damage decreased to 10% (was 25%).
	// 2025-11-13 - Immolation Aura damage decreased to 10% (was 25%).
	demonology.AddStaticMod(core.SpellModConfig{
		ClassMask:  warlock.WarlockSpellHellfire | warlock.WarlockSpellImmolationAura,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.10,
	})

	// 2025-09-31 - Doom’s damage over time increased from 33% to 50%.
	// 2025-11-13 - Doom’s damage over time decreased to 25% (was 50%).
	// 2026-02-02 - Reverted hotfix bonus, now 0% again.
	// demonology.AddStaticMod(core.SpellModConfig{
	// 	ClassMask:  warlock.WarlockSpellDoom,
	// 	Kind:       core.SpellMod_DamageDone_Pct,
	// 	FloatValue: 0,
	// })

	// 2025-09-31 - Soul Fire damage increased by 20%.
	// 2025-11-13 - Soul Fire damage decreased to 10% (from 20%).
	// 2026-02-02 - Reverted hotfix bonus, now 0% again.
	// demonology.AddStaticMod(core.SpellModConfig{
	// 	ClassMask:  warlock.WarlockSpellSoulFire,
	// 	Kind:       core.SpellMod_DamageDone_Pct,
	// 	FloatValue: 0.0,
	// })

	// 2025-09-31 - Wild Imp Damage increased from 43% to 60%.
	for _, imp := range demonology.WildImps {
		imp.AddStaticMod(core.SpellModConfig{
			ClassMask:  warlock.WarlockSpellImpFireBolt,
			Kind:       core.SpellMod_DamageDone_Pct,
			FloatValue: 0.60,
		})
	}
}
