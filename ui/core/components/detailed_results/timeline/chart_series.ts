import i18n from '../../../../i18n/config';
import { ResourceType } from '../../../proto/spell';
import { resourceColors, resourceNames } from '../../../proto_utils/names';
import SecondaryResource from '../../../proto_utils/secondary_resource';
import { UnitMetrics } from '../../../proto_utils/sim_result';
import { orderedResourceTypes } from '../../../proto_utils/utils';
import { distinct, maxIndex, stringComparator } from '../../../utils';
import { actionColors } from '../color_settings';
import { dpsColor, manaColor, THREAT_SERIES_NAME, threatColor } from './constants';
import { dpsTooltip, resourceTooltip, resourceTooltipElem, threatTooltip } from './tooltip_content';
import { TooltipHandler } from './types';

export function addDpsYAxis(maxDps: number, options: any) {
	const dpsAxisMax = Math.ceil(maxDps / 100) * 100;
	options.yaxis.push({
		color: dpsColor,
		seriesName: 'DPS',
		min: 0,
		max: dpsAxisMax,
		tickAmount: 10,
		decimalsInFloat: 0,
		title: {
			text: 'DPS',
			style: {
				color: dpsColor,
			},
		},
		axisBorder: {
			show: true,
			color: dpsColor,
		},
		axisTicks: {
			color: dpsColor,
		},
		labels: {
			minWidth: 30,
			style: {
				colors: [dpsColor],
			},
		},
	});
}

export function addThreatYAxis(maxThreat: number, options: any) {
	const axisMax = Math.ceil(maxThreat / 10000) * 10000;
	options.yaxis.push({
		color: threatColor,
		seriesName: i18n.t('results_tab.details.timeline.tooltips.threat'),
		min: 0,
		max: axisMax,
		tickAmount: 10,
		decimalsInFloat: 0,
		title: {
			text: i18n.t('results_tab.details.timeline.tooltips.threat'),
			style: {
				color: threatColor,
			},
		},
		axisBorder: {
			show: true,
			color: threatColor,
		},
		axisTicks: {
			color: threatColor,
		},
		labels: {
			minWidth: 30,
			style: {
				colors: [threatColor],
			},
		},
	});
}

// Returns a function for drawing the tooltip, or null if no series was added.
export function addDpsSeries(unit: UnitMetrics, options: any, colorOverride: string): { maxDps: number; tooltipHandler: TooltipHandler } {
	const dpsLogs = unit.dpsLogs.filter(log => log.timestamp >= 0);

	options.colors.push(colorOverride || dpsColor);
	options.series.push({
		name: 'DPS',
		type: 'line',
		data: dpsLogs.map(log => {
			return {
				x: log.timestamp,
				y: log.dps,
			};
		}),
	});

	return {
		maxDps: dpsLogs[maxIndex(dpsLogs.map(l => l.dps))!]?.dps,
		tooltipHandler: (dataPointIndex: number) => {
			const log = dpsLogs[dataPointIndex];
			return dpsTooltip(log, true, unit, colorOverride);
		},
	};
}

// ApexCharts maps y-axes to series by name. With a single axis every series shares it, but
// as soon as there is more than one, a series with no matching entry crashes its
// axis-matching pass. Threat has no axis of its own in the single-player view and rode on
// the DPS axis, so keep it there explicitly rather than giving it a scale of its own.
export function attachUnmappedSeriesToFirstAxis(options: any) {
	if (options.yaxis.length <= 1) return;

	const mapped = new Set<string>();
	for (const axis of options.yaxis) {
		for (const name of Array.isArray(axis.seriesName) ? axis.seriesName : [axis.seriesName]) {
			if (name) mapped.add(name);
		}
	}

	const unmapped = options.series.map((series: any) => series.name).filter((name: string) => !mapped.has(name));
	if (unmapped.length == 0) return;

	const first = options.yaxis[0];
	const existing = Array.isArray(first.seriesName) ? first.seriesName : [first.seriesName];
	first.seriesName = [...existing, ...unmapped];
}

