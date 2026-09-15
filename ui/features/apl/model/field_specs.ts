import {
	APLActionDamageAmplifier_AmplificationType as AmplificationType,
	APLActionGuardianHotwDpsRotation_Strategy as HotwStrategy,
	APLActionItemSwap_SwapSet as ItemSwapSet,
	APLValue,
	APLValueCompare_ComparisonOperator as ComparisonOperator,
	APLValueEclipsePhase,
	APLValueIsExecutePhase_ExecutePhaseThreshold as ExecutePhaseThreshold,
	APLValueMath_MathOperator as MathOperator,
	APLValueRuneSlot,
	APLValueRuneType,
} from '@generated/proto/apl';
import { ActionID, Stat } from '@generated/proto/common';
import { FeralDruid_Rotation_AplType } from '@generated/proto/druid';
import { ShamanTotems_TotemType as TotemType } from '@generated/proto/shaman';
import i18n from '@i18n/config';
import { translateStat } from '@i18n/localization';
import { getEnumValues } from '@sim/utils/collections';
import { randomUUID } from '@sim/utils/misc';

import type { ACTION_ID_SET } from './action_id_sets';
import type { APLFieldDescriptor, DEFAULT_UNIT_REF } from './field_descriptors';
import type { UNIT_SET } from './unit_sets';

/**
 * One option in a fixed enum dropdown.
 *
 * Every value here is a proto enum member, so `number` is the whole domain.
 */
export interface EnumOption {
	value: number;
	label: string;
	tooltip?: string;
}

export interface EnumTable {
	/** The trigger's text while nothing matches. */
	defaultLabel: string;
	options: Array<EnumOption>;
}

interface FieldBase {
	/** The proto field this edits, inside the kind's impl message. */
	field: string;
	label?: string;
	labelTooltip?: string;
	/** What to write into the field when it is unset. */
	newValue: () => any;
}

/**
 * A field descriptor resolved to the picker shape the view has to build.
 *
 * Twenty-nine descriptor types collapse to thirteen kinds: the twelve fixed-enum types are one
 * `enum`, the four alias descriptors (`minIcd`, `reactionTime`, `useDotBaseValue`,
 * `useRuneRegenBaseValue`) are a `number` and three `boolean`s, and `variableName`/`groupName` are
 * one `rotationName` over two sources.
 */
export type AplFieldSpec =
	| (FieldBase & { kind: 'boolean' })
	| (FieldBase & { kind: 'number'; float: boolean })
	| (FieldBase & { kind: 'string' })
	| (FieldBase & { kind: 'enum'; table: EnumTable })
	| (FieldBase & { kind: 'actionId'; actionIdSet: ACTION_ID_SET; unitRefField?: string; defaultUnitRef: DEFAULT_UNIT_REF })
	| (FieldBase & { kind: 'unit'; unitSet: UNIT_SET })
	| (FieldBase & { kind: 'rotationName'; source: 'variables' | 'groups' })
	| (FieldBase & { kind: 'placeholderName' })
	| (FieldBase & { kind: 'groupVariables'; groupNameField: string })
	| (FieldBase & { kind: 'value' })
	| (FieldBase & { kind: 'valueList' })
	| (FieldBase & { kind: 'action' })
	| (FieldBase & { kind: 'actionList' });

const none = () => i18n.t('common.none');

