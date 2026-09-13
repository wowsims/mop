import { ProgressMetrics, RaidSimResult } from '@generated/proto/api';
import { Spec } from '@generated/proto/common';
import { FireMage_Rotation } from '@generated/proto/mage';
import i18n from '@i18n/config';
import { ActionId } from '@sim/proto/action_id';
import { AuraLog, AuraUptimeLog, CombatLog, computeActionIdAsString, isAura, PlainLog } from '@sim/proto/combat_log';
import type { IndividualSimHost } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import { sum } from '@sim/utils/math';
import { sleep } from '@sim/utils/misc';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { ProgressTrackerDialog, type ProgressTrackerHandle, type ProgressTrackerState } from '@ui-kit/ProgressTrackerDialog';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';
import { toastManager } from '@ui-kit/Toast';
import { useRef, useState } from 'react';

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

type CombustionCategoryValues = Record<keyof CombustionThresholdValues, number[]>;
type CombustionThresholdValues = {
	combustAlwaysSend: CombustionThresholdStats;
	combustBloodlust: CombustionThresholdStats;
	combustPostAlter: CombustionThresholdStats;
	combustNoAlter: CombustionThresholdStats;
	combustEndOfCombat: CombustionThresholdStats;
};

const BLOODLUST_SPELL_ID = 2825;
const ALTER_TIME_SPELL_ID = 108978;
const ITERATIONS_PER_BATCH = 50;
const BATCHES = 10;

const emptyStats = (): CombustionThresholdStats => ({ p25: 0, p50: 0, p95: 0, p99: 0, p99_5: 0, p99_9: 0, avg: 0, max: 0, count: 0 });

const emptyCategoryValues = (): CombustionCategoryValues => ({
	combustAlwaysSend: [],
	combustBloodlust: [],
	combustPostAlter: [],
	combustNoAlter: [],
	combustEndOfCombat: [],
});

const calculateStats = (values: number[]): CombustionThresholdStats => {
	if (values.length === 0) return emptyStats();

	const sorted = [...values].sort((a, b) => a - b);
	const total = sum(values);
	const p25Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.25) - 1);
	const middleIndex = Math.floor(sorted.length / 2);
	const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
	const p99Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1);
	const p99_5Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.995) - 1);
	const p99_9Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.999) - 1);

	return {
		p25: sorted[p25Index],
		p50: sorted.length % 2 === 0 ? (sorted[middleIndex - 1] + sorted[middleIndex]) / 2 : sorted[middleIndex],
		p95: sorted[p95Index],
		p99: sorted[p99Index],
		p99_5: sorted[p99_5Index],
		p99_9: sorted[p99_9Index],
		avg: total / values.length,
		max: sorted[sorted.length - 1],
		count: values.length,
	};
};

const toCombustionStats = (categoryValues: CombustionCategoryValues): CombustionThresholdValues => ({
	combustAlwaysSend: calculateStats(categoryValues.combustAlwaysSend),
	combustBloodlust: calculateStats(categoryValues.combustBloodlust),
	combustPostAlter: calculateStats(categoryValues.combustPostAlter),
	combustNoAlter: calculateStats(categoryValues.combustNoAlter),
	combustEndOfCombat: calculateStats(categoryValues.combustEndOfCombat),
});

const parseLogs = (logs: string[]): CombatLog[] =>
	logs.map((raw, logIndex) => {
		const base = {
			raw,
			logIndex,
			timestamp: 0,
			source: null,
			target: null,
			actionId: null,
			actionIdAsString: null,
			spellSchool: null,
			threat: 0,
			activeAuras: [] as Array<AuraUptimeLog>,
		};

		const timestampMatch = raw.match(/\[(-?[0-9]+\.[0-9]+)\]\w*(.*)/);
		if (!timestampMatch?.[1]) return { ...base, kind: 'plain' } satisfies PlainLog;
		const timestamp = parseFloat(timestampMatch[1]);

		const auraMatch = raw.match(/Aura ((gained)|(faded)|(refreshed)): (.*)/);
		if (auraMatch?.[5]) {
			const actionId = ActionId.fromLogString(auraMatch[5]);
			const event = auraMatch[1];
			return {
				...base,
				kind: 'aura',
				timestamp,
				actionId,
				actionIdAsString: computeActionIdAsString(actionId),
				isGained: event == 'gained',
				isFaded: event == 'faded',
				isRefreshed: event == 'refreshed',
			} satisfies AuraLog;
		}

		return { ...base, kind: 'plain', timestamp } satisfies PlainLog;
	});

