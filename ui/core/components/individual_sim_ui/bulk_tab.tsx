import { Tab } from 'bootstrap';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { REPO_RELEASES_URL } from '../../constants/other';
import { IndividualSimUI } from '../../individual_sim_ui';
import i18n from '../../../i18n/config';
import { BulkRequiredSetBonus, BulkSettings, BulkSimStage, DistributionMetrics, ProgressMetrics } from '../../proto/api';
import { Class, HandType, ItemRandomSuffix, ItemSlot, ItemSpec, RangedWeaponType, ReforgeStat, Spec, WeaponType } from '../../proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '../../proto/db';
import { UIEnchant, UIGem, UIItem } from '../../proto/ui';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { Gear } from '../../proto_utils/gear';
import { canEquipItem, getEligibleItemSlots, isSecondaryItemSlot } from '../../proto_utils/utils';
import { RequestTypes } from '../../sim_signal_manager';
import { RelativeStatCap } from '../suggest_reforges_action';
import { TypedEvent } from '../../typed_event';
import { formatDurationSeconds, getEnumValues, isDevMode, isExternal, sleep } from '../../utils';
import SelectorModal from '../gear_picker/selector_modal';
import { SimTab } from '../sim_tab';
import Toast from '../toast';
import BulkItemPickerGroup from './bulk/bulk_item_picker_group';
import BulkItemSearch from './bulk/bulk_item_search';
import BulkSimResultRenderer from './bulk/bulk_sim_results_renderer';
import { runCoreBulkSim as runCoreBulkSimImpl } from './bulk/core_sim';
import {
	binomialCoefficient,
	BulkSimItemSlot,
	bulkSimItemSlotToSingleItemSlot,
	bulkSimItemSlotToItemSlotPairs,
	dedupeGearSets,
	getAllPairs,
	getBulkItemSlotFromSlot,
	getDurationSeconds,
	getGearKey,
	getOptimisationStageMinIterations,
	getOptimisationTotalSimRounds,
	shouldRunOptimisationStage,
} from './bulk/utils';
import {
	BULK_OPTIMISATION_MIN_COMBINATIONS,
	BulkSimProgressConfig,
	LOCAL_COMBINATIONS_LIMIT,
	LOCAL_ITERATIONS_LIMIT,
	STAGE_CONFIG,
	TopGearResult,
	WEB_COMBINATIONS_LIMIT,
	WEB_DEFAULT_ITERATIONS,
	WEB_ITERATIONS_LIMIT,
} from './bulk/types';
import { BulkGearJsonImporter } from './importers';
import { BooleanPicker } from '../pickers/boolean_picker';
import { trackEvent } from '../../../tracking/utils';
import { EnumPicker } from '../pickers/enum_picker';
import { translateBulkSlotName, translateWeaponType } from '../../../i18n/localization';
import { ProgressTrackerModal } from '../progress_tracker_modal';
import { ReforgeOptimizeConfig } from '../../sim';

type BulkSetBonusOption = {
	setId: number;
	setName: string;
	totalPieces: number;
};

type RequiredSetBonusComboMatcher = {
	signature: string;
	baseCounts: number[];
	requiredPieces: number[];
	dimensions: Array<{ optionDeltas: number[][] }>;
};

type ComboSlotSelection = [ItemSlot, EquippedItem | null];
type ComboDimension = {
	options: ComboSlotSelection[][];
};
type PreparedComboSelection = [ItemSlot, EquippedItem];
type PreparedComboDimension = {
	options: PreparedComboSelection[][];
};

export class BulkTab extends SimTab {
	readonly simUI: IndividualSimUI<any>;
	readonly playerCanDualWield: boolean;
	readonly playerIsFuryWarrior: boolean;

	readonly itemsChangedEmitter = new TypedEvent<void>();
	readonly settingsChangedEmitter = new TypedEvent<void>();

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
	protected bulkSimUsesWasmConcurrency = false;
	protected rawCombinations = 0;
	protected requiredSetBonusCombinationCount: { signature: string; count: number; matches: Uint8Array } | null = null;

	inheritUpgrades: boolean;
	useOptimisationRounds: boolean;
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

