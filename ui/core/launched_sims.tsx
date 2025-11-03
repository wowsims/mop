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
		phase: Phase.Phase1,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFrostDeathKnight]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecUnholyDeathKnight]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	// Druid
	[Spec.SpecBalanceDruid]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecFeralDruid]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecGuardianDruid]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecRestorationDruid]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	// Hunter
	[Spec.SpecBeastMasteryHunter]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Alpha,
	},
	[Spec.SpecMarksmanshipHunter]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Alpha,
	},
	[Spec.SpecSurvivalHunter]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Alpha,
	},
	// Mage
	[Spec.SpecArcaneMage]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecFireMage]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecFrostMage]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	// Monk
	[Spec.SpecBrewmasterMonk]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecMistweaverMonk]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecWindwalkerMonk]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Beta,
	},
	// Paladin
	[Spec.SpecHolyPaladin]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	[Spec.SpecProtectionPaladin]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecRetributionPaladin]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
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
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
	// Rogue
	[Spec.SpecAssassinationRogue]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecCombatRogue]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecSubtletyRogue]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	// Shaman
	[Spec.SpecElementalShaman]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Alpha,
	},
	[Spec.SpecEnhancementShaman]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Alpha,
	},
	[Spec.SpecRestorationShaman]: {
		phase: Phase.Phase1,
		status: LaunchStatus.Unlaunched,
	},
	// Warlock
	[Spec.SpecAfflictionWarlock]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecDemonologyWarlock]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
	[Spec.SpecDestructionWarlock]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
	// Warrior
	[Spec.SpecArmsWarrior]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecFuryWarrior]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Launched,
	},
	[Spec.SpecProtectionWarrior]: {
		phase: Phase.Phase2,
		status: LaunchStatus.Beta,
	},
};

export const getSpecLaunchStatus = (player: Player<any>) => simLaunchStatuses[player.getSpec() as Spec].status;