const groupLogsByIteration = (logs: CombatLog[]): CombatLog[][] =>
	logs.reduce<CombatLog[][]>((buckets, log) => {
		if (log.raw.includes('-SIMSTART-')) {
			buckets.push([]);
			return buckets;
		}
		if (buckets.length === 0) return buckets;
		buckets[buckets.length - 1].push(log);
		return buckets;
	}, []);

const extractCombustionCategoryValues = (logs: CombatLog[]): CombustionCategoryValues => {
	const auraTimeline: Array<{ timestamp: number; auraId: number; gained: boolean }> = [];

	logs.forEach(log => {
		if (isAura(log) && (log.actionId?.spellId === BLOODLUST_SPELL_ID || log.actionId?.spellId === ALTER_TIME_SPELL_ID)) {
			auraTimeline.push({ timestamp: log.timestamp, auraId: log.actionId.spellId, gained: log.isGained });
		}
	});

	const firstAlterUseTimestamp = auraTimeline
		.filter(event => event.auraId === ALTER_TIME_SPELL_ID && event.gained)
		.reduce<number | null>((first, event) => (first === null || event.timestamp < first ? event.timestamp : first), null);

	let maxTimestamp = 0;
	logs.forEach(log => {
		if (log.timestamp > maxTimestamp) maxTimestamp = log.timestamp;
	});

	const combatStartThreshold = 25;
	const combatEndThreshold = maxTimestamp - 25;

	const getActiveAurasAtTimestamp = (timestamp: number): Set<number> => {
		const active = new Set<number>();
		auraTimeline.forEach(event => {
			if (event.timestamp > timestamp) return;
			if (event.gained) active.add(event.auraId);
			else active.delete(event.auraId);
		});
		return active;
	};

	const categories = emptyCategoryValues();

	logs.forEach(log => {
		if (log.kind !== 'plain' || !log.raw.includes('Combustion Dot Estimate')) return;

		const value = Number(log.raw.split('Combustion Dot Estimate:')?.[1]);
		if (!Number.isFinite(value)) return;

		const activeAuras = getActiveAurasAtTimestamp(log.timestamp);
		const hasBloodlust = activeAuras.has(BLOODLUST_SPELL_ID);
		const hasAlterTime = activeAuras.has(ALTER_TIME_SPELL_ID);

		if (log.timestamp <= combatStartThreshold || hasBloodlust || hasAlterTime) categories.combustAlwaysSend.push(value);

		if (hasBloodlust) categories.combustBloodlust.push(value);
		else categories.combustPostAlter.push(value);

		if (!hasBloodlust && !hasAlterTime && firstAlterUseTimestamp !== null && log.timestamp >= firstAlterUseTimestamp) {
			categories.combustNoAlter.push(value);
		}

		if (log.timestamp >= combatEndThreshold) categories.combustEndOfCombat.push(value);
	});

	return categories;
};

