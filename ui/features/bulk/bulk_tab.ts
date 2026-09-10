import { BulkRequiredSetBonus, BulkSettings, DistributionMetrics, ProgressMetrics } from '@generated/proto/api';
import { ItemSlot, ItemSpec, WeaponType } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BulkPickerEntry, BulkResults, BulkSimProgressConfig, TopGearResult } from '@sim/bulk/types';
import {
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
	BulkSimItemSlot,
	dedupeGearSets,
	getBulkFreezeWeaponTypes,
	getBulkItemSlotFromSlot,
	getBulkPlayerCanDualWield,
} from '@sim/bulk/utils';
import { isSpecDualWield2HCapable } from '@sim/player/classes/capabilities';
import { EquippedItem } from '@sim/proto/equipped_item';
import { Gear } from '@sim/proto/gear';
import { canEquipItem, getEligibleItemSlots, getGearIdentityKey, isSecondaryItemSlot } from '@sim/proto/items';
import { BulkSettingsStore } from '@sim/settings/bulk_settings';
import { RelativeStatCap } from '@sim/settings/reforge_settings';
import type { ReforgeOptimizeConfig } from '@sim/sim';
import type { IndividualSimHost } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import type { BulkSlice } from '@sim/state/sim_store';
import { type BulkOwner, subscribeAll, subscribeBulkChange, subscribePlayerField, subscribeSimField } from '@sim/state/subscriptions';
import { getEnumValues } from '@sim/utils/collections';
import { isDevMode } from '@sim/utils/env';
import { toastManager } from '@ui-kit/Toast';

import { trackEvent } from '../../tracking/analytics';
import { runCoreBulkSim as runCoreBulkSimImpl } from './model/core_sim';
import { bulkCombinationsLimit, bulkIterationsLimit } from './model/limits';
import { addPickerEntry, frozenItemSlot, pickerEntryAt, removePickerEntry, updatePickerEntry } from './model/picker_groups';
import { BulkProgress, candidateGearProgress, simProgress } from './model/progress';
import { availableSetBonuses, slotOptionsOf } from './model/selectors';
import {
	BulkSetBonusOption,
	canEnableRequiredFourPiece,
	canEnableRequiredTwoPiece,
	hasMatchingRequiredSetBonusCombination,
	nextRequiredSetBonuses,
	pruneRequiredSetBonuses,
	sanitiseRequiredSetBonuses,
} from './model/set_bonuses';
import { buildTieChains } from './model/tie_chains';

type WeaponSlot = ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand;
type FrozenBulkSlot = BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket;

/**
 * The bulk feature's model.
 *
 * It renders nothing: `BulkTabBody` is the tab's React body and reads the bulk store slice.
 */
export interface BulkTab extends BulkOwner {
	readonly playerCanDualWield: boolean;
	readonly pickerGroups: BulkSlice['pickerGroups'];
	readonly inheritUpgrades: boolean;
	readonly useLegacyBulkSim: boolean;
	readonly requiredSetBonuses: BulkSlice['requiredSetBonuses'];
	readonly frozenItems: BulkSlice['frozenItems'];
	readonly frozenWeaponSlot: BulkSlice['frozenWeaponSlot'];
	readonly weaponTypeFilters: BulkSlice['weaponTypeFilters'];
	addItem(item: ItemSpec): void;
	addItems(items: ItemSpec[], silent?: boolean): void;
	addItemToSlot(item: ItemSpec, bulkSlot: BulkSimItemSlot): void;
	updateItem(idx: number, newItem: ItemSpec): void;
	removeItem(item: ItemSpec): void;
	removeItemByIndex(idx: number, silent?: boolean): void;
	clearItems(): void;
	hasItem(item: ItemSpec): boolean;
	setInheritUpgrades(newValue: boolean): void;
	setUseLegacyBulkSim(newValue: boolean): void;
	setFrozenItem(bulkSlot: FrozenBulkSlot, item: EquippedItem | null): void;
	setFrozenWeaponSlot(itemSlot: number | null): boolean;
	setWeaponTypeFilter(slot: WeaponSlot, newFilter: WeaponType[], shouldEmit?: boolean): boolean;
	setRequiredSetBonus(setBonus: BulkSetBonusOption, pieces: number): void;
	canEnableRequiredTwoPiece(setId: number): boolean;
	canEnableRequiredFourPiece(setBonus: BulkSetBonusOption): boolean;
	getFreezeWeaponTypes(slot: WeaponSlot): WeaponType[];
	getIterationsLimit(): number;
	getCombinationsLimit(): number;
	runBatchSim(): Promise<void>;
	cancelBatchSim(): Promise<void>;
	/** The batch's own progress ticks, kept out of the store so a tick renders one leaf. */
	onProgress(listener: (progress: BulkProgress) => void): () => void;
	getProgress(): BulkProgress | null;
}

