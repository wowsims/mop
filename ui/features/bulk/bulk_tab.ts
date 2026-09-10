import { BulkSettings, DistributionMetrics, ProgressMetrics } from '@generated/proto/api';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BulkResults, BulkSimProgressConfig, TopGearResult } from '@sim/bulk/types';
import { BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS, BulkSimItemSlot, dedupeGearSets } from '@sim/bulk/utils';
import { EquippedItem } from '@sim/proto/equipped_item';
import { Gear } from '@sim/proto/gear';
import { getGearIdentityKey } from '@sim/proto/items';
import { bulkState, loadStoredBulkSettings, patchBulkState, seedBulkSettings, storeBulkSettings } from '@sim/settings/bulk_settings';
import { RelativeStatCap } from '@sim/settings/reforge_settings';
import type { ReforgeOptimizeConfig } from '@sim/sim';
import type { IndividualSimHost } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import { type BulkOwner, subscribeAll, subscribeBulkChange, subscribePlayerField, subscribeSimField } from '@sim/state/subscriptions';
import { isDevMode } from '@sim/utils/env';
import { toastManager } from '@ui-kit/Toast';

import { trackEvent } from '../../tracking/analytics';
import { runCoreBulkSim as runCoreBulkSimImpl } from './model/core_sim';
import { addBulkItems, loadEquippedBulkItems, seedBulkPickerGroups } from './model/items';
import { BulkProgress, candidateGearProgress, simProgress } from './model/progress';
import { sanitiseRequiredSetBonuses } from './model/set_bonuses';
import {
	createBulkSettingsProto,
	sanitizeBulkWeaponTypeFilter,
	setBulkFrozenItem,
	setBulkFrozenWeaponSlot,
	setBulkInheritUpgrades,
	setBulkUseLegacyBulkSim,
	setBulkWeaponTypeFilter,
} from './model/settings';
import { buildTieChains } from './model/tie_chains';

type FrozenBulkSlot = BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket;

/**
 * The bulk feature's model.
 *
 * It renders nothing: `BulkTabBody` is the tab's React body and reads the bulk store slice.
 */
export interface BulkTab extends BulkOwner {
	runBatchSim(): Promise<void>;
	cancelBatchSim(): Promise<void>;
	/** The batch's own progress ticks, kept out of the store so a tick renders one leaf. */
	onProgress(listener: (progress: BulkProgress) => void): () => void;
	getProgress(): BulkProgress | null;
}

