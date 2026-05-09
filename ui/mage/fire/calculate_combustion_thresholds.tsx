import clsx from 'clsx';
import { BaseModal } from '../../core/components/base_modal';
import { Component } from '../../core/components/component';
import { IndividualSimUI } from '../../core/individual_sim_ui';
import { Spec } from '../../core/proto/common';
import { AuraEventLog, SimLog, SimLogParams } from '../../core/proto_utils/logs_parser';
import { TypedEvent } from '../../core/typed_event';
import { FireMage_Rotation } from '../../core/proto/mage';
import Toast from '../../core/components/toast';
import { ProgressTrackerModal } from '../../core/components/progress_tracker_modal';
import { sleep, sum } from '../../core/utils';
import { ProgressMetrics, RaidSimResult } from '../../core/proto/api';
import i18n from '../../i18n/config';
import { ActionId } from '../../core/proto_utils/action_id';
import { RequestTypes } from '../../core/sim_signal_manager';

interface CombustionThresholdStats {
	p25: number;
	p50: number;
	p95: number;
	p99: number;
	p99_5: number;
	p99_9: number;
	avg: number;
	max: number;
	count: number;
}

type CombustionCategoryValues = Record<keyof CombustionAnalysisResult['combined'], number[]>;
type CombustionThresholdValues = {
	combustAlwaysSend: CombustionThresholdStats;
	combustBloodlust: CombustionThresholdStats;
	combustPostAlter: CombustionThresholdStats;
	combustNoAlter: CombustionThresholdStats;
	combustEndOfCombat: CombustionThresholdStats;
};

interface CombustionAnalysisResult {
	iterationResults: Array<CombustionThresholdValues>;
	combined: CombustionThresholdValues;
}

export class CalculateCombustionThresholds extends Component {
	private readonly simUI: IndividualSimUI<Spec.SpecFireMage>;
	private button: HTMLButtonElement;
	private modal: BaseModal;
	protected progressTrackerModal: ProgressTrackerModal;

