import SecondaryResource from '@domain/proto_utils/secondary_resource';
import { UnitMetrics } from '@domain/proto_utils/sim_result';
import i18n from '@i18n/config';

import { majorCooldownAnnotations } from './annotations';
import {
	DPS_SERIES_ID,
	dpsColor,
	dpsDataset,
	dpsScale,
	manaDataset,
	manaScale,
	resourceDatasets,
	resourcePctScale,
	THREAT_SERIES_ID,
	threatColor,
	threatDataset,
	threatScale,
	timeScale,
	Y_DPS,
	Y_MANA,
	Y_RESOURCE_PCT,
	Y_THREAT,
} from './series';
import { TimelineChartSpec, TimelineDataset } from './types';

const timeAxis = (duration: number) => ({ x: timeScale(duration, i18n.t('results_tab.details.timeline.chart_options.time_axis')) });

export function chartSpec(unit: UnitMetrics, duration: number, secondaryResource: SecondaryResource | null | undefined): TimelineChartSpec {
	const datasets: Array<TimelineDataset> = [];
	const scales: TimelineChartSpec['scales'] = timeAxis(duration);

	const dps = dpsDataset(unit, DPS_SERIES_ID, dpsColor());
	if (dps) {
		datasets.push(dps.dataset);
		scales[Y_DPS] = dpsScale(dps.maxDps);
	}

	const mana = manaDataset(unit);
	if (mana) {
		datasets.push(mana.dataset);
		scales[Y_MANA] = manaScale(mana.maxMana);
	}

	const threat = threatDataset(unit, THREAT_SERIES_ID, threatColor());
	if (threat) {
		datasets.push(threat);
		scales[Y_THREAT] = threatScale(unit.maxThreat);
	}

	const resources = resourceDatasets(unit, secondaryResource);
	if (resources.length) {
		datasets.push(...resources);
		scales[Y_RESOURCE_PCT] = resourcePctScale();
	}

	return { datasets, scales, duration, annotations: majorCooldownAnnotations(unit) };
}