const ECLIPSE_TYPES: EnumTable = {
	defaultLabel: i18n.t('rotation_tab.apl.helpers.eclipse_types.lunar'),
	options: [
		{ value: APLValueEclipsePhase.LunarPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.lunar') },
		{ value: APLValueEclipsePhase.SolarPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.solar') },
		{ value: APLValueEclipsePhase.NeutralPhase, label: i18n.t('rotation_tab.apl.helpers.eclipse_types.neutral') },
	],
};

const RUNE_TYPES: Array<EnumOption> = [
	{ value: APLValueRuneType.RuneBlood, label: i18n.t('rotation_tab.apl.helpers.rune_types.blood') },
	{ value: APLValueRuneType.RuneFrost, label: i18n.t('rotation_tab.apl.helpers.rune_types.frost') },
	{ value: APLValueRuneType.RuneUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_types.unholy') },
];

const RUNE_DEATH: EnumOption = { value: APLValueRuneType.RuneDeath, label: i18n.t('rotation_tab.apl.helpers.rune_types.death') };

const RUNE_SLOTS: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: APLValueRuneSlot.SlotLeftBlood, label: i18n.t('rotation_tab.apl.helpers.rune_slots.blood_left') },
		{ value: APLValueRuneSlot.SlotRightBlood, label: i18n.t('rotation_tab.apl.helpers.rune_slots.blood_right') },
		{ value: APLValueRuneSlot.SlotLeftFrost, label: i18n.t('rotation_tab.apl.helpers.rune_slots.frost_left') },
		{ value: APLValueRuneSlot.SlotRightFrost, label: i18n.t('rotation_tab.apl.helpers.rune_slots.frost_right') },
		{ value: APLValueRuneSlot.SlotLeftUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_slots.unholy_left') },
		{ value: APLValueRuneSlot.SlotRightUnholy, label: i18n.t('rotation_tab.apl.helpers.rune_slots.unholy_right') },
	],
};

const ROTATION_TYPES: EnumTable = {
	defaultLabel: i18n.t('rotation_tab.apl.helpers.rotation_types.single_target'),
	options: [
		{ value: FeralDruid_Rotation_AplType.SingleTarget, label: i18n.t('rotation_tab.apl.helpers.rotation_types.single_target') },
		{ value: FeralDruid_Rotation_AplType.Aoe, label: i18n.t('rotation_tab.apl.helpers.rotation_types.aoe') },
	],
};

const HOTW_STRATEGIES: EnumTable = {
	defaultLabel: i18n.t('rotation_tab.apl.helpers.hotw_strategies.caster'),
	options: [
		{ value: HotwStrategy.Caster, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.caster') },
		{ value: HotwStrategy.Cat, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.cat') },
		{ value: HotwStrategy.Hybrid, label: i18n.t('rotation_tab.apl.helpers.hotw_strategies.hybrid') },
	],
};

const STAT_TYPES: EnumTable = {
	defaultLabel: none(),
	options: [{ value: -1, label: none() }, ...(getEnumValues(Stat) as Array<Stat>).map(stat => ({ value: stat, label: translateStat(stat) }))],
};

const DAMAGE_AMP_TYPES: EnumTable = {
	defaultLabel: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.label'),
	options: [
		{
			value: AmplificationType.CasterBuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.caster_buff.tooltip'),
		},
		{
			value: AmplificationType.EnvironmentBuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.environment_buff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.environment_buff.tooltip'),
		},
		{
			value: AmplificationType.TargetDebuff,
			label: i18n.t('rotation_tab.apl.helpers.amplification_types.target_debuff.label'),
			tooltip: i18n.t('rotation_tab.apl.helpers.amplification_types.target_debuff.tooltip'),
		},
	],
};

const ITEM_SWAP_SETS: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: ItemSwapSet.Main, label: i18n.t('rotation_tab.apl.item_swap_sets.main') },
		{ value: ItemSwapSet.Swap1, label: i18n.t('rotation_tab.apl.item_swap_sets.swapped') },
	],
};

const COMPARISON_OPERATORS: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: ComparisonOperator.OpEq, label: i18n.t('rotation_tab.apl.operators.equals') },
		{ value: ComparisonOperator.OpNe, label: i18n.t('rotation_tab.apl.operators.not_equals') },
		{ value: ComparisonOperator.OpGe, label: i18n.t('rotation_tab.apl.operators.greater_than_or_equal') },
		{ value: ComparisonOperator.OpGt, label: i18n.t('rotation_tab.apl.operators.greater_than') },
		{ value: ComparisonOperator.OpLe, label: i18n.t('rotation_tab.apl.operators.less_than_or_equal') },
		{ value: ComparisonOperator.OpLt, label: i18n.t('rotation_tab.apl.operators.less_than') },
	],
};

