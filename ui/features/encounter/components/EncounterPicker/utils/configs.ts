import type { Encounter } from '@domain/encounter';
import type { Player } from '@domain/player';
import type { Raid } from '@domain/raid';
import { subscribeAll, subscribeEncounterChange, subscribePlayerField, subscribeRaidField } from '@domain/state/subscriptions';
import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';

import { trackEvent } from '../../../../../tracking/analytics';

// Every field here is off limits while the encounter runs to a health target rather than a clock.
const whileTimed = (encounter: Encounter) => () => !encounter.getUseHealth();

interface Field {
	id: string;
	key: string;
	label: string;
	category: 'duration' | 'execute';
	get: (encounter: Encounter) => number;
	set: (encounter: Encounter, value: number) => void;
}

const field = (encounter: Encounter, spec: Field): NumberPickerConfig<Encounter> => ({
	id: spec.id,
	label: i18n.t(`settings_tab.encounter.${spec.key}.label`),
	labelTooltip: i18n.t(`settings_tab.encounter.${spec.key}.tooltip`),
	storeSubscribe: subscribeEncounterChange,
	getValue: spec.get,
	setValue: (subject, newValue) => {
		trackEvent({ action: 'settings', category: spec.category, label: spec.label, value: newValue });
		spec.set(subject, newValue);
	},
	enableWhen: whileTimed(encounter),
});

export const durationConfigs = (encounter: Encounter): Array<NumberPickerConfig<Encounter>> =>
	(
		[
			{ id: 'encounter-duration', key: 'duration', label: 'duration', category: 'duration', get: e => e.getDuration(), set: (e, v) => e.setDuration(v) },
			{
				id: 'encounter-duration-variation',
				key: 'duration_variation',
				label: 'variation',
				category: 'duration',
				get: e => e.getDurationVariation(),
				set: (e, v) => e.setDurationVariation(v),
			},
		] satisfies Array<Field>
	).map(spec => field(encounter, spec));

// Stored as a proportion, shown as a percentage.
const EXECUTE_BANDS: Array<Field> = [
	{
		id: 'encounter-execute-proportion',
		key: 'execute_duration_20',
		label: 'execute_20',
		category: 'execute',
		get: (e: Encounter) => e.getExecuteProportion20() * 100,
		set: (e: Encounter, v: number) => e.setExecuteProportion20(v / 100),
	},
	{
		id: 'encounter-execute-proportion-25',
		key: 'execute_duration_25',
		label: 'execute_25',
		category: 'execute',
		get: (e: Encounter) => e.getExecuteProportion25() * 100,
		set: (e: Encounter, v: number) => e.setExecuteProportion25(v / 100),
	},
	{
		id: 'encounter-execute-proportion-35',
		key: 'execute_duration_35',
		label: 'execute_35',
		category: 'execute',
		get: (e: Encounter) => e.getExecuteProportion35() * 100,
		set: (e: Encounter, v: number) => e.setExecuteProportion35(v / 100),
	},
	{
		id: 'encounter-execute-proportion-45',
		key: 'execute_duration_45',
		label: 'execute_45',
		category: 'execute',
		get: (e: Encounter) => e.getExecuteProportion45() * 100,
		set: (e: Encounter, v: number) => e.setExecuteProportion45(v / 100),
	},
	{
		id: 'encounter-execute-proportion-90',
		key: 'duration_below_high_hp',
		label: 'execute_90',
		category: 'execute',
		get: (e: Encounter) => e.getExecuteProportion90() * 100,
		set: (e: Encounter, v: number) => e.setExecuteProportion90(v / 100),
	},
];

export const executeConfigs = (encounter: Encounter): Array<NumberPickerConfig<Encounter>> => EXECUTE_BANDS.map(band => field(encounter, band));

export const numAlliesConfig = (player: Player<any>): NumberPickerConfig<Raid> => ({
	id: 'encounter-num-allies',
	label: i18n.t('settings_tab.encounter.num_allies.label'),
	labelTooltip: i18n.t('settings_tab.encounter.num_allies.tooltip'),
	storeSubscribe: (raid: Raid) => subscribeAll([subscribeRaidField(raid, 'targetDummies'), subscribePlayerField(player, 'itemSwap')]),
	getValue: (raid: Raid) => raid.getTargetDummies(),
	setValue: (raid: Raid, newValue: number) => raid.setTargetDummies(newValue),
	// Monks' count is talent-driven, so they never choose it.
	showWhen: () => ![Spec.SpecBrewmasterMonk, Spec.SpecWindwalkerMonk].includes(player.getSpec()) && player.shouldEnableTargetDummies(),
});

export const minBaseDamageConfig = (): NumberPickerConfig<Encounter> => ({
	id: 'encounter-min-base-damage',
	label: i18n.t('settings_tab.encounter.min_base_damage.label'),
	labelTooltip: i18n.t('settings_tab.encounter.min_base_damage.tooltip'),
	storeSubscribe: subscribeEncounterChange,
	getValue: (encounter: Encounter) => encounter.primaryTarget.minBaseDamage,
	setValue: (encounter: Encounter, newValue: number) =>
		encounter.modifyTarget(0, target => {
			target.minBaseDamage = newValue;
		}),
});

export const presetEncounterConfig = (encounter: Encounter): EnumPickerConfig<Encounter> => {
	const presets = encounter.sim.db.getAllPresetEncounters();
	return {
		id: 'encounter-preset-encouter',
		label: i18n.t('settings_tab.encounter.encounter_preset.label'),
		extraCssClasses: ['damage-metrics', 'npc-picker'],
		values: [{ name: i18n.t('common.custom'), value: -1 }, ...presets.map((preset, index) => ({ name: preset.path, value: index }))],
		storeSubscribe: subscribeEncounterChange,
		getValue: (subject: Encounter) => presets.findIndex(preset => subject.matchesPreset(preset)),
		setValue: (subject: Encounter, newValue: number) => {
			if (newValue !== -1) subject.applyPreset(presets[newValue]);
		},
	};
};
