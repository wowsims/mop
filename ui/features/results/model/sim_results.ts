// DOM-free half of the sidebar results panel: the shapes a stored run/reference
// consists of, and the CSS class names the rendered topline results are keyed by.
// The rendering half lives in ../view/results_action.tsx.
//
// The class names below are load-bearing outside the app too — the browser sweeps
// and timing protocols in tools/browser-perf select on `.results-sim-*`.
import type { SimResult } from '@domain/proto_utils/sim_result';
import type { Raid as RaidProto } from '@generated/proto/api';
import type { Encounter as EncounterProto } from '@generated/proto/common';

export type ReferenceData = {
	simResult: SimResult;
	settings: any;
	raidProto: RaidProto;
	encounterProto: EncounterProto;
};

export interface ResultMetrics {
	cod: string;
	dps: string;
	dtps: string;
	tmi: string;
	dur: string;
	hps: string;
	tps: string;
	tto: string;
	oom: string;
}

export interface ResultMetricCategories {
	damage: string;
	demo: string;
	healing: string;
	threat: string;
}
export const resultMetricCategories: { [ResultMetrics: string]: keyof ResultMetricCategories } = {
	dps: 'damage',
	tps: 'threat',
	dtps: 'threat',
	tmi: 'threat',
	cod: 'threat',
	tto: 'healing',
	hps: 'healing',
};

export const resultMetricClasses: { [ResultMetrics: string]: string } = {
	cod: 'results-sim-cod',
	dps: 'results-sim-dps',
	dtps: 'results-sim-dtps',
	tmi: 'results-sim-tmi',
	dur: 'results-sim-dur',
	hps: 'results-sim-hps',
	tps: 'results-sim-tps',
	tto: 'results-sim-tto',
	oom: 'results-sim-oom',
};

export const metricsClasses: { [ResultMetricCategories: string]: string } = {
	damage: 'damage-metrics',
	demo: 'demo-metrics',
	healing: 'healing-metrics',
	threat: 'threat-metrics',
};
