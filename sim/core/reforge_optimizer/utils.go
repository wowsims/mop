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