const analyze = async (results: RaidSimResult[], onStage: (state: ProgressTrackerState) => void): Promise<CombustionThresholdValues> => {
	const flattenedRawLogs = results
		.flatMap(result => result.logs.split('\n'))
		.filter(line => line.includes('-SIMSTART-') || line.includes('Combustion Dot Estimate') || line.includes('Aura'));

	onStage({ stage: 'calculating', message: i18n.t('fire_mage.combustion_thresholds.parsing_logs') });
	await sleep(200);

	const iterationCategoryValues = groupLogsByIteration(parseLogs(flattenedRawLogs)).map(extractCombustionCategoryValues);

	const combinedCategoryValues = iterationCategoryValues.reduce<CombustionCategoryValues>((acc, categoryValues) => {
		acc.combustAlwaysSend.push(...categoryValues.combustAlwaysSend);
		acc.combustBloodlust.push(...categoryValues.combustBloodlust);
		acc.combustPostAlter.push(...categoryValues.combustPostAlter);
		acc.combustNoAlter.push(...categoryValues.combustNoAlter);
		acc.combustEndOfCombat.push(...categoryValues.combustEndOfCombat);
		return acc;
	}, emptyCategoryValues());

	onStage({ stage: 'calculating', message: i18n.t('fire_mage.combustion_thresholds.calculating') });

	return toCombustionStats(combinedCategoryValues);
};

const thresholdsFrom = (combined: CombustionThresholdValues): FireMage_Rotation => ({
	combustAlwaysSend: Math.floor(Math.max(combined.combustBloodlust.p95, combined.combustAlwaysSend.p99_9)),
	combustBloodlust: Math.floor(combined.combustBloodlust.p95),
	combustPostAlter: Math.floor(combined.combustPostAlter.max),
	combustNoAlter: Math.floor(combined.combustNoAlter.p50),
	combustEndOfCombat: Math.floor(combined.combustEndOfCombat.p25),
});

const CATEGORY_LABELS: Record<keyof FireMage_Rotation, string> = {
	combustAlwaysSend: 'fire_mage.combustion_thresholds.categories.always_send',
	combustBloodlust: 'fire_mage.combustion_thresholds.categories.bloodlust',
	combustPostAlter: 'fire_mage.combustion_thresholds.categories.alter_time',
	combustNoAlter: 'fire_mage.combustion_thresholds.categories.no_cds',
	combustEndOfCombat: 'fire_mage.combustion_thresholds.categories.end_of_combat',
};

export interface CombustionThresholdsProps {
	host: IndividualSimHost<Spec.SpecFireMage>;
}