export const createBulkTab = (simUI: IndividualSimHost<any>): BulkTab => {
	const { sim, player } = simUI;
	const owner: BulkOwner = { sim, storeKey: player.storeKey };
	const playerCanDualWield = getBulkPlayerCanDualWield(player);
	const playerCanDualWield2H = isSpecDualWield2HCapable(player.getSpec());
	const settingsStore = new BulkSettingsStore(player, simUI.getStorageKey(''));
	const state = () => settingsStore.state;

	let simStart = 0;
	let bulkSimStartedAt = 0;
	let isCancelling = false;
	let bulkSimAbortController: AbortController | null = null;
	let bulkSimAbortPromise: Promise<void> | null = null;
	let usesLegacyBulkSim = false;
	let combinationsCalcRequestVersion = 0;
	let originalGear: Gear | null = null;
	let progress: BulkProgress | null = null;
	const progressListeners = new Set<(progress: BulkProgress) => void>();

	// Memo for the set-bonus feasibility check. Every BooleanPicker's enableWhen runs the
	// per-slot DP on each settings/items change; this caches the answers until the next
	// change event.
	const canSatisfySetBonusMemo = new Map<string, boolean>();
	subscribeBulkChange(owner)(() => canSatisfySetBonusMemo.clear());

	// Return whether or not the slot is considered secondary and the item should be grouped
	// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
	const isSecondaryBulkSlot = (slot: ItemSlot) => isSecondaryItemSlot(slot) || (playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);

	const lookupItem = (item: ItemSpec): EquippedItem | null =>
		sim.db.lookupItemSpec(item)?.withChallengeMode(player.getChallengeModeEnabled()).withDynamicStats() ?? null;

	const getItems = (): ItemSpec[] => state().items.flatMap(spec => (spec ? [ItemSpec.clone(spec)] : []));

	const getEquippedItemForFrozenSlot = (bulkSlot: FrozenBulkSlot, itemSlot: number): EquippedItem | null => {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		if (!slots?.includes(itemSlot)) {
			return null;
		}

		return player.getGear().getEquippedItem(itemSlot) ?? null;
	};

	const getFrozenItemSlot = (bulkSlot: FrozenBulkSlot): ItemSlot | undefined => {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		return frozenItemSlot(player.getGear(), slots, state().frozenItems.get(bulkSlot)) ?? undefined;
	};

	const sanitizeWeaponTypeFilter = (slot: WeaponSlot, weaponTypes: WeaponType[]): WeaponType[] => {
		const selectableWeaponTypes = getBulkFreezeWeaponTypes(player, slot);
		return weaponTypes.filter(weaponType => selectableWeaponTypes.includes(weaponType));
	};

	const createBulkSettings = (): BulkSettings => {
		const current = state();
		return BulkSettings.create({
			items: getItems(),
			inheritUpgrades: current.inheritUpgrades,
			useLegacyBulkSim: current.useLegacyBulkSim,
			iterationsPerCombo: sim.getIterations(),
			freezeRingSlot: getFrozenItemSlot(BulkSimItemSlot.ItemSlotFinger),
			freezeTrinketSlot: getFrozenItemSlot(BulkSimItemSlot.ItemSlotTrinket),
			freezeWeaponSlot: current.frozenWeaponSlot,
			freezeMainhandWeaponSlots: current.weaponTypeFilters.get(ItemSlot.ItemSlotMainHand)?.slice(),
			freezeOffhandWeaponSlots: current.weaponTypeFilters.get(ItemSlot.ItemSlotOffHand)?.slice(),
			requiredSetBonuses: pruneRequiredSetBonuses(current.requiredSetBonuses, availableSetBonuses(current)),
		});
	};

	const addToGroup = (
		groups: Map<BulkSimItemSlot, readonly BulkPickerEntry[]>,
		bulkSlot: BulkSimItemSlot,
		idx: number,
		item: EquippedItem,
		silent: boolean,
	): boolean => {
		const next = addPickerEntry(bulkSlot, groups.get(bulkSlot)!, idx, item);
		if (next === 'duplicate') {
			if (!silent) toastManager.add({ delay: 1000, variant: 'error', body: i18n.t('bulk_tab.search.item_unique', { itemName: item._item.name }) });
			return false;
		}
		groups.set(bulkSlot, next);
		if (!silent) toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_added', { itemName: item._item.name }) });
		return true;
	};

	// Add items to their eligible bulk sim item slot(s). Mainly used for importing and search
	const addItems = (items: ItemSpec[], silent = false) => {
		const batch = state().items.slice();
		const groups = new Map(state().pickerGroups);
		items.forEach(item => {
			const equippedItem = lookupItem(item);
			if (equippedItem) {
				getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
					// Avoid duplicating rings/trinkets/weapons
					if (isSecondaryBulkSlot(slot) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

					const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
					if (addToGroup(groups, bulkSlot, batch.length, equippedItem, silent)) {
						batch.push(item);
					}
				});
			}
		});

		settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
	};

	// Add an item to a particular bulk sim item slot
	const addItemToSlot = (item: ItemSpec, bulkSlot: BulkSimItemSlot) => {
		const equippedItem = lookupItem(item);
		if (equippedItem) {
			const eligibleItemSlots = getEligibleItemSlots(equippedItem.item, playerCanDualWield2H);
			if (!canEquipItem(equippedItem.item, player.getPlayerSpec(), eligibleItemSlots[0])) return;

			const groups = new Map(state().pickerGroups);
			const added = addToGroup(groups, bulkSlot, state().items.length, equippedItem, false);
			settingsStore.patch(added ? { items: [...state().items, item], pickerGroups: groups } : {}, ['items']);
		}
	};

	const updateItem = (idx: number, newItem: ItemSpec) => {
		const equippedItem = lookupItem(newItem);
		if (!equippedItem) {
			settingsStore.patch({}, ['items']);
			return;
		}

		const batch = state().items.slice();
		batch[idx] = newItem;
		const groups = new Map(state().pickerGroups);
		getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
			// Avoid duplicating rings/trinkets/weapons
			if (isSecondaryBulkSlot(slot) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

			const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
			const next = updatePickerEntry(groups.get(bulkSlot)!, idx, equippedItem);
			if (next) {
				groups.set(bulkSlot, next);
			} else {
				toastManager.add({ variant: 'error', body: i18n.t('bulk_tab.picker.failed_update') });
			}
		});

		settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
	};

	const removeItemByIndex = (idx: number, silent = false) => {
		const items = state().items;
		if (idx < 0 || items.length < idx || !items[idx]) {
			if (!silent) {
				toastManager.add({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.failed_to_remove_item'),
				});
			}
			return;
		}

		const equippedItem = sim.db.lookupItemSpec(items[idx]!);
		if (equippedItem) {
			const batch = items.slice();
			batch[idx] = null;
			const groups = new Map(state().pickerGroups);

			// Try to find the matching item within its eligible groups
			getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
				if (!canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;
				const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
				const entries = groups.get(bulkSlot)!;

				const removed = pickerEntryAt(entries, idx);
				groups.set(bulkSlot, removePickerEntry(entries, idx));
				if (removed && !silent) {
					toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_removed', { itemName: removed.item._item.name }) });
				}
			});
			settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
		}
	};

	const removeItem = (item: ItemSpec) => {
		const idx = state().items.findIndex(spec => !!spec && ItemSpec.equals(spec, item));
		if (idx >= 0) removeItemByIndex(idx);
	};

	const clearItems = () => {
		for (let idx = 0; idx < state().items.length; idx++) {
			removeItemByIndex(idx, true);
		}
		settingsStore.patch({ items: [] }, ['items']);
	};

	const canSatisfyRequiredSetBonus = (setId: number, pieces: number): boolean => {
		const memoKey = `${setId}:${pieces}`;
		const memoized = canSatisfySetBonusMemo.get(memoKey);
		if (memoized !== undefined) return memoized;

		const requiredSetBonuses = Array.from(state().requiredSetBonuses.values()).filter(requiredSetBonus => requiredSetBonus.setId !== setId);
		requiredSetBonuses.push(BulkRequiredSetBonus.create({ setId, pieces }));
		const result = hasMatchingRequiredSetBonusCombination(requiredSetBonuses, originalGear ?? player.getGear(), slotOptionsOf(state().pickerGroups));
		canSatisfySetBonusMemo.set(memoKey, result);
		return result;
	};

	const setInheritUpgrades = (newValue: boolean) => settingsStore.patch({ inheritUpgrades: newValue }, ['settings']);

	const setUseLegacyBulkSim = (newValue: boolean) => settingsStore.patch({ useLegacyBulkSim: newValue }, ['settings']);

	const setFrozenItem = (bulkSlot: FrozenBulkSlot, item: EquippedItem | null) => {
		const frozenItems = state().frozenItems;
		if (item === frozenItems.get(bulkSlot)) {
			return;
		}

		settingsStore.patch({ frozenItems: new Map(frozenItems).set(bulkSlot, item) }, ['settings']);
	};

	const setWeaponTypeFilter = (slot: WeaponSlot, newFilter: WeaponType[], shouldEmit = true): boolean => {
		const weaponTypeFilters = state().weaponTypeFilters;
		const currentFilter = weaponTypeFilters.get(slot)!;
		const hasChanged = currentFilter.length !== newFilter.length || currentFilter.some((weaponType, idx) => weaponType !== newFilter[idx]);

		if (!hasChanged) {
			return false;
		}

		settingsStore.patch({ weaponTypeFilters: new Map(weaponTypeFilters).set(slot, newFilter) }, shouldEmit ? ['settings'] : []);
		return true;
	};

	const setFrozenWeaponSlot = (itemSlot: number | null): boolean => {
		const newSlot = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(itemSlot ?? -1) ? (itemSlot as WeaponSlot) : undefined;
		const filtersChanged = newSlot !== undefined && setWeaponTypeFilter(newSlot, [], false);

		if (newSlot === state().frozenWeaponSlot && !filtersChanged) {
			return false;
		}

		settingsStore.patch({ frozenWeaponSlot: newSlot }, ['settings']);
		return true;
	};

	const setRequiredSetBonus = (setBonus: BulkSetBonusOption, pieces: number) => {
		const next = nextRequiredSetBonuses(state().requiredSetBonuses, setBonus, pieces, canSatisfyRequiredSetBonus);
		if (!next) return;

		settingsStore.patch({ requiredSetBonuses: next }, ['settings']);
	};

	const loadSettings = () => {
		const settings = settingsStore.load();
		if (settings != null) {
			addItems(settings.items, true);
			setInheritUpgrades(settings.inheritUpgrades);
			setUseLegacyBulkSim(settings.useLegacyBulkSim);
			setFrozenItem(BulkSimItemSlot.ItemSlotFinger, getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotFinger, settings.freezeRingSlot));
			setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotTrinket, settings.freezeTrinketSlot));
			setFrozenWeaponSlot(settings.freezeWeaponSlot);
			setWeaponTypeFilter(ItemSlot.ItemSlotMainHand, sanitizeWeaponTypeFilter(ItemSlot.ItemSlotMainHand, settings.freezeMainhandWeaponSlots));
			setWeaponTypeFilter(ItemSlot.ItemSlotOffHand, sanitizeWeaponTypeFilter(ItemSlot.ItemSlotOffHand, settings.freezeOffhandWeaponSlots));
			settingsStore.patch({ requiredSetBonuses: sanitiseRequiredSetBonuses(settings.requiredSetBonuses) }, ['settings']);
		}
	};

	const loadEquippedItems = () => {
		if (state().isRunning) {
			return;
		}

		const groups = new Map(state().pickerGroups);
		// Clear all previously equipped items from the pickers
		for (const [bulkSlot, entries] of groups) {
			groups.set(bulkSlot, removePickerEntry(removePickerEntry(entries, -1), -2));
		}

		const equippedIds = new Set(
			player
				.getEquippedItems()
				.filter(Boolean)
				.map(item => item!.id),
		);

		// Sync user-added pickers with currently equipped state:
		// - Hide pickers for items that are now equipped (the dedicated equipped slot covers them).
		// - Restore pickers for items that are no longer equipped but still in the user's list.
		state().items.forEach((itemSpec, idx) => {
			if (!itemSpec) return;

			const equippedItem = lookupItem(itemSpec);
			if (!equippedItem) return;

			getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
				if (isSecondaryBulkSlot(slot) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

				const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
				const entries = groups.get(bulkSlot);
				if (!entries) return;

				if (equippedIds.has(itemSpec.id)) {
					groups.set(bulkSlot, removePickerEntry(entries, idx));
				} else if (!pickerEntryAt(entries, idx)) {
					const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
					if (next !== 'duplicate') groups.set(bulkSlot, next);
				}
			});
		});

		player.getEquippedItems().forEach((equippedItem, slot) => {
			const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
			const entries = groups.get(bulkSlot);
			if (!entries) return;
			const idx = isSecondaryBulkSlot(slot) ? -2 : -1;
			if (equippedItem) {
				const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
				if (next !== 'duplicate') groups.set(bulkSlot, next);
			}
		});

		settingsStore.patch({ pickerGroups: groups }, ['items']);
	};

	const calculateBulkCombinations = async () => {
		try {
			const bulkSettings = createBulkSettings();
			const combinationCountResult = await sim.getBulkCombinationCount(bulkSettings);
			if (combinationCountResult.error) {
				throw new Error(combinationCountResult.error.message || 'Failed to calculate bulk combinations');
			}
			settingsStore.patch({ combinations: combinationCountResult.combinations, iterations: combinationCountResult.iterations });
			usesLegacyBulkSim = combinationCountResult.useLegacyBulkSim;
		} catch (e) {
			simUI.handleCrash(e);
		}
	};

	const refreshCombinationsCount = async () => {
		const requestVersion = ++combinationsCalcRequestVersion;
		settingsStore.patch({ combinationsPending: true });
		await calculateBulkCombinations();
		if (requestVersion !== combinationsCalcRequestVersion) {
			return;
		}
		settingsStore.patch({ combinationsPending: false });
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
		if (!simUI.reforger || !originalGear) {
			return undefined;
		}

		simUI.reforger.setIncludeGems(true);
		simUI.reforger.setIncludeEOTBPGemSocket(playerPhase);
		updateRelativeStatCapReforges();
		return simUI.reforger.getReforgeOptimizeConfig(originalGear);
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
		settingsStore.patch({ isRunning: true, started: true });
		const usesWasmConcurrency = await sim.shouldUseWasmConcurrency();
		await sim.waitForInit();
		const useNativeBulkSim = sim.isNative ?? false;
		const concurrency = usesWasmConcurrency ? sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		bulkSimAbortController = new AbortController();
		bulkSimAbortPromise = null;
		const abortSignal = bulkSimAbortController.signal;

		const playerPhase = sim.getPhase() >= 2;
		const backendBulkSettings = useNativeBulkSim ? createBulkSettings() : undefined;
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
			originalGear = baseGear;

			setCandidateGearProgress();
			settingsStore.patch({ results: null });
			// Yield a frame so the progress modal paints before the combination calculation.
			await new Promise(requestAnimationFrame);
			await calculateBulkCombinations();
			batchCompleteMetrics.combinations = state().combinations;
			batchCompleteMetrics.legacy_bulk_sim_used = usesLegacyBulkSim ? 1 : 0;

			if (!useNativeBulkSim) {
				const candidateGearBuildStartedAt = new Date().getTime();
				const bulkCandidatesResult = await sim.getBulkCandidates(createBulkSettings());
				if (bulkCandidatesResult.error) {
					throw new Error(bulkCandidatesResult.error.message || 'Failed to build bulk candidates');
				}
				candidateGearSets = bulkCandidatesResult.candidates
					.filter(candidate => !!candidate.gear)
					.map(candidate => sim.db.lookupEquipmentSpec(candidate.gear!));
				settingsStore.patch({ combinations: bulkCandidatesResult.combinations });
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
			await player.setGearAsync(originalGear!);
			if (wasCancelling) {
				toastManager.add({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
				});
			}
			isCancelling = false;
			settingsStore.patch(results ? { isRunning: false, results } : { isRunning: false });
		}
	};

	const updateCombinationsCount = () => {
		void refreshCombinationsCount();
	};

	const bulkSlots = getEnumValues<BulkSimItemSlot>(BulkSimItemSlot).filter(
		bulkSlot =>
			!(playerCanDualWield && [BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand].includes(bulkSlot)) &&
			!(!playerCanDualWield && bulkSlot === BulkSimItemSlot.ItemSlotHandWeapon),
	);
	settingsStore.patch({ pickerGroups: new Map<BulkSimItemSlot, readonly BulkPickerEntry[]>(bulkSlots.map(bulkSlot => [bulkSlot, []])) });

	sim.waitForInit().then(() => {
		loadSettings();

		subscribeAll([subscribePlayerField(player, 'challengeModeEnabled'), subscribePlayerField(player, 'gear')])(() => loadEquippedItems());
		subscribeBulkChange(owner)(() => settingsStore.save(createBulkSettings()));
		subscribeBulkChange(owner)(() => updateCombinationsCount());
		subscribeSimField(sim, 'iterations')(() => updateCombinationsCount());

		loadEquippedItems();
		updateCombinationsCount();
	});

	return {
		...owner,
		playerCanDualWield,
		get pickerGroups() {
			return state().pickerGroups;
		},
		get inheritUpgrades() {
			return state().inheritUpgrades;
		},
		get useLegacyBulkSim() {
			return state().useLegacyBulkSim;
		},
		get requiredSetBonuses() {
			return state().requiredSetBonuses;
		},
		get frozenItems() {
			return state().frozenItems;
		},
		get frozenWeaponSlot() {
			return state().frozenWeaponSlot;
		},
		get weaponTypeFilters() {
			return state().weaponTypeFilters;
		},
		addItem: item => addItems([item]),
		addItems,
		addItemToSlot,
		updateItem,
		removeItem,
		removeItemByIndex,
		clearItems,
		hasItem: item => state().items.some(spec => !!spec && ItemSpec.equals(spec, item)),
		setInheritUpgrades,
		setUseLegacyBulkSim,
		setFrozenItem,
		setFrozenWeaponSlot,
		setWeaponTypeFilter,
		setRequiredSetBonus,
		canEnableRequiredTwoPiece: setId => canEnableRequiredTwoPiece(state().requiredSetBonuses, setId, canSatisfyRequiredSetBonus),
		canEnableRequiredFourPiece: setBonus => canEnableRequiredFourPiece(state().requiredSetBonuses, setBonus, canSatisfyRequiredSetBonus),
		getFreezeWeaponTypes: slot => getBulkFreezeWeaponTypes(player, slot),
		getIterationsLimit: () => bulkIterationsLimit(sim.isNative),
		getCombinationsLimit: () => bulkCombinationsLimit(sim.isNative),
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
