import { ScaleOptions } from 'chart.js';

import { ResourceType } from '../../../../proto/spell';
import { DpsLog, ResourceChangedLogGroup, ThreatLogGroup } from '../../../../proto_utils/logs_parser';
import { resourceColors, resourceNames } from '../../../../proto_utils/names';
import SecondaryResource from '../../../../proto_utils/secondary_resource';
import { UnitMetrics } from '../../../../proto_utils/sim_result';
import { orderedResourceTypes } from '../../../../proto_utils/utils';
import { THREAT_SERIES_NAME } from '../constants';
import { DpsTooltip, ResourceTooltip, ThreatTooltip } from '../tooltip_content';
import { AXIS_GRID_COLOR, cssVarColor } from './colors';
import { TimelineDataset } from './types';

const LINE_DATASET = { borderWidth: 2, pointRadius: 0, pointHoverRadius: 3 } as const;
// Thin and dashed so resource traces read as context behind the DPS line rather than peers of it.
const TRACE_DATASET = { ...LINE_DATASET, borderWidth: 1, borderDash: [4, 4] };

// title, ticks and border each need the colour, which is three places for one axis to disagree.
function valueScale(color: string, text: string, max: number, extra?: Partial<ScaleOptions<'linear'>>): ScaleOptions<'linear'> {
	return {
		type: 'linear',
		position: 'left',
		min: 0,
		max,
		title: { display: true, text, color },
		ticks: { color, maxTicksLimit: 11, precision: 0 },
		border: { color },
		grid: { color: AXIS_GRID_COLOR },
		...extra,
	} as ScaleOptions<'linear'>;
}

export const dpsColor = () => cssVarColor('--bs-dps');
const manaColor = () => cssVarColor('--bs-mana');
export const threatColor = () => cssVarColor('--bs-threat');

export const Y_DPS = 'yDps';
export const Y_MANA = 'yMana';
export const Y_THREAT = 'yThreat';
export const Y_RESOURCE_PCT = 'yResourcePct';

export const DPS_SERIES_ID = 'dps';
export const MANA_SERIES_ID = 'mana';
export const THREAT_SERIES_ID = 'threat';

export const playerDpsSeriesId = (unit: UnitMetrics) => `dps:${unit.unitIndex}`;
export const playerThreatSeriesId = (unit: UnitMetrics) => `threat:${unit.unitIndex}`;

export function timeScale(duration: number, label: string): ScaleOptions<'linear'> {
	return {
		type: 'linear',
		min: 0,
		max: duration,
		title: { display: true, text: label },
		ticks: { maxTicksLimit: 11, callback: value => Number(value).toFixed(1) },
		grid: { color: AXIS_GRID_COLOR },
	};
}

export function dpsScale(maxDps: number): ScaleOptions<'linear'> {
	return valueScale(dpsColor(), 'DPS', Math.max(100, Math.ceil((maxDps || 0) / 100) * 100));
}

// 'auto' shows the axis exactly while a dataset drawn against it is visible, so the threat line
// - hidden by default in the single-player chart - brings its own scale back with it.
export function threatScale(maxThreat: number): ScaleOptions<'linear'> {
	const max = Math.max(10000, Math.ceil((maxThreat || 0) / 10000) * 10000);
	return valueScale(threatColor(), THREAT_SERIES_NAME, max, { display: 'auto' });
}

export function manaScale(maxMana: number): ScaleOptions<'linear'> {
	return valueScale(manaColor(), 'Mana', maxMana, {
		position: 'right',
		ticks: {
			color: manaColor(),
			maxTicksLimit: 11,
			callback: value => `${Number(value).toFixed(0)} (${((Number(value) / maxMana) * 100).toFixed(0)}%)`,
		},
		grid: { drawOnChartArea: false },
	});
}

export function resourcePctScale(): ScaleOptions<'linear'> {
	return { type: 'linear', display: false, min: 0, max: 100 };
}

