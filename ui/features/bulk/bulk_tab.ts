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
import { ReforgeOptimizeConfig } from '@sim/sim';
import type { IndividualSimHost } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import { subscribeAll, subscribeBulkChange, subscribePlayerField, subscribeSimField } from '@sim/state/subscriptions';
import { getEnumValues } from '@sim/utils/collections';
import { isDevMode } from '@sim/utils/env';
import { Disposable } from '@ui-kit/component';
import { toastManager } from '@ui-kit/Toast';

import { trackEvent } from '../../tracking/analytics';
import { runCoreBulkSim as runCoreBulkSimImpl } from './model/core_sim';
import { bulkCombinationsLimit, bulkIterationsLimit } from './model/limits';
import { addPickerEntry, frozenItemSlot, pickerEntryAt, removePickerEntry, updatePickerEntry } from './model/picker_groups';
import { BulkProgress, candidateGearProgress, simProgress } from './model/progress';
import {
	BulkSetBonusOption,
	BulkSlotOptions,
	canEnableRequiredFourPiece,
	canEnableRequiredTwoPiece,
	getAvailableBulkSetBonuses,
	hasMatchingRequiredSetBonusCombination,
	nextRequiredSetBonuses,
	pruneRequiredSetBonuses,
	sanitiseRequiredSetBonuses,
} from './model/set_bonuses';
import { buildTieChains } from './model/tie_chains';

/**
 * The bulk feature's model.
 *
 * It renders nothing: `BulkTabBody` is the tab's React body and reads the bulk store slice.
 */
export class BulkTab extends Disposable {
	readonly simUI: IndividualSimHost<any>;
	private readonly settingsStore: BulkSettingsStore;
	playerCanDualWield: boolean;
	readonly playerCanDualWield2H: boolean;

	// Bulk state lives in the sim store (SimState.bulk[storeKey]); see bump().
	get sim() {
		return this.simUI.sim;
	}
	get storeKey(): number {
		return this.simUI.player.storeKey;
	}

	private get items(): ReadonlyArray<ItemSpec | null> {
		return this.settingsStore.state.items;
	}
	get pickerGroups(): ReadonlyMap<BulkSimItemSlot, readonly BulkPickerEntry[]> {
		return this.settingsStore.state.pickerGroups;
	}

	protected simStart: number = 0;
	protected bulkSimStartedAt: number = 0;
	protected isCancelling = false;
	protected bulkSimAbortController: AbortController | null = null;
	protected bulkSimAbortPromise: Promise<void> | null = null;
	protected usesLegacyBulkSim = false;
	private combinationsCalcRequestVersion = 0;

	protected topGearResults: TopGearResult[] | null = null;
	protected originalGear: Gear | null = null;
	protected originalGearResults: TopGearResult | null = null;
	private progress: BulkProgress | null = null;

	private readonly progressListeners = new Set<(progress: BulkProgress) => void>();

	get combinations(): number {
		return this.settingsStore.state.combinations;
	}
	get iterations(): number {
		return this.settingsStore.state.iterations;
	}
	get combinationsPending(): boolean {
		return this.settingsStore.state.combinationsPending;
	}
	protected get isRunning(): boolean {
		return this.settingsStore.state.isRunning;
	}
	get inheritUpgrades(): boolean {
		return this.settingsStore.state.inheritUpgrades;
	}
	get useLegacyBulkSim(): boolean {
		return this.settingsStore.state.useLegacyBulkSim;
	}
	get requiredSetBonuses(): ReadonlyMap<number, BulkRequiredSetBonus> {
		return this.settingsStore.state.requiredSetBonuses;
	}
	get frozenItems(): ReadonlyMap<BulkSimItemSlot, EquippedItem | null> {
		return this.settingsStore.state.frozenItems;
	}
	get frozenWeaponSlot(): ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand | undefined {
		return this.settingsStore.state.frozenWeaponSlot;
	}
	get weaponTypeFilters(): ReadonlyMap<ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand, WeaponType[]> {
		return this.settingsStore.state.weaponTypeFilters;
	}

