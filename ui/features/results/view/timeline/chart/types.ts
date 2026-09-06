import { CombatLog } from '@domain/proto_utils/combat_log';
import { ChartDataset, ChartOptions } from 'chart.js';

export interface TimelinePoint<L extends CombatLog = CombatLog> {
	x: number;
	y: number;
	log: L;
}

// renderTooltip is declared as a method so it stays bivariant and a
// TimelineDataset<DpsLog> can live in an Array<TimelineDataset>.
export interface TimelineDataset<L extends CombatLog = CombatLog> extends ChartDataset<'line', Array<TimelinePoint<L>>> {
	seriesId: string;
	renderTooltip(log: L): Element;
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
