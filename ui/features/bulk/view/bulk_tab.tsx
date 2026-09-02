import {
	BulkSimProgressConfig,
	NATIVE_COMBINATIONS_LIMIT,
	NATIVE_ITERATIONS_LIMIT,
	TopGearResult,
	WEB_COMBINATIONS_LIMIT,
	WEB_ITERATIONS_LIMIT,
} from '@domain/bulk/types';
import {
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
	BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT,
	BulkSimItemSlot,
	dedupeGearSets,
	getBulkFreezeWeaponTypes,
	getBulkItemSlotFromSlot,
	getBulkPlayerCanDualWield,
} from '@domain/bulk/utils';
import { BulkSettingsStore } from '@domain/bulk_settings';
import { REPO_RELEASES_URL } from '@domain/constants/other';
import { isSpecDualWield2HCapable } from '@domain/player_classes/capabilities';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { Gear } from '@domain/proto_utils/gear';
import { canEquipItem, getEligibleItemSlots, getGearIdentityKey, isSecondaryItemSlot } from '@domain/proto_utils/utils';
import { RelativeStatCap } from '@domain/reforge_settings';
import { ReforgeOptimizeConfig } from '@domain/sim';
import { RequestTypes } from '@domain/sim_signal_manager';
import { nextEventID } from '@domain/state/batch';
import { subscribeAll, subscribeBulkChange, subscribeBulkField, subscribePlayerField, subscribeSimField } from '@domain/state/subscriptions';
import { formatDurationSeconds, formatToNumber, getEnumValues, isDevMode, Z_95, zTest } from '@domain/utils';
import type { IndividualSimHost } from '@features/sim_host';
import { BulkRequiredSetBonus, BulkSettings, BulkSimStage, DistributionMetrics, ProgressMetrics } from '@generated/proto/api';
import { ItemSlot, ItemSpec, WeaponType } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateWeaponType } from '@i18n/localization';
import { isExternal } from '@ui-kit/dom_utils';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { EnumPicker } from '@ui-kit/pickers/enum_picker';
import { ProgressTrackerModal } from '@ui-kit/progress_tracker_modal';
import { SimTab } from '@ui-kit/sim_tab';
import Toast from '@ui-kit/toast';
import { Tab } from 'bootstrap';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { trackEvent } from '../../../tracking/utils';
import SelectorModal from '../../gear/view/selector_modal';
import { BulkGearJsonImporter } from '../../import-export/view/importers';
import { runCoreBulkSim as runCoreBulkSimImpl } from '../model/core_sim';
import BulkItemPickerGroup from './bulk_item_picker_group';
import BulkItemSearch from './bulk_item_search';
import BulkSimResultRenderer from './bulk_sim_results_renderer';
type BulkSetBonusOption = {
	setId: number;
	setName: string;
	totalPieces: number;
};

export class BulkTab extends SimTab {
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

	private readonly setupTabElem: HTMLElement;
	private readonly resultsTabElem: HTMLElement;
	private readonly combinationsElem: HTMLElement;
	private readonly bulkSimButton: HTMLButtonElement;
	private readonly settingsContainer: HTMLElement;

	private setupTab: Tab;
	private resultsTab: Tab;
	protected progressTrackerModal: ProgressTrackerModal;

	readonly selectorModal: SelectorModal;

	// The main array we will use to store items with indexes. Null values are the result of removed items to avoid having to shift pickers over and over.
	protected items: Array<ItemSpec | null> = new Array<ItemSpec | null>();
	protected pickerGroups: Map<BulkSimItemSlot, BulkItemPickerGroup> = new Map();

	protected simStart: number = 0;
	protected bulkSimStartedAt: number = 0;
	protected combinations = 0;
	protected iterations = 0;
	protected isRunning: boolean = false;
	protected isCancelling = false;
	protected bulkSimAbortController: AbortController | null = null;
	protected bulkSimAbortPromise: Promise<void> | null = null;
	protected usesLegacyBulkSim = false;
	private combinationsCalcRequestVersion = 0;
	private webSimWarningContainer: HTMLElement | null = null;

	inheritUpgrades: boolean = true;
	useLegacyBulkSim: boolean = false;
	requiredSetBonuses: Map<number, BulkRequiredSetBonus> = new Map();
	frozenItems: Map<BulkSimItemSlot, EquippedItem | null> = new Map([
		[BulkSimItemSlot.ItemSlotFinger, null],
		[BulkSimItemSlot.ItemSlotTrinket, null],
	]);
	frozenWeaponSlot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand | undefined = undefined;
	weaponTypeFilters: Map<ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand, WeaponType[]> = new Map([
		[ItemSlot.ItemSlotMainHand, []],
		[ItemSlot.ItemSlotOffHand, []],
	]);

	protected topGearResults: TopGearResult[] | null = null;
	protected originalGear: Gear | null = null;
	protected originalGearResults: TopGearResult | null = null;

	// Memos for the set-bonus feasibility checks. Every BooleanPicker's enableWhen runs the
	// full picker scan + per-slot DP on each settings/items change; these cache the answers
	// until the next change event (see the invalidation hook in the constructor).
	private availableSetBonusesMemo: BulkSetBonusOption[] | null = null;
	private canSatisfySetBonusMemo = new Map<string, boolean>();

