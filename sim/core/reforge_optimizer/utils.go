package reforgeoptimizer

import (
	"github.com/wowsims/mop/sim/core/proto"
)

// Player spec/profession predicates used by the optimizer.

// playerIsHybridCaster: Boomkin, Shadow, Elemental, Mistweaver route Spirit -> SpellHit and
// exclude hit-rating gems (Spirit already covers hit).
func playerIsHybridCaster(player *proto.Player) bool {
	switch player.GetSpec().(type) {
	case *proto.Player_BalanceDruid,
		*proto.Player_ShadowPriest,
		*proto.Player_ElementalShaman,
		*proto.Player_MistweaverMonk,
		*proto.Player_HolyPaladin:
		return true
	default:
		return false
	}
}

// playerIsTrueCaster: every spellcaster spec. These have zero Expertise EP, so an Expertise
// reforge is only ever a spell-hit proxy — strictly dominated by a Hit reforge from the same
// source stat (see the prefer-Hit pruning in buildYalpsVariables).
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

func playerIsGuardianDruid(player *proto.Player) bool {
	_, ok := player.GetSpec().(*proto.Player_GuardianDruid)
	return ok
}

func playerIsFeralDruid(player *proto.Player) bool {
	_, ok := player.GetSpec().(*proto.Player_FeralDruid)
	return ok
}

func playerHasProfession(player *proto.Player, profession proto.Profession) bool {
	return player.GetProfession1() == profession || player.GetProfession2() == profession
}
