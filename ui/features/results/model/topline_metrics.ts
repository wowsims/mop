// The topline metric list, as data. One model, two renderers: the sidebar panel draws it as a
// column of `.results-metric` divs, the three detailed-results panes draw it as a one-row table.
// Neither layout lives here — see `components/ResultMetricList`, and `view/results_action.tsx`
// for the vanilla sidebar half that still builds its own DOM from this list.
import { DeathKnight } from '@sim/player/classes/death_knight';
import { Hunter } from '@sim/player/classes/hunter';
import { Rogue } from '@sim/player/classes/rogue';
import { Warrior } from '@sim/player/classes/warrior';
import { PlayerSpecs } from '@sim/player/specs/index';
import { ActionMetrics, type SimResult, type SimResultFilter } from '@sim/proto/sim_result';
import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';

import { metricsClasses, resultMetricCategories, resultMetricClasses, type ResultMetrics } from './sim_results';

export type ResultMetricUnit = 'percentage' | 'number' | 'seconds' | undefined;

export type ResultMetric = {
	/** Which metric this is, for a renderer that needs the label or tooltip key rather than the rendered text. */
	metric: keyof ResultMetrics;
	name: string;
	average: number;
	stdev?: number;
	classes?: string;
	unit?: ResultMetricUnit;
};

export type ToplineMetricsOptions = {
	showOutOfMana?: boolean;
};

const NO_MANA_CLASSES = [DeathKnight, Rogue, Warrior, Hunter];

const TANK_SPECS_WITH_HPS = [
	Spec.SpecBloodDeathKnight,
	Spec.SpecGuardianDruid,
	Spec.SpecBrewmasterMonk,
	Spec.SpecProtectionPaladin,
	Spec.SpecProtectionWarrior,
];

const lineClasses = (metric: keyof ResultMetrics): string => {
	const classes = [resultMetricClasses[metric]];
	if (resultMetricCategories[metric]) classes.push(metricsClasses[resultMetricCategories[metric]]);

	return classes.join(' ');
};

const column = (
	metric: keyof ResultMetrics,
	average: number,
	options: { stdev?: number; unit?: ResultMetricUnit; extraClass?: string } = {},
): ResultMetric => ({
	metric,
	name: i18n.t(`sidebar.results.metrics.${metric}.label`),
	average,
	stdev: options.stdev,
	classes: options.extraClass ? `${lineClasses(metric)} ${options.extraClass}` : lineClasses(metric),
	unit: options.unit,
});

/** The out-of-mana column is a single-player, mana-using-class call the detailed-results rows make and the sidebar does not. */
export const showsOutOfMana = (simResult: SimResult, filter?: SimResultFilter): boolean => {
	const players = simResult.getRaidIndexedPlayers(filter);

	return players.length === 1 && !!players[0].spec && !NO_MANA_CLASSES.some(klass => PlayerSpecs.getPlayerClass(players[0].spec!) === klass);
};

export const toplineResultMetrics = (simResult: SimResult, filter?: SimResultFilter, options: ToplineMetricsOptions = {}): ResultMetric[] => {
	const { showOutOfMana = false } = options;

	const players = simResult.getRaidIndexedPlayers(filter);

	const resultColumns: ResultMetric[] = [];

	const playerMetrics = players[0];
	const showHPSMetricsForTanks = TANK_SPECS_WITH_HPS.includes(players[0].spec?.specID);

	if (playerMetrics.getTargetIndex(filter) === null) {
		const { chanceOfDeath, dps: dpsMetrics, tps: tpsMetrics, dtps: dtpsMetrics, tmi: tmiMetrics } = playerMetrics;

		resultColumns.push(column('dps', dpsMetrics.avg, { stdev: dpsMetrics.stdev }));
		resultColumns.push(column('tps', tpsMetrics.avg, { stdev: tpsMetrics.stdev }));
		resultColumns.push(column('dtps', dtpsMetrics.avg, { stdev: dtpsMetrics.stdev }));

		if (showHPSMetricsForTanks) {
			const { hps } = playerMetrics;
			resultColumns.push(column('hps', hps.avg, { stdev: hps.stdev }));
		}

		resultColumns.push(column('tmi', tmiMetrics.avg, { stdev: tmiMetrics.stdev, unit: 'percentage' }));
		resultColumns.push(column('cod', chanceOfDeath.avg, { stdev: chanceOfDeath.stdev, unit: 'percentage' }));
	} else {
		const actions = simResult.getRaidIndexedActionMetrics(filter);
		if (!!actions.length) {
			const { dps, tps } = ActionMetrics.merge(actions);
			resultColumns.push(column('dps', dps));
			resultColumns.push(column('tps', tps));
		}

		const targetActions = simResult
			.getTargets(filter)
			.map(target => target.actions)
			.flat()
			.map(action => action.forTarget({ player: playerMetrics.unitIndex }));
		if (!!targetActions.length) {
			const { dps: dtps } = ActionMetrics.merge(targetActions);
			resultColumns.push(column('dtps', dtps));
		}

		if (showHPSMetricsForTanks) {
			resultColumns.push(column('hps', playerMetrics.hps.avg, { stdev: playerMetrics.hps.stdev }));
		}
	}

	if (!showHPSMetricsForTanks) {
		resultColumns.push(column('tto', playerMetrics.tto.avg, { stdev: playerMetrics.tto.stdev, unit: 'seconds' }));
		resultColumns.push(column('hps', playerMetrics.hps.avg, { stdev: playerMetrics.hps.stdev }));
	}

	if (simResult.request.encounter?.useHealth) {
		resultColumns.push(column('dur', simResult.result.avgIterationDuration, { unit: 'seconds' }));
	}

	if (showOutOfMana) {
		const secondsOOM = players[0].secondsOomAvg;
		const percentOOM = secondsOOM / simResult.encounterMetrics.durationSeconds;
		const dangerLevel = percentOOM < 0.01 ? 'safe' : percentOOM < 0.05 ? 'warning' : 'danger';

		resultColumns.push(column('oom', secondsOOM, { unit: 'seconds', extraClass: dangerLevel }));
	}

	return resultColumns;
};
