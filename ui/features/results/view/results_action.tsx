import { ActionMetrics, SimResult, SimResultFilter } from '@domain/proto_utils/sim_result';
import { RequestTypes } from '@domain/sim_signal_manager';
import { batch } from '@domain/state/batch';
import { Emitter } from '@domain/state/events';
import { formatDeltaTextElem, formatToNumber, formatToPercent, zTest } from '@domain/utils';
import { metricsClasses, ReferenceData, resultMetricCategories, resultMetricClasses, ResultMetrics } from '@features/results/model/sim_results';
import type { SimHost } from '@features/sim_host';
import { DistributionMetrics as DistributionMetricsProto, ProgressMetrics, Raid as RaidProto } from '@generated/proto/api';
import { Encounter as EncounterProto, Spec } from '@generated/proto/common';
import { SimRunData } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translateResultMetricLabel, translateResultMetricTooltip } from '@i18n/localization';
import clsx from 'clsx';
import tippy from 'tippy.js';

import { trackEvent } from '../../../tracking/analytics';

export function addSimResultsAction(simUI: SimHost): SimResultsManager {
	const resultsViewer = simUI.resultsViewer;
	let isRunning = false;
	let waitAbort = false;

	simUI.addAction(i18n.t('sidebar.buttons.simulate'), 'dps-action', async ev => {
		trackEvent({
			action: 'sim',
			category: 'simulate',
			label: 'simulate',
			value: simUI.sim.getIterations(),
		});
		const button = ev.target as HTMLButtonElement;
		button.disabled = true;
		if (!isRunning) {
			isRunning = true;

			resultsViewer.addAbortButton(async () => {
				if (waitAbort) return;
				try {
					waitAbort = true;
					await simUI.sim.signalManager.abortType(RequestTypes.RaidSim);
				} catch (error) {
					console.error('Error on sim abort!');
					console.error(error);
				} finally {
					waitAbort = false;
					if (!isRunning) button.disabled = false;
				}
			});

			await simUI.runSim((progress: ProgressMetrics) => {
				resultsManager.setSimProgress(progress);
			});

			resultsViewer.removeAbortButton();
			if (!waitAbort) button.disabled = false;
			isRunning = false;
		}
	});

	const resultsManager = new SimResultsManager(simUI);
	simUI.sim.simResultEmitter.on(simResult => {
		resultsManager.setSimResult(simResult);
	});
	return resultsManager;
}

export class SimResultsManager {
	static resultMetricCategories = resultMetricCategories;

	static resultMetricClasses = resultMetricClasses;

	static metricsClasses = metricsClasses;

	// Events (results arrived / reference set or swapped), not state.
	readonly currentChangeEmitter = new Emitter<void>();
	readonly referenceChangeEmitter = new Emitter<void>();

	// Fires once per current/reference change; emitted explicitly (no relay)
	// so a swap — which changes both — notifies once.

	private readonly simUI: SimHost;

	currentData: ReferenceData | null = null;
	referenceData: ReferenceData | null = null;

	private resetCallbacks: (() => void)[] = [];

	constructor(simUI: SimHost) {
		this.simUI = simUI;
	}

	setSimProgress(progress: ProgressMetrics) {
		this.reset();
		if (progress.finalRaidResult && progress.finalRaidResult.error) {
			this.simUI.resultsViewer.hideAll();
			return;
		}
		this.simUI.resultsViewer.setContent(
			<div className="results-sim">
				<div className="results-sim-dps damage-metrics">
					<span className="topline-result-avg">{progress.dps.toFixed(2)}</span>
				</div>
				<div className="results-sim-hps healing-metrics">
					<span className="topline-result-avg">{progress.hps.toFixed(2)}</span>
				</div>
				<div>
					{progress.presimRunning
						? i18n.t('sidebar.results.progress.presim_running')
						: `${progress.completedIterations} / ${progress.totalIterations}`}
					<br />
					{i18n.t('sidebar.results.progress.iterations_complete')}
				</div>
			</div>,
		);
	}

