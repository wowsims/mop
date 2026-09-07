import type { ActionMetrics } from '@sim/proto_utils/sim_result';
import i18n from '@i18n/config';

import { MetricsCombinedTooltip, type MetricsCombinedTooltipGroup } from '../MetricsCombinedTooltip';

/** The Count header replaced by "Amount", which every breakdown of a damage or threat total uses. */
export const amountHeader = (): Array<string | undefined> => [undefined, i18n.t('results_tab.details.tooltip_table.amount')];

export const damageBreakdownGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => {
	const done = metric.damageDone;
	return {
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.hit'), ...done.hit },
			{ name: i18n.t('results_tab.details.attack_types.critical_hit'), ...done.critHit },
			{ name: i18n.t('results_tab.details.attack_types.tick'), ...done.tick },
			{ name: i18n.t('results_tab.details.attack_types.critical_tick'), ...done.critTick },
			{ name: i18n.t('results_tab.details.attack_types.glancing_blow'), ...done.glance },
			{ name: i18n.t('results_tab.details.attack_types.blocked_glancing_blow'), ...done.glanceBlock },
			{ name: i18n.t('results_tab.details.attack_types.blocked_hit'), ...done.block },
			{ name: i18n.t('results_tab.details.attack_types.blocked_critical_hit'), ...done.critBlock },
		],
	};
};

export const castsGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => {
	const landed = metric.landedHits || metric.casts;
	return {
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{
				name: `${i18n.t('results_tab.details.attack_types.hit')}s`,
				value: metric.landedHits || metric.casts - metric.totalMisses,
				percentage: (landed / (landed + metric.totalMisses)) * 100,
			},
			{ name: i18n.t('results_tab.details.attack_types.miss'), value: metric.misses, percentage: metric.missPercent },
			{ name: i18n.t('results_tab.details.attack_types.parry'), value: metric.parries, percentage: metric.parryPercent },
			{ name: i18n.t('results_tab.details.attack_types.dodge'), value: metric.dodges, percentage: metric.dodgePercent },
		],
	};
};

export const hitGroups = (metric: ActionMetrics): Array<MetricsCombinedTooltipGroup> => [
	{
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.hit'), value: metric.hits, percentage: (metric.hits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.critical_hit'), value: metric.crits, percentage: (metric.crits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.glancing_blow'), value: metric.glances, percentage: (metric.glances / metric.landedHits) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.blocked_glancing_blow'),
				value: metric.glanceBlocks,
				percentage: (metric.glanceBlocks / metric.landedHits) * 100,
			},
			{ name: i18n.t('results_tab.details.attack_types.blocked_hit'), value: metric.blocks, percentage: (metric.blocks / metric.landedHits) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.blocked_critical_hit'),
				value: metric.critBlocks,
				percentage: (metric.critBlocks / metric.landedHits) * 100,
			},
		],
	},
	{
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.tick'), value: metric.ticks, percentage: (metric.ticks / metric.landedTicks) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.critical_tick'),
				value: metric.critTicks,
				percentage: (metric.critTicks / metric.landedTicks) * 100,
			},
		],
	},
];

export const missGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => ({
	spellSchool: metric.spellSchool,
	totalPercentage: metric.totalMissesPercent,
	data: [
		{ name: i18n.t('results_tab.details.attack_types.miss'), value: metric.misses, percentage: metric.missPercent },
		{ name: i18n.t('results_tab.details.attack_types.parry'), value: metric.parries, percentage: metric.parryPercent },
		{ name: i18n.t('results_tab.details.attack_types.dodge'), value: metric.dodges, percentage: metric.dodgePercent },
	],
});

export const threatGroup = (metric: ActionMetrics, value: number): MetricsCombinedTooltipGroup => ({
	spellSchool: metric.spellSchool,
	totalPercentage: 100,
	data: [{ name: i18n.t('results_tab.details.attack_types.threat'), value, percentage: 100 }],
});

/** The threat veto, as a body that is simply not built: `showThreatMetrics` comes from the store, and a `render` that returns nothing draws no tooltip at all. */
export const threatTooltip = (metric: ActionMetrics, value: number, showThreatMetrics: boolean) =>
	showThreatMetrics && value ? <MetricsCombinedTooltip headerValues={amountHeader()} groups={[threatGroup(metric, value)]} /> : null;
