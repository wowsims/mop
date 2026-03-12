package fire

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/mage"
)

func (fire *FireMage) registerHotfixes() {
	// 2025-07-01 - Critical Mass Critical Strike bonus increased to 1.5x (was 1.3x).
	// 2025-11-13 - Critical Mass Critical Strike bonus decreased to 1.3x (was 1.5x).
	// fire.criticalMassMultiplier += 0.0

	// 2025-07-01 - Pyroblast's direct damage increase raised to 30% (was 11%).
	// 2025-11-13 - Pyroblast's direct damage decreased to 15% (was 30%).
	// 2026-02-02 - Reverted hotfix bonus, now 0% again.
	// 2026-02-03 - Revert the revert, now you can vert while you vert. 15% again.
	fire.AddStaticMod(core.SpellModConfig{
		ClassMask:  mage.MageSpellPyroblast,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: 0.15,
	})

	// 2025-07-01 - Combustion Ignite scaling increased to 50% (was 20%).
	// 2026-02-02 - Reverted hotfix bonus, now 20% again
	// fire.combustionDotDamageMultiplier += 0
}
