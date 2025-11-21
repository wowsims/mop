package affliction

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

func (affliction *AfflictionWarlock) registerHotfixes() {
	// 2025-07-31 - Agony’s damage over time increased by 5%.
	// 2025-11-13 - Agony’s damage over time decreased to 0% (was 5%).
	// affliction.AddStaticMod(core.SpellModConfig{
	// 	ClassMask:  warlock.WarlockSpellAgony,
	// 	Kind:       core.SpellMod_DamageDone_Pct,
	// 	FloatValue: 0.05,
	// })

	// 2025-09-22 - Corruption’s damage over time decreased from 33% to 20%.
	// 2025-11-13 - Corruption’s damage over time decreased to 0% (was 20%)
	// affliction.AddStaticMod(core.SpellModConfig{
	// 	ClassMask:  warlock.WarlockSpellCorruption,
	// 	Kind:       core.SpellMod_DamageDone_Pct,
	// 	FloatValue: 0.20,
	// })

	// 2025-07-31 - Malefic Damage increased by 50%
	// 2025-11-13 - Malefic Damage decreased to 25% (was 50%)
	// 2025-11-20 - Malefic Grasp Damage decreased to 15% (was 25%)
	// 2025-11-20 - Drain Soul Damage decreased to 20% (was 25%)
	affliction.AddStaticMod(core.SpellModConfig{
		ClassMask:  warlock.WarlockSpellMaleficGrasp,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.15,
	})
	affliction.AddStaticMod(core.SpellModConfig{
		ClassMask:  warlock.WarlockSpellDrainSoul,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.20,
	})

	// 2025-07-31 - The damage your Malefic Grasp causes your other DoTs to deal increased to 50% (was 30%).
	// 2025-11-13 - The damage your Malefic Grasp causes your other DoTs to deal decreased to 40% (was 50%).
	affliction.MaleficGraspMaleficEffectMultiplier += 0.1
	// 2025-07-31 - The damage your Drain Soul causes your other DoTs to deal increased to 100% (was 60%).
	// 2025-11-13 - The damage your Drain Soul causes your other DoTs to deal decreased to 80% (was 100%).
	// 2025-11-13 - 5.5.0 damage increase to Drain Soul’s DoT triggers reduced to 15% (was 20%).
	affliction.DrainSoulMaleficEffectMultiplier += 0.15

}
