import { Phase } from './constants/other';
import { Player } from './player';
import { Spec } from './proto/common';

// This file is for anything related to launching a new sim. DO NOT touch this
// file until your sim is ready to launch!

export enum LaunchStatus {
	Unlaunched,
	Alpha,
	Beta,
	Launched,
}

export type SimStatus = {
	phase: Phase;
	status: LaunchStatus;
};

export const raidSimStatus: SimStatus = {
	phase: Phase.Phase1,
	status: LaunchStatus.Unlaunched,
};

// This list controls which links are shown in the top-left dropdown menu.
export const simLaunchStatuses: Record<Spec, SimStatus> = {
	[Spec.SpecUnknown]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	// Death Knight
	[Spec.SpecBloodDeathKnight]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFrostDeathKnight]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecUnholyDeathKnight]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Druid
	[Spec.SpecBalanceDruid]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFeralDruid]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecGuardianDruid]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecRestorationDruid]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	// Hunter
	[Spec.SpecBeastMasteryHunter]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecMarksmanshipHunter]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecSurvivalHunter]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Mage
	[Spec.SpecArcaneMage]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFireMage]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFrostMage]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Monk
	[Spec.SpecBrewmasterMonk]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecMistweaverMonk]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecWindwalkerMonk]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	// Paladin
	[Spec.SpecHolyPaladin]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecProtectionPaladin]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecRetributionPaladin]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Priest
	[Spec.SpecDisciplinePriest]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecHolyPriest]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecShadowPriest]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Rogue
	[Spec.SpecAssassinationRogue]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecCombatRogue]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecSubtletyRogue]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Shaman
	[Spec.SpecElementalShaman]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecEnhancementShaman]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecRestorationShaman]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	// Warlock
	[Spec.SpecAfflictionWarlock]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecDemonologyWarlock]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecDestructionWarlock]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Beta,
	},
	// Warrior
	[Spec.SpecArmsWarrior]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecFuryWarrior]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecProtectionWarrior]: {
		phase: Phase.Phase3,
		status: LaunchStatus.Launched,
	},
};

export const getSpecLaunchStatus = (player: Player<any>) => simLaunchStatuses[player.getSpec() as Spec].status;