	constructor(parentElem: HTMLElement, simUI: IndividualSimHost<any>) {
		super(parentElem, simUI, { identifier: 'bulk-tab', title: i18n.t('bulk_tab.title') });

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

		const setupTabBtnRef = ref<HTMLButtonElement>();
		const setupTabRef = ref<HTMLDivElement>();
		const resultsTabBtnRef = ref<HTMLButtonElement>();
		const resultsTabRef = ref<HTMLDivElement>();
		const settingsContainerRef = ref<HTMLDivElement>();
		const combinationsElemRef = ref<HTMLHeadingElement>();
		const bulkSimBtnRef = ref<HTMLButtonElement>();

		this.contentContainer.appendChild(
			<>
				<div className="bulk-tab-left tab-panel-left">
					<div className="bulk-tab-tabs">
						<ul className="nav nav-tabs" attributes={{ role: 'tablist' }}>
							<li className="nav-item" attributes={{ role: 'presentation' }}>
								<button
									className="nav-link active"
									type="button"
									attributes={{
										role: 'tab',
										// @ts-expect-error
										'aria-controls': 'bulkSetupTab',
										'aria-selected': true,
									}}
									dataset={{
										bsToggle: 'tab',
										bsTarget: `#bulkSetupTab`,
									}}
									ref={setupTabBtnRef}>
									{i18n.t('bulk_tab.tabs.setup')}
								</button>
							</li>
							<li className="nav-item" attributes={{ role: 'presentation' }}>
								<button
									className="nav-link"
									type="button"
									attributes={{
										role: 'tab',
										// @ts-expect-error
										'aria-controls': 'bulkResultsTab',
										'aria-selected': false,
									}}
									dataset={{
										bsToggle: 'tab',
										bsTarget: `#bulkResultsTab`,
									}}
									ref={resultsTabBtnRef}>
									{i18n.t('bulk_tab.tabs.results')}
								</button>
							</li>
						</ul>
						<div className="tab-content">
							<div id="bulkSetupTab" className="tab-pane fade active show" ref={setupTabRef} />
							<div id="bulkResultsTab" className="tab-pane fade show" ref={resultsTabRef}>
								<div className="d-flex align-items-center justify-content-center p-gap">{i18n.t('bulk_tab.results.run_simulation')}</div>
							</div>
						</div>
					</div>
				</div>
				<div className="bulk-tab-right tab-panel-right">
					<div className="bulk-settings-outer-container">
						<div className="bulk-settings-container" ref={settingsContainerRef}>
							<div className="bulk-combinations-count h4" ref={combinationsElemRef} />
							<button className="btn btn-primary bulk-settings-btn" ref={bulkSimBtnRef}>
								{i18n.t('bulk_tab.actions.simulate_batch')}
							</button>
						</div>
					</div>
				</div>
			</>,
		);

		this.setupTabElem = setupTabRef.value!;
		this.resultsTabElem = resultsTabRef.value!;

		this.combinationsElem = combinationsElemRef.value!;
		this.bulkSimButton = bulkSimBtnRef.value!;
		this.settingsContainer = settingsContainerRef.value!;

		this.setupTab = new Tab(setupTabBtnRef.value!);
		this.resultsTab = new Tab(resultsTabBtnRef.value!);

		this.selectorModal = new SelectorModal(this.simUI.rootElem, this.simUI, this.simUI.player, undefined, {
			id: 'bulk-selector-modal',
		});

		this.progressTrackerModal = new ProgressTrackerModal(simUI.rootElem, {
			id: 'bulk-sim-progress-tracker',
			title: 'Bulk Sim',
			hasProgressBar: true,
			onCancel: async () => {
				if (!this.isRunning || this.isCancelling) return;

				trackEvent({
					action: 'sim',
					category: 'batch_sim',
					label: 'batch_cancel',
					value: this.bulkSimStartedAt > 0 ? Math.round((new Date().getTime() - this.bulkSimStartedAt) / 1000) : 0,
				});

				this.isCancelling = true;
				await this.abortBulkSimWork();
			},
		});

		this.buildTabContent();

		this.simUI.sim.waitForInit().then(() => {
			this.loadSettings();
			this.updateWebSimWarning();
			const loadEquippedItems = () => {
				if (this.isRunning) {
					return;
				}

				// Clear all previously equipped items from the pickers
				for (const group of this.pickerGroups.values()) {
					if (group.has(-1)) {
						group.remove(-1, true);
					}
					if (group.has(-2)) {
						group.remove(-2, true);
					}
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
						const group = this.pickerGroups.get(bulkSlot);
						if (!group) return;

						if (equippedIds.has(itemSpec.id)) {
							if (group.has(idx)) group.remove(idx, true);
						} else {
							if (!group.has(idx)) group.add(idx, equippedItem, true);
						}
					});
				}

				this.simUI.player.getEquippedItems().forEach((equippedItem, slot) => {
					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					const group = this.pickerGroups.get(bulkSlot);
					if (!group) return;
					const idx = this.isSecondaryItemSlot(slot) ? -2 : -1;
					if (equippedItem) {
						group.add(idx, equippedItem, true);
					}
				});

				this.bump('items');
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

	// Bumps a version counter — the one write path where the tab used to emit.
	// The values themselves stay on the tab (nothing reads them from the store).
	private bump(field: 'settings' | 'items') {
		this.settingsStore.touch(field);
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
			requiredSetBonuses: this.getRequiredSetBonusesForSettings(),
		});
	}

	private getDefaultIterationsCount(): number {
		return this.simUI.sim.getIterations();
	}

	private updateWebSimWarning() {
		if (!this.webSimWarningContainer) {
			return;
		}

		if (this.simUI.sim.isNative === false) {
			this.webSimWarningContainer.replaceChildren(
				<p className="mb-0">
					<a href={REPO_RELEASES_URL} target="_blank">
						<i className="fas fa-gauge-high me-1" />
						{i18n.t('bulk_tab.download_native')}
					</a>
				</p>,
			);
		} else {
			this.webSimWarningContainer.replaceChildren();
		}
	}

