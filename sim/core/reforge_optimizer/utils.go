package reforgeoptimizer

import (
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func playerIsTrueCaster(player *proto.Player) bool {
	switch player.GetSpec().(type) {
	case *proto.Player_ArcaneMage,
		*proto.Player_FireMage,
		*proto.Player_FrostMage,
		*proto.Player_AfflictionWarlock,
		*proto.Player_DemonologyWarlock,
		*proto.Player_DestructionWarlock,
		*proto.Player_DisciplinePriest,
		*proto.Player_HolyPriest,
		*proto.Player_ShadowPriest,
		*proto.Player_BalanceDruid,
		*proto.Player_RestorationDruid,
		*proto.Player_ElementalShaman,
		*proto.Player_RestorationShaman,
		*proto.Player_HolyPaladin,
		*proto.Player_MistweaverMonk:
		return true
	default:
		return false
	}
}

// Hybrid casters (Boomkin, Shadow, Elemental, Mistweaver) route Spirit → SpellHit in the
// optimizer, and hit-rating gems are excluded for them since Spirit already covers hit.
func playerIsHybridCaster(player *proto.Player) bool {
	switch player.GetSpec().(type) {
	case *proto.Player_BalanceDruid,
		*proto.Player_ShadowPriest,
		*proto.Player_ElementalShaman,
		*proto.Player_MistweaverMonk:
		return true
	default:
		return false
	}
}

func playerIsTankSpec(player *proto.Player) bool {
	switch player.GetSpec().(type) {
	case *proto.Player_BloodDeathKnight,
		*proto.Player_GuardianDruid,
		*proto.Player_BrewmasterMonk,
		*proto.Player_ProtectionPaladin,
		*proto.Player_ProtectionWarrior:
		return true
	default:
		return false
	}
}

func playerHasProfession(player *proto.Player, profession proto.Profession) bool {
	return player.GetProfession1() == profession || player.GetProfession2() == profession
}

// Returns true if any crit or haste pseudo-stat has a configured cap. Used to decide
// whether Yellow sockets need more than 1 gem option (normally 1 is sufficient, but crit/
// haste caps make additional options worth exploring).
func hasCritOrHasteCap(hardCaps []reforgeHardCap, softCaps []reforgeSoftCap) bool {
	for _, unitStat := range []stats.UnitStat{
		stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalCritPercent),
		stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent),
		stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatMeleeHastePercent),
		stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatRangedHastePercent),
		stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent),
	} {
		if unitStatHasOptimizerCap(unitStat, hardCaps, softCaps) {
			return true
		}
	}
	return false
}

func unitStatHasOptimizerCap(unitStat stats.UnitStat, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap) bool {
	for _, hardCap := range hardCaps {
		if hardCap.unitStat == unitStat {
			return true
		}
	}
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			return true
		}
	}
	return false
}
