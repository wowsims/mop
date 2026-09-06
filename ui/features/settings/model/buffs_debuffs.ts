import { ActionId } from '@domain/proto_utils/action_id';
import { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import {
	makeBooleanDebuffInput,
	makeBooleanIndividualBuffInput,
	makeBooleanRaidBuffInput,
	makeMultistateIndividualBuffInput,
	makeMultistateRaidBuffInput,
} from '@ui-kit/icon_inputs';
import * as InputHelpers from '@ui-kit/input_helpers';
import { IconPicker } from '@ui-kit/pickers/icon_picker';
import { MultiIconPicker } from '@ui-kit/pickers/multi_icon_picker';

import { IconPickerStatOption, RenderableStatOptions } from './stat_options';

///////////////////////////////////////////////////////////////////////////
//                                 RAID BUFFS
///////////////////////////////////////////////////////////////////////////

export const StatsBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(20217), fieldName: 'blessingOfKings' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(1126), fieldName: 'markOfTheWild' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(90363), fieldName: 'embraceOfTheShaleSpider' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(115921), fieldName: 'legacyOfTheEmperor' }),
	],
	i18n.t('settings_tab.raid_buffs.stats'),
);

export const AttackPowerBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(19506), fieldName: 'trueshotAura' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(57330), fieldName: 'hornOfWinter' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(6673), fieldName: 'battleShout' }),
	],
	i18n.t('settings_tab.raid_buffs.attack_power'),
);

export const AttackSpeedBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(55610), fieldName: 'unholyAura' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(128433), fieldName: 'serpentsSwiftness' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(113742), fieldName: 'swiftbladesCunning' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(30809), fieldName: 'unleashedRage' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(128432), fieldName: 'cacklingHowl' }),
	],
	i18n.t('settings_tab.raid_buffs.attack_speed'),
);

export const SpellPowerBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(1459), fieldName: 'arcaneBrilliance' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(126309), fieldName: 'stillWater' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(77747), fieldName: 'burningWrath' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(109773), fieldName: 'darkIntent' }),
	],
	i18n.t('settings_tab.raid_buffs.spell_power'),
);

export const SpellHasteBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(24907), fieldName: 'moonkinAura' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(49868), fieldName: 'mindQuickening' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(51470), fieldName: 'elementalOath' }),
	],
	i18n.t('settings_tab.raid_buffs.spell_haste'),
);

export const CritBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(17007), fieldName: 'leaderOfThePack' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(24604), fieldName: 'furiousHowl' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(90309), fieldName: 'terrifyingRoar' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(116781), fieldName: 'legacyOfTheWhiteTiger' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(1459), fieldName: 'arcaneBrilliance' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(126309), fieldName: 'stillWater' }),
	],
	i18n.t('settings_tab.raid_buffs.crit_percent'),
);

export const MasteryBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(19740), fieldName: 'blessingOfMight' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(93435), fieldName: 'roarOfCourage' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(128997), fieldName: 'spiritBeastBlessing' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(116956), fieldName: 'graceOfAir' }),
	],
	i18n.t('settings_tab.raid_buffs.mastery'),
);

export const StaminaBuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(469), fieldName: 'commandingShout' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(109773), fieldName: 'darkIntent' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(21562), fieldName: 'powerWordFortitude' }),
		makeBooleanRaidBuffInput({ actionId: ActionId.fromSpellId(90364), fieldName: 'qirajiFortitude' }),
	],
	i18n.t('settings_tab.raid_buffs.stamina'),
);

// Misc Buffs
export const ManaTideTotem = makeMultistateRaidBuffInput({ actionId: ActionId.fromSpellId(16190), numStates: 5, fieldName: 'manaTideTotemCount' });

// External Damage Cooldowns
export const MajorHasteBuff = makeBooleanRaidBuffInput({
	actionId: ActionId.fromSpellId(2825),
	fieldName: 'bloodlust',
	label: i18n.t('settings_tab.external_damage_cooldowns.bloodlust'),
});
export const Skullbanner = makeMultistateRaidBuffInput({
	actionId: ActionId.fromSpellId(114207),
	numStates: 11,
	fieldName: 'skullBannerCount',
	label: i18n.t('settings_tab.external_damage_cooldowns.skull_banner'),
});
export const StormLashTotem = makeMultistateRaidBuffInput({
	actionId: ActionId.fromSpellId(120668),
	numStates: 11,
	fieldName: 'stormlashTotemCount',
	label: i18n.t('settings_tab.external_damage_cooldowns.stormlash_totem'),
});
export const TricksOfTheTrade = makeBooleanIndividualBuffInput({
	actionId: ActionId.fromSpellId(57933),
	fieldName: 'tricksOfTheTrade',
	label: i18n.t('settings_tab.external_damage_cooldowns.tricks_of_the_trade'),
});
export const UnholyFrenzy = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(49016),
	numStates: 11,
	fieldName: 'unholyFrenzyCount',
	label: i18n.t('settings_tab.external_damage_cooldowns.unholy_frenzy'),
});
export const ShatteringThrow = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(1249459),
	numStates: 11,
	fieldName: 'shatteringThrowCount',
	label: i18n.t('settings_tab.external_damage_cooldowns.shattering_throw'),
});

