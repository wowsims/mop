import { Player } from '../../player.js';
import { UnitReference } from '../../proto/common.js';
import { emptyUnitReference } from '../../proto_utils/utils.js';
import { Sim } from '../../sim.js';
import { EventID } from '../../typed_event.js';
import { BooleanPicker } from '../pickers/boolean_picker.js';
import { EnumPicker } from '../pickers/enum_picker.js';
import i18n from '../../../i18n/config.js';

export function makeShow1hWeaponsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	parent.classList.remove('hide');
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-1h-weapons-selector',
		extraCssClasses: ['show-1h-weapons-selector', 'mb-0'],
		label: i18n.t('settings_tab.other.show_1h_weapons.label'),
		inline: true,
		changedEvent: (sim: Sim) => sim.filtersChangeEmitter,
		getValue: (sim: Sim) => sim.getFilters().oneHandedWeapons,
		setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.oneHandedWeapons = newValue;
			sim.setFilters(eventID, filters);
		},
	});
}

export function makeShow2hWeaponsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	parent.classList.remove('hide');
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-2h-weapons-selector',
		extraCssClasses: ['show-2h-weapons-selector', 'mb-0'],
		label: i18n.t('settings_tab.other.show_2h_weapons.label'),
		inline: true,
		changedEvent: (sim: Sim) => sim.filtersChangeEmitter,
		getValue: (sim: Sim) => sim.getFilters().twoHandedWeapons,
		setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.twoHandedWeapons = newValue;
			sim.setFilters(eventID, filters);
		},
	});
}

export function makeShowMatchingGemsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-matching-gems-selector',
		extraCssClasses: ['show-matching-gems-selector', 'input-inline', 'mb-0'],
		label: i18n.t('settings_tab.other.show_matching_gems.label'),
		inline: true,
		changedEvent: (sim: Sim) => sim.filtersChangeEmitter,
		getValue: (sim: Sim) => sim.getFilters().matchingGemsOnly,
		setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.matchingGemsOnly = newValue;
			sim.setFilters(eventID, filters);
		},
	});
}

export function makeShowEPValuesSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-ep-values-selector',
		extraCssClasses: ['show-ep-values-selector', 'input-inline', 'mb-0'],
		label: i18n.t('settings_tab.other.show_ep_values.label'),
		inline: true,
		changedEvent: (sim: Sim) => sim.showEPValuesChangeEmitter,
		getValue: (sim: Sim) => sim.getShowEPValues(),
		setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
			sim.setShowEPValues(eventID, newValue);
		},
	});
}

export function makePhaseSelector(parent: HTMLElement, sim: Sim): EnumPicker<Sim> {
	return new EnumPicker<Sim>(parent, sim, {
		id: 'phase-selector',
		extraCssClasses: ['phase-selector'],
		values: [
			{ name: i18n.t('common.phases.1'), value: 1 },
			{ name: i18n.t('common.phases.2'), value: 2 },
			{ name: i18n.t('common.phases.3'), value: 3 },
			{ name: i18n.t('common.phases.4'), value: 4 },
			{ name: i18n.t('common.phases.5'), value: 5 },
		],
		changedEvent: (sim: Sim) => sim.phaseChangeEmitter,
		getValue: (sim: Sim) => sim.getPhase(),
		setValue: (eventID: EventID, sim: Sim, newValue: number) => {
			sim.setPhase(eventID, newValue);
		},
	});
}

export const InputDelay = {
	id: 'input-delay',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.input_delay.label'),
	labelTooltip: i18n.t('settings_tab.other.input_delay.tooltip'),
	changedEvent: (player: Player<any>) => player.miscOptionsChangeEmitter,
	getValue: (player: Player<any>) => player.getReactionTime(),
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		player.setReactionTime(eventID, newValue);
	},
};

export const ChallengeMode = {
	id: 'challenge-mode',
	type: 'boolean' as const,
	label: i18n.t('settings_tab.other.challenge_mode.label'),
	labelTooltip: i18n.t('settings_tab.other.challenge_mode.tooltip'),
	changedEvent: (player: Player<any>) => player.challengeModeChangeEmitter,
	getValue: (player: Player<any>) => player.getChallengeModeEnabled(),
	setValue: (eventID: EventID, player: Player<any>, value: boolean) => {
		player.setChallengeModeEnabled(eventID, value);
	},
};

export const ChannelClipDelay = {
	id: 'channel-clip-delay',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.channel_clip_delay.label'),
	labelTooltip: i18n.t('settings_tab.other.channel_clip_delay.tooltip'),
	changedEvent: (player: Player<any>) => player.miscOptionsChangeEmitter,
	getValue: (player: Player<any>) => player.getChannelClipDelay(),
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		player.setChannelClipDelay(eventID, newValue);
	},
};