	constructor(parentElem: HTMLElement, simUI: IndividualSimUI<any>) {
		super(parentElem, simUI, { identifier: 'bulk-tab', title: i18n.t('bulk_tab.title') });

		this.simUI = simUI;
		this.playerCanDualWield = this.simUI.player.getPlayerSpec().canDualWield && this.simUI.player.getClass() !== Class.ClassHunter;
		this.playerIsFuryWarrior = this.simUI.player.getSpec() === Spec.SpecFuryWarrior;

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

		this.inheritUpgrades = true;
		this.useOptimisationRounds = false;

		this.buildTabContent();

		this.simUI.sim.waitForInit().then(() => {
			this.loadSettings();
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

					getEligibleItemSlots(equippedItem.item, this.playerIsFuryWarrior).forEach(slot => {
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

				this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
			};
			const updateCombinationsCount = () => {
				this.combinationsElem.replaceChildren(this.getCombinationsCount());
			};

			TypedEvent.onAny([this.simUI.player.challengeModeChangeEmitter, this.simUI.player.gearChangeEmitter]).on(() => loadEquippedItems());
			TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]).on(() => this.storeSettings());
			TypedEvent.onAny([this.itemsChangedEmitter, this.settingsChangedEmitter, this.simUI.sim.iterationsChangeEmitter]).on(() =>
				updateCombinationsCount(),
			);

			loadEquippedItems();
			updateCombinationsCount();
		});
	}

	private getSettingsKey(): string {
		return this.simUI.getStorageKey('bulk-settings.v1');
	}

	private loadSettings() {
		const storedSettings = window.localStorage.getItem(this.getSettingsKey());
		if (storedSettings != null) {
			let settings: BulkSettings;
			try {
				settings = BulkSettings.fromJsonString(storedSettings, {
					ignoreUnknownFields: true,
				});
			} catch {
				settings = BulkSettings.create();
			}

			this.addItems(settings.items, true);
			this.setInheritUpgrades(settings.inheritUpgrades);
			this.setUseOptimisationRounds(settings.useOptimisationRounds);
			this.setFrozenItem(BulkSimItemSlot.ItemSlotFinger, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotFinger, settings.freezeRingSlot));
			this.setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotTrinket, settings.freezeTrinketSlot));
			this.setFrozenWeaponSlot(settings.freezeWeaponSlot);
			this.setWeaponTypeFilter(ItemSlot.ItemSlotMainHand, settings.freezeMainhandWeaponSlots);
			this.setWeaponTypeFilter(ItemSlot.ItemSlotOffHand, settings.freezeOffhandWeaponSlots);
			this.setRequiredSetBonuses(settings.requiredSetBonuses);
		}
	}

	private storeSettings() {
		const settings = this.createBulkSettings();
		const setStr = BulkSettings.toJsonString(settings, { enumAsInteger: true });
		window.localStorage.setItem(this.getSettingsKey(), setStr);
	}

	protected createBulkSettings(): BulkSettings {
		return BulkSettings.create({
			items: this.getItems(),
			inheritUpgrades: this.inheritUpgrades,
			useOptimisationRounds: this.useOptimisationRounds,
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
		if (isExternal()) return WEB_DEFAULT_ITERATIONS;

		return this.simUI.sim.getIterations();
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
				getEligibleItemSlots(equippedItem.item, this.playerIsFuryWarrior).forEach(slot => {
					// Avoid duplicating rings/trinkets/weapons
					if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

					const idx = this.items.push(item) - 1;
					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					const group = this.pickerGroups.get(bulkSlot)!;
					group.add(idx, equippedItem, silent);
				});
			}
		});

		this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
	}
	// Add an item to a particular bulk sim item slot
	addItemToSlot(item: ItemSpec, bulkSlot: BulkSimItemSlot) {
		const equippedItem = this.simUI.sim.db.lookupItemSpec(item)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats();
		if (equippedItem) {
			const eligibleItemSlots = getEligibleItemSlots(equippedItem.item, this.playerIsFuryWarrior);
			if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), eligibleItemSlots[0])) return;

			const idx = this.items.push(item) - 1;
			const group = this.pickerGroups.get(bulkSlot)!;
			group.add(idx, equippedItem);
			this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
		}
	}

	updateItem(idx: number, newItem: ItemSpec) {
		const equippedItem = this.simUI.sim.db.lookupItemSpec(newItem)?.withChallengeMode(this.simUI.player.getChallengeModeEnabled()).withDynamicStats();
		if (equippedItem) {
			this.items[idx] = newItem;

			getEligibleItemSlots(equippedItem.item, this.playerIsFuryWarrior).forEach(slot => {
				// Avoid duplicating rings/trinkets/weapons
				if (this.isSecondaryItemSlot(slot) || !canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;

				const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
				const group = this.pickerGroups.get(bulkSlot)!;
				group.update(idx, equippedItem);
			});
		}

		this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
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
			getEligibleItemSlots(equippedItem.item, this.playerIsFuryWarrior).forEach(slot => {
				if (!canEquipItem(equippedItem.item, this.simUI.player.getPlayerSpec(), slot)) return;
				const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
				const group = this.pickerGroups.get(bulkSlot)!;

				if (group.has(idx)) {
					group.remove(idx, silent);
				}
			});
			this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
		}
	}

	clearItems() {
		for (let idx = 0; idx < this.items.length; idx++) {
			this.removeItemByIndex(idx, true);
		}
		this.items = new Array<ItemSpec>();
		this.itemsChangedEmitter.emit(TypedEvent.nextEventID());
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

		return Array.from(setBonuses.values())
			.map(setBonus => ({
				setId: setBonus.setId,
				setName: setBonus.setName,
				totalPieces: setBonus.itemIds.size,
			}))
			.filter(setBonus => setBonus.setName && setBonus.totalPieces >= 2)
			.sort((a, b) => a.setName.localeCompare(b.setName) || a.setId - b.setId);
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

	private getRequiredSetBonusFilters(): BulkRequiredSetBonus[] {
		return this.getRequiredSetBonusesForSettings();
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

	private getRequiredSetBonusComboMatcher(requiredSetBonuses: BulkRequiredSetBonus[]): RequiredSetBonusComboMatcher | null {
		if (!requiredSetBonuses.length) return null;

		const requiredSetBonusIndexes = new Map<number, number>();
		requiredSetBonuses.forEach((requiredSetBonus, index) => {
			requiredSetBonusIndexes.set(requiredSetBonus.setId, index);
		});

		const baseGear = this.originalGear ?? this.simUI.player.getGear();
		const baseCounts = new Array<number>(requiredSetBonuses.length).fill(0);
		baseGear.getEquippedItems().forEach(equippedItem => this.addItemToRequiredSetBonusCounts(baseCounts, requiredSetBonusIndexes, equippedItem, 1));

		const dimensions: RequiredSetBonusComboMatcher['dimensions'] = [];
		const weaponPairs = this.getAllWeaponCombos();
		if (weaponPairs.length) {
			dimensions.push({
				optionDeltas: weaponPairs.map(([mainHand, offHand]) =>
					this.getRequiredSetBonusOptionDeltas(baseGear, requiredSetBonusIndexes, [
						[ItemSlot.ItemSlotMainHand, mainHand],
						[ItemSlot.ItemSlotOffHand, offHand],
					]),
				),
			});
		}

		for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
			if (
				pickerGroup.pickers.size == 0 ||
				[BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotHandWeapon].includes(bulkItemSlot)
			) {
				continue;
			}

			const optionsForSlot: EquippedItem[] = Array.from(pickerGroup.pickers.values()).map(picker => picker.item);
			if ([BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].includes(bulkItemSlot)) {
				let pairsForSlot = getAllPairs(optionsForSlot);
				const frozenItem = this.frozenItems.get(bulkItemSlot);

				if (frozenItem) {
					pairsForSlot = optionsForSlot.filter(option => !frozenItem.equals(option)).map(option => [frozenItem, option]);
				}

				const slotsToUse = bulkSimItemSlotToItemSlotPairs.get(bulkItemSlot)!;
				dimensions.push({
					optionDeltas: pairsForSlot.map(pair =>
						this.getRequiredSetBonusOptionDeltas(baseGear, requiredSetBonusIndexes, [
							[slotsToUse[0], pair[0]],
							[slotsToUse[1], pair[1]],
						]),
					),
				});
			} else {
				const slotToUse = bulkSimItemSlotToSingleItemSlot.get(bulkItemSlot)!;
				dimensions.push({
					optionDeltas: optionsForSlot.map(option => this.getRequiredSetBonusOptionDeltas(baseGear, requiredSetBonusIndexes, [[slotToUse, option]])),
				});
			}
		}

		const requiredPieces = requiredSetBonuses.map(requiredSetBonus => requiredSetBonus.pieces);
		return {
			signature: [
				baseCounts.join(','),
				requiredPieces.join(','),
				dimensions.map(dimension => dimension.optionDeltas.map(deltas => deltas.join(',')).join(';')).join('|'),
			].join('/'),
			baseCounts,
			requiredPieces,
			dimensions,
		};
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

	private comboMatchesRequiredSetBonusMatcher(comboIdx: number, matcher: RequiredSetBonusComboMatcher | null): boolean {
		if (!matcher) return true;

		const counts = matcher.baseCounts.slice();
		for (const dimension of matcher.dimensions) {
			const optionDeltas = dimension.optionDeltas;
			if (!optionDeltas.length) return false;

			const optionIdx = comboIdx % optionDeltas.length;
			comboIdx = Math.floor(comboIdx / optionDeltas.length);
			const deltas = optionDeltas[optionIdx];
			for (let i = 0; i < deltas.length; i++) {
				counts[i] += deltas[i];
			}
		}

		return counts.every((count, index) => count >= matcher.requiredPieces[index]);
	}

	protected getAllWeaponCombos(): [EquippedItem | null, EquippedItem | null][] {
		const allWeaponCombos: [EquippedItem | null, EquippedItem | null][] = [];

		// First find any configured 2H weapons.
		let all2HWeapons: EquippedItem[] = [];

		for (const bulkItemSlot of [BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotHandWeapon]) {
			if (!this.pickerGroups.has(bulkItemSlot)) {
				continue;
			}

			const pickerGroup = this.pickerGroups.get(bulkItemSlot)!;
			const allItemOptions: EquippedItem[] = Array.from(pickerGroup.pickers.values()).map(picker => picker.item);
			all2HWeapons = all2HWeapons.concat(
				allItemOptions.filter(
					equippedItem =>
						![RangedWeaponType.RangedWeaponTypeUnknown, RangedWeaponType.RangedWeaponTypeWand].includes(equippedItem.item.rangedWeaponType) ||
						equippedItem.item.handType == HandType.HandTypeTwoHand,
				),
			);
		}

		if (this.playerIsFuryWarrior) {
			for (let i = 0; i < all2HWeapons.length; i++) {
				if (all2HWeapons.slice(0, i).some((item: EquippedItem) => item.equals(all2HWeapons[i], true, true, true, this.inheritUpgrades))) {
					continue;
				}
				allWeaponCombos.push([all2HWeapons[i], null]);
				for (let j = i + 1; j < all2HWeapons.length; j++) {
					if (all2HWeapons.slice(i + 1, j).some((item: EquippedItem) => item.equals(all2HWeapons[j], true, true, true, this.inheritUpgrades))) {
						continue;
					}
					allWeaponCombos.push([all2HWeapons[i], all2HWeapons[j]]);
					if (!all2HWeapons[i].equals(all2HWeapons[j], true, true, true, this.inheritUpgrades)) {
						allWeaponCombos.push([all2HWeapons[j], all2HWeapons[i]]);
					}
				}
			}
		} else {
			for (const twoHandWeapon of all2HWeapons) {
				allWeaponCombos.push([twoHandWeapon, null]);
			}
		}

		// Then loop through all pairs of MH and OH items.
		const mhGroup = this.pickerGroups.get(BulkSimItemSlot.ItemSlotMainHand);
		const ohGroup = this.pickerGroups.get(BulkSimItemSlot.ItemSlotOffHand);

		if (mhGroup?.pickers.size) {
			for (const mhItem of Array.from(mhGroup.pickers.values()).map(picker => picker.item)) {
				if (all2HWeapons.includes(mhItem)) {
					continue;
				}

				if (ohGroup?.pickers.size) {
					for (const ohItem of Array.from(ohGroup.pickers.values()).map(picker => picker.item)) {
						allWeaponCombos.push([mhItem, ohItem]);
					}
				} else {
					allWeaponCombos.push([mhItem, null]);
				}
			}
		} else if (ohGroup?.pickers.size) {
			for (const ohItem of Array.from(ohGroup.pickers.values()).map(picker => picker.item)) {
				allWeaponCombos.push([null, ohItem]);
			}
		}

		// Finally loop through all one-hand weapons. Double count these since they can go in either slot.
		const oneHandGroup = this.pickerGroups.get(BulkSimItemSlot.ItemSlotHandWeapon);

		if (oneHandGroup?.pickers.size) {
			const allOneHandWeapons: EquippedItem[] = Array.from(oneHandGroup.pickers.values())
				.map(picker => picker.item)
				.filter(item => !all2HWeapons.includes(item));

			for (let i = 0; i < allOneHandWeapons.length; i++) {
				if (allOneHandWeapons.slice(0, i).some((item: EquippedItem) => item.equals(allOneHandWeapons[i], true, true, true, this.inheritUpgrades))) {
					continue;
				}

				const hasDuplicate = allOneHandWeapons
					.slice(i + 1)
					.some((item: EquippedItem) => item.equals(allOneHandWeapons[i], true, true, true, this.inheritUpgrades));
				if (!allOneHandWeapons[i].item.unique && !hasDuplicate) {
					allWeaponCombos.push([allOneHandWeapons[i], allOneHandWeapons[i]]);
				}

				for (let j = i + 1; j < allOneHandWeapons.length; j++) {
					if (
						allOneHandWeapons
							.slice(i + 1, j)
							.some((item: EquippedItem) => item.equals(allOneHandWeapons[j], true, true, true, this.inheritUpgrades))
					) {
						continue;
					}

					allWeaponCombos.push([allOneHandWeapons[i], allOneHandWeapons[j]]);

					if (!allOneHandWeapons[i].equals(allOneHandWeapons[j], true, true, true, this.inheritUpgrades)) {
						allWeaponCombos.push([allOneHandWeapons[j], allOneHandWeapons[i]]);
					}
				}
			}
		}

		return allWeaponCombos.filter(([mhItem, ohItem]) => this.weaponComboMatchesSettings(mhItem, ohItem));
	}

	private buildComboDimensions(): ComboDimension[] {
		const dimensions: ComboDimension[] = [];
		const weaponPairs = this.getAllWeaponCombos();
		if (weaponPairs.length > 0) {
			dimensions.push({
				options: weaponPairs.map(([mainHand, offHand]) => [
					[ItemSlot.ItemSlotMainHand, mainHand],
					[ItemSlot.ItemSlotOffHand, offHand],
				]),
			});
		}

		for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
			if (
				pickerGroup.pickers.size == 0 ||
				[BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotHandWeapon].includes(bulkItemSlot)
			) {
				continue;
			}

			const optionsForSlot: EquippedItem[] = Array.from(pickerGroup.pickers.values()).map(picker => picker.item);
			if ([BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].includes(bulkItemSlot)) {
				if (optionsForSlot.length < 2) {
					throw `At least 2 items must be selected for ${translateBulkSlotName(bulkItemSlot)}`;
				}

				let pairsForSlot = getAllPairs(optionsForSlot);
				const frozenItem = this.frozenItems.get(bulkItemSlot);
				if (frozenItem) {
					pairsForSlot = optionsForSlot.filter(option => !frozenItem.equals(option)).map(option => [frozenItem, option]);
				}

				const slotsToUse = bulkSimItemSlotToItemSlotPairs.get(bulkItemSlot)!;
				dimensions.push({
					options: pairsForSlot.map(pair => [
						[slotsToUse[0], pair[0]],
						[slotsToUse[1], pair[1]],
					]),
				});
			} else {
				const slotToUse = bulkSimItemSlotToSingleItemSlot.get(bulkItemSlot)!;
				dimensions.push({
					options: optionsForSlot.map(option => [[slotToUse, option]]),
				});
			}
		}

		return dimensions;
	}

	private getComboSlotSelections(comboIdx: number, comboDimensions: ComboDimension[]): ComboSlotSelection[] {
		const selections: ComboSlotSelection[] = [];
		for (const dimension of comboDimensions) {
			if (!dimension.options.length) {
				return [];
			}

			const optionIdx = comboIdx % dimension.options.length;
			comboIdx = Math.floor(comboIdx / dimension.options.length);
			selections.push(...dimension.options[optionIdx]);
		}

		return selections;
	}

	private buildPreparedComboDimensions(comboDimensions: ComboDimension[], originalGear: Gear, challengeModeEnabled: boolean): PreparedComboDimension[] {
		// Precompute per-option item transformations once
		// so the hot combo loop only applies prepared items.
		return comboDimensions.map(dimension => ({
			options: dimension.options.map(optionSelections => {
				const preparedSelections: PreparedComboSelection[] = [];
				for (const [itemSlot, equippedItem] of optionSelections) {
					if (!equippedItem) {
						continue;
					}

					const equippedItemInSlot = originalGear.getEquippedItem(itemSlot);
					let updatedItem = equippedItemInSlot
						? equippedItemInSlot.withItem(equippedItem.item)
						: equippedItem.withChallengeMode(challengeModeEnabled);
					if (equippedItem._randomSuffix) {
						updatedItem = updatedItem.withRandomSuffix(equippedItem._randomSuffix);
					}
					if (!this.inheritUpgrades) {
						updatedItem = updatedItem.withUpgrade(equippedItem._upgrade);
					}

					preparedSelections.push([itemSlot, updatedItem]);
				}

				return preparedSelections;
			}),
		}));
	}

	protected getItemsForCombo(comboIdx: number): Map<ItemSlot, EquippedItem> {
		const itemsForCombo = new Map<ItemSlot, EquippedItem>();

		for (const [itemSlot, equippedItem] of this.getComboSlotSelections(comboIdx, this.buildComboDimensions())) {
			if (equippedItem) {
				itemsForCombo.set(itemSlot, equippedItem);
			}
		}

		return itemsForCombo;
	}

	private getFrozenWeaponItem(): EquippedItem | undefined {
		if (!this.frozenWeaponSlot) {
			return undefined;
		}

		return this.simUI.player.getGear().getEquippedItem(this.frozenWeaponSlot) || undefined;
	}

	private matchesWeaponTypeFilter(equippedItem: EquippedItem | null, slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): boolean {
		const filter = this.weaponTypeFilters.get(slot)!;
		if (filter.length === 0) {
			return true;
		}

		if (!equippedItem) {
			return false;
		}

		return equippedItem.item.weaponType > WeaponType.WeaponTypeUnknown && filter.includes(equippedItem.item.weaponType);
	}

	private weaponComboMatchesSettings(mhItem: EquippedItem | null, ohItem: EquippedItem | null): boolean {
		const frozenWeaponItem = this.getFrozenWeaponItem();

		if (this.frozenWeaponSlot === ItemSlot.ItemSlotMainHand && frozenWeaponItem && !mhItem?.equals(frozenWeaponItem)) {
			return false;
		}
		if (this.frozenWeaponSlot === ItemSlot.ItemSlotOffHand && frozenWeaponItem && !ohItem?.equals(frozenWeaponItem)) {
			return false;
		}

		return this.matchesWeaponTypeFilter(mhItem, ItemSlot.ItemSlotMainHand) && this.matchesWeaponTypeFilter(ohItem, ItemSlot.ItemSlotOffHand);
	}

	protected createBulkItemsDatabase(): SimDatabase {
		const itemsDb = SimDatabase.create();
		for (const is of this.items.values()) {
			if (!is) continue;

			const item = this.simUI.sim.db.lookupItemSpec(is);
			if (!item) {
				throw new Error(`item with ID ${is.id} not found in database`);
			}
			itemsDb.items.push(SimItem.fromJson(UIItem.toJson(item.item), { ignoreUnknownFields: true }));

			const ieRpp = this.simUI.sim.db.getItemEffectRandPropPoints(item.ilvl);
			if (ieRpp) {
				itemsDb.itemEffectRandPropPoints.push(ItemEffectRandPropPoints.create(this.simUI.sim.db.getItemEffectRandPropPoints(item.ilvl)));
			}

			if (item.enchant) {
				itemsDb.enchants.push(
					SimEnchant.fromJson(UIEnchant.toJson(item.enchant), {
						ignoreUnknownFields: true,
					}),
				);
			}
			if (item.randomSuffix) {
				itemsDb.randomSuffixes.push(
					ItemRandomSuffix.fromJson(ItemRandomSuffix.toJson(item.randomSuffix), {
						ignoreUnknownFields: true,
					}),
				);
			}
			if (item.reforge) {
				itemsDb.reforgeStats.push(
					ReforgeStat.fromJson(ReforgeStat.toJson(item.reforge), {
						ignoreUnknownFields: true,
					}),
				);
			}
			for (const gem of item.gems) {
				if (gem) {
					itemsDb.gems.push(SimGem.fromJson(UIGem.toJson(gem), { ignoreUnknownFields: true }));
				}
			}
		}
		return itemsDb;
	}

	protected calculateBulkCombinations() {
		try {
			const rawCombinations = this.getRawCombinationsCount();
			this.rawCombinations = rawCombinations;
			const requiredSetBonuses = this.getRequiredSetBonusFilters();
			if (requiredSetBonuses.length) {
				const requiredSetBonusMatcher = this.getRequiredSetBonusComboMatcher(requiredSetBonuses);
				const requiredSetBonusCountSignature = this.getRequiredSetBonusCombinationCountSignature(
					rawCombinations,
					requiredSetBonuses,
					requiredSetBonusMatcher,
				);
				if (this.requiredSetBonusCombinationCount?.signature !== requiredSetBonusCountSignature) {
					this.requiredSetBonusCombinationCount = this.getRequiredSetBonusCombinationCount(
						rawCombinations,
						requiredSetBonusMatcher,
						requiredSetBonusCountSignature,
					);
				}
				this.combinations = this.requiredSetBonusCombinationCount?.count ?? rawCombinations;
			} else {
				this.requiredSetBonusCombinationCount = null;
				this.combinations = rawCombinations;
			}

			const optimisationIterationUpperBound = this.getOptimisationRoundsIterationUpperBound(this.combinations);
			if (this.shouldUseOptimisationRounds(this.combinations, optimisationIterationUpperBound)) {
				this.iterations = this.getOptimisationRoundsIterationEstimate(this.combinations);
			} else {
				this.iterations = this.simUI.sim.getIterations() * this.combinations;
			}
		} catch (e) {
			this.simUI.handleCrash(e);
		}
	}

	private getRawCombinationsCount(): number {
		let rawCombinations = this.getAllWeaponCombos().length;

		for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
			if ([BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotHandWeapon].includes(bulkItemSlot)) {
				continue;
			}

			const numOptions = pickerGroup.pickers.size;

			if (numOptions > 1 && [BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].includes(bulkItemSlot)) {
				if (this.frozenItems.get(bulkItemSlot)) {
					rawCombinations *= numOptions - 1;
				} else {
					rawCombinations *= binomialCoefficient(numOptions, 2);
				}
			} else {
				rawCombinations *= Math.max(numOptions, 1);
			}
		}

		return rawCombinations;
	}

	private hasMatchingRequiredSetBonusCombination(requiredSetBonuses: BulkRequiredSetBonus[]): boolean {
		const matcher = this.getRequiredSetBonusComboMatcher(requiredSetBonuses);
		if (!matcher) return true;

		const rawCombinations = this.getRawCombinationsCount();
		for (let comboIdx = 0; comboIdx < rawCombinations; comboIdx++) {
			if (this.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher)) return true;
		}

		return false;
	}

	private canSatisfyRequiredSetBonus(setId: number, pieces: number): boolean {
		const requiredSetBonuses = Array.from(this.requiredSetBonuses.values()).filter(requiredSetBonus => requiredSetBonus.setId !== setId);
		requiredSetBonuses.push(BulkRequiredSetBonus.create({ setId, pieces }));
		return this.hasMatchingRequiredSetBonusCombination(requiredSetBonuses);
	}

	private getRequiredSetBonusCombinationCountSignature(
		rawCombinations: number,
		requiredSetBonuses: BulkRequiredSetBonus[],
		matcher: RequiredSetBonusComboMatcher | null,
	): string {
		return [
			rawCombinations,
			requiredSetBonuses.map(requiredSetBonus => `${requiredSetBonus.setId}:${requiredSetBonus.pieces}`).join('|'),
			matcher?.signature ?? '',
		].join('/');
	}

	private getRequiredSetBonusCombinationCount(
		rawCombinations: number,
		matcher: RequiredSetBonusComboMatcher | null,
		signature: string,
	): { signature: string; count: number; matches: Uint8Array } | null {
		if (!matcher) return null;

		let matchingCombinations = 0;
		const matches = new Uint8Array(rawCombinations);
		for (let comboIdx = 0; comboIdx < rawCombinations; comboIdx++) {
			if (this.comboMatchesRequiredSetBonusMatcher(comboIdx, matcher)) {
				matches[comboIdx] = 1;
				matchingCombinations++;
			}
		}

		return { signature, count: matchingCombinations, matches };
	}

	private shouldUseOptimisationRounds(numCombinations: number, optimisationIterationUpperBound?: number): boolean {
		const isOptimisationEligible = this.useOptimisationRounds && numCombinations >= BULK_OPTIMISATION_MIN_COMBINATIONS;
		const fullRunIterations = this.simUI.sim.getIterations() * numCombinations;
		const estimatedOptimisationIterationsUpperBound = optimisationIterationUpperBound ?? this.getOptimisationRoundsIterationUpperBound(numCombinations);
		const shouldUseOptimisationRounds = isOptimisationEligible && estimatedOptimisationIterationsUpperBound < fullRunIterations;
		this.debugOptimisationRound('optimisation round check', {
			numCombinations,
			minCombinations: BULK_OPTIMISATION_MIN_COMBINATIONS,
			useOptimisationRoundsSetting: this.useOptimisationRounds,
			fullRunIterations,
			estimatedOptimisationIterationsUpperBound,
			isOptimisationEligible,
			shouldUseOptimisationRounds,
		});
		return shouldUseOptimisationRounds;
	}

	private getOptimisationRoundsIterationUpperBound(numCombinations: number): number {
		let candidates = numCombinations;
		let iterations = 0;

		for (const stage of ['low', 'medium'] as const) {
			if (this.shouldRunOptimisationStage(stage, candidates)) {
				iterations += this.getOptimisationStageMinIterations(stage) * (candidates + 1);
				candidates = Math.min(candidates, STAGE_CONFIG[stage].maxSurvivors!);
			}
		}

		return iterations + this.getOptimisationStageMinIterations('high') * (candidates + 1);
	}

	private getOptimisationRoundsIterationEstimate(numCombinations: number): number {
		let candidates = numCombinations;
		let iterations = 0;

		for (const stage of ['low', 'medium'] as const) {
			if (this.shouldRunOptimisationStage(stage, candidates)) {
				iterations += this.getOptimisationStageMinIterations(stage) * (candidates + 1);
				candidates = Math.min(candidates, STAGE_CONFIG[stage].minSurvivors ?? STAGE_CONFIG[stage].maxSurvivors!);
			}
		}

		return iterations + this.getOptimisationStageMinIterations('high') * (candidates + 1);
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
		this.setupTabElem.appendChild(
			<>
				{/* // TODO: Remove once we're more comfortable with the state of Batch sim */}
				<p className="mb-0" innerHTML={i18n.t('bulk_tab.description')} />
				{isExternal() && (
					<p className="mb-0">
						<a href={REPO_RELEASES_URL} target="_blank">
							<i className="fas fa-gauge-high me-1" />
							{i18n.t('bulk_tab.download_local')}
						</a>
					</p>
				)}
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
	}

	private buildResultsTabContent() {
		if (!this.topGearResults || !this.originalGearResults) {
			return;
		}

		for (const topGearResult of this.topGearResults) {
			new BulkSimResultRenderer(this.resultsTabElem, this.simUI, topGearResult, this.originalGearResults);
		}

		this.resultsTab.show();
	}

	// Return whether or not the slot is considered secondary and the item should be grouped
	// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
	private isSecondaryItemSlot(slot: ItemSlot) {
		return isSecondaryItemSlot(slot) || (this.playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);
	}

	private setInheritUpgrades(newValue: boolean) {
		this.inheritUpgrades = newValue;
		this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
	}

	private createFreezeWeaponTypePickers(container: HTMLElement, slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand) {
		const weaponTypes = Array.from(
			new Set(
				this.simUI.player
					.getPlayerClass()
					.weaponTypes.filter(
						eligibleWeaponType =>
							slot === ItemSlot.ItemSlotMainHand ||
							(this.playerCanDualWield && ![WeaponType.WeaponTypePolearm, WeaponType.WeaponTypeStaff].includes(eligibleWeaponType.weaponType)),
					)
					.map(eligibleWeaponType => eligibleWeaponType.weaponType),
			),
		);

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
		const visibilityChange = this.settingsChangedEmitter.on(updateVisibility);
		this.addOnDisposeCallback(() => visibilityChange.dispose());

		weaponTypes.forEach(weaponType => {
			new BooleanPicker<BulkTab>(freezeWeaponTypeListRef.value!, this, {
				id: `bulk-${slot}-weapon-type-${weaponType}`,
				label: translateWeaponType(weaponType),
				inline: true,
				changedEvent: _modObj => this.settingsChangedEmitter,
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

	private setFrozenItem(
		bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket,
		item: EquippedItem | null,
		eventID = TypedEvent.nextEventID(),
	) {
		if (item === this.frozenItems.get(bulkSlot)) {
			return;
		}

		this.frozenItems.set(bulkSlot, item);
		this.settingsChangedEmitter.emit(eventID);
	}

	private getEquippedItemForFrozenSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket, itemSlot: number): EquippedItem | null {
		const slots = bulkSimItemSlotToItemSlotPairs.get(bulkSlot);
		if (!slots?.includes(itemSlot)) {
			return null;
		}

		return this.simUI.player.getGear().getEquippedItem(itemSlot) ?? null;
	}

	private getFrozenItemSlot(bulkSlot: BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket): ItemSlot | undefined {
		const frozenItem = this.frozenItems.get(bulkSlot);
		const slots = bulkSimItemSlotToItemSlotPairs.get(bulkSlot);
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
		eventID = TypedEvent.nextEventID(),
		shouldEmit = true,
	): boolean {
		const currentFilter = this.weaponTypeFilters.get(slot)!;
		const hasChanged = currentFilter.length !== newFilter.length || currentFilter.some((weaponType, idx) => weaponType !== newFilter[idx]);

		if (!hasChanged) {
			return false;
		}

		this.weaponTypeFilters.set(slot, newFilter);
		if (shouldEmit) {
			this.settingsChangedEmitter.emit(eventID);
		}
		return true;
	}

	private clearWeaponTypeFilter(slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): boolean {
		return this.setWeaponTypeFilter(slot, [], undefined, false);
	}

	private setFrozenWeaponSlot(itemSlot: number | null, eventID = TypedEvent.nextEventID()): boolean {
		const newSlot = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(itemSlot ?? -1)
			? (itemSlot as ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand)
			: undefined;
		const filtersChanged = newSlot !== undefined && this.clearWeaponTypeFilter(newSlot);

		if (newSlot === this.frozenWeaponSlot && !filtersChanged) {
			return false;
		}

		this.frozenWeaponSlot = newSlot;
		this.settingsChangedEmitter.emit(eventID);
		return true;
	}

	private setUseOptimisationRounds(newValue: boolean) {
		this.useOptimisationRounds = newValue;
		this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
	}

	private setRequiredSetBonus(setBonus: BulkSetBonusOption, pieces: number, eventID = TypedEvent.nextEventID()) {
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
		this.requiredSetBonusCombinationCount = null;
		this.settingsChangedEmitter.emit(eventID);
	}

	private setRequiredSetBonuses(requiredSetBonuses: BulkRequiredSetBonus[], eventID = TypedEvent.nextEventID()) {
		this.requiredSetBonuses.clear();
		const requiredFourPieceSetBonus = requiredSetBonuses.find(requiredSetBonus => requiredSetBonus.setId > 0 && requiredSetBonus.pieces === 4);
		const requiredSetBonusesToStore = requiredFourPieceSetBonus ? [requiredFourPieceSetBonus] : requiredSetBonuses;
		requiredSetBonusesToStore.forEach(requiredSetBonus => {
			if (requiredSetBonus.setId > 0 && [2, 4].includes(requiredSetBonus.pieces)) {
				this.requiredSetBonuses.set(requiredSetBonus.setId, BulkRequiredSetBonus.create(requiredSetBonus));
			}
		});
		this.requiredSetBonusCombinationCount = null;
		this.settingsChangedEmitter.emit(eventID);
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
						changedEvent: _modObj => TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]),
						enableWhen: _modObj => this.canEnableRequiredTwoPiece(setBonus.setId),
						getValue: _modObj => this.requiredSetBonuses.get(setBonus.setId)?.pieces === 2,
						setValue: (eventID, _modObj, newValue) => {
							this.setRequiredSetBonus(setBonus, newValue ? 2 : 0, eventID);
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
						changedEvent: _modObj => TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]),
						enableWhen: _modObj => this.canEnableRequiredFourPiece(setBonus),
						getValue: _modObj => this.requiredSetBonuses.get(setBonus.setId)?.pieces === 4,
						setValue: (eventID, _modObj, newValue) => {
							this.setRequiredSetBonus(setBonus, newValue ? 4 : 0, eventID);
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
		this.itemsChangedEmitter.on(render);
	}

	protected buildBatchSettings() {
		this.bulkSimButton.addEventListener('click', () => this.runBatchSim());

		const inheritUpgradesDiv = ref<HTMLDivElement>();
		const useOptimisationRoundsDiv = ref<HTMLDivElement>();
		const requiredSetBonusesDiv = ref<HTMLDivElement>();
		const frozenRingDiv = ref<HTMLDivElement>();
		const frozenTrinketDiv = ref<HTMLDivElement>();
		const frozenWeaponDiv = ref<HTMLDivElement>();
		const mainHandWeaponTypesDiv = ref<HTMLDivElement>();
		const offHandWeaponTypesDiv = ref<HTMLDivElement>();

		this.settingsContainer.appendChild(
			<>
				<div ref={useOptimisationRoundsDiv} className="use-optimisation-rounds-container"></div>
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
				changedEvent: _modObj => this.settingsChangedEmitter,
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

		if (useOptimisationRoundsDiv.value)
			new BooleanPicker<BulkTab>(useOptimisationRoundsDiv.value, this, {
				id: 'use-optimisation-rounds',
				label: i18n.t('bulk_tab.settings.use_multistage_optimisation.label'),
				labelTooltip: i18n.t('bulk_tab.settings.use_multistage_optimisation.tooltip'),
				inline: true,
				changedEvent: _modObj => this.settingsChangedEmitter,
				getValue: _modObj => this.useOptimisationRounds,
				setValue: (_, _modObj, newValue: boolean) => {
					this.setUseOptimisationRounds(newValue);
					trackEvent({
						action: 'settings',
						category: 'batch_sim',
						label: 'use_optimisation_rounds',
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
				changedEvent: _modObj => TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]),
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
				changedEvent: _modObj => TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]),
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
					changedEvent: _modObj => TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]),
					getValue: _modObj => {
						if (!this.frozenWeaponSlot) {
							return -1;
						}

						return this.frozenWeaponSlot;
					},
					setValue: (eventID, _modObj, newValue) => {
						this.setFrozenWeaponSlot(newValue === -1 ? null : newValue, eventID);
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
		this.calculateBulkCombinations();
		this.bulkSimButton.disabled = !this.combinations || this.combinations > this.getCombinationsLimit();

		const warningRef = ref<HTMLButtonElement>();
		const rtn = (
			<>
				<span className={clsx(this.showIterationsWarning() && 'text-danger')}>
					{this.combinations === 1
						? i18n.t('bulk_tab.settings.combination_singular')
						: i18n.t('bulk_tab.settings.combinations_count', { count: this.combinations })}
					<br />
					<small>
						{this.iterations} {i18n.t('bulk_tab.settings.iterations')}
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
				content: i18n.t('bulk_tab.warning.iterations_limit', { limit: this.getIterationsLimit() }),
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

	private showIterationsWarning(): boolean {
		return this.iterations > this.getIterationsLimit();
	}

	private getIterationsLimit(): number {
		return isExternal() ? WEB_ITERATIONS_LIMIT : LOCAL_ITERATIONS_LIMIT;
	}

	private getCombinationsLimit(): number {
		return isExternal() ? WEB_COMBINATIONS_LIMIT : LOCAL_COMBINATIONS_LIMIT;
	}

	private setReforgeProgress(currentRound: number, rounds: number) {
		this.progressTrackerModal.updateProgress({
			stage: 'reforging',
			title: i18n.t('bulk_tab.progress.reforging_iteration_rounds'),
			current: currentRound - 1,
			total: rounds,
			message: undefined,
		});
	}

	private setCandidateGearProgress(
		{
			completed,
			total,
			title = i18n.t('bulk_tab.progress.building_candidate_gear_sets'),
			stage = 'preparing',
			startedAt,
		}: {
			completed: number;
			total: number;
			title?: string;
			stage?: string;
			startedAt?: number;
		},
	) {
		const secondsRemaining =
			startedAt !== undefined && completed > 0 ? ((new Date().getTime() - startedAt) / 1000 / completed) * Math.max(0, total - completed) : undefined;
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

		if (RelativeStatCap.hasRoRo(this.simUI.player) && this.simUI.reforger.relativeStatCapStat !== -1) {
			this.simUI.reforger.relativeStatCap = new RelativeStatCap(this.simUI.reforger.relativeStatCapStat);
		}
	}

	private getDurationSeconds(startedAt: number): number {
		return getDurationSeconds(startedAt);
	}

	private debugOptimisationRound(message: string, data?: unknown) {
		// if (!isDevMode()) return;
		console.debug(`[Bulk Sim Optimisation] ${message}`, data);
	}

	private dedupeGearSets(gearSets: Gear[]): Gear[] {
		return dedupeGearSets(gearSets, this.originalGear ? [this.originalGear] : []);
	}

	private shouldRunOptimisationStage(stage: 'low' | 'medium' | 'high', candidateCount: number): boolean {
		return shouldRunOptimisationStage(stage, candidateCount);
	}

	private getOptimisationStageMinIterations(stage: 'low' | 'medium' | 'high'): number {
		return getOptimisationStageMinIterations(stage, this.simUI.sim.getIterations());
	}

	private async runCoreBulkSim(
		gearSets: Gear[],
		signal: AbortSignal,
		reforgeConfig?: ReforgeOptimizeConfig,
	): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> {
		let cacheRestoreStartedAt: number | undefined;
		return runCoreBulkSimImpl(
			{
				simUI: this.simUI,
				throwIfBulkAborted: signal => this.throwIfBulkAborted(signal),
				runWithBulkAbort: (promise, signal) => this.runWithBulkAbort(promise, signal),
				setSimProgress: (progress, config) => this.setSimProgress(progress, config),
				setCacheRestoreProgress: progress => {
					cacheRestoreStartedAt ??= new Date().getTime();
					this.setCandidateGearProgress({
						completed: progress.processedCandidates,
						total: progress.totalCandidates,
						title: i18n.t('bulk_tab.progress.restoring_reforges_from_cache'),
						stage: 'reforging',
						startedAt: cacheRestoreStartedAt,
					});
				},
				debugOptimisationRound: (message, data) => this.debugOptimisationRound(message, data),
			},
			gearSets,
			signal,
			reforgeConfig,
		);
	}

	private getBulkReforgeConfig(playerPhase: boolean): ReforgeOptimizeConfig | undefined {
		if (!this.simUI.reforger || !this.originalGear) {
			return undefined;
		}

		this.simUI.reforger.setIncludeGems(TypedEvent.nextEventID(), true);
		this.simUI.reforger.setIncludeEOTBPGemSocket(TypedEvent.nextEventID(), playerPhase);
		this.updateRelativeStatCapReforges();
		return this.simUI.reforger.getReforgeOptimizeConfig(this.originalGear);
	}

	private async buildCandidateGearSets(challengeModeEnabled: boolean, signal: AbortSignal): Promise<Gear[]> {
		const startedAt = new Date().getTime();
		const candidateGearSets: Gear[] = [];
		const comboDimensions = this.buildComboDimensions();
		const originalGear = this.originalGear!;
		const rawCombinations = this.rawCombinations;
		const preparedComboDimensions = this.buildPreparedComboDimensions(comboDimensions, originalGear, challengeModeEnabled);
		const requiredSetBonuses = this.getRequiredSetBonusFilters();
		const requiredSetBonusMatcher = this.getRequiredSetBonusComboMatcher(requiredSetBonuses);
		const requiredSetBonusCountSignature = this.getRequiredSetBonusCombinationCountSignature(rawCombinations, requiredSetBonuses, requiredSetBonusMatcher);
		const requiredSetBonusMatches =
			// Reuse precomputed required-set-bonus pass/fail flags
			// whenever the signature still matches current settings.
			this.requiredSetBonusCombinationCount?.signature === requiredSetBonusCountSignature ? this.requiredSetBonusCombinationCount.matches : undefined;
		this.debugOptimisationRound('candidate gear sets build started', {
			combinations: this.combinations,
			rawCombinations,
		});
		this.setCandidateGearProgress({ completed: 0, total: this.combinations, startedAt });
		await sleep(0);
		let lastYieldAt = performance.now();

		for (let comboIdx = 0; comboIdx < rawCombinations; comboIdx++) {
			this.throwIfBulkAborted(signal);
			if (requiredSetBonusMatches ? !requiredSetBonusMatches[comboIdx] : !this.comboMatchesRequiredSetBonusMatcher(comboIdx, requiredSetBonusMatcher)) {
				continue;
			}

			let gear = originalGear;
			let comboRemainder = comboIdx;
			// Decode a mixed-radix combo index: each dimension consumes one digit (option index).
			for (const dimension of preparedComboDimensions) {
				const optionIdx = comboRemainder % dimension.options.length;
				comboRemainder = Math.floor(comboRemainder / dimension.options.length);
				for (const [itemSlot, updatedItem] of dimension.options[optionIdx]) {
					gear = gear.withEquippedItem(itemSlot, updatedItem, this.playerIsFuryWarrior);
				}
			}

			candidateGearSets.push(gear);

			const scannedCombinations = comboIdx + 1;
			// Check progress every 64 combos
			if (scannedCombinations % 64 === 0 || scannedCombinations === rawCombinations) {
				const now = performance.now();
				if (scannedCombinations === rawCombinations || now - lastYieldAt >= 16) {
					this.setCandidateGearProgress({ completed: candidateGearSets.length, total: this.combinations, startedAt });
					await sleep(0);
					lastYieldAt = performance.now();
				}
			}
		}
		this.setCandidateGearProgress({ completed: candidateGearSets.length, total: this.combinations, startedAt });

		const durationSeconds = this.getDurationSeconds(startedAt);
		this.debugOptimisationRound('candidate gear sets build complete', {
			durationSeconds,
			combinations: this.combinations,
			rawCombinations,
			candidateGearSets: candidateGearSets.length,
		});
		trackEvent({
			action: 'sim',
			category: 'batch_sim',
			label: 'candidate_gear_sets_complete',
			value: Math.round(durationSeconds),
			additionalData: {
				combinations: this.combinations,
				raw_combinations: rawCombinations,
				candidate_gear_sets: candidateGearSets.length,
			},
		});

		return candidateGearSets;
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
		this.bulkSimUsesWasmConcurrency = await this.simUI.sim.shouldUseWasmConcurrency();
		const useLocalBulkSim = !(await this.simUI.sim.isWasm());
		const concurrency = this.bulkSimUsesWasmConcurrency ? this.simUI.sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		this.bulkSimAbortController = new AbortController();
		this.bulkSimAbortPromise = null;
		const abortSignal = this.bulkSimAbortController.signal;
		this.bulkSimButton.disabled = true;
		this.topGearResults = null;
		this.originalGearResults = null;

		const playerPhase = this.simUI.sim.getPhase() >= 2;
		const challengeModeEnabled = this.simUI.player.getChallengeModeEnabled();
		let candidateGearSets: Gear[] = [];
		const gearSets: Gear[] = [];
		let runError: unknown = null;
		const batchCompleteMetrics: Record<string, string | number> = {
			wasm_concurrency: this.bulkSimUsesWasmConcurrency ? 1 : 0,
			local_bulk_sim: useLocalBulkSim ? 1 : 0,
			concurrency,
		};

		try {
			await this.simUI.sim.signalManager.abortType(RequestTypes.RaidSim);
			this.simStart = new Date().getTime();
			this.originalGear = this.simUI.player.getGear();
			let topGearResults: TopGearResult[] = [];

			this.resetResultsTabContent();
			this.calculateBulkCombinations();
			batchCompleteMetrics.combinations = this.combinations;
			batchCompleteMetrics.optimisation_rounds_used = this.shouldUseOptimisationRounds(this.combinations) ? 1 : 0;

			const candidateGearBuildStartedAt = new Date().getTime();
			candidateGearSets = await this.buildCandidateGearSets(challengeModeEnabled, abortSignal);
			batchCompleteMetrics.candidate_gear_sets = candidateGearSets.length;
			batchCompleteMetrics.candidate_gear_sets_duration_seconds = Math.round((new Date().getTime() - candidateGearBuildStartedAt) / 1000);

			const backendReforgeConfig = this.getBulkReforgeConfig(playerPhase);
			if (backendReforgeConfig) {
				gearSets.push(...candidateGearSets);
			} else {
				gearSets.push(...this.dedupeGearSets(candidateGearSets));
			}
			await sleep(0);
			this.simStart = new Date().getTime();
			let referenceDpsMetrics: DistributionMetrics;
			const bulkSimResult = await this.runCoreBulkSim(gearSets, abortSignal, backendReforgeConfig);
			referenceDpsMetrics = bulkSimResult.referenceDpsMetrics;
			topGearResults = bulkSimResult.topGearResults;
			Object.assign(batchCompleteMetrics, bulkSimResult.metrics);
			batchCompleteMetrics.local_bulk_sim = useLocalBulkSim ? 1 : 0;
			batchCompleteMetrics.wasm_concurrent_bulk_sim = this.bulkSimUsesWasmConcurrency ? 1 : 0;

			const originalGearKey = getGearKey(this.originalGear);
			this.topGearResults = topGearResults.filter(result => getGearKey(result.gear) !== originalGearKey);
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
			// if (isDevMode()) {
			console.info('[Bulk Sim] run complete', {
				durationSeconds: Math.round(bulkSimDurationSeconds * 100) / 100,
				combinations: this.combinations,
				usedOptimisationRounds: this.shouldUseOptimisationRounds(this.combinations),
				cancelled: wasCancelling,
			});
			// }
			await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), this.originalGear!);
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
