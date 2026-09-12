import type { StatWeightsResult } from '@generated/proto/api';
import type { Stat, UnitStats } from '@generated/proto/common';
import i18n from '@i18n/config';

export type StatsTableColumn = {
	metric?: 'damage' | 'healing' | 'threat';
	type: 'ep' | 'weight' | 'action';
	label: string;
	labelTooltip: string;
	actionTooltip: string;
	getWeights: () => UnitStats | undefined;
	getEpRefStat?: () => Stat;
};

export type StatsTableSources = {
	getPrevSimResult: () => StatWeightsResult;
	getDefaultEpWeights: () => UnitStats;
	getDpsEpRefStat: () => Stat;
	getHealEpRefStat: () => Stat;
	getTankEpRefStat: () => Stat;
};

export const statsTableColumns = ({
	getPrevSimResult,
	getDefaultEpWeights,
	getDpsEpRefStat,
	getHealEpRefStat,
	getTankEpRefStat,
}: StatsTableSources): StatsTableColumn[] => {
	const copyToCurrentEpText = i18n.t('sidebar.buttons.stat_weights.modal.tooltips.copy_to_current_ep');
	return [
		{
			metric: 'damage',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.dps_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.dps_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().dps!.weights,
		},
		{
			metric: 'damage',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.dps_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.dps_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().dps!.epValues,
			getEpRefStat: () => getDpsEpRefStat(),
		},
		{
			metric: 'healing',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.hps_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.hps_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().hps!.weights,
		},
		{
			metric: 'healing',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.hps_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.hps_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().hps!.epValues,
			getEpRefStat: () => getHealEpRefStat(),
		},
		{
			metric: 'threat',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.tps_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.tps_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().tps!.weights,
		},
		{
			metric: 'threat',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.tps_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.tps_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().tps!.epValues,
			getEpRefStat: () => getDpsEpRefStat(),
		},
		{
			metric: 'threat',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.dtps_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.dtps_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().dtps!.weights,
		},
		{
			metric: 'threat',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.dtps_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.dtps_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().dtps!.epValues,
			getEpRefStat: () => getTankEpRefStat(),
		},
		{
			metric: 'threat',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.tmi_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.tmi_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().tmi!.weights,
		},
		{
			metric: 'threat',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.tmi_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.tmi_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().tmi!.epValues,
			getEpRefStat: () => getTankEpRefStat(),
		},
		{
			metric: 'threat',
			type: 'weight',
			label: i18n.t('sidebar.buttons.stat_weights.modal.death_weight.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.death_weight.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().pDeath!.weights,
		},
		{
			metric: 'threat',
			type: 'ep',
			label: i18n.t('sidebar.buttons.stat_weights.modal.death_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.death_ep.tooltip'),
			actionTooltip: copyToCurrentEpText,
			getWeights: () => getPrevSimResult().pDeath!.epValues,
			getEpRefStat: () => getTankEpRefStat(),
		},
		{
			type: 'action',
			label: i18n.t('sidebar.buttons.stat_weights.modal.current_ep.label'),
			labelTooltip: i18n.t('sidebar.buttons.stat_weights.modal.current_ep.tooltip'),
			actionTooltip: i18n.t('sidebar.buttons.stat_weights.modal.tooltips.restore_default_ep'),
			getWeights: () => getDefaultEpWeights(),
		},
	];
};