export const InFrontOfTarget = {
	id: 'in-front-of-target',
	type: 'boolean' as const,
	label: i18n.t('settings_tab.other.in_front_of_target.label'),
	labelTooltip: i18n.t('settings_tab.other.in_front_of_target.tooltip'),
	changedEvent: (player: Player<any>) => player.inFrontOfTargetChangeEmitter,
	getValue: (player: Player<any>) => player.getInFrontOfTarget(),
	setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
		player.setInFrontOfTarget(eventID, newValue);
	},
};

export const DistanceFromTarget = {
	id: 'distance-from-target',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.distance_from_target.label'),
	labelTooltip: i18n.t('settings_tab.other.distance_from_target.tooltip'),
	changedEvent: (player: Player<any>) => player.distanceFromTargetChangeEmitter,
	getValue: (player: Player<any>) => player.getDistanceFromTarget(),
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		player.setDistanceFromTarget(eventID, newValue);
	},
};

export const TankAssignment = {
	id: 'tank-assignment',
	type: 'enum' as const,
	extraCssClasses: ['tank-selector', 'threat-metrics'],
	label: i18n.t('settings_tab.other.tank_assignment.label'),
	labelTooltip: i18n.t('settings_tab.other.tank_assignment.tooltip'),
	values: [
		{ name: i18n.t('common.none'), value: -1 },
		{ name: i18n.t('common.tanks.main_tank'), value: 0 },
		{ name: i18n.t('common.tanks.tank_2'), value: 1 },
		{ name: i18n.t('common.tanks.tank_3'), value: 2 },
		{ name: i18n.t('common.tanks.tank_4'), value: 3 },
	],
	changedEvent: (player: Player<any>) => player.getRaid()!.tanksChangeEmitter,
	getValue: (player: Player<any>) => (player.getRaid()?.getTanks() || []).findIndex(tank => UnitReference.equals(tank, player.makeUnitReference())),
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const newTanks = [];
		if (newValue != -1) {
			for (let i = 0; i < newValue; i++) {
				newTanks.push(emptyUnitReference());
			}
			newTanks.push(player.makeUnitReference());
		}
		player.getRaid()!.setTanks(eventID, newTanks);
	},
};

export const IncomingHps = {
	id: 'incoming-hps',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.incoming_hps.label'),
	labelTooltip: i18n.t('settings_tab.other.incoming_hps.tooltip'),
	changedEvent: (player: Player<any>) => player.getRaid()!.changeEmitter,
	getValue: (player: Player<any>) => player.getHealingModel().hps,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.hps = newValue;
		player.setHealingModel(eventID, healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HealingCadence = {
	id: 'healing-cadence',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.healing_cadence.label'),
	labelTooltip: i18n.t('settings_tab.other.healing_cadence.tooltip'),
	changedEvent: (player: Player<any>) => player.getRaid()!.changeEmitter,
	getValue: (player: Player<any>) => player.getHealingModel().cadenceSeconds,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.cadenceSeconds = newValue;
		player.setHealingModel(eventID, healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HealingCadenceVariation = {
	id: 'healing-cadence-variation',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.healing_cadence_variation.label'),
	labelTooltip: i18n.t('settings_tab.other.healing_cadence_variation.tooltip'),
	changedEvent: (player: Player<any>) => player.getRaid()!.changeEmitter,
	getValue: (player: Player<any>) => player.getHealingModel().cadenceVariation,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.cadenceVariation = newValue;
		player.setHealingModel(eventID, healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const AbsorbFrac = {
	id: 'healing-model-absorb-frac',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.absorb_frac.label'),
	labelTooltip: i18n.t('settings_tab.other.absorb_frac.tooltip'),
	changedEvent: (player: Player<any>) => player.healingModelChangeEmitter,
	getValue: (player: Player<any>) => player.getHealingModel().absorbFrac * 100,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.absorbFrac = newValue / 100;
		player.setHealingModel(eventID, healingModel);
	},
};

export const BurstWindow = {
	id: 'burst-window',
	type: 'number' as const,
	float: false,
	label: i18n.t('settings_tab.other.burst_window.label'),
	labelTooltip: i18n.t('settings_tab.other.burst_window.tooltip'),
	changedEvent: (player: Player<any>) => player.getRaid()!.changeEmitter,
	getValue: (player: Player<any>) => player.getHealingModel().burstWindow,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.burstWindow = newValue;
		player.setHealingModel(eventID, healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HpPercentForDefensives = {
	id: 'hp-percent-for-defensives',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.hp_percent_for_defensives.label'),
	labelTooltip: i18n.t('settings_tab.other.hp_percent_for_defensives.tooltip'),
	changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
	getValue: (player: Player<any>) => player.getSimpleCooldowns().hpPercentForDefensives * 100,
	setValue: (eventID: EventID, player: Player<any>, newValue: number) => {
		const cooldowns = player.getSimpleCooldowns();
		cooldowns.hpPercentForDefensives = newValue / 100;
		player.setSimpleCooldowns(eventID, cooldowns);
	},
};
