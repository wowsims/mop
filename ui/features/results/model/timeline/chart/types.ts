import { CombatLog } from '@sim/proto/combat_log';
import { ChartDataset, ChartOptions } from 'chart.js';

export interface TimelinePoint<L extends CombatLog = CombatLog> {
	x: number;
	y: number;
	log: L;
}

/** Which tooltip a series shows, as data: the renderer is a React component the chart wrapper owns. */
export type TooltipSpec = { kind: 'dps' } | { kind: 'threat' } | { kind: 'resource'; maxValue: number; includeAuras: boolean };

export interface TimelineDataset<L extends CombatLog = CombatLog> extends ChartDataset<'line', Array<TimelinePoint<L>>> {
	seriesId: string;
	// Not `tooltip`: chart.js already has per-dataset tooltip options under that name.
	tooltipSpec: TooltipSpec;
}

export interface CooldownBand {
	start: number;
	end: number;
	color: string;
}

export interface CooldownIcon {
	time: number;
	row: number;
	url: string;
}

export interface AnnotationSpec {
	bands: Array<CooldownBand>;
	icons: Array<CooldownIcon>;
}

export interface TimelineChartSpec {
	datasets: Array<TimelineDataset>;
	scales: NonNullable<ChartOptions<'line'>['scales']>;
	annotations: AnnotationSpec | null;
	duration: number;
}
