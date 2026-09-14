// DOM-free half of the sidebar results panel: the shapes a stored run/reference consists of.
// The rendering half is components/SimResultsPanel/SimResultSummary.tsx.
import type { Raid as RaidProto } from '@generated/proto/api';
import type { Encounter as EncounterProto } from '@generated/proto/common';
import type { SimResult } from '@sim/proto/sim_result';

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

export const showsEpRatios = (metrics: { damage: boolean; threat: boolean; healing: boolean }): boolean =>
	metrics.threat || (metrics.damage && metrics.healing);
