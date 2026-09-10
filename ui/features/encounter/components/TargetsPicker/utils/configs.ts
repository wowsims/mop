import { InputType, MobType, SpellSchool, Stat, Target as TargetProto, TargetInput } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateMobType, translateSpellSchool, translateStat, translateTargetInputLabel, translateTargetInputTooltip } from '@i18n/localization';
import type { Encounter } from '@sim/raid/encounter';
import { subscribeEncounterField } from '@sim/state/subscriptions';
import { distinct } from '@sim/utils/collections';
import { randomUUID } from '@sim/utils/misc';
import type { BooleanPickerConfig } from '@ui-kit/BooleanPicker/types';
import type { EnumPickerConfig } from '@ui-kit/EnumPicker/types';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';

import { trackEvent, type TrackEventProps } from '../../../../../tracking/analytics';

export const ALL_TARGET_STATS: Array<{ stat: Stat; tooltip: string; extraCssClasses: Array<string> }> = [
	{ stat: Stat.StatHealth, tooltip: '', extraCssClasses: [] },
	{ stat: Stat.StatArmor, tooltip: '', extraCssClasses: [] },
	{ stat: Stat.StatAttackPower, tooltip: '', extraCssClasses: ['threat-metrics'] },
];

const mobTypeEnumValues = [
	MobType.MobTypeUnknown,
	MobType.MobTypeBeast,
	MobType.MobTypeDemon,
	MobType.MobTypeDragonkin,
	MobType.MobTypeElemental,
	MobType.MobTypeGiant,
	MobType.MobTypeHumanoid,
	MobType.MobTypeMechanical,
	MobType.MobTypeUndead,
].map(value => ({ name: translateMobType(value), value }));

const spellSchoolValues = [
	SpellSchool.SpellSchoolPhysical,
	SpellSchool.SpellSchoolArcane,
	SpellSchool.SpellSchoolFire,
	SpellSchool.SpellSchoolFrost,
	SpellSchool.SpellSchoolHoly,
	SpellSchool.SpellSchoolNature,
	SpellSchool.SpellSchoolShadow,
].map(value => ({ name: translateSpellSchool(value), value }));

/**
 * Vanilla gave the five section-1 pickers unindexed ids (`target-picker-npc`, …) while every
 * section-2 and section-3 picker carried its target index. With more than one target that put
 * duplicate ids in the document, so each of those labels pointed at the *first* target's control:
 * clicking target 2's "Level" label focused target 1's select. The index is on all of them now.
 */
const targetId = (targetIndex: number, name: string) => `target-${targetIndex}-picker-${name}`;

// Module-private, as it was in the vanilla file: only the NPC preset match asks the question.
const equalTargetsIgnoreInputs = (target1: TargetProto | undefined, target2: TargetProto | undefined): boolean => {
	if (!!target1 !== !!target2) return false;
	if (!target1) return true;
	const modTarget2 = TargetProto.clone(target2!);
	modTarget2.targetInputs = target1.targetInputs;
	return TargetProto.equals(target1, modTarget2);
};

export interface TargetFieldContext {
	encounter: Encounter;
	targetIndex: number;
	getTarget: () => TargetProto;
}

const onTargets = (encounter: Encounter) => () => subscribeEncounterField(encounter, 'targets');

export const npcConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => {
	const presetTargets = encounter.sim.db.getAllPresetTargets();
	return {
		id: targetId(targetIndex, 'npc'),
		extraCssClasses: ['npc-picker'],
		label: i18n.t('settings_tab.encounter.npc.label'),
		labelTooltip: i18n.t('settings_tab.encounter.npc.tooltip'),
		values: [{ name: i18n.t('common.custom'), value: -1 }].concat(presetTargets.map((preset, index) => ({ name: preset.path, value: index }))),
		storeSubscribe: onTargets(encounter),
		getValue: () => presetTargets.findIndex(preset => equalTargetsIgnoreInputs(getTarget(), preset.target)),
		setValue: (_: null, newValue: number) => {
			if (newValue === -1) return;
			const preset = presetTargets[newValue];
			trackEvent({ action: 'settings', category: 'targets', label: 'preset', value: preset.target?.name || preset.path });
			encounter.applyPresetTarget(preset, targetIndex);
		},
	};
};

export const aiConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => {
	const presetTargets = encounter.sim.db.getAllPresetTargets();
	// The value here is the npc id, and the sim builds a target's AI from the first preset carrying
	// that id (core.GetPresetTargetWithID), so the raid-size and difficulty variants registered under
	// one id are one selectable AI — the later ones name a preset the sim would never build.
	const byNpcId = distinct(presetTargets, (a, b) => a.target?.id === b.target?.id);
	return {
		id: targetId(targetIndex, 'ai'),
		extraCssClasses: ['ai-picker'],
		label: i18n.t('settings_tab.encounter.ai.label'),
		labelTooltip: i18n.t('settings_tab.encounter.ai.tooltip'),
		values: [{ name: i18n.t('common.none'), value: 0 }].concat(byNpcId.map(preset => ({ name: preset.path, value: preset.target!.id }))),
		storeSubscribe: onTargets(encounter),
		getValue: () => getTarget().id,
		setValue: (_: null, newValue: number) => {
			encounter.modifyTarget(targetIndex, target => {
				target.id = newValue;
				trackEvent({ action: 'settings', category: 'targets', label: 'ai', value: target.name });
				// Carry across the target inputs the selected AI declares.
				target.targetInputs = (presetTargets.find(preset => target.id === preset.target?.id)?.target?.targetInputs || []).map(input =>
					TargetInput.clone(input),
				);
			});
		},
	};
};