	setSimResult(simResult: SimResult) {
		this.reset();
		this.currentData = {
			simResult: simResult,
			settings: {
				raid: RaidProto.toJson(this.simUI.sim.raid.toProto()),
				encounter: EncounterProto.toJson(this.simUI.sim.encounter.toProto()),
			},
			raidProto: RaidProto.clone(simResult.request.raid || RaidProto.create()),
			encounterProto: EncounterProto.clone(simResult.request.encounter || EncounterProto.create()),
		};

		this.currentChangeEmitter.emit();

		this.simUI.resultsViewer.setContent(
			<div className="results-sim">
				{SimResultsManager.makeToplineResultsContent(simResult, undefined, { asList: true })}
				<div className="results-sim-reference">
					<button className="results-sim-set-reference">
						<i className={`fa fa-map-pin fa-lg text-${this.simUI.config.cssScheme} me-2`} />
						{i18n.t('sidebar.results.reference.save_as_reference')}
					</button>
					<div className="results-sim-reference-bar">
						<button className="results-sim-reference-swap me-3">
							<i className="fas fa-arrows-rotate me-1" />
							{i18n.t('sidebar.results.reference.swap')}
						</button>
						<button className="results-sim-reference-delete">
							<i className="fa fa-times fa-lg me-1" />
							{i18n.t('sidebar.results.reference.cancel')}
						</button>
					</div>
				</div>
			</div>,
		);

		const setResultTooltip = (selector: string, content: Element | HTMLElement | string) => {
			const resultDivElem = this.simUI.resultsViewer.contentElem.querySelector<HTMLElement>(selector);
			if (resultDivElem) {
				const tooltip = tippy(resultDivElem, { content, placement: 'right' });
				this.addOnResetCallback(() => tooltip.destroy());
			}
		};
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['dps']}`, i18n.t('sidebar.results.metrics.dps.tooltip'));
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['tto']}`, i18n.t('sidebar.results.metrics.tto.tooltip'));
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['hps']}`, i18n.t('sidebar.results.metrics.hps.tooltip'));
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['tps']}`, i18n.t('sidebar.results.metrics.tps.tooltip'));
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['dtps']}`, i18n.t('sidebar.results.metrics.dtps.tooltip'));
		setResultTooltip(`.${SimResultsManager.resultMetricClasses['dur']}`, i18n.t('sidebar.results.metrics.dur.tooltip'));
		setResultTooltip(
			`.${SimResultsManager.resultMetricClasses['tmi']}`,
			<>
				<p>{i18n.t('sidebar.results.metrics.tmi.tooltip.title')}</p>
				<p>{i18n.t('sidebar.results.metrics.tmi.tooltip.description')}</p>
				<p>
					<b>{i18n.t('sidebar.results.metrics.tmi.tooltip.note')}</b>
				</p>
			</>,
		);
		setResultTooltip(
			`.${SimResultsManager.resultMetricClasses['cod']}`,
			<>
				<p>{i18n.t('sidebar.results.metrics.cod.tooltip.title')}</p>
				<p>{i18n.t('sidebar.results.metrics.cod.tooltip.description')}</p>
				<p>{i18n.t('sidebar.results.metrics.cod.tooltip.note')}</p>
			</>,
		);

		const simReferenceSetButton = this.simUI.resultsViewer.contentElem.querySelector<HTMLSpanElement>('.results-sim-set-reference');
		if (simReferenceSetButton) {
			const onSetReferenceClickHandler = () => {
				this.referenceData = this.currentData;
				this.referenceChangeEmitter.emit();
				this.updateReference();
			};
			simReferenceSetButton.addEventListener('click', onSetReferenceClickHandler);
			const tooltip = tippy(simReferenceSetButton, { content: i18n.t('sidebar.results.reference.use_as_reference') });
			this.addOnResetCallback(() => {
				tooltip.destroy();
				simReferenceSetButton?.removeEventListener('click', onSetReferenceClickHandler);
			});
		}

		const simReferenceSwapButton = this.simUI.resultsViewer.contentElem.querySelector<HTMLSpanElement>('.results-sim-reference-swap');
		if (simReferenceSwapButton) {
			const onSwapClickHandler = () => {
				batch(() => {
					if (this.currentData && this.referenceData) {
						const tmpData = this.currentData;
						this.currentData = this.referenceData;
						this.referenceData = tmpData;

						this.simUI.sim.raid.fromProto(this.currentData.raidProto);
						this.simUI.sim.encounter.fromProto(this.currentData.encounterProto);
						this.setSimResult(this.currentData.simResult);

						this.referenceChangeEmitter.emit();
						this.updateReference();
					}
				});
			};
			simReferenceSwapButton.addEventListener('click', onSwapClickHandler);
			const tooltip = tippy(simReferenceSwapButton, {
				content: i18n.t('sidebar.results.reference.swap_reference_with_current'),
				ignoreAttributes: true,
			});
			this.addOnResetCallback(() => {
				tooltip.destroy();
				simReferenceSwapButton?.removeEventListener('click', onSwapClickHandler);
			});
		}
		const simReferenceDeleteButton = this.simUI.resultsViewer.contentElem.querySelector<HTMLSpanElement>('.results-sim-reference-delete');
		if (simReferenceDeleteButton) {
			const onDeleteReferenceClickHandler = () => {
				this.referenceData = null;
				this.referenceChangeEmitter.emit();
				this.updateReference();
			};
			simReferenceDeleteButton.addEventListener('click', onDeleteReferenceClickHandler);
			const tooltip = tippy(simReferenceDeleteButton, {
				content: i18n.t('sidebar.results.reference.remove_reference'),
				ignoreAttributes: true,
			});

			this.addOnResetCallback(() => {
				tooltip.destroy();
				simReferenceDeleteButton?.removeEventListener('click', onDeleteReferenceClickHandler);
			});
		}

		this.updateReference();
	}

	updateReference() {
		if (!this.referenceData || !this.currentData) {
			// Remove references
			this.simUI.resultsViewer.contentElem.querySelector('.results-sim-reference')?.classList.remove('has-reference');
			this.simUI.resultsViewer.contentElem.querySelectorAll('.results-reference').forEach(e => e.classList.add('hide'));
			return;
		} else {
			// Add references references
			this.simUI.resultsViewer.contentElem.querySelector('.results-sim-reference')?.classList.add('has-reference');
			this.simUI.resultsViewer.contentElem.querySelectorAll('.results-reference').forEach(e => e.classList.remove('hide'));
		}

		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['dps']} .results-reference-diff`, res => res.raidMetrics.dps, 2);
		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['hps']} .results-reference-diff`, res => res.raidMetrics.hps, 2);
		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['tto']} .results-reference-diff`, res => res.getFirstPlayer()!.tto, 2);
		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['tps']} .results-reference-diff`, res => res.getFirstPlayer()!.tps, 2);
		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['dtps']} .results-reference-diff`, res => res.getFirstPlayer()!.dtps, 2, true);
		this.formatToplineResult(`.${SimResultsManager.resultMetricClasses['tmi']} .results-reference-diff`, res => res.getFirstPlayer()!.tmi, 2, true);
		this.formatToplineResult(
			`.${SimResultsManager.resultMetricClasses['cod']} .results-reference-diff`,
			res => res.getFirstPlayer()!.chanceOfDeath,
			2,
			true,
			true,
		);
	}

	private formatToplineResult(
		querySelector: string,
		getMetrics: (result: SimResult) => DistributionMetricsProto | number,
		precision: number,
		lowerIsBetter?: boolean,
		preNormalizedErrors?: boolean,
	) {
		const elem = this.simUI.resultsViewer.contentElem.querySelector<HTMLSpanElement>(querySelector);
		if (!elem) {
			return;
		}

		const cur = this.currentData!.simResult;
		const ref = this.referenceData!.simResult;
		const curMetricsTemp = getMetrics(cur);
		const refMetricsTemp = getMetrics(ref);
		if (typeof curMetricsTemp === 'number') {
			const curMetrics = curMetricsTemp as number;
			const refMetrics = refMetricsTemp as number;
			formatDeltaTextElem(elem, refMetrics, curMetrics, precision, lowerIsBetter, undefined, true);
		} else {
			const curMetrics = curMetricsTemp as DistributionMetricsProto;
			const refMetrics = refMetricsTemp as DistributionMetricsProto;
			const isDiff = SimResultsManager.applyZTestTooltip(
				elem,
				ref.iterations,
				refMetrics.avg,
				refMetrics.stdev,
				cur.iterations,
				curMetrics.avg,
				curMetrics.stdev,
				!!preNormalizedErrors,
			);
			formatDeltaTextElem(elem, refMetrics.avg, curMetrics.avg, precision, lowerIsBetter, !isDiff, true);
		}
	}

	static applyZTestTooltip(
		elem: HTMLElement,
		n1: number,
		avg1: number,
		stdev1: number,
		n2: number,
		avg2: number,
		stdev2: number,
		preNormalized: boolean,
	): boolean {
		const { z, isDiff } = zTest(n1, avg1, stdev1, n2, avg2, stdev2, preNormalized);

		let significance_str = '';
		if (isDiff) {
			significance_str = `Difference is significantly different (Z = ${z.toFixed(3)}).`;
		} else {
			significance_str = `Difference is not significantly different (Z = ${z.toFixed(3)}).`;
		}
		tippy(elem, {
			content: significance_str,
			ignoreAttributes: true,
		});

		return isDiff;
	}

	getRunData(): SimRunData | null {
		if (!this.currentData) {
			return null;
		}

		return SimRunData.create({
			run: this.currentData.simResult.toProto(),
			referenceRun: this.referenceData?.simResult.toProto(),
		});
	}

	getCurrentData(): ReferenceData | null {
		if (!this.currentData) {
			return null;
		}

		// Defensive copy.
		return {
			simResult: this.currentData.simResult,
			settings: structuredClone(this.currentData.settings),
			raidProto: this.currentData.raidProto,
			encounterProto: this.currentData.encounterProto,
		};
	}

	getReferenceData(): ReferenceData | null {
		if (!this.referenceData) {
			return null;
		}

		// Defensive copy.
		return {
			simResult: this.referenceData.simResult,
			settings: structuredClone(this.referenceData.settings),
			raidProto: this.referenceData.raidProto,
			encounterProto: this.referenceData.encounterProto,
		};
	}

	static makeToplineResultsContent(simResult: SimResult, filter?: SimResultFilter, options: ToplineResultOptions = {}) {
		const { showOutOfMana = false } = options;

		const players = simResult.getRaidIndexedPlayers(filter);

		const resultColumns: ResultMetric[] = [];

		const playerMetrics = players[0];
		const showHPSMetricsForTanks = [
			Spec.SpecBloodDeathKnight,
			Spec.SpecGuardianDruid,
			Spec.SpecBrewmasterMonk,
			Spec.SpecProtectionPaladin,
			Spec.SpecProtectionWarrior,
		].includes(players[0].spec?.specID);

		if (playerMetrics.getTargetIndex(filter) === null) {
			const { chanceOfDeath, dps: dpsMetrics, tps: tpsMetrics, dtps: dtpsMetrics, tmi: tmiMetrics } = playerMetrics;

			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.dps.label'),
				average: dpsMetrics.avg,
				stdev: dpsMetrics.stdev,
				classes: this.getResultsLineClasses('dps'),
			});
			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.tps.label'),
				average: tpsMetrics.avg,
				stdev: tpsMetrics.stdev,
				classes: this.getResultsLineClasses('tps'),
			});
			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.dtps.label'),
				average: dtpsMetrics.avg,
				stdev: dtpsMetrics.stdev,
				classes: this.getResultsLineClasses('dtps'),
			});

			if (showHPSMetricsForTanks) {
				const { hps } = playerMetrics;
				resultColumns.push({
					name: i18n.t('sidebar.results.metrics.hps.label'),
					average: hps.avg,
					stdev: hps.stdev,
					classes: this.getResultsLineClasses('hps'),
				});
			}

			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.tmi.label'),
				average: tmiMetrics.avg,
				stdev: tmiMetrics.stdev,
				classes: this.getResultsLineClasses('tmi'),
				unit: 'percentage',
			});

			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.cod.label'),
				average: chanceOfDeath.avg,
				stdev: chanceOfDeath.stdev,
				classes: this.getResultsLineClasses('cod'),
				unit: 'percentage',
			});
		} else {
			const actions = simResult.getRaidIndexedActionMetrics(filter);
			if (!!actions.length) {
				const { dps, tps } = ActionMetrics.merge(actions);
				resultColumns.push({
					name: i18n.t('sidebar.results.metrics.dps.label'),
					average: dps,
					classes: this.getResultsLineClasses('dps'),
				});

				resultColumns.push({
					name: i18n.t('sidebar.results.metrics.tps.label'),
					average: tps,
					classes: this.getResultsLineClasses('tps'),
				});
			}

			const targetActions = simResult
				.getTargets(filter)
				.map(target => target.actions)
				.flat()
				.map(action => action.forTarget({ player: playerMetrics.unitIndex }));
			if (!!targetActions.length) {
				const { dps: dtps } = ActionMetrics.merge(targetActions);

				resultColumns.push({
					name: i18n.t('sidebar.results.metrics.dtps.label'),
					average: dtps,
					classes: this.getResultsLineClasses('dtps'),
				});
			}

			if (showHPSMetricsForTanks) {
				resultColumns.push({
					name: i18n.t('sidebar.results.metrics.hps.label'),
					average: playerMetrics.hps.avg,
					stdev: playerMetrics.hps.stdev,
					classes: this.getResultsLineClasses('hps'),
				});
			}
		}

		if (!showHPSMetricsForTanks) {
			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.tto.label'),
				average: playerMetrics.tto.avg,
				stdev: playerMetrics.tto.stdev,
				classes: this.getResultsLineClasses('tto'),
				unit: 'seconds',
			});

			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.hps.label'),
				average: playerMetrics.hps.avg,
				stdev: playerMetrics.hps.stdev,
				classes: this.getResultsLineClasses('hps'),
			});
		}

		if (simResult.request.encounter?.useHealth) {
			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.dur.label'),
				average: simResult.result.avgIterationDuration,
				classes: this.getResultsLineClasses('dur'),
				unit: 'seconds',
			});
		}

		if (showOutOfMana) {
			const player = players[0];
			const secondsOOM = player.secondsOomAvg;
			const percentOOM = secondsOOM / simResult.encounterMetrics.durationSeconds;
			const dangerLevel = percentOOM < 0.01 ? 'safe' : percentOOM < 0.05 ? 'warning' : 'danger';

			resultColumns.push({
				name: i18n.t('sidebar.results.metrics.oom.label'),
				average: secondsOOM,
				classes: [this.getResultsLineClasses('oom'), dangerLevel].join(' '),
				unit: 'seconds',
			});
		}

		if (options.asList) return this.buildResultsList(resultColumns);

		return this.buildResultsTable(resultColumns);
	}

	private static getResultsLineClasses(metric: keyof ResultMetrics): string {
		const classes = [this.resultMetricClasses[metric]];
		if (this.resultMetricCategories[metric]) classes.push(this.metricsClasses[this.resultMetricCategories[metric]]);

		return classes.join(' ');
	}

	private static buildResultsTable(data: ResultMetric[]): Element {
		return (
			<>
				<table className="metrics-table">
					<thead className="metrics-table-header">
						<tr className="metrics-table-header-row">
							{data.map(({ name, classes }) => {
								const localizedName = translateResultMetricLabel(name) || name;
								const cell = <th className={clsx('metrics-table-header-cell', classes)}>{localizedName}</th>;

								tippy(cell, {
									content: translateResultMetricTooltip(name) || name,
									ignoreAttributes: true,
								});

								return cell;
							})}
						</tr>
					</thead>
					<tbody className="metrics-table-body">
						<tr>
							{data.map(({ average, stdev, classes, unit }) => {
								let value = '';
								let errorDecimals = 0;
								switch (unit) {
									case 'percentage':
										value = formatToPercent(average);
										errorDecimals = 2;
										break;
									case 'seconds':
										value = formatToNumber(average, { style: 'unit', unit: 'second', unitDisplay: 'narrow' });
										break;
									default:
										value = formatToNumber(average);
										break;
								}
								return (
									<td className={clsx('text-center align-top', classes)}>
										<div className="topline-result-avg">{value}</div>
										{stdev ? (
											<div className="topline-result-stdev">
												<i className="fas fa-plus-minus fa-xs"></i> {formatToNumber(stdev, { maximumFractionDigits: errorDecimals })}
											</div>
										) : undefined}
										<div className="results-reference hide">
											<span className="results-reference-diff"></span> {i18n.t('sidebar.results.reference.vs_ref')}
										</div>
									</td>
								);
							})}
						</tr>
					</tbody>
				</table>
			</>
		);
	}

	private static buildResultsList(data: ResultMetric[]): Element {
		return (
			<>
				{data.map(column => {
					const errorDecimals = column.unit === 'percentage' ? 2 : 0;
					const label = translateResultMetricLabel(column.name) || column.name;
					const prefix = column.name === 'tmi' || column.name === 'cod' ? '% ' : ' ';

					return (
						<div className={`results-metric ${column.classes}`}>
							<span className="topline-result-avg">
								{column.average.toFixed(2)}
								<span className="metric-label">
									{prefix}
									{label}
								</span>
							</span>
							{column.stdev && (
								<span className="topline-result-stdev">
									(<i className="fas fa-plus-minus fa-xs"></i>
									{column.stdev.toFixed(errorDecimals)})
								</span>
							)}
							<div className="results-reference hide">
								<span className="results-reference-diff"></span> {i18n.t('sidebar.results.reference.vs_ref')}
							</div>
						</div>
					);
				})}
			</>
		);
	}

	addOnResetCallback(callback: () => void) {
		this.resetCallbacks.push(callback);
	}

	reset() {
		this.resetCallbacks.forEach(callback => callback());
		this.resetCallbacks = [];
	}
}

type ToplineResultOptions = {
	showOutOfMana?: boolean;
	asList?: boolean;
};

type ResultMetric = {
	name: string;
	average: number;
	stdev?: number;
	classes?: string;
	unit?: 'percentage' | 'number' | 'seconds' | undefined;
};