// External Defensive Cooldowns
// TODO: Look at these, what we want and how to structure them for multiple available
export const VigilanceCount = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(114030),
	numStates: 11,
	fieldName: 'vigilanceCount',
	label: i18n.t('settings_tab.external_defensive_cooldowns.vigilance'),
});
export const DevotionAuraCount = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(31821),
	numStates: 11,
	fieldName: 'devotionAuraCount',
	label: i18n.t('settings_tab.external_defensive_cooldowns.devotion_aura'),
});
export const PainSuppressionCount = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(33206),
	numStates: 11,
	fieldName: 'painSuppressionCount',
	label: i18n.t('settings_tab.external_defensive_cooldowns.pain_suppression'),
});
// export const GuardianSpirits = makeMultistateIndividualBuffInput({ actionId: ActionId.fromSpellId(47788), numStates: 11, fieldName: 'guardianSpirits' });
export const RallyingCryCount = makeMultistateIndividualBuffInput({
	actionId: ActionId.fromSpellId(97462),
	numStates: 11,
	fieldName: 'rallyingCryCount',
	label: i18n.t('settings_tab.external_defensive_cooldowns.rallying_cry'),
});
///////////////////////////////////////////////////////////////////////////
//                                 DEBUFFS
///////////////////////////////////////////////////////////////////////////

export const MajorArmorDebuff = makeBooleanDebuffInput({
	actionId: ActionId.fromSpellId(113746),
	fieldName: 'weakenedArmor',
	label: i18n.t('settings_tab.debuffs.armor_reduction'),
});

export const DamageReduction = makeBooleanDebuffInput({
	actionId: ActionId.fromSpellId(115798),
	fieldName: 'weakenedBlows',
	label: i18n.t('settings_tab.debuffs.phys_dmg_reduction'),
});

export const CastSpeedDebuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(73975), fieldName: 'necroticStrike' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(58604), fieldName: 'lavaBreath' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(50274), fieldName: 'sporeCloud' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(5761), fieldName: 'mindNumbingPoison' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(31589), fieldName: 'slow' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(109466), fieldName: 'curseOfEnfeeblement' }),
	],
	i18n.t('settings_tab.debuffs.cast_speed'),
);

export const PhysicalDamageDebuff = makeBooleanDebuffInput({
	actionId: ActionId.fromSpellId(81326),
	fieldName: 'physicalVulnerability',
	label: i18n.t('settings_tab.debuffs.phys_dmg'),
});

export const SpellDamageDebuff = InputHelpers.makeMultiIconInput(
	[
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(24844), fieldName: 'lightningBreath' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(1490), fieldName: 'curseOfElements' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(58410), fieldName: 'masterPoisoner' }),
		makeBooleanDebuffInput({ actionId: ActionId.fromSpellId(34889), fieldName: 'fireBreath' }),
	],
	i18n.t('settings_tab.debuffs.spell_dmg'),
);

///////////////////////////////////////////////////////////////////////////
//                                 CONFIGS
///////////////////////////////////////////////////////////////////////////

export const RAID_BUFFS_CONFIG = [
	// Standard buffs
	{
		config: StatsBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatStrength, Stat.StatAgility, Stat.StatIntellect],
	},
	{
		config: AttackPowerBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
	{
		config: AttackSpeedBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
	{
		config: SpellPowerBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatSpellPower],
	},
	{
		config: SpellHasteBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatSpellPower],
	},
	{
		config: CritBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatCritRating],
	},
	{
		config: MasteryBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatMasteryRating],
	},
	{
		config: StaminaBuff,
		picker: MultiIconPicker,
		stats: [Stat.StatStamina],
	},
] as RenderableStatOptions[];

export const RAID_BUFFS_MISC_CONFIG = [
	{
		config: ManaTideTotem,
		picker: IconPicker,
		stats: [Stat.StatSpirit],
	},
] as IconPickerStatOption[];

export const RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN = [
	{
		config: MajorHasteBuff,
		picker: IconPicker,
		stats: [Stat.StatHasteRating],
	},
	{
		config: Skullbanner,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower, Stat.StatSpellPower],
	},
	{
		config: StormLashTotem,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower, Stat.StatSpellPower],
	},
	{
		config: TricksOfTheTrade,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower, Stat.StatSpellPower],
	},
	{
		config: UnholyFrenzy,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
	{
		config: ShatteringThrow,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
] as IconPickerStatOption[];

export const RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN = [
	{
		config: VigilanceCount,
		picker: IconPicker,
		stats: [Stat.StatStamina],
	},
	{
		config: DevotionAuraCount,
		picker: IconPicker,
		stats: [Stat.StatStamina],
	},
	{
		config: PainSuppressionCount,
		picker: IconPicker,
		stats: [Stat.StatStamina],
	},
	{
		config: RallyingCryCount,
		picker: IconPicker,
		stats: [Stat.StatStamina],
	},
] as IconPickerStatOption[];

export const DEBUFFS_CONFIG = [
	{
		config: MajorArmorDebuff,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
	{
		config: PhysicalDamageDebuff,
		picker: IconPicker,
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower],
	},
	{
		config: SpellDamageDebuff,
		picker: MultiIconPicker,
		// Enabled for all specs because it affects Stormlash Totem
		stats: [Stat.StatAttackPower, Stat.StatRangedAttackPower, Stat.StatSpellPower],
	},
	{
		config: DamageReduction,
		picker: IconPicker,
		stats: [Stat.StatStamina],
	},
	{
		config: CastSpeedDebuff,
		picker: MultiIconPicker,
		stats: [Stat.StatStamina],
	},
] as RenderableStatOptions[];
