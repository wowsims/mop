import i18n from '../../../../../i18n/config';
import SecondaryResource from '../../../../proto_utils/secondary_resource';
import { UnitMetrics } from '../../../../proto_utils/sim_result';
import { majorCooldownAnnotations } from './annotations';
import { classColorValue } from './colors';
import {
	DPS_SERIES_ID,
	dpsDataset,
	dpsScale,
	manaDataset,
	manaScale,
	playerDpsSeriesId,
	playerThreatSeriesId,
	resourceDatasets,
	resourcePctScale,
	THREAT_SERIES_ID,
	threatDataset,
	threatScale,
	timeScale,
	Y_DPS,
	Y_MANA,
	Y_RESOURCE_PCT,
	Y_THREAT,
	Y_THREAT_HIDDEN,
} from './series';
import { TimelineChartSpec, TimelineDataset } from './types';

const timeAxis = (duration: number) => ({ x: timeScale(duration, i18n.t('results_tab.details.timeline.chart_options.time_axis')) });

export function singlePlayerChartSpec(unit: UnitMetrics, duration: number, secondaryResource: SecondaryResource | null | undefined): TimelineChartSpec {
	const datasets: Array<TimelineDataset> = [];
	const scales: TimelineChartSpec['scales'] = timeAxis(duration);

	const dps = dpsDataset(unit, DPS_SERIES_ID, '');
	if (dps) {
		datasets.push(dps.dataset);
		scales[Y_DPS] = dpsScale(dps.maxDps);
	}

	const mana = manaDataset(unit);
	if (mana) {
		datasets.push(mana.dataset);
		scales[Y_MANA] = manaScale(mana.maxMana);
	}

	const threat = threatDataset(unit, THREAT_SERIES_ID, '', Y_THREAT_HIDDEN);
	if (threat) {
		datasets.push(threat);
		scales[Y_THREAT_HIDDEN] = threatScale(unit.maxThreat, false);
	}

	const resources = resourceDatasets(unit, secondaryResource);
	if (resources.length) {
		datasets.push(...resources);
		scales[Y_RESOURCE_PCT] = resourcePctScale();
	}

	return { datasets, scales, duration, annotations: majorCooldownAnnotations(unit) };
}

export function multiPlayerChartSpec(units: Array<UnitMetrics>, duration: number, mode: 'dps' | 'threat'): TimelineChartSpec {
	const datasets: Array<TimelineDataset> = [];
	const scales: TimelineChartSpec['scales'] = timeAxis(duration);

	if (mode === 'dps') {
		let maxDps = 0;
		for (const unit of units) {
			const dps = dpsDataset(unit, playerDpsSeriesId(unit), classColorValue(unit.classColor));
			if (!dps) continue;
			datasets.push(dps.dataset);
			maxDps = Math.max(maxDps, dps.maxDps);
		}
		scales[Y_DPS] = dpsScale(maxDps);
	} else {
		let maxThreat = 0;
		for (const unit of units) {
			const threat = threatDataset(unit, playerThreatSeriesId(unit), classColorValue(unit.classColor), Y_THREAT);
			if (!threat) continue;
			datasets.push(threat);
			maxThreat = Math.max(maxThreat, unit.maxThreat);
		}
		scales[Y_THREAT] = threatScale(maxThreat, true);
	}

	return { datasets, scales, duration, annotations: null };
}