export const CombustionThresholds = ({ host }: CombustionThresholdsProps) => {
	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState<ProgressTrackerState>({ stage: 'simming' });
	const [analysis, setAnalysis] = useState<CombustionThresholdValues | null>(null);
	const [resultsOpen, setResultsOpen] = useState(false);
	const barRef = useRef<ProgressTrackerHandle>(null);
	const abortController = useRef<AbortController | null>(null);
	const isCancelling = useRef(false);

	const throwIfAborted = (signal: AbortSignal) => {
		if (signal.aborted || isCancelling.current) throw new Error('Sim Aborted');
	};

	const runWithAbort = <T,>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
		throwIfAborted(signal);
		return Promise.race([
			promise,
			new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('Sim Aborted')), { once: true })),
		]);
	};

	const runSim = async (): Promise<RaidSimResult[]> => {
		const controller = new AbortController();
		abortController.current = controller;
		const abortSignal = controller.signal;

		// The logs of a run have to fit one proto string field, which is why this asks for ten small
		// batches rather than the total in a single request.
		const totalIterations = ITERATIONS_PER_BATCH * BATCHES;
		const completedIterations: number[] = new Array(BATCHES).fill(0);
		const shouldUseWasmConcurrency = await host.sim.shouldUseWasmConcurrency();

		const updateProgress = () => barRef.current?.setProgress({ current: sum(completedIterations), total: totalIterations });

		const onProgress = (batchIndex: number, metrics: Pick<ProgressMetrics, 'completedIterations' | 'totalIterations'>) => {
			completedIterations[batchIndex] = metrics.completedIterations;
			updateProgress();
		};

		const runBatch = async (index: number): Promise<RaidSimResult> => {
			throwIfAborted(abortSignal);

			const response = await runWithAbort(
				host.runGearSim(host.player.getGear(), metrics => onProgress(index, metrics), { debug: true, iterations: ITERATIONS_PER_BATCH }),
				abortSignal,
			);

			if (!response || 'type' in response) throw new Error(response?.message);

			const [__, result] = response;
			return result;
		};

		// In WASM mode each batch has to settle before the next is posted, or the worker's postMessage
		// queue overflows.
		let responses: RaidSimResult[] = [];
		if (shouldUseWasmConcurrency) {
			for (let index = 0; index < BATCHES; index++) responses.push(await runBatch(index));
		} else {
			responses = await Promise.all(Array.from({ length: BATCHES }, (_, index) => runBatch(index)));
		}

		updateProgress();
		return responses;
	};

	const onCalculate = async () => {
		setIsRunning(true);
		isCancelling.current = false;
		setProgress({ stage: 'simming' });

		try {
			const results = await runSim();
			setAnalysis(await analyze(results, setProgress));
			setResultsOpen(true);
		} catch (error) {
			console.error(error);
		} finally {
			abortController.current = null;
			isCancelling.current = false;
			setIsRunning(false);
		}
	};

	const abortSim = async () => {
		if (isCancelling.current) return;
		isCancelling.current = true;
		await host.sim.signalManager.abortType(RequestTypes.IndividualSim);
		if (!abortController.current?.signal.aborted) {
			abortController.current?.abort();
			abortController.current = null;
		}
	};

	const results = analysis && { newValues: thresholdsFrom(analysis), currentValues: host.player.getSimpleRotation() };

	const applyValues = () => {
		if (!results) return;
		host.player.setSimpleRotation(results.newValues);
		setResultsOpen(false);
		toastManager.add({ variant: 'success', body: i18n.t('fire_mage.combustion_thresholds.updated_toast') });
	};

	return (
		<>
			<SidebarActionButton className="mage-calculate-combustion-threshold-group" onClick={() => void onCalculate()} disabled={isRunning}>
				{i18n.t('fire_mage.combustion_thresholds.button')}
			</SidebarActionButton>
			{isRunning && (
				<ProgressTrackerDialog
					open
					container={host.rootElem}
					className="combustion-thresholds-progress-tracker"
					title={i18n.t('fire_mage.combustion_thresholds.progress_title')}
					state={progress}
					hasProgressBar
					warning={
						<>
							<p>{i18n.t('fire_mage.combustion_thresholds.progress_warning')}</p>
							<p className="mb-0">{i18n.t('fire_mage.combustion_thresholds.progress_cancel_hint')}</p>
						</>
					}
					onCancel={() => void abortSim()}
					ref={barRef}
				/>
			)}
			{results && (
				<Dialog
					open={resultsOpen}
					onOpenChange={setResultsOpen}
					container={host.rootElem}
					className="combustion-thresholds-modal"
					size="md"
					title={i18n.t('fire_mage.combustion_thresholds.modal_title')}
					preventClose>
					<div className="combustion-threshold-results d-flex flex-column align-items-end gap-3">
						<div className="table-responsive w-100">
							<table>
								<thead>
									<tr>
										<th>{i18n.t('fire_mage.combustion_thresholds.table.threshold')}</th>
										<th>{i18n.t('fire_mage.combustion_thresholds.table.current')}</th>
										<th></th>
										<th>{i18n.t('fire_mage.combustion_thresholds.table.new')}</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(results.newValues).map(([key, value]) => {
										const typedKey = key as keyof FireMage_Rotation;
										return (
											<tr key={key}>
												<th>{i18n.t(CATEGORY_LABELS[typedKey])}</th>
												<td className="negative">{Math.round(results.currentValues[typedKey])}</td>
												<td>→</td>
												<td className="positive">{Math.round(value)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<div className="d-flex justify-content-end w-100 gap-3">
							<Button variant="outline-primary" onClick={() => setResultsOpen(false)}>
								{i18n.t('fire_mage.combustion_thresholds.close')}
							</Button>
							<Button onClick={applyValues}>{i18n.t('fire_mage.combustion_thresholds.update')}</Button>
						</div>
					</div>
				</Dialog>
			)}
		</>
	);
};

export const registerCombustionThresholds = (host: IndividualSimHost<Spec.SpecFireMage>) =>
	host.sidebar.add({ id: 'mage-calculate-combustion-thresholds', render: () => <CombustionThresholds host={host} /> });