	// Add an item to its eligible bulk sim item slot(s). Mainly used for importing and search
	addItem(item: ItemSpec) {
		this.addItems([item]);
	}
	// Add items to their eligible bulk sim item slot(s). Mainly used for importing and search
	addItems(items: ItemSpec[], silent = false) {
		items.forEach(item => {
			const equippedItem = this.simUI.sim.db.lookupItemSpec(item)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats();
			if (equippedItem) {
				getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
					// Avoid duplicating rings/trinkets/weapons
					if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

					const idx = this.items.push(item) - 1;
					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					const group = this.pickerGroups.get(bulkSlot)!;
					if (!group.add(idx, equippedItem, silent)) {
						this.items.pop();
					}
				});
			}
		});

		this.bump('items');
	}
	// Add an item to a particular bulk sim item slot
	addItemToSlot(item: ItemSpec, bulkSlot: BulkSimItemSlot) {
		const equippedItem = this.simUI.sim.db.lookupItemSpec(item)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats();
		if (equippedItem) {
			const eligibleItemSlots = getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H);
			if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), eligibleItemSlots[0])) return;

			const idx = this.items.push(item) - 1;
			const group = this.pickerGroups.get(bulkSlot)!;
			if (!group.add(idx, equippedItem)) {
				this.items.pop();
			}
			this.bump('items');
		}
	}

	updateItem(idx: number, newItem: ItemSpec) {
		const equippedItem = this.simUI.sim.db.lookupItemSpec(newItem)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats();
		if (equippedItem) {
			this.items[idx] = newItem;

			getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
				// Avoid duplicating rings/trinkets/weapons
				if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

				const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
				const group = this.pickerGroups.get(bulkSlot)!;
				group.update(idx, equippedItem);
			});
		}

		this.bump('items');
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
			new Toast({
				variant: 'error',
				body: i18n.t('bulk_tab.notifications.failed_to_remove_item'),
			});
			return;
		}

		const item = this.items[idx]!;
		const equippedItem = this.simUI.sim.db.lookupItemSpec(item);
		if (equippedItem) {
			this.items[idx] = null;

			// Try to find the matching item within its eligible groups
			getEligibleItemSlots(equippedItem.item, this.playerCanDualWield2H).forEach(slot => {
				if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;
				const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
				const group = this.pickerGroups.get(bulkSlot)!;

				if (group.has(idx)) {
					group.remove(idx, silent);
				}
			});
			this.bump('items');
		}
	}

	clearItems() {
		for (let idx = 0; idx < this.items.length; idx++) {
			this.removeItemByIndex(idx, true);
		}
		this.items = new Array<ItemSpec>();
		this.bump('items');
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

	private getAvailableBulkSetBonuses(): BulkSetBonusOption[] {
		if (this.availableSetBonusesMemo) return this.availableSetBonusesMemo;
		const setBonuses = new Map<number, BulkSetBonusOption & { itemIds: Set<number> }>();

		for (const pickerGroup of this.pickerGroups.values()) {
			for (const picker of pickerGroup.pickers.values()) {
				const item = picker.item.item;
				if (!item.setId || !item.setName) continue;

				if (!setBonuses.has(item.setId)) {
					setBonuses.set(item.setId, {
						setId: item.setId,
						setName: item.setName,
						totalPieces: 0,
						itemIds: new Set<number>(),
					});
				}
				setBonuses.get(item.setId)!.itemIds.add(item.id);
			}
		}

		this.availableSetBonusesMemo = Array.from(setBonuses.values())
			.map(setBonus => ({
				setId: setBonus.setId,
				setName: setBonus.setName,
				totalPieces: setBonus.itemIds.size,
			}))
			.filter(setBonus => setBonus.setName && setBonus.totalPieces >= 2)
			.sort((a, b) => a.setName.localeCompare(b.setName) || a.setId - b.setId);
		return this.availableSetBonusesMemo;
	}

	private getRequiredSetBonusesForSettings(): BulkRequiredSetBonus[] {
		const setBonusesById = new Map(this.getAvailableBulkSetBonuses().map(setBonus => [setBonus.setId, setBonus]));
		return Array.from(this.requiredSetBonuses.values())
			.map(requiredSetBonus => {
				const setBonus = setBonusesById.get(requiredSetBonus.setId);
				if (!setBonus || requiredSetBonus.pieces > setBonus.totalPieces) return null;
				return BulkRequiredSetBonus.create(requiredSetBonus);
			})
			.filter((requiredSetBonus): requiredSetBonus is BulkRequiredSetBonus => requiredSetBonus !== null)
			.sort((a, b) => a.setId - b.setId);
	}

	private getRequiredFourPieceSetBonusId(): number | undefined {
		return Array.from(this.requiredSetBonuses.entries()).find(([, requiredSetBonus]) => requiredSetBonus.pieces === 4)?.[0];
	}

	private hasOtherRequiredSetBonus(setId: number, pieces?: number): boolean {
		return Array.from(this.requiredSetBonuses.entries()).some(
			([requiredSetBonusId, requiredSetBonus]) => requiredSetBonusId !== setId && (pieces === undefined || requiredSetBonus.pieces === pieces),
		);
	}

	private canEnableRequiredTwoPiece(setId: number): boolean {
		if (this.requiredSetBonuses.get(setId)?.pieces === 2) return true;

		const fourPieceSetBonusId = this.getRequiredFourPieceSetBonusId();
		return (fourPieceSetBonusId === undefined || fourPieceSetBonusId === setId) && this.canSatisfyRequiredSetBonus(setId, 2);
	}

	private canEnableRequiredFourPiece(setBonus: BulkSetBonusOption): boolean {
		if (this.requiredSetBonuses.get(setBonus.setId)?.pieces === 4) return true;

		const fourPieceSetBonusId = this.getRequiredFourPieceSetBonusId();
		return (
			setBonus.totalPieces >= 4 &&
			(fourPieceSetBonusId === undefined || fourPieceSetBonusId === setBonus.setId) &&
			!this.hasOtherRequiredSetBonus(setBonus.setId, 2) &&
			this.canSatisfyRequiredSetBonus(setBonus.setId, 4)
		);
	}

	private hasMatchingRequiredSetBonusCombination(requiredSetBonuses: BulkRequiredSetBonus[]): boolean {
		if (!requiredSetBonuses.length) return true;

		const requiredSetBonusIndexes = new Map<number, number>();
		requiredSetBonuses.forEach((requiredSetBonus, index) => {
			requiredSetBonusIndexes.set(requiredSetBonus.setId, index);
		});

		const requiredPieces = requiredSetBonuses.map(requiredSetBonus => requiredSetBonus.pieces);
		const baseGear = this.originalGear ?? this.simUI.player.getGear();
		const baseCounts = new Array<number>(requiredSetBonuses.length).fill(0);
		baseGear.getEquippedItems().forEach(equippedItem => this.addItemToRequiredSetBonusCounts(baseCounts, requiredSetBonusIndexes, equippedItem, 1));

		const dimensions: number[][][] = [];

		for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
			if (
				pickerGroup.pickers.size === 0 ||
				[
					BulkSimItemSlot.ItemSlotMainHand,
					BulkSimItemSlot.ItemSlotOffHand,
					BulkSimItemSlot.ItemSlotHandWeapon,
					BulkSimItemSlot.ItemSlotFinger,
					BulkSimItemSlot.ItemSlotTrinket,
				].includes(bulkItemSlot)
			) {
				continue;
			}

			const optionsForSlot: EquippedItem[] = Array.from(pickerGroup.pickers.values()).map(picker => picker.item);
			const slotToUse = BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT.get(bulkItemSlot)!;
			dimensions.push(optionsForSlot.map(option => this.getRequiredSetBonusOptionDeltas(baseGear, requiredSetBonusIndexes, [[slotToUse, option]])));
		}

		const clampCounts = (counts: number[]) => counts.map((count, index) => Math.min(requiredPieces[index], Math.max(0, count)));
		let states = new Map<string, number[]>();
		const initialState = clampCounts(baseCounts);
		states.set(initialState.join(','), initialState);

		for (const optionDeltas of dimensions) {
			if (!optionDeltas.length) {
				return false;
			}

			const nextStates = new Map<string, number[]>();
			for (const counts of states.values()) {
				for (const deltas of optionDeltas) {
					const nextCounts = clampCounts(counts.map((count, index) => count + deltas[index]));
					nextStates.set(nextCounts.join(','), nextCounts);
				}
			}

			if (!nextStates.size) {
				return false;
			}
			states = nextStates;
		}

		for (const counts of states.values()) {
			if (counts.every((count, index) => count >= requiredPieces[index])) {
				return true;
			}
		}

		return false;
	}

	private addItemToRequiredSetBonusCounts(counts: number[], requiredSetBonusIndexes: Map<number, number>, equippedItem: EquippedItem | null, delta: number) {
		const item = equippedItem?.item;
		if (!item?.setId) return;

		const index = requiredSetBonusIndexes.get(item.setId);
		if (index === undefined) return;

		counts[index] += delta;
	}

	private getRequiredSetBonusOptionDeltas(
		baseGear: Gear,
		requiredSetBonusIndexes: Map<number, number>,
		slotItems: Array<[ItemSlot, EquippedItem | null]>,
	): number[] {
		const deltas = new Array<number>(requiredSetBonusIndexes.size).fill(0);
		for (const [slot, equippedItem] of slotItems) {
			this.addItemToRequiredSetBonusCounts(deltas, requiredSetBonusIndexes, baseGear.getEquippedItem(slot), -1);
			this.addItemToRequiredSetBonusCounts(deltas, requiredSetBonusIndexes, equippedItem, 1);
		}
		return deltas;
	}

	protected async calculateBulkCombinations() {
		try {
			const bulkSettings = this.createBulkSettings();
			const combinationCountResult = await this.simUI.sim.getBulkCombinationCount(bulkSettings);
			if (combinationCountResult.error) {
				throw new Error(combinationCountResult.error.message || 'Failed to calculate bulk combinations');
			}
			this.combinations = combinationCountResult.combinations;
			this.iterations = combinationCountResult.iterations;
			this.usesLegacyBulkSim = combinationCountResult.useLegacyBulkSim;
		} catch (e) {
			this.simUI.handleCrash(e);
		}
	}

	private async refreshCombinationsCount() {
		const requestVersion = ++this.combinationsCalcRequestVersion;
		this.combinationsElem.replaceChildren(this.getCombinationsLoading());
		await this.calculateBulkCombinations();
		if (requestVersion !== this.combinationsCalcRequestVersion) {
			return;
		}
		this.combinationsElem.replaceChildren(this.getCombinationsCount());
	}

	private canSatisfyRequiredSetBonus(setId: number, pieces: number): boolean {
		const memoKey = `${setId}:${pieces}`;
		const memoized = this.canSatisfySetBonusMemo.get(memoKey);
		if (memoized !== undefined) return memoized;

		const requiredSetBonuses = Array.from(this.requiredSetBonuses.values()).filter(requiredSetBonus => requiredSetBonus.setId !== setId);
		requiredSetBonuses.push(BulkRequiredSetBonus.create({ setId, pieces }));
		const result = this.hasMatchingRequiredSetBonusCombination(requiredSetBonuses);
		this.canSatisfySetBonusMemo.set(memoKey, result);
		return result;
	}

	protected buildTabContent() {
		this.buildSetupTabContent();
		this.buildResultsTabContent();
		this.buildBatchSettings();
	}

	private buildSetupTabContent() {
		const bagImportBtnRef = ref<HTMLButtonElement>();
		const favsImportBtnRef = ref<HTMLButtonElement>();
		const clearBtnRef = ref<HTMLButtonElement>();
		const webSimWarningRef = ref<HTMLDivElement>();
		this.setupTabElem.appendChild(
			<>
				{/* // TODO: Remove once we're more comfortable with the state of Batch sim */}
				<p className="mb-0" innerHTML={i18n.t('bulk_tab.description')} />
				<div ref={webSimWarningRef}></div>
				<div className="bulk-gear-actions">
					<button className="btn btn-secondary" ref={bagImportBtnRef}>
						<i className="fa fa-download me-1" /> {i18n.t('bulk_tab.actions.import_bags')}
					</button>
					<button className="btn btn-secondary" ref={favsImportBtnRef}>
						<i className="fa fa-download me-1" /> {i18n.t('bulk_tab.actions.import_favorites')}
					</button>
					<button className="btn btn-danger ms-auto" ref={clearBtnRef}>
						<i className="fas fa-times me-1" />
						{i18n.t('bulk_tab.actions.clear_items')}
					</button>
				</div>
			</>,
		);

		const bagImportButton = bagImportBtnRef.value!;
		const favsImportButton = favsImportBtnRef.value!;
		const clearButton = clearBtnRef.value!;
		this.webSimWarningContainer = webSimWarningRef.value!;
		this.updateWebSimWarning();

		bagImportButton.addEventListener('click', () => new BulkGearJsonImporter(this.simUI.rootElem, this.simUI, this).open());

		favsImportButton.addEventListener('click', () => {
			const filters = this.simUI.player.sim.getFilters();
			const items = filters.favoriteItems.map(itemID => ItemSpec.create({ id: itemID }));
			this.addItems(items);
		});

		clearButton.addEventListener('click', () => this.clearItems());

		new BulkItemSearch(this.setupTabElem, this.simUI, this);

		const itemList = (<div className="bulk-gear-combo" />) as HTMLElement;
		this.setupTabElem.appendChild(itemList);

		getEnumValues<BulkSimItemSlot>(BulkSimItemSlot).forEach(bulkSlot => {
			if (this.playerCanDualWield && [BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand].includes(bulkSlot)) return;
			if (!this.playerCanDualWield && bulkSlot === BulkSimItemSlot.ItemSlotHandWeapon) return;
			this.pickerGroups.set(bulkSlot, new BulkItemPickerGroup(itemList, this.simUI, this, bulkSlot));
		});
	}

	private resetResultsTabContent() {
		this.resultsTabElem.replaceChildren();
		this.setupTab.show();
	}

	private buildResultsTabContent() {
		if (!this.topGearResults || !this.originalGearResults) {
			return;
		}

		const iterations = Math.max(1, this.simUI.sim.getIterations());
		const isBaselineRow = (result: TopGearResult) => result === this.originalGearResults;
		const pairTied = (upper: TopGearResult, lower: TopGearResult): boolean => {
			let pairedError: number | undefined;
			if (isBaselineRow(upper)) {
				pairedError = lower.pairedErrorToBaseline;
			} else if (isBaselineRow(lower)) {
				pairedError = upper.pairedErrorToBaseline;
			} else if (upper.backendRank !== undefined && lower.backendRank === upper.backendRank + 1) {
				pairedError = upper.pairedErrorToNextResult;
			}
			if (pairedError) {
				return Math.abs(upper.dpsMetrics.avg - lower.dpsMetrics.avg) <= Z_95 * pairedError;
			}
			return !zTest(iterations, upper.dpsMetrics.avg, upper.dpsMetrics.stdev, iterations, lower.dpsMetrics.avg, lower.dpsMetrics.stdev).isDiff;
		};
		const tieChains: TopGearResult[][] = [];
		for (const topGearResult of this.topGearResults) {
			const currentChain = tieChains[tieChains.length - 1];
			const previousResult = currentChain?.[currentChain.length - 1];
			if (previousResult && pairTied(previousResult, topGearResult)) {
				currentChain.push(topGearResult);
			} else {
				tieChains.push([topGearResult]);
			}
		}

		// Build everything into a detached fragment and attach once: each renderer row is a
		// sizeable subtree, and appending them live would relayout the tab per row.
		const resultsFragment = document.createDocumentFragment();
		for (const chain of tieChains) {
			let container: HTMLElement | DocumentFragment = resultsFragment;
			if (chain.length > 1) {
				container = (
					<div className="bulk-results-tie-group">
						<span className="mb-4">{i18n.t('bulk_tab.results.tied_group')}</span>
					</div>
				) as HTMLElement;
				resultsFragment.appendChild(container);
			}
			for (const topGearResult of chain) {
				new BulkSimResultRenderer(container, this.simUI, topGearResult, this.originalGearResults);
			}
		}
		this.resultsTabElem.appendChild(resultsFragment);

		this.resultsTab.show();
	}

	// Return whether or not the slot is considered secondary and the item should be grouped
	// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
	private isSecondaryItemSlot(slot: ItemSlot) {
		return isSecondaryItemSlot(slot) || (this.playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);
	}

	private setInheritUpgrades(newValue: boolean) {
		this.inheritUpgrades = newValue;
		this.bump('settings');
	}

	private createFreezeWeaponTypePickers(container: HTMLElement, slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand) {
		const weaponTypes = getBulkFreezeWeaponTypes(this.simUI.player, slot);

		if (!weaponTypes.length) return;

		const freezeWeaponTypeContainerRef = ref<HTMLDivElement>();
		const freezeWeaponTypeListRef = ref<HTMLDivElement>();

		container.appendChild(
			<div className={clsx('bulk-gear-freeze-weapontypes', this.frozenWeaponSlot === slot && 'hide')} ref={freezeWeaponTypeContainerRef}>
				<h6 className="mb-2">
					{slot === ItemSlot.ItemSlotMainHand
						? i18n.t('bulk_tab.settings.freeze_weapon_types.mainhand_label')
						: i18n.t('bulk_tab.settings.freeze_weapon_types.offhand_label')}
				</h6>
				<div className="fs-content mb-2">{i18n.t('bulk_tab.settings.freeze_weapon_types.tooltip')}</div>
				<div className="bulk-gear-freeze-weapontypes__list gap-1" ref={freezeWeaponTypeListRef}></div>
			</div>,
		);

		const updateVisibility = () => freezeWeaponTypeContainerRef.value?.parentElement?.classList.toggle('hide', this.frozenWeaponSlot === slot);
		const unsubVisibility = subscribeBulkField(this, 'settings')(updateVisibility);
		this.addOnDisposeCallback(() => unsubVisibility());

		weaponTypes.forEach(weaponType => {
			new BooleanPicker<BulkTab>(freezeWeaponTypeListRef.value!, this, {
				id: `bulk-${slot}-weapon-type-${weaponType}`,
				label: translateWeaponType(weaponType),
				inline: true,
				storeSubscribe: () => subscribeBulkField(this, 'settings'),
				getValue: _modObj => this.weaponTypeFilters.get(slot)!.includes(weaponType),
				setValue: (eventID, _modObj, newValue: boolean) => {
					const filter = this.weaponTypeFilters.get(slot)!;
					this.setWeaponTypeFilter(slot, newValue ? [...filter, weaponType] : filter.filter(type => type !== weaponType), eventID);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: `freeze_${slot}_weapon_type`,
						value: newValue,
					});
				},
			});
		});
	}

	private setFrozenItem(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket, item: EquippedItem | null, _eventID = nextEventID()) {
		if (item === this.frozenItems.get(bulkSlot)) {
			return;
		}

		this.frozenItems.set(bulkSlot, item);
		this.bump('settings');
	}

	private getEquippedItemForFrozenSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket, itemSlot: number): EquippedItem | null {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		if (!slots?.includes(itemSlot)) {
			return null;
		}

		return this.simUI.player.getGear().getEquippedItem(itemSlot) ?? null;
	}

	private getFrozenItemSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket): ItemSlot | undefined {
		const frozenItem = this.frozenItems.get(bulkSlot);
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
		if (!frozenItem || !slots) {
			return undefined;
		}

		const currentGear = this.simUI.player.getGear();
		return (
			slots.find(slot => currentGear.getEquippedItem(slot) === frozenItem) ??
			slots.find(slot => currentGear.getEquippedItem(slot)?.equals(frozenItem)) ??
			undefined
		);
	}

	private setWeaponTypeFilter(
		slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand,
		newFilter: WeaponType[],
		eventID = nextEventID(),
		shouldEmit = true,
	): boolean {
		const currentFilter = this.weaponTypeFilters.get(slot)!;
		const hasChanged = currentFilter.length !== newFilter.length || currentFilter.some((weaponType, idx) => weaponType !== newFilter[idx]);

		if (!hasChanged) {
			return false;
		}

		this.weaponTypeFilters.set(slot, newFilter);
		if (shouldEmit) {
			this.bump('settings');
		}
		return true;
	}

	private clearWeaponTypeFilter(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): boolean {
		return this.setWeaponTypeFilter(slot, [], undefined, false);
	}

	private setFrozenWeaponSlot(itemSlot: number | null): boolean {
		const newSlot = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(itemSlot ?? -1)
			? (itemSlot as ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand)
			: undefined;
		const filtersChanged = newSlot !== undefined && this.clearWeaponTypeFilter(newSlot);

		if (newSlot === this.frozenWeaponSlot && !filtersChanged) {
			return false;
		}

		this.frozenWeaponSlot = newSlot;
		this.bump('settings');
		return true;
	}

	private setUseLegacyBulkSim(newValue: boolean) {
		this.useLegacyBulkSim = newValue;
		this.bump('settings');
	}

	private setRequiredSetBonus(setBonus: BulkSetBonusOption, pieces: number) {
		const currentValue = this.requiredSetBonuses.get(setBonus.setId)?.pieces ?? 0;
		if (currentValue === pieces) return;

		if (pieces === 4) {
			if (!this.canEnableRequiredFourPiece(setBonus)) return;
			this.requiredSetBonuses.clear();
			this.requiredSetBonuses.set(setBonus.setId, BulkRequiredSetBonus.create({ setId: setBonus.setId, pieces }));
		} else if (pieces === 2) {
			if (!this.canEnableRequiredTwoPiece(setBonus.setId)) return;
			this.requiredSetBonuses.set(setBonus.setId, BulkRequiredSetBonus.create({ setId: setBonus.setId, pieces }));
		} else {
			this.requiredSetBonuses.delete(setBonus.setId);
		}
		this.bump('settings');
	}

	private setRequiredSetBonuses(requiredSetBonuses: BulkRequiredSetBonus[]) {
		this.requiredSetBonuses.clear();
		const requiredFourPieceSetBonus = requiredSetBonuses.find(requiredSetBonus => requiredSetBonus.setId > 0 && requiredSetBonus.pieces === 4);
		const requiredSetBonusesToStore = requiredFourPieceSetBonus ? [requiredFourPieceSetBonus] : requiredSetBonuses;
		requiredSetBonusesToStore.forEach(requiredSetBonus => {
			if (requiredSetBonus.setId > 0 && [2, 4].includes(requiredSetBonus.pieces)) {
				this.requiredSetBonuses.set(requiredSetBonus.setId, BulkRequiredSetBonus.create(requiredSetBonus));
			}
		});
		this.bump('settings');
	}

	private createRequiredSetBonusSettings(container: HTMLElement) {
		const render = () => {
			const setBonuses = this.getAvailableBulkSetBonuses();
			if (!setBonuses.length) {
				container.replaceChildren();
				return;
			}

			const fragment = document.createDocumentFragment();
			fragment.appendChild(<h6>{i18n.t('bulk_tab.settings.required_set_bonuses.label')}</h6>);
			for (const setBonus of setBonuses) {
				const setBonusId = `required-set-bonus-${setBonus.setId}-${setBonus.setName.replace(/\W+/g, '-')}`;
				const setBonusContainer = fragment.appendChild(
					<div className="bulk-required-set-bonus d-flex flex-column gap-1">
						<div className="form-label">
							{setBonus.setName} {i18n.t('bulk_tab.settings.required_set_bonuses.available_pieces', { count: setBonus.totalPieces })}
						</div>
					</div>,
				) as HTMLElement;

				if (setBonus.totalPieces >= 2) {
					new BooleanPicker<BulkTab>(setBonusContainer, this, {
						id: `${setBonusId}-2p`,
						label: i18n.t('bulk_tab.settings.required_set_bonuses.require_2p'),
						inline: true,
						storeSubscribe: () => subscribeBulkChange(this),
						enableWhen: _modObj => this.canEnableRequiredTwoPiece(setBonus.setId),
						getValue: _modObj => this.requiredSetBonuses.get(setBonus.setId)?.pieces === 2,
						setValue: (eventID, _modObj, newValue) => {
							this.setRequiredSetBonus(setBonus, newValue ? 2 : 0);
							trackEvent({
								action: 'settings',
								category: 'batch_sim',
								label: 'required_set_bonus',
								value: newValue ? 2 : 0,
							});
						},
					});
				}

				if (setBonus.totalPieces >= 4) {
					new BooleanPicker<BulkTab>(setBonusContainer, this, {
						id: `${setBonusId}-4p`,
						label: i18n.t('bulk_tab.settings.required_set_bonuses.require_4p'),
						inline: true,
						extraCssClasses: ['bulk-required-set-bonus'],
						storeSubscribe: () => subscribeBulkChange(this),
						enableWhen: _modObj => this.canEnableRequiredFourPiece(setBonus),
						getValue: _modObj => this.requiredSetBonuses.get(setBonus.setId)?.pieces === 4,
						setValue: (eventID, _modObj, newValue) => {
							this.setRequiredSetBonus(setBonus, newValue ? 4 : 0);
							trackEvent({
								action: 'settings',
								category: 'batch_sim',
								label: 'required_set_bonus',
								value: newValue ? 4 : 0,
							});
						},
					});
				}
			}

			container.replaceChildren(fragment);
		};

		render();
		subscribeBulkField(this, 'items')(render);
	}

	protected buildBatchSettings() {
		this.bulkSimButton.addEventListener('click', () => this.runBatchSim());

		const inheritUpgradesDiv = ref<HTMLDivElement>();
		const useLegacyBulkSimDiv = ref<HTMLDivElement>();
		const requiredSetBonusesDiv = ref<HTMLDivElement>();
		const frozenRingDiv = ref<HTMLDivElement>();
		const frozenTrinketDiv = ref<HTMLDivElement>();
		const frozenWeaponDiv = ref<HTMLDivElement>();
		const mainHandWeaponTypesDiv = ref<HTMLDivElement>();
		const offHandWeaponTypesDiv = ref<HTMLDivElement>();

		this.settingsContainer.appendChild(
			<>
				<div ref={useLegacyBulkSimDiv} className="use-legacy-bulk-sim-container"></div>
				<div ref={inheritUpgradesDiv} className="inherit-upgrades-container"></div>
				<div ref={requiredSetBonusesDiv} className="required-set-bonuses-container d-flex flex-column gap-2"></div>
				<div ref={frozenRingDiv}></div>
				<div ref={frozenTrinketDiv}></div>
				{this.playerCanDualWield && (
					<>
						<div ref={frozenWeaponDiv}></div>
						<div ref={mainHandWeaponTypesDiv}></div>
						<div ref={offHandWeaponTypesDiv}></div>
					</>
				)}
			</>,
		);

		if (inheritUpgradesDiv.value)
			new BooleanPicker<BulkTab>(inheritUpgradesDiv.value, this, {
				id: 'inherit-upgrades',
				label: i18n.t('bulk_tab.settings.inherit_upgrades.label'),
				labelTooltip: i18n.t('bulk_tab.settings.inherit_upgrades.tooltip'),
				inline: true,
				storeSubscribe: () => subscribeBulkField(this, 'settings'),
				getValue: _modObj => this.inheritUpgrades,
				setValue: (_, _modObj, newValue: boolean) => {
					this.setInheritUpgrades(newValue);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: 'inherit_upgrades',
						value: newValue,
					});
				},
			});

		if (useLegacyBulkSimDiv.value)
			new BooleanPicker<BulkTab>(useLegacyBulkSimDiv.value, this, {
				id: 'use-legacy-bulk-sim',
				label: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.label'),
				labelTooltip: i18n.t('bulk_tab.settings.use_legacy_bulk_sim.tooltip'),
				inline: true,
				storeSubscribe: () => subscribeBulkField(this, 'settings'),
				getValue: _modObj => this.useLegacyBulkSim,
				setValue: (_, _modObj, newValue: boolean) => {
					this.setUseLegacyBulkSim(newValue);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: 'use_legacy_bulk_sim',
						value: newValue,
					});
				},
			});

		if (requiredSetBonusesDiv.value) this.createRequiredSetBonusSettings(requiredSetBonusesDiv.value);

		if (frozenRingDiv.value)
			new EnumPicker<BulkTab>(frozenRingDiv.value, this, {
				id: 'freeze-ring',
				label: i18n.t('bulk_tab.settings.freeze_ring.label'),
				labelTooltip: i18n.t('bulk_tab.settings.freeze_ring.tooltip'),
				values: [
					{ name: i18n.t('common.none'), value: -1 },
					{ name: i18n.t('slots.finger_1', { ns: 'character' }), value: ItemSlot.ItemSlotFinger1 },
					{ name: i18n.t('slots.finger_2', { ns: 'character' }), value: ItemSlot.ItemSlotFinger2 },
				],
				storeSubscribe: () => subscribeBulkChange(this),
				getValue: _modObj => {
					const frozenRing = this.frozenItems.get(BulkSimItemSlot.ItemSlotFinger);

					if (!frozenRing) {
						return -1;
					}

					const currentGear: Gear = this.simUI.player.getGear();

					if (currentGear.getEquippedItem(ItemSlot.ItemSlotFinger1)?.equals(frozenRing)) {
						return ItemSlot.ItemSlotFinger1;
					} else if (currentGear.getEquippedItem(ItemSlot.ItemSlotFinger2)?.equals(frozenRing)) {
						return ItemSlot.ItemSlotFinger2;
					} else {
						this.setFrozenItem(BulkSimItemSlot.ItemSlotFinger, null);
						return -1;
					}
				},
				setValue: (eventID, _modObj, newValue) => {
					let newItem: EquippedItem | null = null;

					if (newValue != -1) {
						newItem = this.simUI.player.getGear().getEquippedItem(newValue);
					}

					this.setFrozenItem(BulkSimItemSlot.ItemSlotFinger, newItem, eventID);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: 'freeze_ring_slot',
						value: newValue,
					});
				},
			});

		if (frozenTrinketDiv.value)
			new EnumPicker<BulkTab>(frozenTrinketDiv.value, this, {
				id: 'freeze-trinket',
				label: i18n.t('bulk_tab.settings.freeze_trinket.label'),
				labelTooltip: i18n.t('bulk_tab.settings.freeze_trinket.tooltip'),
				values: [
					{ name: i18n.t('common.none'), value: -1 },
					{ name: i18n.t('slots.trinket_1', { ns: 'character' }), value: ItemSlot.ItemSlotTrinket1 },
					{ name: i18n.t('slots.trinket_2', { ns: 'character' }), value: ItemSlot.ItemSlotTrinket2 },
				],
				storeSubscribe: () => subscribeBulkChange(this),
				getValue: _modObj => {
					const frozenTrinket = this.frozenItems.get(BulkSimItemSlot.ItemSlotTrinket);

					if (!frozenTrinket) {
						return -1;
					}

					const currentGear: Gear = this.simUI.player.getGear();

					if (currentGear.getEquippedItem(ItemSlot.ItemSlotTrinket1)?.equals(frozenTrinket)) {
						return ItemSlot.ItemSlotTrinket1;
					} else if (currentGear.getEquippedItem(ItemSlot.ItemSlotTrinket2)?.equals(frozenTrinket)) {
						return ItemSlot.ItemSlotTrinket2;
					} else {
						this.setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, null);
						return -1;
					}
				},
				setValue: (eventID, _modObj, newValue) => {
					let newItem: EquippedItem | null = null;

					if (newValue != -1) {
						newItem = this.simUI.player.getGear().getEquippedItem(newValue);
					}

					this.setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, newItem, eventID);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: 'freeze_trinket_slot',
						value: newValue,
					});
				},
			});

		if (this.playerCanDualWield) {
			if (frozenWeaponDiv.value)
				new EnumPicker<BulkTab>(frozenWeaponDiv.value, this, {
					id: 'freeze-weapon',
					label: i18n.t('bulk_tab.settings.freeze_weapon.label'),
					labelTooltip: i18n.t('bulk_tab.settings.freeze_weapon.tooltip'),
					values: [
						{ name: i18n.t('common.none'), value: -1 },
						{ name: i18n.t('slots.main_hand', { ns: 'character' }), value: ItemSlot.ItemSlotMainHand },
						{ name: i18n.t('slots.off_hand', { ns: 'character' }), value: ItemSlot.ItemSlotOffHand },
					],
					storeSubscribe: () => subscribeBulkChange(this),
					getValue: _modObj => {
						if (!this.frozenWeaponSlot) {
							return -1;
						}

						return this.frozenWeaponSlot;
					},
					setValue: (eventID, _modObj, newValue) => {
						this.setFrozenWeaponSlot(newValue === -1 ? null : newValue);
						trackEvent({
							action: 'settings',
							category: 'batch_sim',
							label: 'freeze_weapon_slot',
							value: newValue,
						});
					},
				});

			if (mainHandWeaponTypesDiv.value) this.createFreezeWeaponTypePickers(mainHandWeaponTypesDiv.value, ItemSlot.ItemSlotMainHand);
			if (offHandWeaponTypesDiv.value) this.createFreezeWeaponTypePickers(offHandWeaponTypesDiv.value, ItemSlot.ItemSlotOffHand);
		}
	}

	private getCombinationsCount(): Element {
		this.bulkSimButton.disabled = this.combinations <= 1 || this.combinations > this.getCombinationsLimit();

		const warningRef = ref<HTMLButtonElement>();
		const rtn = (
			<>
				<span className={clsx(this.showIterationsWarning() && 'text-danger')}>
					{this.combinations === 1
						? i18n.t('bulk_tab.settings.combination_singular')
						: i18n.t('bulk_tab.settings.combinations_count', { amount: formatToNumber(this.combinations) })}
					<br />
					<small>
						{formatToNumber(this.iterations)} {i18n.t('bulk_tab.settings.iterations')}
					</small>
				</span>
				{this.showIterationsWarning() && (
					<button className="warning link-warning" ref={warningRef}>
						<i className="fas fa-exclamation-triangle fa-2x" />
					</button>
				)}
			</>
		);

		if (warningRef.value) {
			tippy(warningRef.value, {
				content: i18n.t('bulk_tab.warning.iterations_limit', { limit: formatToNumber(this.getIterationsLimit()) }),
				placement: 'left',
				popperOptions: {
					modifiers: [
						{
							name: 'flip',
							options: {
								fallbackPlacements: ['auto'],
							},
						},
					],
				},
			});
		}

		return rtn;
	}

	private getCombinationsLoading(): Element {
		this.bulkSimButton.disabled = true;
		return <div className="loader"></div>;
	}

	private showIterationsWarning(): boolean {
		return this.iterations > this.getIterationsLimit();
	}

	// The web/native limit for this host: the async isNative probe wins once resolved, with
	// the hostname heuristic as the pre-resolution fallback.
	private limitForHost(webLimit: number, nativeLimit: number): number {
		if (this.simUI.sim.isNative === undefined) {
			return isExternal() ? webLimit : nativeLimit;
		}

		return this.simUI.sim.isNative ? nativeLimit : webLimit;
	}

	private getIterationsLimit(): number {
		return this.limitForHost(WEB_ITERATIONS_LIMIT, NATIVE_ITERATIONS_LIMIT);
	}

	private getCombinationsLimit(): number {
		return this.limitForHost(WEB_COMBINATIONS_LIMIT, NATIVE_COMBINATIONS_LIMIT);
	}

	private setCandidateGearProgress({
		completed,
		total,
		title = i18n.t('bulk_tab.progress.building_candidate_gear_sets'),
		stage = 'preparing',
		startedAt,
	}: {
		completed?: number;
		total?: number;
		title?: string;
		stage?: string;
		startedAt?: number;
	} = {}) {
		const secondsRemaining =
			startedAt !== undefined && completed !== undefined && total !== undefined && completed > 0
				? ((new Date().getTime() - startedAt) / 1000 / completed) * Math.max(0, total - completed)
				: undefined;

		if (completed === undefined || total === undefined) {
			this.progressTrackerModal.updateProgress({
				stage,
				title,
				message: undefined,
			});
			return;
		}

		this.progressTrackerModal.updateProgress({
			stage,
			title,
			current: completed,
			total,
			message:
				secondsRemaining !== undefined ? (
					<div>{i18n.t('bulk_tab.progress.time_remaining', { time: formatDurationSeconds(secondsRemaining) })}</div>
				) : undefined,
		});
	}

	private setSimProgress(progress: ProgressMetrics, config: BulkSimProgressConfig) {
		const stageCurrentRound = config.stageCurrentRound ?? config.currentRound;
		const stageRounds = config.stageRounds ?? config.totalRounds;
		const isBaselineRound = stageCurrentRound === 1;
		const stage = progress.bulkStage == BulkSimStage.BulkSimStageReforge ? 'reforging' : 'sim';
		const totalElapsedSeconds = (new Date().getTime() - (config.aggregateStartedAt ?? this.simStart)) / 1000;
		const completedIterations = config.aggregateCompletedIterations ?? progress.completedIterations;
		const totalIterations = config.aggregateTotalIterations ?? progress.totalIterations;
		const completedRoundsFromIterations = Math.max(
			0,
			config.aggregateTotalIterations && config.aggregateTotalIterations > 0
				? (completedIterations / config.aggregateTotalIterations) * stageRounds
				: stageCurrentRound - 1 + (progress.totalIterations > 0 ? progress.completedIterations / progress.totalIterations : 0),
		);
		const completedSimsFromIterations =
			config.useSimCountProgress && progress.totalSims > 0 && progress.totalIterations > 0
				? (progress.completedIterations / progress.totalIterations) * progress.totalSims
				: 0;
		const completedRounds =
			config.useSimCountProgress && progress.totalSims > 0
				? Math.max(progress.completedSims, completedSimsFromIterations)
				: completedRoundsFromIterations;
		const totalRounds = config.useSimCountProgress && progress.totalSims > 0 ? progress.totalSims : stageRounds;
		const secondsRemaining = completedRounds > 0 ? (totalElapsedSeconds / completedRounds) * Math.max(0, totalRounds - completedRounds) : 0;

		if (isNaN(Number(secondsRemaining))) return;

		this.progressTrackerModal.updateProgress({
			stage,
			title: config.title ?? (isBaselineRound ? i18n.t('bulk_tab.progress.baseline_round') : i18n.t('bulk_tab.progress.refining_rounds')),
			current: completedRounds,
			total: totalRounds,
			message: (
				<div className="results-sim">
					<div
						innerHTML={i18n.t('bulk_tab.progress.iterations_complete', {
							completed: completedIterations,
							total: totalIterations,
						})}
					/>
					<div>{i18n.t('bulk_tab.progress.time_remaining', { time: formatDurationSeconds(secondsRemaining) })}</div>
				</div>
			),
		});
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

		this.simUI.reforger.setIncludeGems(nextEventID(), true);
		this.simUI.reforger.setIncludeEOTBPGemSocket(nextEventID(), playerPhase);
		this.updateRelativeStatCapReforges();
		return this.simUI.reforger.getReforgeOptimizeConfig(this.originalGear);
	}

	private async runBatchSim() {
		if (this.isRunning) return;

		this.progressTrackerModal.show();

		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'batch_start',
			value: this.combinations,
		});

		this.isRunning = true;
		this.isCancelling = false;
		this.bulkSimStartedAt = new Date().getTime();
		const usesWasmConcurrency = await this.simUI.sim.shouldUseWasmConcurrency();
		await this.simUI.sim.waitForInit();
		const useNativeBulkSim = this.simUI.sim.isNative ?? false;
		const concurrency = usesWasmConcurrency ? this.simUI.sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		this.bulkSimAbortController = new AbortController();
		this.bulkSimAbortPromise = null;
		const abortSignal = this.bulkSimAbortController.signal;
		this.bulkSimButton.disabled = true;
		this.topGearResults = null;
		this.originalGearResults = null;

		const playerPhase = this.simUI.sim.getPhase() >= 2;
		const backendBulkSettings = useNativeBulkSim ? this.createBulkSettings() : undefined;
		let candidateGearSets: Gear[] = [];
		let runError: unknown = null;
		const batchCompleteMetrics: Record<string, string | number> = {
			is_native: useNativeBulkSim ? 1 : 0,
			concurrency,
		};

		try {
			await this.simUI.sim.signalManager.abortType(RequestTypes.RaidSim);
			this.simStart = new Date().getTime();
			this.originalGear = this.simUI.player.getGear();

			this.resetResultsTabContent();
			this.setCandidateGearProgress();
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
				this.combinations = bulkCandidatesResult.combinations;
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

			this.buildResultsTabContent();
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
				new Toast({
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
			await this.simUI.player.setGearAsync(nextEventID(), this.originalGear!);
			this.bulkSimButton.disabled = false;
			if (wasCancelling) {
				new Toast({
					variant: 'error',
					body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
				});
			}
			this.isRunning = false;
			this.isCancelling = false;
			this.progressTrackerModal.hide();
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
			const abortTasks: Promise<unknown>[] = [this.simUI.sim.signalManager.abortType(RequestTypes.All)];
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