// Every other resource the unit actually used, drawn as a faint background trace behind
// the DPS line. Mana keeps its own labelled axis; these share a hidden 0-100% axis,
// because a rage bar and a rune count have nothing comparable about their raw numbers and
// one visible axis per resource would bury the chart.
export function addResourceSeries(unit: UnitMetrics, options: any, secondaryResource: SecondaryResource | null | undefined): Array<TooltipHandler> {
	const handlers: Array<TooltipHandler> = [];
	const traceNames = new Set<string>();

	// Health is only informative where staying alive is the job; on a damage spec it is a
	// flat line that just adds a trace to read past.
	const showHealth = !!unit.spec?.isTankSpec || !!unit.spec?.isHealingSpec;

	for (const resourceType of orderedResourceTypes) {
		// Mana is already plotted against its own axis.
		if (resourceType == ResourceType.ResourceTypeMana) continue;
		if (resourceType == ResourceType.ResourceTypeHealth && !showHealth) continue;

		const resourceLogs = unit.groupedResourceLogs[resourceType].filter(log => log.timestamp >= 0);
		if (resourceLogs.length == 0) continue;

		// Resources that start empty - chi, combo points, runic power - have no useful
		// maxValue on their groups and a valueBefore of 0 at t=0, so scaling off either
		// gave nonsense percentages. Take the largest value the resource is ever declared
		// or observed to hold, over the whole fight.
		let resourceMax = 0;
		for (const log of resourceLogs) {
			resourceMax = Math.max(resourceMax, log.maxValue || 0, log.valueBefore, log.valueAfter);
		}
		if (resourceMax <= 0) continue;
		let name = resourceNames.get(resourceType)!;
		if (resourceType == ResourceType.ResourceTypeGenericResource && secondaryResource?.name) {
			name = secondaryResource.name;
		}

		traceNames.add(name);
		options.colors.push(resourceColors.get(resourceType));
		options.series.push({
			name: name,
			type: 'line',
			data: resourceLogs.map(log => ({
				x: log.timestamp,
				// Percent of that resource's own maximum: the only scale they share.
				y: Number(((log.valueAfter / resourceMax) * 100).toFixed(2)),
			})),
		});
		options.yaxis.push({
			seriesName: name,
			show: false,
			min: 0,
			max: 100,
		});

		handlers.push((dataPointIndex: number) => {
			const log = resourceLogs[dataPointIndex];
			return resourceTooltipElem(log, resourceMax, false);
		});
	}

	if (traceNames.size > 0) {
		// Thin and dashed so they read as context behind the DPS line rather than as peers
		// of it. Both are per-series arrays, so they have to cover every series in order.
		options.stroke = {
			curve: 'straight',
			width: options.series.map((series: any) => (traceNames.has(series.name) ? 1 : 2)),
			dashArray: options.series.map((series: any) => (traceNames.has(series.name) ? 4 : 0)),
		};
	}

	return handlers;
}

// Returns a function for drawing the tooltip, or null if no series was added.
export function addManaSeries(unit: UnitMetrics, options: any): TooltipHandler | null {
	const manaLogs = unit.groupedResourceLogs[ResourceType.ResourceTypeMana].filter(log => log.timestamp >= 0);
	if (manaLogs.length == 0) {
		return null;
	}
	const maxMana = manaLogs[0].valueBefore;

	options.colors.push(manaColor);
	options.series.push({
		name: 'Mana',
		type: 'line',
		data: manaLogs.map(log => {
			return {
				x: log.timestamp,
				y: log.valueAfter,
			};
		}),
	});
	options.yaxis.push({
		seriesName: 'Mana',
		opposite: true, // Appear on right side
		min: 0,
		max: maxMana,
		tickAmount: 10,
		title: {
			text: 'Mana',
			style: {
				color: manaColor,
			},
		},
		axisBorder: {
			show: true,
			color: manaColor,
		},
		axisTicks: {
			color: manaColor,
		},
		labels: {
			minWidth: 30,
			style: {
				colors: [manaColor],
			},
			formatter: (val: string) => {
				const v = parseFloat(val);
				return `${v.toFixed(0)} (${((v / maxMana) * 100).toFixed(0)}%)`;
			},
		},
	} as any);

	return (dataPointIndex: number) => {
		const log = manaLogs[dataPointIndex];
		return resourceTooltip(log, maxMana, true);
	};
}

// Returns a function for drawing the tooltip, or null if no series was added.
export function addThreatSeries(unit: UnitMetrics, options: any, colorOverride: string): TooltipHandler | null {
	options.colors.push(colorOverride || threatColor);
	options.series.push({
		name: THREAT_SERIES_NAME,
		type: 'line',
		data: unit.threatLogs
			.filter(log => log.timestamp >= 0)
			.map(log => {
				return {
					x: log.timestamp,
					y: log.threatAfter,
				};
			}),
	});

	return (dataPointIndex: number) => {
		const log = unit.threatLogs[dataPointIndex];
		return threatTooltip(log, true, unit, colorOverride);
	};
}

export function addMajorCooldownAnnotations(unit: UnitMetrics, options: any) {
	const mcdLogs = unit.majorCooldownLogs;
	const mcdAuraLogs = unit.majorCooldownAuraUptimeLogs;

	// Figure out how much to vertically offset cooldown icons, for cooldowns
	// used very close to each other. This is so the icons don't overlap.
	const MAX_ALLOWED_DIST = 10;
	const cooldownIconOffsets = mcdLogs.map(
		(mcdLog, mcdIdx) => mcdLogs.filter((cdLog, cdIdx) => cdIdx < mcdIdx && cdLog.timestamp > mcdLog.timestamp - MAX_ALLOWED_DIST).length,
	);

	const distinctMcdAuras = distinct(mcdAuraLogs, (a, b) => a.actionId!.equalsIgnoringTag(b.actionId!));
	// Sort by name so auras keep their same colors even if timings change.
	distinctMcdAuras.sort((a, b) => stringComparator(a.actionId!.name, b.actionId!.name));
	const mcdAuraColors = mcdAuraLogs.map(
		mcdAuraLog => actionColors[distinctMcdAuras.findIndex(dAura => dAura.actionId!.equalsIgnoringTag(mcdAuraLog.actionId!))],
	);

	options.annotations = {
		position: 'back',
		xaxis: mcdAuraLogs.map((log, i) => {
			return {
				x: log.gainedAt,
				x2: log.fadedAt,
				fillColor: mcdAuraColors[i],
			};
		}),
		points: mcdLogs.map((log, i) => {
			return {
				x: log.timestamp,
				y: 0,
				image: {
					path: log.actionId!.iconUrl,
					width: 20,
					height: 20,
					offsetY: cooldownIconOffsets[i] * -25,
				},
			};
		}),
	};
}
