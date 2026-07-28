package bulk

import (
	"fmt"

	"github.com/wowsims/mop/sim/core/proto"
)

func getPlayerSpec(player *proto.Player) (proto.Spec, error) {
	if player == nil {
		return proto.Spec_SpecUnknown, fmt.Errorf("unsupported player spec for backend bulk candidate generation")
	}

	switch player.GetSpec().(type) {
	case *proto.Player_BloodDeathKnight:
		return proto.Spec_SpecBloodDeathKnight, nil
	case *proto.Player_FrostDeathKnight:
		return proto.Spec_SpecFrostDeathKnight, nil
	case *proto.Player_UnholyDeathKnight:
		return proto.Spec_SpecUnholyDeathKnight, nil
	case *proto.Player_BalanceDruid:
		return proto.Spec_SpecBalanceDruid, nil
	case *proto.Player_FeralDruid:
		return proto.Spec_SpecFeralDruid, nil
	case *proto.Player_GuardianDruid:
		return proto.Spec_SpecGuardianDruid, nil
	case *proto.Player_RestorationDruid:
		return proto.Spec_SpecRestorationDruid, nil
	case *proto.Player_BeastMasteryHunter:
		return proto.Spec_SpecBeastMasteryHunter, nil
	case *proto.Player_MarksmanshipHunter:
		return proto.Spec_SpecMarksmanshipHunter, nil
	case *proto.Player_SurvivalHunter:
		return proto.Spec_SpecSurvivalHunter, nil
	case *proto.Player_ArcaneMage:
		return proto.Spec_SpecArcaneMage, nil
	case *proto.Player_FireMage:
		return proto.Spec_SpecFireMage, nil
	case *proto.Player_FrostMage:
		return proto.Spec_SpecFrostMage, nil
	case *proto.Player_BrewmasterMonk:
		return proto.Spec_SpecBrewmasterMonk, nil
	case *proto.Player_MistweaverMonk:
		return proto.Spec_SpecMistweaverMonk, nil
	case *proto.Player_WindwalkerMonk:
		return proto.Spec_SpecWindwalkerMonk, nil
	case *proto.Player_HolyPaladin:
		return proto.Spec_SpecHolyPaladin, nil
	case *proto.Player_ProtectionPaladin:
		return proto.Spec_SpecProtectionPaladin, nil
	case *proto.Player_RetributionPaladin:
		return proto.Spec_SpecRetributionPaladin, nil
	case *proto.Player_DisciplinePriest:
		return proto.Spec_SpecDisciplinePriest, nil
	case *proto.Player_HolyPriest:
		return proto.Spec_SpecHolyPriest, nil
	case *proto.Player_ShadowPriest:
		return proto.Spec_SpecShadowPriest, nil
	case *proto.Player_AssassinationRogue:
		return proto.Spec_SpecAssassinationRogue, nil
	case *proto.Player_CombatRogue:
		return proto.Spec_SpecCombatRogue, nil
	case *proto.Player_SubtletyRogue:
		return proto.Spec_SpecSubtletyRogue, nil
	case *proto.Player_ElementalShaman:
		return proto.Spec_SpecElementalShaman, nil
	case *proto.Player_EnhancementShaman:
		return proto.Spec_SpecEnhancementShaman, nil
	case *proto.Player_RestorationShaman:
		return proto.Spec_SpecRestorationShaman, nil
	case *proto.Player_AfflictionWarlock:
		return proto.Spec_SpecAfflictionWarlock, nil
	case *proto.Player_DemonologyWarlock:
		return proto.Spec_SpecDemonologyWarlock, nil
	case *proto.Player_DestructionWarlock:
		return proto.Spec_SpecDestructionWarlock, nil
	case *proto.Player_ArmsWarrior:
		return proto.Spec_SpecArmsWarrior, nil
	case *proto.Player_FuryWarrior:
		return proto.Spec_SpecFuryWarrior, nil
	case *proto.Player_ProtectionWarrior:
		return proto.Spec_SpecProtectionWarrior, nil
	default:
		return proto.Spec_SpecUnknown, fmt.Errorf("unsupported player spec for backend bulk candidate generation")
	}
}
