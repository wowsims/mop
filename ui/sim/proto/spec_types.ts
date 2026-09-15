// The spec-indexed type machinery: which specs a class has, and which rotation,
// talents and options proto each spec uses. Types only - the helpers that use
// them stay in ./utils.
import { Player } from '@generated/proto/api';
import { Class, Spec } from '@generated/proto/common';
import {
	BloodDeathKnight,
	BloodDeathKnight_Options,
	BloodDeathKnight_Rotation,
	DeathKnightOptions,
	DeathKnightTalents,
	FrostDeathKnight,
	FrostDeathKnight_Options,
	FrostDeathKnight_Rotation,
	UnholyDeathKnight,
	UnholyDeathKnight_Options,
	UnholyDeathKnight_Rotation,
} from '@generated/proto/death_knight';
import {
	BalanceDruid,
	BalanceDruid_Options,
	BalanceDruid_Rotation,
	DruidOptions,
	DruidTalents,
	FeralDruid,
	FeralDruid_Options,
	FeralDruid_Rotation,
	GuardianDruid,
	GuardianDruid_Options,
	GuardianDruid_Rotation,
	RestorationDruid,
	RestorationDruid_Options,
	RestorationDruid_Rotation,
} from '@generated/proto/druid';
import {
	BeastMasteryHunter,
	BeastMasteryHunter_Options,
	BeastMasteryHunter_Rotation,
	HunterOptions,
	HunterTalents,
	MarksmanshipHunter,
	MarksmanshipHunter_Options,
	MarksmanshipHunter_Rotation,
	SurvivalHunter,
	SurvivalHunter_Options,
	SurvivalHunter_Rotation,
} from '@generated/proto/hunter';
import {
	ArcaneMage,
	ArcaneMage_Options,
	ArcaneMage_Rotation,
	FireMage,
	FireMage_Options,
	FireMage_Rotation,
	FrostMage,
	FrostMage_Options,
	FrostMage_Rotation,
	MageOptions,
	MageTalents,
} from '@generated/proto/mage';
import {
	BrewmasterMonk,
	BrewmasterMonk_Options,
	BrewmasterMonk_Rotation,
	MistweaverMonk,
	MistweaverMonk_Options,
	MistweaverMonk_Rotation,
	MonkOptions,
	MonkTalents,
	WindwalkerMonk,
	WindwalkerMonk_Options,
	WindwalkerMonk_Rotation,
} from '@generated/proto/monk';
import {
	HolyPaladin,
	HolyPaladin_Options,
	HolyPaladin_Rotation,
	PaladinOptions,
	PaladinTalents,
	ProtectionPaladin,
	ProtectionPaladin_Options,
	ProtectionPaladin_Rotation,
	RetributionPaladin,
	RetributionPaladin_Options,
	RetributionPaladin_Rotation,
} from '@generated/proto/paladin';
import {
	DisciplinePriest,
	DisciplinePriest_Options,
	DisciplinePriest_Rotation,
	HolyPriest,
	HolyPriest_Options,
	HolyPriest_Rotation,
	PriestOptions,
	PriestTalents,
	ShadowPriest,
	ShadowPriest_Options,
	ShadowPriest_Rotation,
} from '@generated/proto/priest';
import {
	AssassinationRogue,
	AssassinationRogue_Options,
	AssassinationRogue_Rotation,
	CombatRogue,
	CombatRogue_Options,
	CombatRogue_Rotation,
	RogueOptions,
	RogueTalents,
	SubtletyRogue,
	SubtletyRogue_Options,
	SubtletyRogue_Rotation,
} from '@generated/proto/rogue';
import {
	ElementalShaman,
	ElementalShaman_Options,
	ElementalShaman_Rotation,
	EnhancementShaman,
	EnhancementShaman_Options,
	EnhancementShaman_Rotation,
	RestorationShaman,
	RestorationShaman_Options,
	RestorationShaman_Rotation,
	ShamanOptions,
	ShamanTalents,
} from '@generated/proto/shaman';
import {
	AfflictionWarlock,
	AfflictionWarlock_Options,
	AfflictionWarlock_Rotation,
	DemonologyWarlock,
	DemonologyWarlock_Options,
	DemonologyWarlock_Rotation,
	DestructionWarlock,
	DestructionWarlock_Options,
	DestructionWarlock_Rotation,
	WarlockOptions,
	WarlockTalents,
} from '@generated/proto/warlock';
import {
	ArmsWarrior,
	ArmsWarrior_Options,
	ArmsWarrior_Rotation,
	FuryWarrior,
	FuryWarrior_Options,
	FuryWarrior_Rotation,
	ProtectionWarrior,
	ProtectionWarrior_Options,
	ProtectionWarrior_Rotation,
	WarriorOptions,
	WarriorTalents,
} from '@generated/proto/warrior';

