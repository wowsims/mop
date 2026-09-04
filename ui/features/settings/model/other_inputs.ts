import { Player } from '@domain/player';
import { emptyUnitReference } from '@domain/proto_utils/utils';
import { subscribeAll, subscribePlayerField, subscribeRaidField } from '@domain/state/subscriptions';
import { UnitReference } from '@generated/proto/common';
import i18n from '@i18n/config';

// The healing-model inputs below are enabled only while the player is one of the
// raid's tanks, so they have to re-evaluate on a tank-assignment change as well as
// on their own value (the old `raid.changeEmitter` source covered both).
const subscribeHealingModelAndTanks = (player: Player<any>) =>
	subscribeAll([subscribePlayerField(player, 'healingModel'), subscribeRaidField(player.getRaid()!, 'tanks')]);

export const InputDelay = {
	id: 'input-delay',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.input_delay.label'),
	labelTooltip: i18n.t('settings_tab.other.input_delay.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribeAll([subscribePlayerField(player, 'reactionTime'), subscribePlayerField(player, 'channelClipDelay')]),
	getValue: (player: Player<any>) => player.getReactionTime(),
	setValue: (player: Player<any>, newValue: number) => {
		player.setReactionTime(newValue);
	},
};

export const ChallengeMode = {
	id: 'challenge-mode',
	type: 'boolean' as const,
	label: i18n.t('settings_tab.other.challenge_mode.label'),
	labelTooltip: i18n.t('settings_tab.other.challenge_mode.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'challengeModeEnabled'),
	getValue: (player: Player<any>) => player.getChallengeModeEnabled(),
	setValue: (player: Player<any>, value: boolean) => {
		player.setChallengeModeEnabled(value);
	},
};

export const ChannelClipDelay = {
	id: 'channel-clip-delay',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.channel_clip_delay.label'),
	labelTooltip: i18n.t('settings_tab.other.channel_clip_delay.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribeAll([subscribePlayerField(player, 'reactionTime'), subscribePlayerField(player, 'channelClipDelay')]),
	getValue: (player: Player<any>) => player.getChannelClipDelay(),
	setValue: (player: Player<any>, newValue: number) => {
		player.setChannelClipDelay(newValue);
	},
};

export const InFrontOfTarget = {
	id: 'in-front-of-target',
	type: 'boolean' as const,
	label: i18n.t('settings_tab.other.in_front_of_target.label'),
	labelTooltip: i18n.t('settings_tab.other.in_front_of_target.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'inFrontOfTarget'),
	getValue: (player: Player<any>) => player.getInFrontOfTarget(),
	setValue: (player: Player<any>, newValue: boolean) => {
		player.setInFrontOfTarget(newValue);
	},
};

export const DistanceFromTarget = {
	id: 'distance-from-target',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.distance_from_target.label'),
	labelTooltip: i18n.t('settings_tab.other.distance_from_target.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'distanceFromTarget'),
	getValue: (player: Player<any>) => player.getDistanceFromTarget(),
	setValue: (player: Player<any>, newValue: number) => {
		player.setDistanceFromTarget(newValue);
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
	storeSubscribe: (player: Player<any>) => subscribeRaidField(player.getRaid()!, 'tanks'),
	getValue: (player: Player<any>) => (player.getRaid()?.getTanks() || []).findIndex(tank => UnitReference.equals(tank, player.makeUnitReference())),
	setValue: (player: Player<any>, newValue: number) => {
		const newTanks = [];
		if (newValue != -1) {
			for (let i = 0; i < newValue; i++) {
				newTanks.push(emptyUnitReference());
			}
			newTanks.push(player.makeUnitReference());
		}
		player.getRaid()!.setTanks(newTanks);
	},
};

export const IncomingHps = {
	id: 'incoming-hps',
	type: 'number' as const,
	label: i18n.t('settings_tab.other.incoming_hps.label'),
	labelTooltip: i18n.t('settings_tab.other.incoming_hps.tooltip'),
	storeSubscribe: subscribeHealingModelAndTanks,
	getValue: (player: Player<any>) => player.getHealingModel().hps,
	setValue: (player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.hps = newValue;
		player.setHealingModel(healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HealingCadence = {
	id: 'healing-cadence',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.healing_cadence.label'),
	labelTooltip: i18n.t('settings_tab.other.healing_cadence.tooltip'),
	storeSubscribe: subscribeHealingModelAndTanks,
	getValue: (player: Player<any>) => player.getHealingModel().cadenceSeconds,
	setValue: (player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.cadenceSeconds = newValue;
		player.setHealingModel(healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HealingCadenceVariation = {
	id: 'healing-cadence-variation',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.healing_cadence_variation.label'),
	labelTooltip: i18n.t('settings_tab.other.healing_cadence_variation.tooltip'),
	storeSubscribe: subscribeHealingModelAndTanks,
	getValue: (player: Player<any>) => player.getHealingModel().cadenceVariation,
	setValue: (player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.cadenceVariation = newValue;
		player.setHealingModel(healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const AbsorbFrac = {
	id: 'healing-model-absorb-frac',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.absorb_frac.label'),
	labelTooltip: i18n.t('settings_tab.other.absorb_frac.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'healingModel'),
	getValue: (player: Player<any>) => player.getHealingModel().absorbFrac * 100,
	setValue: (player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.absorbFrac = newValue / 100;
		player.setHealingModel(healingModel);
	},
};

export const BurstWindow = {
	id: 'burst-window',
	type: 'number' as const,
	float: false,
	label: i18n.t('settings_tab.other.burst_window.label'),
	labelTooltip: i18n.t('settings_tab.other.burst_window.tooltip'),
	storeSubscribe: subscribeHealingModelAndTanks,
	getValue: (player: Player<any>) => player.getHealingModel().burstWindow,
	setValue: (player: Player<any>, newValue: number) => {
		const healingModel = player.getHealingModel();
		healingModel.burstWindow = newValue;
		player.setHealingModel(healingModel);
	},
	enableWhen: (player: Player<any>) => (player.getRaid()?.getTanks() || []).find(tank => UnitReference.equals(tank, player.makeUnitReference())) != null,
};

export const HpPercentForDefensives = {
	id: 'hp-percent-for-defensives',
	type: 'number' as const,
	float: true,
	label: i18n.t('settings_tab.other.hp_percent_for_defensives.label'),
	labelTooltip: i18n.t('settings_tab.other.hp_percent_for_defensives.tooltip'),
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
	getValue: (player: Player<any>) => player.getSimpleCooldowns().hpPercentForDefensives * 100,
	setValue: (player: Player<any>, newValue: number) => {
		const cooldowns = player.getSimpleCooldowns();
		cooldowns.hpPercentForDefensives = newValue / 100;
		player.setSimpleCooldowns(cooldowns);
	},
};