	// Memos for the set-bonus feasibility checks. Every BooleanPicker's enableWhen runs the
	// full picker scan + per-slot DP on each settings/items change; these cache the answers
	// until the next change event (see the invalidation hook in the constructor).
	private availableSetBonusesMemo: BulkSetBonusOption[] | null = null;
	private canSatisfySetBonusMemo = new Map<string, boolean>();

	constructor(simUI: IndividualSimHost<any>) {
		super();

		this.simUI = simUI;
		this.playerCanDualWield = getBulkPlayerCanDualWield(this.simUI.player);
		this.playerCanDualWield2H = isSpecDualWield2HCapable(this.simUI.player.getSpec());
		this.settingsStore = new BulkSettingsStore(this.simUI.player, this.simUI.getStorageKey(''));
		this.addOnDisposeCallback(
			subscribeBulkChange(this)(() => {
				this.availableSetBonusesMemo = null;
				this.canSatisfySetBonusMemo.clear();
			}),
		);

		const bulkSlots = getEnumValues<BulkSimItemSlot>(BulkSimItemSlot).filter(
			bulkSlot =>
				!(this.playerCanDualWield && [BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand].includes(bulkSlot)) &&
				!(!this.playerCanDualWield && bulkSlot === BulkSimItemSlot.ItemSlotHandWeapon),
		);
		this.settingsStore.patch({ pickerGroups: new Map<BulkSimItemSlot, readonly BulkPickerEntry[]>(bulkSlots.map(bulkSlot => [bulkSlot, []])) });

		this.simUI.sim.waitForInit().then(() => {
			this.loadSettings();
			const loadEquippedItems = () => {
				if (this.isRunning) {
					return;
				}

				const groups = new Map(this.pickerGroups);
				// Clear all previously equipped items from the pickers
				for (const [bulkSlot, entries] of groups) {
					groups.set(bulkSlot, removePickerEntry(removePickerEntry(entries, -1), -2));
				}

				const equippedIds = new Set(
					this.simUI.player
						.getEquippedItems()
						.filter(Boolean)
						.map(item => item!.id),
				);

				// Sync user-added pickers with currently equipped state:
				// - Hide pickers for items that are now equipped (the dedicated equipped slot covers them).
				// - Restore pickers for items that are no longer equipped but still in the user's list.
				for (let idx = 0; idx < this.items.length; idx++) {
					const itemSpec = this.items[idx];
					if (!itemSpec) continue;

					const equippedItem = this.simUI.sim.db
						.lookupItemSpec(itemSpec)
						?.withChallengeMode(this.simUI.player.getChallengeModeEnabled())
						.withDynamicStats();
					if (!equippedItem) continue;

					getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
						if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

						const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
						const entries = groups.get(bulkSlot);
						if (!entries) return;

						if (equippedIds.has(itemSpec.id)) {
							groups.set(bulkSlot, removePickerEntry(entries, idx));
						} else if (!pickerEntryAt(entries, idx)) {
							const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
							if (next !== 'duplicate') groups.set(bulkSlot, next);
						}
					});
				}

				this.simUI.player.getEquippedItems().forEach((equippedItem, slot) => {
					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					const entries = groups.get(bulkSlot);
					if (!entries) return;
					const idx = this.isSecondaryItemSlot(slot) ? -2 : -1;
					if (equippedItem) {
						const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
						if (next !== 'duplicate') groups.set(bulkSlot, next);
					}
				});

				this.settingsStore.patch({ pickerGroups: groups }, ['items']);
			};
			const updateCombinationsCount = () => {
				void this.refreshCombinationsCount();
			};

			this.addOnDisposeCallback(
				subscribeAll([subscribePlayerField(this.simUI.player, 'challengeModeEnabled'), subscribePlayerField(this.simUI.player, 'gear')])(() =>
					loadEquippedItems(),
				),
			);
			this.addOnDisposeCallback(subscribeBulkChange(this)(() => this.storeSettings()));
			this.addOnDisposeCallback(subscribeBulkChange(this)(() => updateCombinationsCount()));
			this.addOnDisposeCallback(subscribeSimField(this.simUI.sim, 'iterations')(() => updateCombinationsCount()));

			loadEquippedItems();
			updateCombinationsCount();
		});
	}

	readonly getResults = (): BulkResults | null => this.settingsStore.state.results;

	/** Starting a run empties the results pane, so the invitation to run one does not come back. */
	readonly hasStarted = (): boolean => this.settingsStore.state.started;

	/** The batch's own progress ticks, kept out of `notify` so a tick renders one leaf. */
	readonly onProgress = (listener: (progress: BulkProgress) => void): (() => void) => {
		this.progressListeners.add(listener);
		return () => {
			this.progressListeners.delete(listener);
		};
	};

	readonly getProgress = (): BulkProgress | null => this.progress;

	private emitProgress(progress: BulkProgress | null) {
		if (!progress) return;
		this.progress = progress;
		for (const listener of this.progressListeners) listener(progress);
	}

	// Bumps a version counter — the one write path where the tab used to emit.
	// The values themselves stay on the tab (nothing reads them from the store).
	private bump(field: 'settings' | 'items') {
		this.settingsStore.patch({}, [field]);
	}

	private loadSettings() {
		const settings = this.settingsStore.load();
		if (settings != null) {
			this.addItems(settings.items, true);
			this.setInheritUpgrades(settings.inheritUpgrades);
			this.setUseLegacyBulkSim(settings.useLegacyBulkSim);
			this.setFrozenItem(BulkSimItemSlot.ItemSlotFinger, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotFinger, settings.freezeRingSlot));
			this.setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotTrinket, settings.freezeTrinketSlot));
			this.setFrozenWeaponSlot(settings.freezeWeaponSlot);
			this.setWeaponTypeFilter(ItemSlot.ItemSlotMainHand, this.sanitizeWeaponTypeFilter(ItemSlot.ItemSlotMainHand, settings.freezeMainhandWeaponSlots));
			this.setWeaponTypeFilter(ItemSlot.ItemSlotOffHand, this.sanitizeWeaponTypeFilter(ItemSlot.ItemSlotOffHand, settings.freezeOffhandWeaponSlots));
			this.setRequiredSetBonuses(settings.requiredSetBonuses);
		}
	}

	private sanitizeWeaponTypeFilter(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand, weaponTypes: WeaponType[]): WeaponType[] {
		const selectableWeaponTypes = getBulkFreezeWeaponTypes(this.simUI.player, slot);
		return weaponTypes.filter(weaponType => selectableWeaponTypes.includes(weaponType));
	}

	private storeSettings() {
		this.settingsStore.save(this.createBulkSettings());
	}

	protected createBulkSettings(): BulkSettings {
		return BulkSettings.create({
			items: this.getItems(),
			inheritUpgrades: this.inheritUpgrades,
			useLegacyBulkSim: this.useLegacyBulkSim,
			iterationsPerCombo: this.getDefaultIterationsCount(),
			freezeRingSlot: this.getFrozenItemSlot(BulkSimItemSlot.ItemSlotFinger),
			freezeTrinketSlot: this.getFrozenItemSlot(BulkSimItemSlot.ItemSlotTrinket),
			freezeWeaponSlot: this.frozenWeaponSlot,
			freezeMainhandWeaponSlots: this.weaponTypeFilters.get(ItemSlot.ItemSlotMainHand)?.slice(),
			freezeOffhandWeaponSlots: this.weaponTypeFilters.get(ItemSlot.ItemSlotOffHand)?.slice(),
			requiredSetBonuses: pruneRequiredSetBonuses(this.requiredSetBonuses, this.getAvailableBulkSetBonuses()),
		});
	}

	private getDefaultIterationsCount(): number {
		return this.simUI.sim.getIterations();
	}

	private lookupItem(item: ItemSpec): EquippedItem | null {
		return this.simUI.sim.db.lookupItemSpec(item)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats() ?? null;
	}

	private addToGroup(
		groups: Map<BulkSimItemSlot, readonly BulkPickerEntry[]>,
		bulkSlot: BulkSimItemSlot,
		idx: number,
		item: EquippedItem,
		silent: boolean,
	): boolean {
		const next = addPickerEntry(bulkSlot, groups.get(bulkSlot)!, idx, item);
		if (next === 'duplicate') {
			if (!silent) toastManager.add({ delay: 1000, variant: 'error', body: i18n.t('bulk_tab.search.item_unique', { itemName: item._item.name }) });
			return false;
		}
		groups.set(bulkSlot, next);
		if (!silent) toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_added', { itemName: item._item.name }) });
		return true;
	}

	// Add an item to its eligible bulk sim item slot(s). Mainly used for importing and search
	addItem(item: ItemSpec) {
		this.addItems([item]);
	}
	// Add items to their eligible bulk sim item slot(s). Mainly used for importing and search
	addItems(items: ItemSpec[], silent = false) {
		const batch = this.items.slice();
		const groups = new Map(this.pickerGroups);
		items.forEach(item => {
			const equippedItem = this.lookupItem(item);
			if (equippedItem) {
				getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
					// Avoid duplicating rings/trinkets/weapons
					if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					if (this.addToGroup(groups, bulkSlot, batch.length, equippedItem, silent)) {
						batch.push(item);
					}
				});
			}
		});

		this.settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
	}
	// Add an item to a particular bulk sim item slot
	addItemToSlot(item: ItemSpec, bulkSlot: BulkSimItemSlot) {
		const equippedItem = this.lookupItem(item);
		if (equippedItem) {
			const eligibleItemSlots = getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H);
			if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), eligibleItemSlots[0])) return;

			const groups = new Map(this.pickerGroups);
			const added = this.addToGroup(groups, bulkSlot, this.items.length, equippedItem, false);
			this.settingsStore.patch(added ? { items: [...this.items, item], pickerGroups: groups } : {}, ['items']);
		}
	}

	updateItem(idx: number, newItem: ItemSpec) {
		const equippedItem = this.lookupItem(newItem);
		if (!equippedItem) {
			this.bump('items');
			return;
		}

		const batch = this.items.slice();
		batch[idx] = newItem;
		const groups = new Map(this.pickerGroups);
		getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
			// Avoid duplicating rings/trinkets/weapons
			if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

			const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
			const next = updatePickerEntry(groups.get(bulkSlot)!, idx, equippedItem);
			if (next) {
				groups.set(bulkSlot, next);
			} else {
				toastManager.add({ variant: 'error', body: i18n.t('bulk_tab.picker.failed_update') });
			}
		});

		this.settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
	}

	removeItem(item: ItemSpec) {
		for (let idx = 0; idx < this.items.length; idx++) {
			if (this.items[idx] && ItemSpec.equals(this.items[idx]!, item)) {
				this.removeItemByIndex(idx);
				return;
			}
		}
	}
	removeItemByIndex(idx: number, silent = false) {
		if (idx < 0 || this.items.length < idx || !this.items[idx]) {
			if (!silent) {
				toastManager.add({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.failed_to_remove_item'),
				});
			}
			return;
		}

		const item = this.items[idx]!;
		const equippedItem = this.simUI.sim.db.lookupItemSpec(item);
		if (equippedItem) {
			const batch = this.items.slice();
			batch[idx] = null;
			const groups = new Map(this.pickerGroups);

			// Try to find the matching item within its eligible groups
			getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
				if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;
				const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
				const entries = groups.get(bulkSlot)!;

				const removed = pickerEntryAt(entries, idx);
				groups.set(bulkSlot, removePickerEntry(entries, idx));
				if (removed && !silent) {
					toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_removed', { itemName: removed.item._item.name }) });
				}
			});
			this.settingsStore.patch({ items: batch, pickerGroups: groups }, ['items']);
		}
	}

	clearItems() {
		for (let idx = 0; idx < this.items.length; idx++) {
			this.removeItemByIndex(idx, true);
		}
		this.settingsStore.patch({ items: [] }, ['items']);
	}

	hasItem(item: ItemSpec) {
		return this.items.some(i => !!i && ItemSpec.equals(i, item));
	}

	getItems(): Array<ItemSpec> {
		const result = new Array<ItemSpec>();
		this.items.forEach(spec => {
			if (!spec) return;

			result.push(ItemSpec.clone(spec));
		});
		return result;
	}

	// The batch's per-slot choices, equipped pieces included: the pickers are where they live, and
	// the set-bonus model takes them as data rather than reaching into the DOM for them.
	private getSlotOptions(): BulkSlotOptions {
		return new Map(Array.from(this.pickerGroups).map(([bulkSlot, entries]) => [bulkSlot, entries.map(entry => entry.item)]));
	}

	getAvailableBulkSetBonuses(): BulkSetBonusOption[] {
		this.availableSetBonusesMemo ??= getAvailableBulkSetBonuses(this.getSlotOptions());
		return this.availableSetBonusesMemo;
	}

	canEnableRequiredTwoPiece(setId: number): boolean {
		return canEnableRequiredTwoPiece(this.requiredSetBonuses, setId, (id, pieces) => this.canSatisfyRequiredSetBonus(id, pieces));
	}

	canEnableRequiredFourPiece(setBonus: BulkSetBonusOption): boolean {
		return canEnableRequiredFourPiece(this.requiredSetBonuses, setBonus, (id, pieces) => this.canSatisfyRequiredSetBonus(id, pieces));
	}

	protected async calculateBulkCombinations() {
		try {
			const bulkSettings = this.createBulkSettings();
			const combinationCountResult = await this.simUI.sim.getBulkCombinationCount(bulkSettings);
			if (combinationCountResult.error) {
				throw new Error(combinationCountResult.error.message || 'Failed to calculate bulk combinations');
			}
			this.settingsStore.patch({ combinations: combinationCountResult.combinations, iterations: combinationCountResult.iterations });
			this.usesLegacyBulkSim = combinationCountResult.useLegacyBulkSim;
		} catch (e) {
			this.simUI.handleCrash(e);
		}
	}

	private async refreshCombinationsCount() {
		const requestVersion = ++this.combinationsCalcRequestVersion;
		this.settingsStore.patch({ combinationsPending: true });
		await this.calculateBulkCombinations();
		if (requestVersion !== this.combinationsCalcRequestVersion) {
			return;
		}
		this.settingsStore.patch({ combinationsPending: false });
	}

	private canSatisfyRequiredSetBonus(setId: number, pieces: number): boolean {
		const memoKey = `${setId}:${pieces}`;
		const memoized = this.canSatisfySetBonusMemo.get(memoKey);
		if (memoized !== undefined) return memoized;

		const requiredSetBonuses = Array.from(this.requiredSetBonuses.values()).filter(requiredSetBonus => requiredSetBonus.setId !== setId);
		requiredSetBonuses.push(BulkRequiredSetBonus.create({ setId, pieces }));
		const result = hasMatchingRequiredSetBonusCombination(requiredSetBonuses, this.originalGear ?? this.simUI.player.getGear(), this.getSlotOptions());
		this.canSatisfySetBonusMemo.set(memoKey, result);
		return result;
	}

	// Return whether or not the slot is considered secondary and the item should be grouped
	// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
	private isSecondaryItemSlot(slot: ItemSlot) {
		return isSecondaryItemSlot(slot) || (this.playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);
	}

	setInheritUpgrades(newValue: boolean) {
		this.settingsStore.patch({ inheritUpgrades: newValue }, ['settings']);
	}

	getFreezeWeaponTypes(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): WeaponType[] {
		return getBulkFreezeWeaponTypes(this.simUI.player, slot);
	}

	setFrozenItem(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket, item: EquippedItem | null) {
		if (item === this.frozenItems.get(bulkSlot)) {
			return;
		}

		this.settingsStore.patch({ frozenItems: new Map(this.frozenItems).set(bulkSlot, item) }, ['settings']);
	}

	private getEquippedItemForFrozenSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket, itemSlot: number): EquippedItem | null {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		if (!slots?.includes(itemSlot)) {
			return null;
		}

		return this.simUI.player.getGear().getEquippedItem(itemSlot) ?? null;
	}

	private getFrozenItemSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket): ItemSlot | undefined {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		return frozenItemSlot(this.simUI.player.getGear(), slots, this.frozenItems.get(bulkSlot)) ?? undefined;
	}

	setWeaponTypeFilter(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand, newFilter: WeaponType[], shouldEmit = true): boolean {
		const currentFilter = this.weaponTypeFilters.get(slot)!;
		const hasChanged = currentFilter.length !== newFilter.length || currentFilter.some((weaponType, idx) => weaponType !== newFilter[idx]);

		if (!hasChanged) {
			return false;
		}

		this.settingsStore.patch({ weaponTypeFilters: new Map(this.weaponTypeFilters).set(slot, newFilter) }, shouldEmit ? ['settings'] : []);
		return true;
	}

	private clearWeaponTypeFilter(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): boolean {
		return this.setWeaponTypeFilter(slot, [], false);
	}

	setFrozenWeaponSlot(itemSlot: number | null): boolean {
		const newSlot = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(itemSlot ?? -1)
			? (itemSlot as ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand)
			: undefined;
		const filtersChanged = newSlot !== undefined && this.clearWeaponTypeFilter(newSlot);

		if (newSlot === this.frozenWeaponSlot && !filtersChanged) {
			return false;
		}

		this.settingsStore.patch({ frozenWeaponSlot: newSlot }, ['settings']);
		return true;
	}

	setUseLegacyBulkSim(newValue: boolean) {
		this.settingsStore.patch({ useLegacyBulkSim: newValue }, ['settings']);
	}

	setRequiredSetBonus(setBonus: BulkSetBonusOption, pieces: number) {
		const next = nextRequiredSetBonuses(this.requiredSetBonuses, setBonus, pieces, (id, count) => this.canSatisfyRequiredSetBonus(id, count));
		if (!next) return;

		this.settingsStore.patch({ requiredSetBonuses: next }, ['settings']);
	}

	private setRequiredSetBonuses(requiredSetBonuses: BulkRequiredSetBonus[]) {
		this.settingsStore.patch({ requiredSetBonuses: sanitiseRequiredSetBonuses(requiredSetBonuses) }, ['settings']);
	}

	showIterationsWarning(): boolean {
		return this.iterations > this.getIterationsLimit();
	}

	getIterationsLimit(): number {
		return bulkIterationsLimit(this.simUI.sim.isNative);
	}

	getCombinationsLimit(): number {
		return bulkCombinationsLimit(this.simUI.sim.isNative);
	}

	canRunBatch(): boolean {
		return !this.combinationsPending && !this.isRunning && this.combinations > 1 && this.combinations <= this.getCombinationsLimit();
	}

	private setCandidateGearProgress(input: { completed?: number; total?: number; title?: string; stage?: string; startedAt?: number } = {}) {
		this.emitProgress(candidateGearProgress({ ...input, now: new Date().getTime() }));
	}

	private setSimProgress(progress: ProgressMetrics, config: BulkSimProgressConfig) {
		this.emitProgress(simProgress(progress, config, this.simStart, new Date().getTime()));
	}

	private updateRelativeStatCapReforges() {
		if (!this.simUI.reforger) {
			return;
		}

		if (RelativeStatCap.hasRoRo(this.simUI.player) && this.simUI.reforger.settings.relativeStatCapStat !== -1) {
			this.simUI.reforger.settings.relativeStatCap = new RelativeStatCap(this.simUI.reforger.settings.relativeStatCapStat);
		}
	}

	private debugOptimisationRound(message: string, data?: unknown) {
		if (!isDevMode()) return;
		console.debug(`[Bulk Sim Optimisation] ${message}`, data);
	}

	private dedupeGearSets(gearSets: Gear[]): Gear[] {
		return dedupeGearSets(gearSets, this.originalGear ? [this.originalGear] : []);
	}

	private async runCoreBulkSim(
		gearSets: Gear[],
		signal: AbortSignal,
		reforgeConfig?: ReforgeOptimizeConfig,
		bulkSettings?: BulkSettings,
	): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> {
		let candidateBuildStartedAt: number | undefined;
		let cacheRestoreStartedAt: number | undefined;
		return runCoreBulkSimImpl(
			{
				simUI: this.simUI,
				throwIfBulkAborted: signal => this.throwIfBulkAborted(signal),
				runWithBulkAbort: (promise, signal) => this.runWithBulkAbort(promise, signal),
				setSimProgress: (progress, config) => this.setSimProgress(progress, config),
				setCacheRestoreProgress: progress => {
					const isCandidateBuildStage = progress.stage === 'candidate-build';
					if (isCandidateBuildStage) {
						candidateBuildStartedAt ??= new Date().getTime();
					} else {
						cacheRestoreStartedAt ??= new Date().getTime();
					}
					this.setCandidateGearProgress({
						completed: progress.processedCandidates,
						total: progress.totalCandidates,
						title: isCandidateBuildStage
							? i18n.t('bulk_tab.progress.building_candidate_gear_sets')
							: i18n.t('bulk_tab.progress.restoring_reforges_from_cache'),
						stage: isCandidateBuildStage ? 'preparing' : 'reforging',
						startedAt: isCandidateBuildStage ? candidateBuildStartedAt : cacheRestoreStartedAt,
					});
				},
				debugOptimisationRound: (message, data) => this.debugOptimisationRound(message, data),
			},
			gearSets,
			signal,
			reforgeConfig,
			bulkSettings,
		);
	}

	private getBulkReforgeConfig(playerPhase: boolean): ReforgeOptimizeConfig | undefined {
		if (!this.simUI.reforger || !this.originalGear) {
			return undefined;
		}

		this.simUI.reforger.setIncludeGems(true);
		this.simUI.reforger.setIncludeEOTBPGemSocket(playerPhase);
		this.updateRelativeStatCapReforges();
		return this.simUI.reforger.getReforgeOptimizeConfig(this.originalGear);
	}

	async cancelBatchSim() {
		if (!this.isRunning || this.isCancelling) return;

		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'batch_cancel',
			value: this.bulkSimStartedAt > 0 ? Math.round((new Date().getTime() - this.bulkSimStartedAt) / 1000) : 0,
		});

		this.isCancelling = true;
		await this.abortBulkSimWork();
	}

	async runBatchSim() {
		if (this.isRunning) return;

		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'batch_start',
			value: this.combinations,
		});

		this.isCancelling = false;
		this.bulkSimStartedAt = new Date().getTime();
		this.progress = null;
		this.settingsStore.patch({ isRunning: true, started: true });
		const usesWasmConcurrency = await this.simUI.sim.shouldUseWasmConcurrency();
		await this.simUI.sim.waitForInit();
		const useNativeBulkSim = this.simUI.sim.isNative ?? false;
		const concurrency = usesWasmConcurrency ? this.simUI.sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		this.bulkSimAbortController = new AbortController();
		this.bulkSimAbortPromise = null;
		const abortSignal = this.bulkSimAbortController.signal;
		this.topGearResults = null;
		this.originalGearResults = null;

		const playerPhase = this.simUI.sim.getPhase() >= 2;
		const backendBulkSettings = useNativeBulkSim ? this.createBulkSettings() : undefined;
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
			await this.simUI.sim.signalManager.abortType(RequestTypes.IndividualSim | RequestTypes.BulkSim);
			this.simStart = new Date().getTime();
			this.originalGear = this.simUI.player.getGear();

			this.setCandidateGearProgress();
			this.settingsStore.patch({ results: null });
			// Yield a frame so the progress modal paints before the combination calculation.
			await new Promise(requestAnimationFrame);
			await this.calculateBulkCombinations();
			batchCompleteMetrics.combinations = this.combinations;
			batchCompleteMetrics.legacy_bulk_sim_used = this.usesLegacyBulkSim ? 1 : 0;

			if (!useNativeBulkSim) {
				const candidateGearBuildStartedAt = new Date().getTime();
				const bulkCandidatesResult = await this.simUI.sim.getBulkCandidates(this.createBulkSettings());
				if (bulkCandidatesResult.error) {
					throw new Error(bulkCandidatesResult.error.message || 'Failed to build bulk candidates');
				}
				candidateGearSets = bulkCandidatesResult.candidates
					.filter(candidate => !!candidate.gear)
					.map(candidate => this.simUI.sim.db.lookupEquipmentSpec(candidate.gear!));
				this.settingsStore.patch({ combinations: bulkCandidatesResult.combinations });
				batchCompleteMetrics.candidate_gear_sets = candidateGearSets.length;
				batchCompleteMetrics.candidate_gear_sets_duration_seconds = Math.round((new Date().getTime() - candidateGearBuildStartedAt) / 1000);
			}

			const backendReforgeConfig = this.getBulkReforgeConfig(playerPhase);
			// With backend reforging every candidate must be submitted (reforges differentiate
			// otherwise identical gear); without it duplicates are culled up front.
			const gearSets = backendReforgeConfig ? candidateGearSets : this.dedupeGearSets(candidateGearSets);
			this.simStart = new Date().getTime();
			const bulkSimResult = await this.runCoreBulkSim(gearSets, abortSignal, backendReforgeConfig, backendBulkSettings);
			const { referenceDpsMetrics, topGearResults } = bulkSimResult;
			Object.assign(batchCompleteMetrics, bulkSimResult.metrics);

			const originalGearKey = getGearIdentityKey(this.originalGear.asSpec());
			this.topGearResults = topGearResults.filter(result => getGearIdentityKey(result.gear.asSpec()) !== originalGearKey);
			this.originalGearResults = {
				gear: this.originalGear,
				dpsMetrics: referenceDpsMetrics,
			};

			this.topGearResults.push(this.originalGearResults);
			this.topGearResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);

			results = {
				chains: buildTieChains(this.topGearResults, this.originalGearResults, Math.max(1, this.simUI.sim.getIterations())),
				originalGearResults: this.originalGearResults,
			};
		} catch (error) {
			runError = error;
			console.error(error);
			const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
			if (!this.isCancelling && errorMessage) {
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
			const wasCancelling = this.isCancelling;
			const bulkSimDurationSeconds = (new Date().getTime() - this.bulkSimStartedAt) / 1000;
			if (wasCancelling || runError) {
				await this.abortBulkSimWork();
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
					combinations: this.combinations,
					usedLegacyBulkSim: this.usesLegacyBulkSim,
					cancelled: wasCancelling,
				});
			}
			await this.simUI.player.setGearAsync(this.originalGear!);
			if (wasCancelling) {
				toastManager.add({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
				});
			}
			this.isCancelling = false;
			this.settingsStore.patch(results ? { isRunning: false, results } : { isRunning: false });
		}
	}

	private async abortBulkSimWork() {
		if (this.bulkSimAbortPromise) {
			return this.bulkSimAbortPromise;
		}

		const abortController = this.bulkSimAbortController;
		if (!abortController) {
			return;
		}

		this.bulkSimAbortController = null;
		if (!abortController.signal.aborted) {
			abortController.abort();
		}

		this.bulkSimAbortPromise = (async () => {
			// Narrower than `All`: cancelling a batch must not also cancel a stat-weights run, which is
			// the whole point of bulk having its own type. Reforge stays in because the batch's own
			// pre-pass registers under it.
			const abortTasks: Promise<unknown>[] = [this.simUI.sim.signalManager.abortType(RequestTypes.BulkSim | RequestTypes.ReforgeOptimize)];
			if (this.simUI.reforger) {
				abortTasks.push(this.simUI.reforger.abortReforgeOptimization());
			}

			await Promise.all(abortTasks);
		})();

		try {
			await this.bulkSimAbortPromise;
		} finally {
			this.bulkSimAbortPromise = null;
		}
	}

	private throwIfBulkAborted(signal: AbortSignal) {
		if (signal.aborted || this.isCancelling) {
			throw new Error('Bulk Sim Aborted');
		}
	}

	private async runWithBulkAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
		this.throwIfBulkAborted(signal);

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
	}
}
