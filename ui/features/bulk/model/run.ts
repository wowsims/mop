import { BulkSettings, DistributionMetrics, ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';
import { BulkResults, BulkSimProgressConfig, TopGearResult } from '@sim/bulk/types';
import { dedupeGearSets } from '@sim/bulk/utils';
import type { Player } from '@sim/player/player';
import { Gear } from '@sim/proto/gear';
import { getGearIdentityKey } from '@sim/proto/items';
import { bulkState, patchBulkState } from '@sim/settings/bulk_settings';
import { RelativeStatCap } from '@sim/settings/reforge_settings';
import type { ReforgeOptimizeConfig } from '@sim/sim';
import type { IndividualSimHost } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import { isDevMode } from '@sim/utils/env';
import { toastManager } from '@ui-kit/Toast';

import { trackEvent } from '../../../tracking/analytics';
import { runCoreBulkSim as runCoreBulkSimImpl } from './core_sim';
import { BulkProgress, candidateGearProgress, simProgress } from './progress';
import { createBulkSettingsProto } from './settings';
import { buildTieChains } from './tie_chains';

/**
 * A batch in flight, per player. None of it belongs in the store: an abort controller and a
 * promise are not state a selector can compare, and the progress ticks are kept out on purpose,
 * so a tick renders the one leaf that shows it instead of every reader of the slice.
 */
interface BulkRun {
	simStart: number;
	startedAt: number;
	isCancelling: boolean;
	abortController: AbortController | null;
	abortPromise: Promise<void> | null;
	usesLegacyBulkSim: boolean;
	combinationsRequestVersion: number;
	progress: BulkProgress | null;
	listeners: Set<(progress: BulkProgress) => void>;
}

const runs = new WeakMap<Player<any>, BulkRun>();

const runOf = (player: Player<any>): BulkRun => {
	let run = runs.get(player);
	if (!run) {
		run = {
			simStart: 0,
			startedAt: 0,
			isCancelling: false,
			abortController: null,
			abortPromise: null,
			usesLegacyBulkSim: false,
			combinationsRequestVersion: 0,
			progress: null,
			listeners: new Set(),
		};
		runs.set(player, run);
	}
	return run;
};

export const bulkProgress = (player: Player<any>): BulkProgress | null => runOf(player).progress;

export const subscribeBulkProgress = (player: Player<any>, listener: (progress: BulkProgress) => void): (() => void) => {
	const { listeners } = runOf(player);
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

const emitProgress = (player: Player<any>, next: BulkProgress | null) => {
	if (!next) return;
	const run = runOf(player);
	run.progress = next;
	for (const listener of run.listeners) listener(next);
};

const setCandidateGearProgress = (
	player: Player<any>,
	input: { completed?: number; total?: number; title?: string; stage?: string; startedAt?: number } = {},
) => {
	emitProgress(player, candidateGearProgress({ ...input, now: new Date().getTime() }));
};

const setSimProgress = (player: Player<any>, metrics: ProgressMetrics, config: BulkSimProgressConfig) => {
	emitProgress(player, simProgress(metrics, config, runOf(player).simStart, new Date().getTime()));
};

const calculateBulkCombinations = async (host: IndividualSimHost<any>) => {
	const { sim, player } = host;
	try {
		const bulkSettings = createBulkSettingsProto(player);
		const combinationCountResult = await sim.getBulkCombinationCount(bulkSettings);
		if (combinationCountResult.error) {
			throw new Error(combinationCountResult.error.message || 'Failed to calculate bulk combinations');
		}
		patchBulkState(player, { combinations: combinationCountResult.combinations, iterations: combinationCountResult.iterations });
		runOf(player).usesLegacyBulkSim = combinationCountResult.useLegacyBulkSim;
	} catch (e) {
		host.handleCrash(e);
	}
};

export const refreshBulkCombinations = async (host: IndividualSimHost<any>) => {
	const run = runOf(host.player);
	const requestVersion = ++run.combinationsRequestVersion;
	patchBulkState(host.player, { combinationsPending: true });
	await calculateBulkCombinations(host);
	if (requestVersion !== run.combinationsRequestVersion) {
		return;
	}
	patchBulkState(host.player, { combinationsPending: false });
};

const updateRelativeStatCapReforges = (host: IndividualSimHost<any>) => {
	if (!host.reforger) {
		return;
	}

	if (RelativeStatCap.hasRoRo(host.player) && host.reforger.settings.relativeStatCapStat !== -1) {
		host.reforger.settings.relativeStatCap = new RelativeStatCap(host.reforger.settings.relativeStatCapStat);
	}
};

const debugOptimisationRound = (message: string, data?: unknown) => {
	if (!isDevMode()) return;
	console.debug(`[Bulk Sim Optimisation] ${message}`, data);
};

const throwIfBulkAborted = (player: Player<any>, signal: AbortSignal) => {
	if (signal.aborted || runOf(player).isCancelling) {
		throw new Error('Bulk Sim Aborted');
	}
};

const runWithBulkAbort = async <T>(player: Player<any>, promise: Promise<T>, signal: AbortSignal): Promise<T> => {
	throwIfBulkAborted(player, signal);

	let abortHandler: (() => void) | null = null;
	const abortPromise = new Promise<never>((_, reject) => {
		abortHandler = () => reject(new Error('Bulk Sim Aborted'));
		signal.addEventListener('abort', abortHandler, { once: true });
	});

	try {
		return Promise.race([promise, abortPromise]);
	} finally {
		if (abortHandler) {
			signal.removeEventListener('abort', abortHandler);
		}
	}
};

const runCoreBulkSim = async (
	host: IndividualSimHost<any>,
	gearSets: Gear[],
	signal: AbortSignal,
	reforgeConfig?: ReforgeOptimizeConfig,
	bulkSettings?: BulkSettings,
): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> => {
	const { player } = host;
	let candidateBuildStartedAt: number | undefined;
	let cacheRestoreStartedAt: number | undefined;
	return runCoreBulkSimImpl(
		{
			simUI: host,
			throwIfBulkAborted: abortSignal => throwIfBulkAborted(player, abortSignal),
			runWithBulkAbort: (promise, abortSignal) => runWithBulkAbort(player, promise, abortSignal),
			setSimProgress: (metrics, config) => setSimProgress(player, metrics, config),
			setCacheRestoreProgress: cacheProgress => {
				const isCandidateBuildStage = cacheProgress.stage === 'candidate-build';
				if (isCandidateBuildStage) {
					candidateBuildStartedAt ??= new Date().getTime();
				} else {
					cacheRestoreStartedAt ??= new Date().getTime();
				}
				setCandidateGearProgress(player, {
					completed: cacheProgress.processedCandidates,
					total: cacheProgress.totalCandidates,
					title: isCandidateBuildStage
						? i18n.t('bulk_tab.progress.building_candidate_gear_sets')
						: i18n.t('bulk_tab.progress.restoring_reforges_from_cache'),
					stage: isCandidateBuildStage ? 'preparing' : 'reforging',
					startedAt: isCandidateBuildStage ? candidateBuildStartedAt : cacheRestoreStartedAt,
				});
			},
			debugOptimisationRound,
		},
		gearSets,
		signal,
		reforgeConfig,
		bulkSettings,
	);
};

const getBulkReforgeConfig = (host: IndividualSimHost<any>, playerPhase: boolean): ReforgeOptimizeConfig | undefined => {
	const runGear = bulkState(host.player).runGear;
	if (!host.reforger || !runGear) {
		return undefined;
	}

	host.reforger.setIncludeGems(true);
	host.reforger.setIncludeEOTBPGemSocket(playerPhase);
	updateRelativeStatCapReforges(host);
	return host.reforger.getReforgeOptimizeConfig(runGear);
};

const abortBulkSimWork = async (host: IndividualSimHost<any>) => {
	const run = runOf(host.player);
	if (run.abortPromise) {
		return run.abortPromise;
	}

	const abortController = run.abortController;
	if (!abortController) {
		return;
	}

	run.abortController = null;
	if (!abortController.signal.aborted) {
		abortController.abort();
	}

	run.abortPromise = (async () => {
		// Narrower than `All`: cancelling a batch must not also cancel a stat-weights run, which is
		// the whole point of bulk having its own type. Reforge stays in because the batch's own
		// pre-pass registers under it.
		const abortTasks: Promise<unknown>[] = [host.sim.signalManager.abortType(RequestTypes.BulkSim | RequestTypes.ReforgeOptimize)];
		if (host.reforger) {
			abortTasks.push(host.reforger.abortReforgeOptimization());
		}

		await Promise.all(abortTasks);
	})();

	try {
		await run.abortPromise;
	} finally {
		run.abortPromise = null;
	}
};

export const cancelBulkBatch = async (host: IndividualSimHost<any>) => {
	const run = runOf(host.player);
	if (!bulkState(host.player).isRunning || run.isCancelling) return;

	trackEvent({
		action: 'sim',
		category: 'batch_sim',
		label: 'batch_cancel',
		value: run.startedAt > 0 ? Math.round((new Date().getTime() - run.startedAt) / 1000) : 0,
	});

	run.isCancelling = true;
	await abortBulkSimWork(host);
};

export const runBulkBatch = async (host: IndividualSimHost<any>) => {
	const { sim, player } = host;
	const run = runOf(player);
	if (bulkState(player).isRunning) return;

	trackEvent({
		action: 'sim',
		category: 'batch_sim',
		label: 'batch_start',
		value: bulkState(player).combinations,
	});

	run.isCancelling = false;
	run.startedAt = new Date().getTime();
	run.progress = null;
	patchBulkState(player, { isRunning: true, started: true });
	const usesWasmConcurrency = await sim.shouldUseWasmConcurrency();
	await sim.waitForInit();
	const useNativeBulkSim = sim.isNative ?? false;
	const concurrency = usesWasmConcurrency ? sim.getWasmConcurrency() : sim.env.hardwareConcurrency || 4;
	run.abortController = new AbortController();
	run.abortPromise = null;
	const abortSignal = run.abortController.signal;

	const playerPhase = sim.getPhase() >= 2;
	const backendBulkSettings = useNativeBulkSim ? createBulkSettingsProto(player) : undefined;
	let candidateGearSets: Gear[] = [];
	let results: BulkResults | null = null;
	let runError: unknown = null;
	const batchCompleteMetrics: Record<string, string | number> = {
		is_native: useNativeBulkSim ? 1 : 0,
		concurrency,
	};

	try {
		// Bulk owns its own request type now, so this has to name both: a batch still replaces an
		// in-flight single sim, and it still replaces a previous batch, which naming one would drop.
		await sim.signalManager.abortType(RequestTypes.IndividualSim | RequestTypes.BulkSim);
		run.simStart = new Date().getTime();
		const baseGear = player.getGear();
		patchBulkState(player, { runGear: baseGear });

		setCandidateGearProgress(player);
		patchBulkState(player, { results: null });
		// Yield a frame so the progress modal paints before the combination calculation.
		await new Promise(requestAnimationFrame);
		await calculateBulkCombinations(host);
		batchCompleteMetrics.combinations = bulkState(player).combinations;
		batchCompleteMetrics.legacy_bulk_sim_used = run.usesLegacyBulkSim ? 1 : 0;

		if (!useNativeBulkSim) {
			const candidateGearBuildStartedAt = new Date().getTime();
			const bulkCandidatesResult = await sim.getBulkCandidates(createBulkSettingsProto(player));
			if (bulkCandidatesResult.error) {
				throw new Error(bulkCandidatesResult.error.message || 'Failed to build bulk candidates');
			}
			candidateGearSets = bulkCandidatesResult.candidates
				.filter(candidate => !!candidate.gear)
				.map(candidate => sim.db.lookupEquipmentSpec(candidate.gear!));
			patchBulkState(player, { combinations: bulkCandidatesResult.combinations });
			batchCompleteMetrics.candidate_gear_sets = candidateGearSets.length;
			batchCompleteMetrics.candidate_gear_sets_duration_seconds = Math.round((new Date().getTime() - candidateGearBuildStartedAt) / 1000);
		}

		const backendReforgeConfig = getBulkReforgeConfig(host, playerPhase);
		// With backend reforging every candidate must be submitted (reforges differentiate
		// otherwise identical gear); without it duplicates are culled up front.
		const gearSets = backendReforgeConfig ? candidateGearSets : dedupeGearSets(candidateGearSets, [baseGear]);
		run.simStart = new Date().getTime();
		const bulkSimResult = await runCoreBulkSim(host, gearSets, abortSignal, backendReforgeConfig, backendBulkSettings);
		const { referenceDpsMetrics, topGearResults } = bulkSimResult;
		Object.assign(batchCompleteMetrics, bulkSimResult.metrics);

		const originalGearKey = getGearIdentityKey(baseGear.asSpec());
		const rankedResults = topGearResults.filter(result => getGearIdentityKey(result.gear.asSpec()) !== originalGearKey);
		const originalGearResults: TopGearResult = {
			gear: baseGear,
			dpsMetrics: referenceDpsMetrics,
		};

		rankedResults.push(originalGearResults);
		rankedResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);

		results = {
			chains: buildTieChains(rankedResults, originalGearResults, Math.max(1, sim.getIterations())),
			originalGearResults,
		};
	} catch (error) {
		runError = error;
		console.error(error);
		const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
		if (!run.isCancelling && errorMessage) {
			trackEvent({
				action: 'sim',
				category: 'batch_sim',
				label: 'batch_error',
				value: errorMessage,
			});
			toastManager.add({
				variant: 'error',
				body: errorMessage,
			});
		}
	} finally {
		const wasCancelling = run.isCancelling;
		const bulkSimDurationSeconds = (new Date().getTime() - run.startedAt) / 1000;
		if (wasCancelling || runError) {
			await abortBulkSimWork(host);
		} else {
			trackEvent({
				action: 'sim',
				category: 'batch_sim',
				label: 'batch_complete',
				value: Math.round(bulkSimDurationSeconds),
				additionalData: batchCompleteMetrics,
			});
		}
		if (isDevMode()) {
			console.info('[Bulk Sim] run complete', {
				durationSeconds: Math.round(bulkSimDurationSeconds * 100) / 100,
				combinations: bulkState(player).combinations,
				usedLegacyBulkSim: run.usesLegacyBulkSim,
				cancelled: wasCancelling,
			});
		}
		await player.setGearAsync(bulkState(player).runGear!);
		if (wasCancelling) {
			toastManager.add({
				variant: 'error',
				body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
			});
		}
		run.isCancelling = false;
		patchBulkState(player, results ? { isRunning: false, results } : { isRunning: false });
	}
};