export const levelConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => ({
	id: targetId(targetIndex, 'level'),
	label: i18n.t('settings_tab.encounter.level'),
	values: [93, 92, 91, 90, 88].map(value => ({ name: String(value), value })),
	storeSubscribe: onTargets(encounter),
	getValue: () => getTarget().level,
	setValue: (_: null, newValue: number) => {
		trackEvent({ action: 'settings', category: 'targets', label: 'level', value: newValue });
		encounter.modifyTarget(targetIndex, target => {
			target.level = newValue;
		});
	},
});

export const mobTypeConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => ({
	id: targetId(targetIndex, 'mob-type'),
	label: i18n.t('settings_tab.encounter.mob_type'),
	values: mobTypeEnumValues,
	storeSubscribe: onTargets(encounter),
	getValue: () => getTarget().mobType,
	setValue: (_: null, newValue: number) => {
		trackEvent({ action: 'settings', category: 'targets', label: 'mob_type', value: newValue });
		encounter.modifyTarget(targetIndex, target => {
			target.mobType = newValue;
		});
	},
});

export const tankIndexConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => ({
	id: targetId(targetIndex, 'tanked-by'),
	extraCssClasses: ['threat-metrics'],
	label: i18n.t('settings_tab.encounter.tanked_by.label'),
	labelTooltip: i18n.t('settings_tab.encounter.tanked_by.tooltip'),
	values: [
		{ name: i18n.t('common.none'), value: -1 },
		{ name: i18n.t('common.tanks.main_tank'), value: 0 },
		{ name: i18n.t('common.tanks.tank_2'), value: 1 },
		{ name: i18n.t('common.tanks.tank_3'), value: 2 },
		{ name: i18n.t('common.tanks.tank_4'), value: 3 },
	],
	storeSubscribe: onTargets(encounter),
	getValue: () => getTarget().tankIndex,
	setValue: (_: null, newValue: number) => {
		trackEvent({ action: 'settings', category: 'targets', label: 'tank_index', value: newValue });
		encounter.modifyTarget(targetIndex, target => {
			target.tankIndex = newValue;
		});
	},
});

export const statConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext, stat: Stat, tooltip: string, extraCssClasses: Array<string>) =>
	({
		id: `target-${targetIndex}-picker-stats-${stat}`,
		inline: true,
		extraCssClasses,
		label: translateStat(stat),
		labelTooltip: tooltip,
		storeSubscribe: onTargets(encounter),
		getValue: () => getTarget().stats[stat],
		setValue: (_: null, newValue: number) => {
			encounter.modifyTarget(targetIndex, target => {
				target.stats[stat] = newValue;
			});
		},
	}) satisfies NumberPickerConfig<null>;

interface NumberField {
	name: string;
	key: string;
	label: string;
	float?: boolean;
	get: (target: TargetProto) => number;
	set: (target: TargetProto, value: number) => void;
}

const NUMBER_FIELDS: Array<NumberField> = [
	{
		name: 'swing-speed',
		key: 'swing_speed',
		label: 'swing_speed',
		float: true,
		get: target => target.swingSpeed,
		set: (target, value) => {
			target.swingSpeed = value;
		},
	},
	{
		name: 'min-base-damage',
		key: 'min_base_damage',
		label: 'min_base_damage',
		get: target => target.minBaseDamage,
		set: (target, value) => {
			target.minBaseDamage = value;
		},
	},
	{
		name: 'damage-spread',
		key: 'damage_spread',
		label: 'damage_spread',
		float: true,
		get: target => target.damageSpread,
		set: (target, value) => {
			target.damageSpread = value;
		},
	},
];

export const numberConfigs = ({ encounter, targetIndex, getTarget }: TargetFieldContext): Array<NumberPickerConfig<null>> =>
	NUMBER_FIELDS.map(field => ({
		id: targetId(targetIndex, field.name),
		label: i18n.t(`settings_tab.encounter.${field.key}.label`),
		labelTooltip: i18n.t(`settings_tab.encounter.${field.key}.tooltip`),
		float: field.float,
		storeSubscribe: onTargets(encounter),
		getValue: () => field.get(getTarget()),
		setValue: (_: null, newValue: number) => {
			trackEvent({ action: 'settings', category: 'targets', label: field.label, value: newValue });
			encounter.modifyTarget(targetIndex, target => field.set(target, newValue));
		},
	}));