export function dpsDataset(
	unit: UnitMetrics,
	seriesId: string,
	borderColor: string,
	showPlayerLabel: boolean,
): { dataset: TimelineDataset<DpsLog>; maxDps: number } | null {
	const logs = unit.dpsLogs.filter(log => log.timestamp >= 0);
	if (logs.length == 0) return null;

	let maxDps = 0;
	for (const log of logs) maxDps = Math.max(maxDps, log.dps);

	return {
		maxDps,
		dataset: {
			seriesId,
			label: 'DPS',
			yAxisID: Y_DPS,
			borderColor,
			...LINE_DATASET,
			data: logs.map(log => ({ x: log.timestamp, y: log.dps, log })),
			renderTooltip: log => DpsTooltip(log, unit, borderColor, showPlayerLabel),
		},
	};
}

export function threatDataset(unit: UnitMetrics, seriesId: string, borderColor: string, showPlayerLabel: boolean): TimelineDataset<ThreatLogGroup> | null {
	const logs = unit.threatLogs.filter(log => log.timestamp >= 0);
	if (logs.length == 0) return null;

	return {
		seriesId,
		label: THREAT_SERIES_NAME,
		yAxisID: Y_THREAT,
		borderColor,
		...LINE_DATASET,
		data: logs.map(log => ({ x: log.timestamp, y: log.threatAfter, log })),
		renderTooltip: log => ThreatTooltip(log, unit, borderColor, showPlayerLabel),
	};
}

export function manaDataset(unit: UnitMetrics): { dataset: TimelineDataset<ResourceChangedLogGroup>; maxMana: number } | null {
	const logs = unit.groupedResourceLogs[ResourceType.ResourceTypeMana].filter(log => log.timestamp >= 0);
	if (logs.length == 0) return null;
	const maxMana = logs[0].valueBefore;
	if (maxMana <= 0) return null;

	return {
		maxMana,
		dataset: {
			seriesId: MANA_SERIES_ID,
			label: 'Mana',
			yAxisID: Y_MANA,
			borderColor: manaColor(),
			...LINE_DATASET,
			data: logs.map(log => ({ x: log.timestamp, y: log.valueAfter, log })),
			renderTooltip: log => ResourceTooltip(log, maxMana, true),
		},
	};
}

// Every other resource the unit actually used, drawn as a faint background trace behind
// the DPS line. Mana keeps its own labelled axis; these share one hidden 0-100% axis,
// because a rage bar and a rune count have nothing comparable about their raw numbers and
// one visible axis per resource would bury the chart.
export function resourceDatasets(unit: UnitMetrics, secondaryResource: SecondaryResource | null | undefined): Array<TimelineDataset<ResourceChangedLogGroup>> {
	const datasets: Array<TimelineDataset<ResourceChangedLogGroup>> = [];

	// Health is only informative where staying alive is the job; on a damage spec it is a
	// flat line that just adds a trace to read past.
	const showHealth = !!unit.spec?.isTankSpec || !!unit.spec?.isHealingSpec;

	for (const resourceType of orderedResourceTypes) {
		// Mana is already plotted against its own axis.
		if (resourceType == ResourceType.ResourceTypeMana) continue;
		if (resourceType == ResourceType.ResourceTypeHealth && !showHealth) continue;

		const logs = unit.groupedResourceLogs[resourceType].filter(log => log.timestamp >= 0);
		if (logs.length == 0) continue;

		// Resources that start empty - chi, combo points, runic power - have no useful
		// maxValue on their groups and a valueBefore of 0 at t=0, so scaling off either
		// gave nonsense percentages. Take the largest value the resource is ever declared
		// or observed to hold, over the whole fight.
		let resourceMax = 0;
		for (const log of logs) resourceMax = Math.max(resourceMax, log.maxValue || 0, log.valueBefore, log.valueAfter);
		if (resourceMax <= 0) continue;

		let label = resourceNames.get(resourceType)!;
		if (resourceType == ResourceType.ResourceTypeGenericResource && secondaryResource?.name) {
			label = secondaryResource.name;
		}

		datasets.push({
			seriesId: `res:${resourceType}`,
			label,
			yAxisID: Y_RESOURCE_PCT,
			borderColor: resourceColors.get(resourceType),
			...TRACE_DATASET,
			// Percent of that resource's own maximum: the only scale they share.
			data: logs.map(log => ({ x: log.timestamp, y: Number(((log.valueAfter / resourceMax) * 100).toFixed(2)), log })),
			renderTooltip: log => ResourceTooltip(log, resourceMax, false),
		});
	}

	return datasets;
}