// Placeholder classes to fill the Unknown Spec Type Functions entry below
type UnknownSpecs = Spec.SpecUnknown;
export class UnknownRotation {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownTalents {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownClassOptions {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownSpecOptions {
	classOptions: UnknownClassOptions;
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {
		this.classOptions = new UnknownClassOptions();
	}
}

export type DeathKnightSpecs = Spec.SpecBloodDeathKnight | Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight;
export type DruidSpecs = Spec.SpecBalanceDruid | Spec.SpecFeralDruid | Spec.SpecGuardianDruid | Spec.SpecRestorationDruid;
export type HunterSpecs = Spec.SpecBeastMasteryHunter | Spec.SpecMarksmanshipHunter | Spec.SpecSurvivalHunter;
export type MageSpecs = Spec.SpecArcaneMage | Spec.SpecFireMage | Spec.SpecFrostMage;
export type PaladinSpecs = Spec.SpecHolyPaladin | Spec.SpecRetributionPaladin | Spec.SpecProtectionPaladin;
export type PriestSpecs = Spec.SpecDisciplinePriest | Spec.SpecHolyPriest | Spec.SpecShadowPriest;
export type RogueSpecs = Spec.SpecAssassinationRogue | Spec.SpecCombatRogue | Spec.SpecSubtletyRogue;
export type ShamanSpecs = Spec.SpecElementalShaman | Spec.SpecEnhancementShaman | Spec.SpecRestorationShaman;
export type WarlockSpecs = Spec.SpecAfflictionWarlock | Spec.SpecDemonologyWarlock | Spec.SpecDestructionWarlock;
export type WarriorSpecs = Spec.SpecArmsWarrior | Spec.SpecFuryWarrior | Spec.SpecProtectionWarrior;
export type MonkSpecs = Spec.SpecBrewmasterMonk | Spec.SpecMistweaverMonk | Spec.SpecWindwalkerMonk;

export type ClassSpecs<T extends Class> = T extends Class.ClassDeathKnight
	? DeathKnightSpecs
	: T extends Class.ClassDruid
		? DruidSpecs
		: T extends Class.ClassHunter
			? HunterSpecs
			: T extends Class.ClassMage
				? MageSpecs
				: T extends Class.ClassMonk
					? MonkSpecs
					: T extends Class.ClassPaladin
						? PaladinSpecs
						: T extends Class.ClassPriest
							? PriestSpecs
							: T extends Class.ClassRogue
								? RogueSpecs
								: T extends Class.ClassShaman
									? ShamanSpecs
									: T extends Class.ClassWarlock
										? WarlockSpecs
										: T extends Class.ClassWarrior
											? WarriorSpecs
											: // Should never reach this case
												UnknownSpecs;

export type SpecClasses<T extends Spec> = T extends DeathKnightSpecs
	? Class.ClassDeathKnight
	: // Druid
		T extends DruidSpecs
		? Class.ClassDruid
		: // Hunter
			T extends HunterSpecs
			? Class.ClassHunter
			: // Mage
				T extends MageSpecs
				? Class.ClassMage
				: // Monk
					T extends MonkSpecs
					? Class.ClassMonk
					: // Paladin
						T extends PaladinSpecs
						? Class.ClassPaladin
						: // Priest
							T extends PriestSpecs
							? Class.ClassPriest
							: // Rogue
								T extends RogueSpecs
								? Class.ClassRogue
								: // Shaman
									T extends ShamanSpecs
									? Class.ClassShaman
									: // Warlock
										T extends WarlockSpecs
										? Class.ClassWarlock
										: // Warrior
											T extends WarriorSpecs
											? Class.ClassWarrior
											: // Should never reach this case
												Class.ClassUnknown;

export type SpecRotation<T extends Spec> =
	// Death Knight
	T extends Spec.SpecBloodDeathKnight
		? BloodDeathKnight_Rotation
		: T extends Spec.SpecFrostDeathKnight
			? FrostDeathKnight_Rotation
			: T extends Spec.SpecUnholyDeathKnight
				? UnholyDeathKnight_Rotation
				: // Druid
					T extends Spec.SpecBalanceDruid
					? BalanceDruid_Rotation
					: T extends Spec.SpecFeralDruid
						? FeralDruid_Rotation
						: T extends Spec.SpecGuardianDruid
							? GuardianDruid_Rotation
							: T extends Spec.SpecRestorationDruid
								? RestorationDruid_Rotation
								: // Hunter
									T extends Spec.SpecBeastMasteryHunter
									? BeastMasteryHunter_Rotation
									: T extends Spec.SpecMarksmanshipHunter
										? MarksmanshipHunter_Rotation
										: T extends Spec.SpecSurvivalHunter
											? SurvivalHunter_Rotation
											: // Mage
												T extends Spec.SpecArcaneMage
												? ArcaneMage_Rotation
												: T extends Spec.SpecFireMage
													? FireMage_Rotation
													: T extends Spec.SpecFrostMage
														? FrostMage_Rotation
														: // Monk
															T extends Spec.SpecBrewmasterMonk
															? BrewmasterMonk_Rotation
															: T extends Spec.SpecMistweaverMonk
																? MistweaverMonk_Rotation
																: T extends Spec.SpecWindwalkerMonk
																	? WindwalkerMonk_Rotation
																	: // Paladin
																		T extends Spec.SpecHolyPaladin
																		? HolyPaladin_Rotation
																		: T extends Spec.SpecProtectionPaladin
																			? ProtectionPaladin_Rotation
																			: T extends Spec.SpecRetributionPaladin
																				? RetributionPaladin_Rotation
																				: // Priest
																					T extends Spec.SpecDisciplinePriest
																					? DisciplinePriest_Rotation
																					: T extends Spec.SpecHolyPriest
																						? HolyPriest_Rotation
																						: T extends Spec.SpecShadowPriest
																							? ShadowPriest_Rotation
																							: // Rogue
																								T extends Spec.SpecAssassinationRogue
																								? AssassinationRogue_Rotation
																								: T extends Spec.SpecCombatRogue
																									? CombatRogue_Rotation
																									: T extends Spec.SpecSubtletyRogue
																										? SubtletyRogue_Rotation
																										: // Shaman
																											T extends Spec.SpecElementalShaman
																											? ElementalShaman_Rotation
																											: T extends Spec.SpecEnhancementShaman
																												? EnhancementShaman_Rotation
																												: T extends Spec.SpecRestorationShaman
																													? RestorationShaman_Rotation
																													: // Warlock
																														T extends Spec.SpecAfflictionWarlock
																														? AfflictionWarlock_Rotation
																														: T extends Spec.SpecDemonologyWarlock
																															? DemonologyWarlock_Rotation
																															: T extends Spec.SpecDestructionWarlock
																																? DestructionWarlock_Rotation
																																: // Warrior
																																	T extends Spec.SpecArmsWarrior
																																	? ArmsWarrior_Rotation
																																	: T extends Spec.SpecFuryWarrior
																																		? FuryWarrior_Rotation
																																		: T extends Spec.SpecProtectionWarrior
																																			? ProtectionWarrior_Rotation
																																			: // Should never reach this case
																																				UnknownRotation;

export type SpecTalents<T extends Spec> =
	// Death Knight
	T extends DeathKnightSpecs
		? DeathKnightTalents
		: // Druid
			T extends DruidSpecs
			? DruidTalents
			: // Hunter
				T extends HunterSpecs
				? HunterTalents
				: // Mage
					T extends MageSpecs
					? MageTalents
					: // Monk
						T extends MonkSpecs
						? MonkTalents
						: // Paladin
							T extends PaladinSpecs
							? PaladinTalents
							: // Priest
								T extends PriestSpecs
								? PriestTalents
								: // Rogue
									T extends RogueSpecs
									? RogueTalents
									: // Shaman
										T extends ShamanSpecs
										? ShamanTalents
										: // Warlock
											T extends WarlockSpecs
											? WarlockTalents
											: // Warrior
												T extends WarriorSpecs
												? WarriorTalents
												: // Should never reach this case
													UnknownTalents;

export type ClassOptions<T extends Spec> =
	// Death Knight
	T extends DeathKnightSpecs
		? DeathKnightOptions
		: // Druid
			T extends DruidSpecs
			? DruidOptions
			: // Hunter
				T extends HunterSpecs
				? HunterOptions
				: // Mage
					T extends MageSpecs
					? MageOptions
					: // Monk
						T extends MonkSpecs
						? MonkOptions
						: // Paladin
							T extends PaladinSpecs
							? PaladinOptions
							: // Priest
								T extends PriestSpecs
								? PriestOptions
								: // Rogue
									T extends RogueSpecs
									? RogueOptions
									: // Shaman
										T extends ShamanSpecs
										? ShamanOptions
										: // Warlock
											T extends WarlockSpecs
											? WarlockOptions
											: // Warrior
												T extends WarriorSpecs
												? WarriorOptions
												: // Should never reach this case
													UnknownClassOptions;

export type SpecOptions<T extends Spec> =
	// Death Knight
	T extends Spec.SpecBloodDeathKnight
		? BloodDeathKnight_Options
		: T extends Spec.SpecFrostDeathKnight
			? FrostDeathKnight_Options
			: T extends Spec.SpecUnholyDeathKnight
				? UnholyDeathKnight_Options
				: // Druid
					T extends Spec.SpecBalanceDruid
					? BalanceDruid_Options
					: T extends Spec.SpecFeralDruid
						? FeralDruid_Options
						: T extends Spec.SpecGuardianDruid
							? GuardianDruid_Options
							: T extends Spec.SpecRestorationDruid
								? RestorationDruid_Options
								: // Hunter
									T extends Spec.SpecBeastMasteryHunter
									? BeastMasteryHunter_Options
									: T extends Spec.SpecMarksmanshipHunter
										? MarksmanshipHunter_Options
										: T extends Spec.SpecSurvivalHunter
											? SurvivalHunter_Options
											: // Mage
												T extends Spec.SpecArcaneMage
												? ArcaneMage_Options
												: T extends Spec.SpecFireMage
													? FireMage_Options
													: T extends Spec.SpecFrostMage
														? FrostMage_Options
														: // Monk
															T extends Spec.SpecBrewmasterMonk
															? BrewmasterMonk_Options
															: T extends Spec.SpecMistweaverMonk
																? MistweaverMonk_Options
																: T extends Spec.SpecWindwalkerMonk
																	? WindwalkerMonk_Options
																	: // Paladin
																		T extends Spec.SpecHolyPaladin
																		? HolyPaladin_Options
																		: T extends Spec.SpecProtectionPaladin
																			? ProtectionPaladin_Options
																			: T extends Spec.SpecRetributionPaladin
																				? RetributionPaladin_Options
																				: // Priest
																					T extends Spec.SpecDisciplinePriest
																					? DisciplinePriest_Options
																					: T extends Spec.SpecHolyPriest
																						? HolyPriest_Options
																						: T extends Spec.SpecShadowPriest
																							? ShadowPriest_Options
																							: // Rogue
																								T extends Spec.SpecAssassinationRogue
																								? AssassinationRogue_Options
																								: T extends Spec.SpecCombatRogue
																									? CombatRogue_Options
																									: T extends Spec.SpecSubtletyRogue
																										? SubtletyRogue_Options
																										: // Shaman
																											T extends Spec.SpecElementalShaman
																											? ElementalShaman_Options
																											: T extends Spec.SpecEnhancementShaman
																												? EnhancementShaman_Options
																												: T extends Spec.SpecRestorationShaman
																													? RestorationShaman_Options
																													: // Warlock
																														T extends Spec.SpecAfflictionWarlock
																														? AfflictionWarlock_Options
																														: T extends Spec.SpecDemonologyWarlock
																															? DemonologyWarlock_Options
																															: T extends Spec.SpecDestructionWarlock
																																? DestructionWarlock_Options
																																: // Warrior
																																	T extends Spec.SpecArmsWarrior
																																	? ArmsWarrior_Options
																																	: T extends Spec.SpecFuryWarrior
																																		? FuryWarrior_Options
																																		: T extends Spec.SpecProtectionWarrior
																																			? ProtectionWarrior_Options
																																			: // Should never reach this case
																																				UnknownSpecOptions;

export type SpecType<T extends Spec> =
	// Death Knight
	T extends Spec.SpecBloodDeathKnight
		? BloodDeathKnight
		: T extends Spec.SpecFrostDeathKnight
			? FrostDeathKnight
			: T extends Spec.SpecUnholyDeathKnight
				? UnholyDeathKnight
				: // Druid
					T extends Spec.SpecBalanceDruid
					? BalanceDruid
					: T extends Spec.SpecFeralDruid
						? FeralDruid
						: T extends Spec.SpecGuardianDruid
							? GuardianDruid
							: T extends Spec.SpecRestorationDruid
								? RestorationDruid
								: // Hunter
									T extends Spec.SpecBeastMasteryHunter
									? BeastMasteryHunter
									: T extends Spec.SpecMarksmanshipHunter
										? MarksmanshipHunter
										: T extends Spec.SpecSurvivalHunter
											? SurvivalHunter
											: // Mage
												T extends Spec.SpecArcaneMage
												? ArcaneMage
												: T extends Spec.SpecFireMage
													? FireMage
													: T extends Spec.SpecFrostMage
														? FrostMage
														: // Monk
															T extends Spec.SpecBrewmasterMonk
															? BrewmasterMonk
															: T extends Spec.SpecMistweaverMonk
																? MistweaverMonk
																: T extends Spec.SpecWindwalkerMonk
																	? WindwalkerMonk
																	: // Paladin
																		T extends Spec.SpecHolyPaladin
																		? HolyPaladin
																		: T extends Spec.SpecProtectionPaladin
																			? ProtectionPaladin
																			: T extends Spec.SpecRetributionPaladin
																				? RetributionPaladin
																				: // Priest
																					T extends Spec.SpecDisciplinePriest
																					? DisciplinePriest
																					: T extends Spec.SpecHolyPriest
																						? HolyPriest
																						: T extends Spec.SpecShadowPriest
																							? ShadowPriest
																							: // Rogue
																								T extends Spec.SpecAssassinationRogue
																								? AssassinationRogue
																								: T extends Spec.SpecCombatRogue
																									? CombatRogue
																									: T extends Spec.SpecSubtletyRogue
																										? SubtletyRogue
																										: // Shaman
																											T extends Spec.SpecElementalShaman
																											? ElementalShaman
																											: T extends Spec.SpecEnhancementShaman
																												? EnhancementShaman
																												: T extends Spec.SpecRestorationShaman
																													? RestorationShaman
																													: // Warlock
																														T extends Spec.SpecAfflictionWarlock
																														? AfflictionWarlock
																														: T extends Spec.SpecDemonologyWarlock
																															? DemonologyWarlock
																															: T extends Spec.SpecDestructionWarlock
																																? DestructionWarlock
																																: // Warrior
																																	T extends Spec.SpecArmsWarrior
																																	? ArmsWarrior
																																	: T extends Spec.SpecFuryWarrior
																																		? FuryWarrior
																																		: T extends Spec.SpecProtectionWarrior
																																			? ProtectionWarrior
																																			: // Should never reach this case
																																				Spec.SpecUnknown;

export type SpecTypeFunctions<SpecType extends Spec> = {
	rotationCreate: () => SpecRotation<SpecType>;
	rotationEquals: (a: SpecRotation<SpecType>, b: SpecRotation<SpecType>) => boolean;
	rotationCopy: (a: SpecRotation<SpecType>) => SpecRotation<SpecType>;
	rotationToJson: (a: SpecRotation<SpecType>) => any;
	rotationFromJson: (obj: any) => SpecRotation<SpecType>;

	talentsCreate: () => SpecTalents<SpecType>;
	talentsEquals: (a: SpecTalents<SpecType>, b: SpecTalents<SpecType>) => boolean;
	talentsCopy: (a: SpecTalents<SpecType>) => SpecTalents<SpecType>;
	talentsToJson: (a: SpecTalents<SpecType>) => any;
	talentsFromJson: (obj: any) => SpecTalents<SpecType>;

	optionsCreate: () => SpecOptions<SpecType>;
	optionsEquals: (a: SpecOptions<SpecType>, b: SpecOptions<SpecType>) => boolean;
	optionsCopy: (a: SpecOptions<SpecType>) => SpecOptions<SpecType>;
	optionsToJson: (a: SpecOptions<SpecType>) => any;
	optionsFromJson: (obj: any) => SpecOptions<SpecType>;
	optionsFromPlayer: (player: Player) => SpecOptions<SpecType>;
};