interface BooleanField {
	name: string;
	key: string;
	label: string;
	get: (target: TargetProto) => boolean;
	set: (target: TargetProto, value: boolean) => void;
	enabledWhen?: (target: TargetProto) => boolean;
}

const BOOLEAN_FIELDS: Array<BooleanField> = [
	{
		name: 'dual-wield',
		key: 'dual_wield',
		label: 'dual_wield',
		get: target => target.dualWield,
		set: (target, value) => {
			target.dualWield = value;
		},
	},
	{
		name: 'dw-miss-penalty',
		key: 'dual_wield_penalty',
		label: 'dual_wield_penalty',
		get: target => target.dualWieldPenalty,
		set: (target, value) => {
			target.dualWieldPenalty = value;
		},
		enabledWhen: target => target.dualWield,
	},
	{
		name: 'parry-haste',
		key: 'parry_haste',
		label: 'parry_haste',
		get: target => target.parryHaste,
		set: (target, value) => {
			target.parryHaste = value;
		},
	},
];

export const booleanConfigs = ({ encounter, targetIndex, getTarget }: TargetFieldContext): Array<BooleanPickerConfig<null>> =>
	BOOLEAN_FIELDS.map(field => ({
		id: targetId(targetIndex, field.name),
		label: i18n.t(`settings_tab.encounter.${field.key}.label`),
		labelTooltip: i18n.t(`settings_tab.encounter.${field.key}.tooltip`),
		inline: true,
		reverse: true,
		storeSubscribe: onTargets(encounter),
		getValue: () => field.get(getTarget()),
		setValue: (_: null, newValue: boolean) => {
			trackEvent({ action: 'settings', category: 'targets', label: field.label, value: newValue });
			encounter.modifyTarget(targetIndex, target => field.set(target, newValue));
		},
		...(field.enabledWhen ? { enableWhen: () => field.enabledWhen!(getTarget()) } : {}),
	}));

export const spellSchoolConfig = ({ encounter, targetIndex, getTarget }: TargetFieldContext): EnumPickerConfig<null> => ({
	id: targetId(targetIndex, 'spell-school'),
	label: i18n.t('settings_tab.encounter.spell_school.label'),
	labelTooltip: i18n.t('settings_tab.encounter.spell_school.tooltip'),
	values: spellSchoolValues,
	storeSubscribe: onTargets(encounter),
	getValue: () => getTarget().spellSchool,
	setValue: (_: null, newValue: number) => {
		trackEvent({ action: 'settings', category: 'targets', label: 'spell_school', value: newValue });
		encounter.modifyTarget(targetIndex, target => {
			target.spellSchool = newValue;
		});
	},
});

/** One target input's picker config, dispatched on the `InputType` the AI declared. */
export const targetInputConfig = (encounter: Encounter, targetIndex: number, inputIndex: number, input: TargetInput) => {
	const getTargetInput = () => encounter.getTarget(targetIndex)!.targetInputs[inputIndex] || TargetInput.create();
	const tracking: TrackEventProps = { action: 'settings', category: 'targets', label: input.label };
	// Replace-on-write: mutate the draft. A missing input drops the write, matching the old
	// throwaway-object fallback.
	const write =
		<T>(apply: (target: TargetInput, value: T) => void) =>
		(_: null, newValue: T) => {
			trackEvent({ ...tracking, value: newValue as string | number | boolean });
			encounter.modifyTarget(targetIndex, target => {
				const draft = target.targetInputs[inputIndex];
				if (draft) apply(draft, newValue);
			});
		};
	const shared = {
		id: randomUUID(),
		label: translateTargetInputLabel(input.label),
		labelTooltip: translateTargetInputTooltip(input.label, input.tooltip),
		storeSubscribe: () => subscribeEncounterField(encounter, 'targets'),
	};

	if (input.inputType === InputType.Number) {
		return {
			kind: 'number' as const,
			config: {
				...shared,
				float: true,
				getValue: () => getTargetInput().numberValue,
				setValue: write<number>((draft, value) => {
					draft.numberValue = value;
				}),
			} satisfies NumberPickerConfig<null>,
		};
	}
	if (input.inputType === InputType.Bool) {
		return {
			kind: 'boolean' as const,
			config: {
				...shared,
				extraCssClasses: ['input-inline'],
				getValue: () => getTargetInput().boolValue,
				setValue: write<boolean>((draft, value) => {
					draft.boolValue = value;
				}),
			} satisfies BooleanPickerConfig<null>,
		};
	}
	if (input.inputType === InputType.Enum) {
		return {
			kind: 'enum' as const,
			config: {
				...shared,
				// The enum picker took the label but never the tooltip.
				labelTooltip: undefined,
				values: input.enumOptions.map((option, index) => ({ value: index, name: option })),
				getValue: () => getTargetInput().enumValue,
				setValue: write<number>((draft, value) => {
					draft.enumValue = value;
				}),
			} satisfies EnumPickerConfig<null>,
		};
	}
	return { kind: 'none' as const };
};