export const createBulkTab = (simUI: IndividualSimHost<any>): BulkTab => {
	const { sim, player } = simUI;
	const owner: BulkOwner = { sim, storeKey: player.storeKey };
	const state = () => bulkState(player);
	seedBulkSettings(player);

	let simStart = 0;
	let bulkSimStartedAt = 0;
	let isCancelling = false;
	let bulkSimAbortController: AbortController | null = null;
	let bulkSimAbortPromise: Promise<void> | null = null;
	let usesLegacyBulkSim = false;
	let combinationsCalcRequestVersion = 0;
	let progress: BulkProgress | null = null;
	const progressListeners = new Set<(progress: BulkProgress) => void>();

	const getEquippedItemForFrozenSlot = (bulkSlot: FrozenBulkSlot, itemSlot: number): EquippedItem | null => {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		if (!slots?.includes(itemSlot)) {
			return null;
		}

		return player.getGear().getEquippedItem(itemSlot) ?? null;
	};

	const loadSettings = () => {
		const settings = loadStoredBulkSettings(player);
		if (settings != null) {
			addBulkItems(player, settings.items, true);
			setBulkInheritUpgrades(player, settings.inheritUpgrades);
			setBulkUseLegacyBulkSim(player, settings.useLegacyBulkSim);
			setBulkFrozenItem(player, BulkSimItemSlot.ItemSlotFinger, getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotFinger, settings.freezeRingSlot));
			setBulkFrozenItem(
				player,
				BulkSimItemSlot.ItemSlotTrinket,
				getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotTrinket, settings.freezeTrinketSlot),
			);
			setBulkFrozenWeaponSlot(player, settings.freezeWeaponSlot);
			setBulkWeaponTypeFilter(
				player,
				ItemSlot.ItemSlotMainHand,
				sanitizeBulkWeaponTypeFilter(player, ItemSlot.ItemSlotMainHand, settings.freezeMainhandWeaponSlots),
			);
			setBulkWeaponTypeFilter(
				player,
				ItemSlot.ItemSlotOffHand,
				sanitizeBulkWeaponTypeFilter(player, ItemSlot.ItemSlotOffHand, settings.freezeOffhandWeaponSlots),
			);
			patchBulkState(player, { requiredSetBonuses: sanitiseRequiredSetBonuses(settings.requiredSetBonuses) }, ['settings']);
		}
	};

	const calculateBulkCombinations = async () => {
		try {
			const bulkSettings = createBulkSettingsProto(player);
			const combinationCountResult = await sim.getBulkCombinationCount(bulkSettings);
			if (combinationCountResult.error) {
				throw new Error(combinationCountResult.error.message || 'Failed to calculate bulk combinations');
			}
			patchBulkState(player, { combinations: combinationCountResult.combinations, iterations: combinationCountResult.iterations });
			usesLegacyBulkSim = combinationCountResult.useLegacyBulkSim;
		} catch (e) {
			simUI.handleCrash(e);
		}
	};

	const refreshCombinationsCount = async () => {
		const requestVersion = ++combinationsCalcRequestVersion;
		patchBulkState(player, { combinationsPending: true });
		await calculateBulkCombinations();
		if (requestVersion !== combinationsCalcRequestVersion) {
			return;
		}
		patchBulkState(player, { combinationsPending: false });
	};

	const emitProgress = (next: BulkProgress | null) => {
		if (!next) return;
		progress = next;
		for (const listener of progressListeners) listener(next);
	};

	const setCandidateGearProgress = (input: { completed?: number; total?: number; title?: string; stage?: string; startedAt?: number } = {}) => {
		emitProgress(candidateGearProgress({ ...input, now: new Date().getTime() }));
	};

	const setSimProgress = (metrics: ProgressMetrics, config: BulkSimProgressConfig) => {
		emitProgress(simProgress(metrics, config, simStart, new Date().getTime()));
	};

	const updateRelativeStatCapReforges = () => {
		if (!simUI.reforger) {
			return;
		}

		if (RelativeStatCap.hasRoRo(player) && simUI.reforger.settings.relativeStatCapStat !== -1) {
			simUI.reforger.settings.relativeStatCap = new RelativeStatCap(simUI.reforger.settings.relativeStatCapStat);
		}
	};

	const debugOptimisationRound = (message: string, data?: unknown) => {
		if (!isDevMode()) return;
		console.debug(`[Bulk Sim Optimisation] ${message}`, data);
	};

	const throwIfBulkAborted = (signal: AbortSignal) => {
		if (signal.aborted || isCancelling) {
			throw new Error('Bulk Sim Aborted');
		}
	};

	const runWithBulkAbort = async <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
		throwIfBulkAborted(signal);

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
		gearSets: Gear[],
		signal: AbortSignal,
		reforgeConfig?: ReforgeOptimizeConfig,
		bulkSettings?: BulkSettings,
	): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> => {
		let candidateBuildStartedAt: number | undefined;
		let cacheRestoreStartedAt: number | undefined;
		return runCoreBulkSimImpl(
			{
				simUI,
				throwIfBulkAborted,
				runWithBulkAbort,
				setSimProgress,
				setCacheRestoreProgress: cacheProgress => {
					const isCandidateBuildStage = cacheProgress.stage === 'candidate-build';
					if (isCandidateBuildStage) {
						candidateBuildStartedAt ??= new Date().getTime();
					} else {
						cacheRestoreStartedAt ??= new Date().getTime();
					}
					setCandidateGearProgress({
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

	const getBulkReforgeConfig = (playerPhase: boolean): ReforgeOptimizeConfig | undefined => {
		if (!simUI.reforger || !state().runGear) {
			return undefined;
		}

		simUI.reforger.setIncludeGems(true);
		simUI.reforger.setIncludeEOTBPGemSocket(playerPhase);
		updateRelativeStatCapReforges();
		return simUI.reforger.getReforgeOptimizeConfig(state().runGear!);
	};

	const abortBulkSimWork = async () => {
		if (bulkSimAbortPromise) {
			return bulkSimAbortPromise;
		}

		const abortController = bulkSimAbortController;
		if (!abortController) {
			return;
		}

		bulkSimAbortController = null;
		if (!abortController.signal.aborted) {
			abortController.abort();
		}

		bulkSimAbortPromise = (async () => {
			// Narrower than `All`: cancelling a batch must not also cancel a stat-weights run, which is
			// the whole point of bulk having its own type. Reforge stays in because the batch's own
			// pre-pass registers under it.
			const abortTasks: Promise<unknown>[] = [sim.signalManager.abortType(RequestTypes.BulkSim | RequestTypes.ReforgeOptimize)];
			if (simUI.reforger) {
				abortTasks.push(simUI.reforger.abortReforgeOptimization());
			}

			await Promise.all(abortTasks);
		})();

		try {
			await bulkSimAbortPromise;
		} finally {
			bulkSimAbortPromise = null;
		}
	};

	const cancelBatchSim = async () => {
		if (!state().isRunning || isCancelling) return;

		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'batch_cancel',
			value: bulkSimStartedAt > 0 ? Math.round((new Date().getTime() - bulkSimStartedAt) / 1000) : 0,
		});

		isCancelling = true;
		await abortBulkSimWork();
	};

	const runBatchSim = async () => {
		if (state().isRunning) return;

		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'batch_start',
			value: state().combinations,
		});

		isCancelling = false;
		bulkSimStartedAt = new Date().getTime();
		progress = null;
		patchBulkState(player, { isRunning: true, started: true });
		const usesWasmConcurrency = await sim.shouldUseWasmConcurrency();
		await sim.waitForInit();
		const useNativeBulkSim = sim.isNative ?? false;
		const concurrency = usesWasmConcurrency ? sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		bulkSimAbortController = new AbortController();
		bulkSimAbortPromise = null;
		const abortSignal = bulkSimAbortController.signal;

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
			simStart = new Date().getTime();
			const baseGear = player.getGear();
			patchBulkState(player, { runGear: baseGear });

			setCandidateGearProgress();
			patchBulkState(player, { results: null });
			// Yield a frame so the progress modal paints before the combination calculation.
			await new Promise(requestAnimationFrame);
			await calculateBulkCombinations();
			batchCompleteMetrics.combinations = state().combinations;
			batchCompleteMetrics.legacy_bulk_sim_used = usesLegacyBulkSim ? 1 : 0;

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

			const backendReforgeConfig = getBulkReforgeConfig(playerPhase);
			// With backend reforging every candidate must be submitted (reforges differentiate
			// otherwise identical gear); without it duplicates are culled up front.
			const gearSets = backendReforgeConfig ? candidateGearSets : dedupeGearSets(candidateGearSets, [baseGear]);
			simStart = new Date().getTime();
			const bulkSimResult = await runCoreBulkSim(gearSets, abortSignal, backendReforgeConfig, backendBulkSettings);
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
			if (!isCancelling && errorMessage) {
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
			const wasCancelling = isCancelling;
			const bulkSimDurationSeconds = (new Date().getTime() - bulkSimStartedAt) / 1000;
			if (wasCancelling || runError) {
				await abortBulkSimWork();
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
					combinations: state().combinations,
					usedLegacyBulkSim: usesLegacyBulkSim,
					cancelled: wasCancelling,
				});
			}
			await player.setGearAsync(state().runGear!);
			if (wasCancelling) {
				toastManager.add({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
				});
			}
			isCancelling = false;
			patchBulkState(player, results ? { isRunning: false, results } : { isRunning: false });
		}
	};

	const updateCombinationsCount = () => {
		void refreshCombinationsCount();
	};

	seedBulkPickerGroups(player);

	sim.waitForInit().then(() => {
		loadSettings();

		subscribeAll([subscribePlayerField(player, 'challengeModeEnabled'), subscribePlayerField(player, 'gear')])(() => loadEquippedBulkItems(player));
		subscribeBulkChange(owner)(() => storeBulkSettings(player, createBulkSettingsProto(player)));
		subscribeBulkChange(owner)(() => updateCombinationsCount());
		subscribeSimField(sim, 'iterations')(() => updateCombinationsCount());

		loadEquippedBulkItems(player);
		updateCombinationsCount();
	});

	return {
		...owner,
		runBatchSim,
		cancelBatchSim,
		onProgress: listener => {
			progressListeners.add(listener);
			return () => {
				progressListeners.delete(listener);
			};
		},
		getProgress: () => progress,
	};
};