const MATH_OPERATORS: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: MathOperator.OpAdd, label: i18n.t('rotation_tab.apl.operators.add') },
		{ value: MathOperator.OpSub, label: i18n.t('rotation_tab.apl.operators.subtract') },
		{ value: MathOperator.OpMul, label: i18n.t('rotation_tab.apl.operators.multiply') },
		{ value: MathOperator.OpDiv, label: i18n.t('rotation_tab.apl.operators.divide') },
	],
};

const EXECUTE_PHASE_THRESHOLDS: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: ExecutePhaseThreshold.E20, label: i18n.t('rotation_tab.apl.execute_phases.e20') },
		{ value: ExecutePhaseThreshold.E25, label: i18n.t('rotation_tab.apl.execute_phases.e25') },
		{ value: ExecutePhaseThreshold.E35, label: i18n.t('rotation_tab.apl.execute_phases.e35') },
		{ value: ExecutePhaseThreshold.E45, label: i18n.t('rotation_tab.apl.execute_phases.e45') },
		{ value: ExecutePhaseThreshold.E90, label: i18n.t('rotation_tab.apl.execute_phases.e90') },
	],
};

const TOTEM_TYPES: EnumTable = {
	defaultLabel: none(),
	options: [
		{ value: TotemType.Earth, label: i18n.t('rotation_tab.apl.totem_types.earth') },
		{ value: TotemType.Air, label: i18n.t('rotation_tab.apl.totem_types.air') },
		{ value: TotemType.Fire, label: i18n.t('rotation_tab.apl.totem_types.fire') },
		{ value: TotemType.Water, label: i18n.t('rotation_tab.apl.totem_types.water') },
	],
};

const newAplValue = () => APLValue.create({ uuid: { value: randomUUID() } });

/**
 * Resolves one DOM-free descriptor to the picker shape, its label and its unset-field default.
 *
 * Two quirks are preserved rather than corrected, because the rotations users have saved were
 * built against them:
 *
 * - **The eclipse default is `NeutralPhase`, not `LunarPhase`.** The default is written as a rune
 *   enum member — the wrong enum, whose member is `1`, which is `NeutralPhase` here. The trigger
 *   still reads "Lunar" until the field is touched, because that is the `defaultLabel` and `1`
 *   matches the Neutral option.
 * - **`booleanFieldConfig`'s `label` argument wins over `options.label`**, because it is assigned
 *   after the options object is spread. No caller passes both, but that is the rule.
 */
