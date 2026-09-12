import {
	APLActionDamageAmplifier_AmplificationType as AmplificationType,
	APLActionGuardianHotwDpsRotation_Strategy as HotwStrategy,
	APLActionItemSwap_SwapSet as ItemSwapSet,
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
import { getEnumValues } from '@sim/utils/collections';
import { describe, expect, it, vi } from 'vitest';

import {
	actionFieldConfig,
	actionIdFieldConfig,
	actionListFieldConfig,
	booleanFieldConfig,
	comparisonOperatorFieldConfig,
	damageAmpTypeFieldConfig,
	eclipseTypeFieldConfig,
	executePhaseThresholdFieldConfig,
	groupNameFieldConfig,
	groupReferenceVariablesFieldConfig,
	hotwStrategyFieldConfig,
	itemSwapSetFieldConfig,
	makeUseDotBaseValueCheckbox,
	makeUseRuneRegenBaseValueCheckbox,
	mathOperatorFieldConfig,
	minIcdInput,
	numberFieldConfig,
	placeholderNameFieldConfig,
	reactionTimeCheckbox,
	rotationTypeFieldConfig,
	runeSlotFieldConfig,
	runeTypeFieldConfig,
	statTypeFieldConfig,
	stringFieldConfig,
	totemTypeFieldConfig,
	unitFieldConfig,
	valueFieldConfig,
	valueListFieldConfig,
	variableNameFieldConfig,
} from './field_descriptors';
import { resolveField } from './field_specs';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

describe('resolveField kinds', () => {
	it('resolves the twelve fixed-enum descriptor types to kind enum', () => {
		const descriptors = [
			eclipseTypeFieldConfig('f'),
			runeTypeFieldConfig('f', false),
			runeSlotFieldConfig('f'),
			rotationTypeFieldConfig('f'),
			hotwStrategyFieldConfig('f'),
			statTypeFieldConfig('f'),
			damageAmpTypeFieldConfig('f'),
			itemSwapSetFieldConfig('f'),
			comparisonOperatorFieldConfig('f'),
			mathOperatorFieldConfig('f'),
			executePhaseThresholdFieldConfig('f'),
			totemTypeFieldConfig('f'),
		];
		for (const descriptor of descriptors) {
			expect(resolveField(descriptor).kind).toBe('enum');
		}
	});

	it('resolves minIcd to a number field named minIcdSeconds', () => {
		const spec = resolveField(minIcdInput);
		expect(spec.kind).toBe('number');
		expect(spec.field).toBe('minIcdSeconds');
	});

	it('resolves the three alias checkboxes to kind boolean with their own field names', () => {
		expect(resolveField(reactionTimeCheckbox())).toMatchObject({ kind: 'boolean', field: 'includeReactionTime' });
		expect(resolveField(makeUseDotBaseValueCheckbox())).toMatchObject({ kind: 'boolean', field: 'useBaseValue' });
		expect(resolveField(makeUseRuneRegenBaseValueCheckbox())).toMatchObject({ kind: 'boolean', field: 'useBaseValue' });
	});

	it('resolves variableName and groupName to rotationName over their own source', () => {
		expect(resolveField(variableNameFieldConfig('f'))).toMatchObject({ kind: 'rotationName', source: 'variables' });
		expect(resolveField(groupNameFieldConfig('f'))).toMatchObject({ kind: 'rotationName', source: 'groups' });
	});

	it('resolves the remaining descriptor types to their own kind', () => {
		expect(resolveField(actionIdFieldConfig('f', 'spells')).kind).toBe('actionId');
		expect(resolveField(unitFieldConfig('f', 'targets')).kind).toBe('unit');
		expect(resolveField(booleanFieldConfig('f')).kind).toBe('boolean');
		expect(resolveField(numberFieldConfig('f', false)).kind).toBe('number');
		expect(resolveField(stringFieldConfig('f')).kind).toBe('string');
		expect(resolveField(placeholderNameFieldConfig('f')).kind).toBe('placeholderName');
		expect(resolveField(groupReferenceVariablesFieldConfig('f', 'g')).kind).toBe('groupVariables');
		expect(resolveField(valueFieldConfig('f')).kind).toBe('value');
		expect(resolveField(valueListFieldConfig('f')).kind).toBe('valueList');
		expect(resolveField(actionFieldConfig('f')).kind).toBe('action');
		expect(resolveField(actionListFieldConfig('f')).kind).toBe('actionList');
	});
});

describe('resolveField newValue defaults', () => {
	it('defaults simple kinds to their empty value', () => {
		expect(resolveField(booleanFieldConfig('f')).newValue()).toBe(false);
		expect(resolveField(numberFieldConfig('f', false)).newValue()).toBe(0);
		expect(resolveField(stringFieldConfig('f')).newValue()).toBe('');
		expect(resolveField(variableNameFieldConfig('f')).newValue()).toBe('');
		expect(resolveField(groupNameFieldConfig('f')).newValue()).toBe('');
		expect(resolveField(placeholderNameFieldConfig('f')).newValue()).toBe('');
		expect(resolveField(unitFieldConfig('f', 'targets')).newValue()).toBeUndefined();
		expect(resolveField(groupReferenceVariablesFieldConfig('f', 'g')).newValue()).toEqual([]);
		expect(resolveField(valueListFieldConfig('f')).newValue()).toEqual([]);
		expect(resolveField(actionListFieldConfig('f')).newValue()).toEqual([]);
		expect(resolveField(minIcdInput).newValue()).toBe(0);
		expect(resolveField(reactionTimeCheckbox()).newValue()).toBe(false);
		expect(resolveField(makeUseDotBaseValueCheckbox()).newValue()).toBe(false);
		expect(resolveField(makeUseRuneRegenBaseValueCheckbox()).newValue()).toBe(false);
	});

	it('defaults actionId to a fresh empty ActionID', () => {
		expect(resolveField(actionIdFieldConfig('f', 'spells')).newValue()).toEqual(ActionID.create());
	});

	it('defaults value and action to a fresh APLValue carrying a uuid', () => {
		const value = resolveField(valueFieldConfig('f')).newValue();
		const action = resolveField(actionFieldConfig('f')).newValue();
		expect(typeof value.uuid.value).toBe('string');
		expect(value.uuid.value.length).toBeGreaterThan(0);
		expect(typeof action.uuid.value).toBe('string');
		expect(value.uuid.value).not.toBe(action.uuid.value);
	});

	it('keeps the eclipse-default quirk: NeutralPhase, not LunarPhase', () => {
		expect(resolveField(eclipseTypeFieldConfig('f')).newValue()).toBe(APLValueEclipsePhase.NeutralPhase);
		expect(resolveField(eclipseTypeFieldConfig('f')).newValue()).not.toBe(APLValueEclipsePhase.LunarPhase);
	});

	it('defaults the remaining enum kinds to their documented member', () => {
		expect(resolveField(runeTypeFieldConfig('f', false)).newValue()).toBe(APLValueRuneType.RuneBlood);
		expect(resolveField(runeSlotFieldConfig('f')).newValue()).toBe(APLValueRuneSlot.SlotLeftBlood);
		expect(resolveField(rotationTypeFieldConfig('f')).newValue()).toBe(FeralDruid_Rotation_AplType.SingleTarget);
		expect(resolveField(hotwStrategyFieldConfig('f')).newValue()).toBe(HotwStrategy.Caster);
		expect(resolveField(statTypeFieldConfig('f')).newValue()).toBe(0);
		expect(resolveField(damageAmpTypeFieldConfig('f')).newValue()).toBe(AmplificationType.CasterBuff);
		expect(resolveField(itemSwapSetFieldConfig('f')).newValue()).toBe(ItemSwapSet.Swap1);
		expect(resolveField(comparisonOperatorFieldConfig('f')).newValue()).toBe(ComparisonOperator.OpEq);
		expect(resolveField(mathOperatorFieldConfig('f')).newValue()).toBe(MathOperator.OpAdd);
		expect(resolveField(executePhaseThresholdFieldConfig('f')).newValue()).toBe(ExecutePhaseThreshold.E20);
		expect(resolveField(totemTypeFieldConfig('f')).newValue()).toBe(TotemType.Water);
	});
});

describe('resolveField label precedence', () => {
	it('lets booleanFieldConfig label win over options.label', () => {
		const descriptor = booleanFieldConfig('f', 'Explicit Label', { label: 'Options Label' });
		expect(resolveField(descriptor).label).toBe('Explicit Label');
	});

	it('reads label and labelTooltip off descriptor.options for other field types', () => {
		const unit = resolveField(unitFieldConfig('f', 'targets', { label: 'Unit Label', labelTooltip: 'Unit Tooltip' }));
		expect(unit.label).toBe('Unit Label');
		expect(unit.labelTooltip).toBe('Unit Tooltip');

		const number = resolveField(numberFieldConfig('f', false, { label: 'Number Label', labelTooltip: 'Number Tooltip' }));
		expect(number.label).toBe('Number Label');
		expect(number.labelTooltip).toBe('Number Tooltip');
	});
});

describe('resolveField actionId defaultUnitRef', () => {
	it('defaults to self when the descriptor gives no defaultUnitRef', () => {
		const spec = resolveField(actionIdFieldConfig('f', 'spells'));
		expect(spec.kind).toBe('actionId');
		if (spec.kind === 'actionId') expect(spec.defaultUnitRef).toBe('self');
	});

	it('keeps an explicit defaultUnitRef', () => {
		const spec = resolveField(actionIdFieldConfig('f', 'spells', undefined, 'currentTarget'));
		if (spec.kind === 'actionId') expect(spec.defaultUnitRef).toBe('currentTarget');
	});
});

describe('resolveField runeType', () => {
	it('adds exactly one extra option, RuneDeath, when includeDeath is true', () => {
		const without = resolveField(runeTypeFieldConfig('f', false));
		const withDeath = resolveField(runeTypeFieldConfig('f', true));
		if (without.kind !== 'enum' || withDeath.kind !== 'enum') throw new Error('expected enum kind');
		expect(withDeath.table.options.length).toBe(without.table.options.length + 1);
		expect(withDeath.table.options[withDeath.table.options.length - 1].value).toBe(APLValueRuneType.RuneDeath);
	});
});

describe('resolveField statType table', () => {
	it('leads with value -1 and then covers every Stat enum member in order', () => {
		const spec = resolveField(statTypeFieldConfig('f'));
		if (spec.kind !== 'enum') throw new Error('expected enum kind');
		expect(spec.table.options[0].value).toBe(-1);
		expect(spec.table.options.slice(1).map(option => option.value)).toEqual(getEnumValues(Stat));
	});
});