	private isRunning = false;
	private isCancelling = false;
	private simAbortController: AbortController | null = null;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<Spec.SpecFireMage>) {
		super(null, undefined, parent);
		this.simUI = simUI;

		this.progressTrackerModal = new ProgressTrackerModal(simUI.rootElem, {
			id: 'combustion-thresholds-progress-tracker',
			title: 'Calculating Combustion Thresholds',
			hasProgressBar: true,
			warning: (
				<>
					<p>Calculating combustion thresholds can be a lengthy process.</p>
					<p className="mb-0">You may cancel this operation at any time using the button below.</p>
				</>
			),
			onCancel: () => {
				this.abortSim();
			},
		});

		this.button = this.simUI.addAction('Calculate Combustion Thresholds', 'mage-calculate-combustion-threshold-group', async () => {
			if (this.isRunning) return;

			this.isRunning = true;
			this.isCancelling = false;
			this.button.disabled = true;

			this.progressTrackerModal.show();
			const results = await this.runSim();
			const analysis = await this.analyze(results);
			this.render(analysis);

			this.modal.open();
			this.progressTrackerModal.hide();
		});

		this.modal = new BaseModal(this.rootElem, clsx('combustion-thresholds-modal'), {
			title: 'Combustion Thresholds',
			disposeOnClose: false,
			preventClose: true,
			size: 'md',
		});
	}

	private async runSim(): Promise<RaidSimResult[]> {
		try {
			this.simAbortController = new AbortController();
			const abortSignal = this.simAbortController.signal;

			// We limit the iterations because of the max length of the logs string object in the proto
			const shouldUseWasmConcurrency = await this.simUI.sim.shouldUseWasmConcurrency();
			let iterations = 50;
			let batches = 10;

			const totalIterations = iterations * batches;
			let completedIterations: number[] = new Array(batches).fill(0);

			const updateProgress = () => {
				this.progressTrackerModal.updateProgress({
					stage: 'simming',
					current: sum(completedIterations),
					total: totalIterations,
					message: (
						<div
							innerHTML={i18n.t('bulk_tab.progress.iterations_complete', {
								completed: sum(completedIterations),
								total: totalIterations,
							})}
						/>
					),
				});
			};

			const onProgress = (batchIndex: number, progress: Pick<ProgressMetrics, 'completedIterations' | 'totalIterations'>) => {
				completedIterations[batchIndex] = progress.completedIterations;
				updateProgress();
			};

			const runBatch = async (index: number): Promise<RaidSimResult> => {
				this.throwIfAborted(abortSignal);

				const response = await this.runWithAbort(
					this.simUI.runSimLightweight(this.simUI.player.getGear(), progress => onProgress(index, progress), {
						debug: true,
						iterations,
					}),
					abortSignal,
				);

				if (!response || (response && 'type' in response)) {
					throw new Error(response?.message);
				}

				const [__, result] = response;

				return result;
			};

			let responses: RaidSimResult[] = [];
			// In WASM mode we need to wait for the workers to finish each batch
			// otherwise we risk running into postmessage errors
			if (shouldUseWasmConcurrency) {
				for (let index = 0; index < batches; index++) {
					responses.push(await runBatch(index));
				}
			} else {
				responses = await Promise.all(Array.from({ length: batches }, (_, index) => runBatch(index)));
			}

			updateProgress();

			return responses;
		} finally {
			this.button.disabled = false;
			this.isRunning = false;
			this.isCancelling = false;
			this.progressTrackerModal.hide();
		}
	}

	private async analyze(results: RaidSimResult[]): Promise<CombustionAnalysisResult> {
		if (!results || results.length === 0) {
			return this.emptyAnalysisResult();
		}

		const flattenedRawLogs = results
			.flatMap(result => result.logs.split('\n'))
			.filter(line => line.includes('-SIMSTART-') || line.includes('Combustion Dot Estimate') || line.includes('Aura'));
		const parsedLogs = await this.parseLogs(flattenedRawLogs);
		const iterationCategoryValues = this.groupLogsByIteration(parsedLogs).map(logs => this.extractCombustionCategoryValues(logs));

		const iterationResults = iterationCategoryValues.map(categoryValues => this.toCombustionStats(categoryValues));

		const combinedCategoryValues = iterationCategoryValues.reduce<CombustionCategoryValues>((acc, categoryValues) => {
			acc.combustAlwaysSend.push(...categoryValues.combustAlwaysSend);
			acc.combustBloodlust.push(...categoryValues.combustBloodlust);
			acc.combustPostAlter.push(...categoryValues.combustPostAlter);
			acc.combustNoAlter.push(...categoryValues.combustNoAlter);
			acc.combustEndOfCombat.push(...categoryValues.combustEndOfCombat);
			return acc;
		}, this.emptyCategoryValues());

		this.progressTrackerModal.updateProgress({
			stage: 'calculating',
			message: 'Calculating thresholds',
		});

		const combined = this.toCombustionStats(combinedCategoryValues);

		return {
			iterationResults,
			combined,
		};
	}

	private async parseLogs(logs: string[]): Promise<SimLog[]> {
		this.progressTrackerModal.updateProgress({
			stage: 'calculating',
			message: `Parsing logs`,
		});
		await sleep(200);
		return logs
			.map((log, index) => {
				const params: SimLogParams = {
					raw: log,
					logIndex: index,
					timestamp: 0,
					source: null,
					target: null,
					actionId: null,
					spellSchool: null,
					threat: 0,
				};
				const timestampMatch = params.raw.match(/\[(-?[0-9]+\.[0-9]+)\]\w*(.*)/);
				const auraMatch = params.raw.match(/Aura ((gained)|(faded)|(refreshed)): (.*)/);
				if (!timestampMatch?.[1]) {
					return new SimLog(params);
				}

				params.timestamp = parseFloat(timestampMatch[1]);

				if (auraMatch && auraMatch[5]) {
					const actionId = ActionId.fromLogString(auraMatch[5]);
					params.actionId = actionId;
					const event = auraMatch[1];
					return new AuraEventLog(params, event == 'gained', event == 'faded', event == 'refreshed');
				}

				return new SimLog(params);
			})
			.filter((log): log is SimLog => !!log);
	}

	private groupLogsByIteration(logs: SimLog[]): SimLog[][] {
		return logs.reduce<SimLog[][]>((buckets, log) => {
			if (log.raw.includes('-SIMSTART-')) {
				buckets.push([]);
				return buckets;
			}

			if (buckets.length === 0) {
				return buckets;
			}

			buckets[buckets.length - 1].push(log);
			return buckets;
		}, []);
	}

	private extractCombustionCategoryValues(logs: SimLog[]): CombustionCategoryValues {
		const BLOODLUST_SPELL_ID = 2825;
		const ALTER_TIME_SPELL_ID = 108978;

		// Build aura timeline
		const auraTimeline: Array<{ timestamp: number; auraId: number; gained: boolean }> = [];

		logs.forEach(log => {
			if (log.isAuraEvent?.()) {
				if (log.actionId?.spellId === BLOODLUST_SPELL_ID || log.actionId?.spellId === ALTER_TIME_SPELL_ID) {
					auraTimeline.push({
						timestamp: log.timestamp,
						auraId: log.actionId.spellId,
						gained: log.isGained,
					});
				}
			}
		});

		const firstAlterUseTimestamp = auraTimeline
			.filter(event => event.auraId === ALTER_TIME_SPELL_ID && event.gained)
			.reduce<number | null>((first, event) => {
				if (first === null || event.timestamp < first) {
					return event.timestamp;
				}
				return first;
			}, null);

		// Find max timestamp for combat end calculation
		let maxTimestamp = 0;
		logs.forEach(log => {
			if (log.timestamp > maxTimestamp) {
				maxTimestamp = log.timestamp;
			}
		});

		const combatStartThreshold = 25;
		const combatEndThreshold = maxTimestamp - 25;

		// Function to determine active auras at a given timestamp
		const getActiveAurasAtTimestamp = (timestamp: number): Set<number> => {
			const active = new Set<number>();
			auraTimeline.forEach(event => {
				if (event.timestamp <= timestamp) {
					if (event.gained) {
						active.add(event.auraId);
					} else {
						active.delete(event.auraId);
					}
				}
			});
			return active;
		};

		// Categorize combustion values
		const categories = this.emptyCategoryValues();

		logs.forEach(log => {
			if (Object.getPrototypeOf(log) !== SimLog.prototype) {
				return;
			}

			if (!log.raw.includes('Combustion Dot Estimate')) {
				return;
			}

			const value = Number(log.raw.split('Combustion Dot Estimate:')?.[1]);
			if (!Number.isFinite(value)) {
				return;
			}

			const activeAuras = getActiveAurasAtTimestamp(log.timestamp);
			const hasBloodlust = activeAuras.has(BLOODLUST_SPELL_ID);
			const hasAlterTime = activeAuras.has(ALTER_TIME_SPELL_ID);

			if (log.timestamp <= combatStartThreshold || hasBloodlust || hasAlterTime) {
				categories.combustAlwaysSend.push(value);
			}

			if (hasBloodlust) {
				categories.combustBloodlust.push(value);
			} else {
				categories.combustPostAlter.push(value);
			}

			if (!hasBloodlust && !hasAlterTime && firstAlterUseTimestamp !== null && log.timestamp >= firstAlterUseTimestamp) {
				categories.combustNoAlter.push(value);
			}

			if (log.timestamp >= combatEndThreshold) {
				categories.combustEndOfCombat.push(value);
			}
		});

		return categories;
	}

	private toCombustionStats(categoryValues: CombustionCategoryValues): CombustionAnalysisResult['combined'] {
		return {
			combustAlwaysSend: this.calculateStats(categoryValues.combustAlwaysSend),
			combustBloodlust: this.calculateStats(categoryValues.combustBloodlust),
			combustPostAlter: this.calculateStats(categoryValues.combustPostAlter),
			combustNoAlter: this.calculateStats(categoryValues.combustNoAlter),
			combustEndOfCombat: this.calculateStats(categoryValues.combustEndOfCombat),
		};
	}

	private emptyCategoryValues(): CombustionCategoryValues {
		return {
			combustAlwaysSend: [],
			combustBloodlust: [],
			combustPostAlter: [],
			combustNoAlter: [],
			combustEndOfCombat: [],
		};
	}

	private calculateStats(values: number[]): CombustionThresholdStats {
		if (values.length === 0) {
			return { p25: 0, p50: 0, p99_9: 0, p95: 0, p99: 0, p99_5: 0, avg: 0, max: 0, count: 0 };
		}
		const sorted = [...values].sort((a, b) => a - b);
		const sum = values.reduce((a, b) => a + b, 0);
		const p25Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.25) - 1);
		const middleIndex = Math.floor(sorted.length / 2);
		const p25 = sorted[p25Index];
		const p50 = sorted.length % 2 === 0 ? (sorted[middleIndex - 1] + sorted[middleIndex]) / 2 : sorted[middleIndex];
		const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
		const p99Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1);
		const p99_5Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.995) - 1);
		const p99_9Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.999) - 1);
		const p95 = sorted[p95Index];
		const p99 = sorted[p99Index];
		const p99_5 = sorted[p99_5Index];
		const p99_9 = sorted[p99_9Index];
		return {
			p25,
			p50,
			p95,
			p99,
			p99_5,
			p99_9,
			avg: sum / values.length,
			max: sorted[sorted.length - 1],
			count: values.length,
		};
	}

	private emptyAnalysisResult(): CombustionAnalysisResult {
		const emptyStats = { p25: 0, p50: 0, p95: 0, p99: 0, p99_5: 0, p99_9: 0, avg: 0, max: 0, count: 0 };
		return {
			iterationResults: [],
			combined: {
				combustAlwaysSend: emptyStats,
				combustBloodlust: emptyStats,
				combustPostAlter: emptyStats,
				combustNoAlter: emptyStats,
				combustEndOfCombat: emptyStats,
			},
		};
	}

	private render(data: CombustionAnalysisResult) {
		const categoryEntries: Record<keyof FireMage_Rotation, string> = {
			combustAlwaysSend: 'Combust Threshold - Always send',
			combustBloodlust: 'Combust Threshold - Bloodlust',
			combustPostAlter: 'Combust Threshold - Alter Time',
			combustNoAlter: 'Combust Threshold - No CDs',
			combustEndOfCombat: 'Combust Threshold - End of combat',
		};

		const numberFormatter = (value: number) => Math.round(value);
		const newValues: FireMage_Rotation = {
			combustAlwaysSend: Math.floor(Math.max(data.combined.combustBloodlust.p95, data.combined.combustAlwaysSend.p99_9)),
			combustBloodlust: Math.floor(data.combined.combustBloodlust.p95),
			combustPostAlter: Math.floor(data.combined.combustPostAlter.max),
			combustNoAlter: Math.floor(data.combined.combustNoAlter.p50),
			combustEndOfCombat: Math.floor(data.combined.combustEndOfCombat.p25),
		};

		const currentValues = this.simUI.player.getSimpleRotation();

		const updateValues = () => {
			this.simUI.player.setSimpleRotation(TypedEvent.nextEventID(), newValues);
			this.modal.close();
			new Toast({
				variant: 'success',
				body: 'Combustion thresholds have been updated',
			});
		};

		this.modal.body.replaceChildren(
			<div className="combustion-threshold-results d-flex flex-column align-items-end gap-3">
				<>
					<div className="table-responsive w-100">
						<table>
							<thead>
								<tr>
									<th>Threshold</th>
									<th>Current</th>
									<th></th>
									<th>New</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(newValues).map(([key, value]) => {
									const typedKey = key as keyof FireMage_Rotation;
									return (
										<tr>
											<th>{categoryEntries[typedKey]}</th>
											<td className="negative">{numberFormatter(currentValues[typedKey])}</td>
											<td>→</td>
											<td className="positive">{numberFormatter(value)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<div className="d-flex justify-content-end w-100 gap-3">
						<button onclick={() => this.modal.close()} className={clsx('btn btn-outline-primary')}>
							Close
						</button>
						<button onclick={updateValues} className={clsx('btn btn-primary')}>
							Update Thresholds
						</button>
					</div>
				</>
			</div>,
		);
	}

	private throwIfAborted(signal: AbortSignal) {
		if (signal.aborted || this.isCancelling) {
			throw new Error('Sim Aborted');
		}
	}

	private async runWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
		this.throwIfAborted(signal);

		let abortHandler: (() => void) | null = null;
		const abortPromise = new Promise<never>((_, reject) => {
			abortHandler = () => reject(new Error('Sim Aborted'));
			signal.addEventListener('abort', abortHandler, { once: true });
		});

		try {
			return Promise.race([promise, abortPromise]);
		} finally {
			if (abortHandler) {
				signal.removeEventListener('abort', abortHandler);
			}
		}
	}

	private async abortSim() {
		if (this.isCancelling) return;

		try {
			this.isCancelling = true;
			await this.simUI.sim.signalManager.abortType(RequestTypes.All);
			if (!this.simAbortController?.signal.aborted) {
				this.simAbortController?.abort();
				this.simAbortController = null;
			}
		} finally {
			this.button.disabled = false;
		}
	}
}