export const resolveField = (descriptor: APLFieldDescriptor): AplFieldSpec => {
	const options = 'options' in descriptor ? descriptor.options : undefined;
	const base = { label: options?.label, labelTooltip: options?.labelTooltip };
	const asEnum = (field: string, table: EnumTable, newValue: () => number, label?: string, labelTooltip?: string): AplFieldSpec => ({
		kind: 'enum',
		field,
		table,
		newValue,
		label,
		labelTooltip,
	});

	switch (descriptor.type) {
		case 'actionId':
			return {
				...base,
				kind: 'actionId',
				field: descriptor.field,
				newValue: () => ActionID.create(),
				actionIdSet: descriptor.actionIdSet,
				unitRefField: descriptor.unitRefField,
				defaultUnitRef: descriptor.defaultUnitRef || 'self',
			};
		case 'unit':
			return { ...base, kind: 'unit', field: descriptor.field, newValue: () => undefined, unitSet: descriptor.unitSet };
		case 'boolean':
			return { ...base, kind: 'boolean', field: descriptor.field, newValue: () => false, label: descriptor.label };
		case 'number':
			return { ...base, kind: 'number', field: descriptor.field, newValue: () => 0, float: descriptor.float };
		case 'string':
			return { ...base, kind: 'string', field: descriptor.field, newValue: () => '' };
		case 'variableName':
			return { ...base, kind: 'rotationName', field: descriptor.field, newValue: () => '', source: 'variables' };
		case 'groupName':
			return { ...base, kind: 'rotationName', field: descriptor.field, newValue: () => '', source: 'groups' };
		case 'placeholderName':
			return { ...base, kind: 'placeholderName', field: descriptor.field, newValue: () => '' };
		case 'groupReferenceVariables':
			return { ...base, kind: 'groupVariables', field: descriptor.field, newValue: () => [], groupNameField: descriptor.groupNameField };
		case 'eclipseType':
			return asEnum(descriptor.field, ECLIPSE_TYPES, () => APLValueEclipsePhase.NeutralPhase);
		case 'runeType':
			return asEnum(
				descriptor.field,
				{ defaultLabel: none(), options: descriptor.includeDeath ? [...RUNE_TYPES, RUNE_DEATH] : RUNE_TYPES },
				() => APLValueRuneType.RuneBlood,
			);
		case 'runeSlot':
			return asEnum(descriptor.field, RUNE_SLOTS, () => APLValueRuneSlot.SlotLeftBlood);
		case 'rotationType':
			return asEnum(
				descriptor.field,
				ROTATION_TYPES,
				() => FeralDruid_Rotation_AplType.SingleTarget,
				i18n.t('rotation_tab.apl.helpers.field_configs.type'),
			);
		case 'hotwStrategy':
			return asEnum(descriptor.field, HOTW_STRATEGIES, () => HotwStrategy.Caster, i18n.t('rotation_tab.apl.helpers.field_configs.strategy'));
		case 'statType':
			return asEnum(descriptor.field, STAT_TYPES, () => 0, i18n.t('rotation_tab.apl.helpers.field_configs.buff_type'));
		case 'damageAmpType':
			return asEnum(
				descriptor.field,
				DAMAGE_AMP_TYPES,
				() => AmplificationType.CasterBuff,
				i18n.t('rotation_tab.apl.helpers.field_configs.amplification_type'),
			);
		case 'itemSwapSet':
			return asEnum(descriptor.field, ITEM_SWAP_SETS, () => ItemSwapSet.Swap1);
		case 'comparisonOperator':
			return asEnum(descriptor.field, COMPARISON_OPERATORS, () => ComparisonOperator.OpEq);
		case 'mathOperator':
			return asEnum(descriptor.field, MATH_OPERATORS, () => MathOperator.OpAdd);
		case 'executePhaseThreshold':
			return asEnum(descriptor.field, EXECUTE_PHASE_THRESHOLDS, () => ExecutePhaseThreshold.E20);
		case 'totemType':
			return asEnum(descriptor.field, TOTEM_TYPES, () => TotemType.Water);
		case 'minIcd':
			return {
				kind: 'number',
				field: 'minIcdSeconds',
				float: false,
				newValue: () => 0,
				label: i18n.t('rotation_tab.apl.helpers.field_configs.min_icd'),
				labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.min_icd_tooltip'),
			};
		case 'reactionTime':
			return {
				kind: 'boolean',
				field: 'includeReactionTime',
				newValue: () => false,
				label: i18n.t('rotation_tab.apl.helpers.field_configs.include_reaction_time'),
				labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.include_reaction_time_tooltip'),
			};
		case 'useDotBaseValue':
			return {
				kind: 'boolean',
				field: 'useBaseValue',
				newValue: () => false,
				label: i18n.t('rotation_tab.apl.helpers.field_configs.use_base_value'),
				labelTooltip: i18n.t('rotation_tab.apl.helpers.field_configs.use_base_value_tooltip'),
			};
		case 'useRuneRegenBaseValue':
			return {
				kind: 'boolean',
				field: 'useBaseValue',
				newValue: () => false,
				label: 'Use base value',
				labelTooltip: 'If checked, will return your base (unmodified by procs/lust etc) rune regen rate',
			};
		case 'value':
			return { ...base, kind: 'value', field: descriptor.field, newValue: newAplValue };
		case 'valueList':
			return { kind: 'valueList', field: descriptor.field, newValue: () => [] };
		// `actionFieldConfig` mints an `APLValue`, not an `APLAction`, for an unset inner action. Only
		// `schedule.innerAction` uses it and the message is replaced the moment a kind is picked, so the
		// mismatch never reaches the sim — it is left as it is.
		case 'action':
			return { kind: 'action', field: descriptor.field, newValue: newAplValue };
		case 'actionList':
			return { kind: 'actionList', field: descriptor.field, newValue: () => [] };
	}
};
