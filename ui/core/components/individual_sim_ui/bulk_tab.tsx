import { Tab } from 'bootstrap';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { REPO_RELEASES_URL } from '../../constants/other';
import { IndividualSimUI } from '../../individual_sim_ui';
import i18n from '../../../i18n/config';
import { BulkSettings, DistributionMetrics, ProgressMetrics, RaidSimResult } from '../../proto/api';
import { Class, GemColor, HandType, ItemRandomSuffix, ItemSlot, ItemSpec, RangedWeaponType, ReforgeStat, Spec, WeaponType } from '../../proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '../../proto/db';
import { UIEnchant, UIGem, UIItem } from '../../proto/ui';
import { ActionId } from '../../proto_utils/action_id';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { Gear } from '../../proto_utils/gear';
import { getEmptyGemSocketIconUrl } from '../../proto_utils/gems';
import { canEquipItem, getEligibleItemSlots, isSecondaryItemSlot } from '../../proto_utils/utils';
import { RequestTypes } from '../../sim_signal_manager';
import { RelativeStatCap } from '../suggest_reforges_action';
import { TypedEvent } from '../../typed_event';
import { getEnumValues, isExternal, promisePool, sleep } from '../../utils';
import { ItemData } from '../gear_picker/item_list';
import SelectorModal from '../gear_picker/selector_modal';
import { SimTab } from '../sim_tab';
import Toast from '../toast';
import BulkItemPickerGroup from './bulk/bulk_item_picker_group';
import BulkItemSearch from './bulk/bulk_item_search';
import BulkSimResultRenderer from './bulk/bulk_sim_results_renderer';
import GemSelectorModal from './bulk/gem_selector_modal';
import {
	binomialCoefficient,
	BulkSimItemSlot,
	bulkSimItemSlotToSingleItemSlot,
	bulkSimItemSlotToItemSlotPairs,
	getAllPairs,
	getBulkItemSlotFromSlot,
} from './bulk/utils';
import { BulkGearJsonImporter } from './importers';
import { BooleanPicker } from '../pickers/boolean_picker';
import { trackEvent } from '../../../tracking/utils';
import { EnumPicker } from '../pickers/enum_picker';
import { translateBulkSlotName, translateWeaponType } from '../../../i18n/localization';
import { ProgressTrackerModal } from '../progress_tracker_modal';

const WEB_DEFAULT_ITERATIONS = 5_000;
const WEB_ITERATIONS_LIMIT = 100_000;
const LOCAL_ITERATIONS_LIMIT = 5_000_000;

const WEB_COMBINATIONS_LIMIT = 50_000;
const LOCAL_COMBINATIONS_LIMIT = 100_000;

export interface TopGearResult {
	gear: Gear;
	dpsMetrics: DistributionMetrics;
}

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
	protected combinations = 0;
	protected iterations = 0;
	protected isRunning: boolean = false;
	protected isCancelling = false;
	protected bulkSimAbortController: AbortController | null = null;

	inheritUpgrades: boolean;
	frozenItems: Map<BulkSimItemSlot, EquippedItem | null> = new Map([
		[BulkSimItemSlot.ItemSlotFinger, null],
		[BulkSimItemSlot.ItemSlotTrinket, null],
	]);
	frozenWeaponSlot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand | undefined = undefined;
	weaponTypeFilters: Map<ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand, WeaponType[]> = new Map([
		[ItemSlot.ItemSlotMainHand, []],
		[ItemSlot.ItemSlotOffHand, []],
	]);
	fallbackGems: SimGem[];
	gemIconElements: HTMLImageElement[];

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
			onCancel: () => {
				this.abortBulkSim();
			},
		});

		this.inheritUpgrades = true;
		this.fallbackGems = Array.from({ length: 5 }, () => UIGem.create());
		this.gemIconElements = [];

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

				this.simUI.player.getEquippedItems().forEach((equippedItem, slot) => {
					const bulkSlot = getBulkItemSlotFromSlot(slot, this.playerCanDualWield);
					const group = this.pickerGroups.get(bulkSlot)!;
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
			this.setFrozenItem(BulkSimItemSlot.ItemSlotFinger, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotFinger, settings.freezeRingSlot));
			this.setFrozenItem(BulkSimItemSlot.ItemSlotTrinket, this.getEquippedItemForFrozenSlot(BulkSimItemSlot.ItemSlotTrinket, settings.freezeTrinketSlot));
			this.setFrozenWeaponSlot(settings.freezeWeaponSlot);
			this.setWeaponTypeFilter(ItemSlot.ItemSlotMainHand, settings.freezeMainhandWeaponSlots);
			this.setWeaponTypeFilter(ItemSlot.ItemSlotOffHand, settings.freezeOffhandWeaponSlots);
			this.fallbackGems = new Array<SimGem>(
				SimGem.create({ id: settings.defaultRedGem }),
				SimGem.create({ id: settings.defaultYellowGem }),
				SimGem.create({ id: settings.defaultBlueGem }),
				SimGem.create({ id: settings.defaultMetaGem }),
				SimGem.create({ id: settings.defaultPrismaticGem }),
			);

			this.fallbackGems.forEach((gem, idx) => {
				ActionId.fromItemId(gem.id)
					.fill()
					.then(filledId => {
						if (gem.id) {
							this.gemIconElements[idx].src = filledId.iconUrl;
							this.gemIconElements[idx].classList.remove('hide');
						}
					});
			});
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
			defaultRedGem: this.fallbackGems[0].id,
			defaultYellowGem: this.fallbackGems[1].id,
			defaultBlueGem: this.fallbackGems[2].id,
			defaultMetaGem: this.fallbackGems[3].id,
			defaultPrismaticGem: this.fallbackGems[4].id,
			iterationsPerCombo: this.getDefaultIterationsCount(),
			freezeRingSlot: this.getFrozenItemSlot(BulkSimItemSlot.ItemSlotFinger),
			freezeTrinketSlot: this.getFrozenItemSlot(BulkSimItemSlot.ItemSlotTrinket),
			freezeWeaponSlot: this.frozenWeaponSlot,
			freezeMainhandWeaponSlots: this.weaponTypeFilters.get(ItemSlot.ItemSlotMainHand)?.slice(),
			freezeOffhandWeaponSlots: this.weaponTypeFilters.get(ItemSlot.ItemSlotOffHand)?.slice(),
		});
	}

	private getDefaultIterationsCount(): number {
		if (isExternal()) return WEB_DEFAULT_ITERATIONS;

		return this.simUI.sim.getIterations();
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
		for (const gem of this.fallbackGems) {
			if (gem.id > 0) {
				itemsDb.gems.push(gem);
			}
		}
		return itemsDb;
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

		for (const twoHandWeapon of all2HWeapons) {
			allWeaponCombos.push([twoHandWeapon, null]);
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

	protected getItemsForCombo(comboIdx: number): Map<ItemSlot, EquippedItem> {
		const itemsForCombo = new Map<ItemSlot, EquippedItem>();

		// Deal with weapon combos first since they bridge multiple slots.
		const allWeaponPairs = this.getAllWeaponCombos();
		const numWeaponPairs = allWeaponPairs.length;

		if (numWeaponPairs > 0) {
			const weaponPairIdx = comboIdx % numWeaponPairs;
			comboIdx = Math.floor(comboIdx / numWeaponPairs);
			const weaponPairToUse = allWeaponPairs[weaponPairIdx];

			if (weaponPairToUse[0]) {
				itemsForCombo.set(ItemSlot.ItemSlotMainHand, weaponPairToUse[0]);
			}

			if (weaponPairToUse[1]) {
				itemsForCombo.set(ItemSlot.ItemSlotOffHand, weaponPairToUse[1]);
			}
		}

		for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
			if (
				pickerGroup.pickers.size == 0 ||
				[BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotHandWeapon].includes(bulkItemSlot)
			) {
				continue;
			}

			const optionsForSlot: EquippedItem[] = Array.from(pickerGroup.pickers.values()).map(picker => picker.item);
			const numOptions = optionsForSlot.length;

			if ([BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].includes(bulkItemSlot)) {
				if (numOptions < 2) {
					throw `At least 2 items must be selected for ${translateBulkSlotName(bulkItemSlot)}`;
				}

				let pairsForSlot = getAllPairs(optionsForSlot);
				const frozenItem = this.frozenItems.get(bulkItemSlot);

				if (frozenItem) {
					pairsForSlot = optionsForSlot.filter(option => !frozenItem.equals(option)).map(option => [frozenItem, option]);
				}

				const numPairs = pairsForSlot.length;
				const pairIdx = comboIdx % numPairs;
				comboIdx = Math.floor(comboIdx / numPairs);
				const pairToUse = pairsForSlot[pairIdx];
				const slotsToUse = bulkSimItemSlotToItemSlotPairs.get(bulkItemSlot)!;
				itemsForCombo.set(slotsToUse[0], pairToUse[0]);
				itemsForCombo.set(slotsToUse[1], pairToUse[1]);
			} else {
				const optionIdx = comboIdx % numOptions;
				comboIdx = Math.floor(comboIdx / numOptions);
				itemsForCombo.set(bulkSimItemSlotToSingleItemSlot.get(bulkItemSlot)!, optionsForSlot[optionIdx]);
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

	protected calculateBulkCombinations() {
		try {
			let numCombinations: number = this.getAllWeaponCombos().length;

			for (const [bulkItemSlot, pickerGroup] of this.pickerGroups.entries()) {
				if ([BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotHandWeapon].includes(bulkItemSlot)) {
					continue;
				}

				const numOptions: number = pickerGroup.pickers.size;

				if (numOptions > 1 && [BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].includes(bulkItemSlot)) {
					if (this.frozenItems.get(bulkItemSlot)) {
						numCombinations *= numOptions - 1;
					} else {
						numCombinations *= binomialCoefficient(numOptions, 2);
					}
				} else {
					numCombinations *= Math.max(numOptions, 1);
				}
			}

			this.combinations = numCombinations;
			this.iterations = this.simUI.sim.getIterations() * numCombinations;
		} catch (e) {
			this.simUI.handleCrash(e);
		}
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

	protected buildBatchSettings() {
		this.bulkSimButton.addEventListener('click', () => this.runBatchSim());

		const socketsContainerRef = ref<HTMLDivElement>();
		const inheritUpgradesDiv = ref<HTMLDivElement>();
		const frozenRingDiv = ref<HTMLDivElement>();
		const frozenTrinketDiv = ref<HTMLDivElement>();
		const frozenWeaponDiv = ref<HTMLDivElement>();
		const mainHandWeaponTypesDiv = ref<HTMLDivElement>();
		const offHandWeaponTypesDiv = ref<HTMLDivElement>();

		this.settingsContainer.appendChild(
			<>
				<div className="fallback-gem-container">
					<h6>{i18n.t('bulk_tab.settings.fallback_gems')}</h6>
					<div ref={socketsContainerRef} className="sockets-container"></div>
				</div>
				<div ref={inheritUpgradesDiv} className="inherit-upgrades-container"></div>
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
				},
			});

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
					},
				});

			if (mainHandWeaponTypesDiv.value) this.createFreezeWeaponTypePickers(mainHandWeaponTypesDiv.value, ItemSlot.ItemSlotMainHand);
			if (offHandWeaponTypesDiv.value) this.createFreezeWeaponTypePickers(offHandWeaponTypesDiv.value, ItemSlot.ItemSlotOffHand);
		}

		Array<GemColor>(GemColor.GemColorRed, GemColor.GemColorYellow, GemColor.GemColorBlue, GemColor.GemColorMeta, GemColor.GemColorPrismatic).forEach(
			(socketColor, socketIndex) => {
				const gemContainerRef = ref<HTMLDivElement>();
				const gemIconRef = ref<HTMLImageElement>();
				const socketIconRef = ref<HTMLImageElement>();

				socketsContainerRef.value!.appendChild(
					<div ref={gemContainerRef} className="gem-socket-container">
						<img ref={gemIconRef} className="gem-icon hide" />
						<img ref={socketIconRef} className="socket-icon" />
					</div>,
				);

				this.gemIconElements.push(gemIconRef.value!);
				socketIconRef.value!.src = getEmptyGemSocketIconUrl(socketColor);

				let selector: GemSelectorModal;

				const onSelectHandler = (itemData: ItemData<UIGem>) => {
					this.fallbackGems[socketIndex] = itemData.item;
					this.storeSettings();
					ActionId.fromItemId(itemData.id)
						.fill()
						.then(filledId => {
							if (itemData.id) {
								this.gemIconElements[socketIndex].src = filledId.iconUrl;
								this.gemIconElements[socketIndex].classList.remove('hide');
							}
						});
					selector.close();
				};

				const onRemoveHandler = () => {
					this.fallbackGems[socketIndex] = UIGem.create();
					this.storeSettings();
					this.gemIconElements[socketIndex].classList.add('hide');
					this.gemIconElements[socketIndex].src = '';
					selector.close();
				};

				const openGemSelector = () => {
					if (!selector) selector = new GemSelectorModal(this.simUI.rootElem, this.simUI, socketColor, onSelectHandler, onRemoveHandler);
					selector.show();
				};

				this.gemIconElements[socketIndex].addEventListener('click', openGemSelector);
				gemContainerRef.value?.addEventListener('click', openGemSelector);
			},
		);
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
			title: i18n.t('bulk_tab.progress.reforging_rounds'),
			current: currentRound - 1,
			total: rounds,
			message: undefined,
		});
	}

	private setSimProgress(progress: ProgressMetrics, currentRound: number, rounds: number) {
		const isBaselineRound = currentRound === 1;
		const totalElapsedSeconds = (new Date().getTime() - this.simStart) / 1000;
		const roundFraction = progress.totalIterations > 0 ? progress.completedIterations / progress.totalIterations : 0;
		const completedRounds = Math.max(0, currentRound - 1 + roundFraction);
		const roundsRemaining = Math.max(0, rounds - completedRounds);
		const secondsRemaining = completedRounds > 0 ? (totalElapsedSeconds / completedRounds) * roundsRemaining : 0;

		if (isNaN(Number(secondsRemaining))) return;

		this.progressTrackerModal.updateProgress({
			stage: 'sim',
			title: isBaselineRound ? i18n.t('bulk_tab.progress.baseline_round') : i18n.t('bulk_tab.progress.refining_rounds'),
			current: currentRound - 1 + roundFraction,
			total: rounds,
			message: (
				<div className="results-sim">
					<div
						innerHTML={i18n.t('bulk_tab.progress.iterations_complete', {
							completed: progress.completedIterations,
							total: progress.totalIterations,
						})}
					/>
					<div>{i18n.t('bulk_tab.progress.seconds_remaining', { seconds: Math.round(secondsRemaining) })}</div>
				</div>
			),
		});
	}

	private updateRelativeStatCapReforges() {
		if (!this.simUI.reforger) {
			return;
		}

		if (RelativeStatCap.hasRoRo(this.simUI.player) && this.simUI.reforger.relativeStatCapStat !== -1) {
			this.simUI.reforger.relativeStatCap = new RelativeStatCap(this.simUI.reforger.relativeStatCapStat, this.simUI.player, this.simUI.player.getClass());
		}
	}

	private async runBatchSim() {
		if (this.isRunning) return;

		this.progressTrackerModal.show();

		trackEvent({
			action: 'sim',
			category: 'simulate',
			label: 'batch',
			value: this.combinations,
		});

		this.isRunning = true;
		this.isCancelling = false;
		const concurrency = (await this.simUI.sim.shouldUseWasmConcurrency()) ? this.simUI.sim.getWasmConcurrency() : navigator.hardwareConcurrency || 4;
		this.bulkSimAbortController = new AbortController();
		const abortSignal = this.bulkSimAbortController.signal;
		this.bulkSimButton.disabled = true;
		this.topGearResults = null;
		this.originalGearResults = null;

		const playerPhase = this.simUI.sim.getPhase() >= 2;
		const challengeModeEnabled = this.simUI.player.getChallengeModeEnabled();
		const hasBlacksmithing = this.simUI.player.isBlacksmithing();
		const candidateGearSets: Gear[] = [];
		const reforgedGearSets: Gear[] = [];

		try {
			await this.simUI.sim.signalManager.abortType(RequestTypes.All);
			this.simStart = new Date().getTime();
			this.originalGear = this.simUI.player.getGear();
			let topGearResults: TopGearResult[] = [];

			this.resetResultsTabContent();
			this.calculateBulkCombinations();

			const allItemCombos: Map<ItemSlot, EquippedItem>[] = [];

			for (let comboIdx = 0; comboIdx < this.combinations; comboIdx++) {
				allItemCombos.push(this.getItemsForCombo(comboIdx));
			}

			const defaultGemsByColor = new Map<GemColor, UIGem | null>();

			for (const [colorIdx, color] of [
				GemColor.GemColorRed,
				GemColor.GemColorYellow,
				GemColor.GemColorBlue,
				GemColor.GemColorMeta,
				GemColor.GemColorPrismatic,
			].entries()) {
				defaultGemsByColor.set(color, this.simUI.sim.db.lookupGem(this.fallbackGems[colorIdx].id));
			}

			for (let comboIdx = 0; comboIdx < this.combinations; comboIdx++) {
				this.throwIfBulkAborted(abortSignal);

				let reforgeGear = this.originalGear;

				for (const [itemSlot, equippedItem] of allItemCombos[comboIdx].entries()) {
					const equippedItemInSlot = this.originalGear.getEquippedItem(itemSlot);
					let updatedItem = equippedItemInSlot
						? equippedItemInSlot.withItem(equippedItem.item)
						: equippedItem.withChallengeMode(challengeModeEnabled);

					if (equippedItem._randomSuffix) {
						updatedItem = updatedItem.withRandomSuffix(equippedItem._randomSuffix);
					}
					if (!this.inheritUpgrades) {
						updatedItem = updatedItem.withUpgrade(equippedItem._upgrade);
					}

					reforgeGear = reforgeGear.withEquippedItem(itemSlot, updatedItem, this.playerIsFuryWarrior);

					for (const [socketIdx, socketColor] of equippedItem.curSocketColors(hasBlacksmithing).entries()) {
						if (defaultGemsByColor.get(socketColor)) {
							reforgeGear = reforgeGear.withGem(itemSlot, socketIdx, defaultGemsByColor.get(socketColor)!);
						}
					}
				}

				candidateGearSets.push(reforgeGear);
			}

			let completedReforges = 1;
			this.setReforgeProgress(completedReforges, candidateGearSets.length);
			await sleep(400);
			const reforgeTasks = candidateGearSets.map(reforgeGear => async () => {
				const reforgedGear = await this.optimizeReforges(reforgeGear, playerPhase, abortSignal);
				this.throwIfBulkAborted(abortSignal);
				completedReforges += 1;
				this.setReforgeProgress(completedReforges, candidateGearSets.length);
				return reforgedGear;
			});
			const reforgeSettledResults = await promisePool(reforgeTasks, {
				concurrency,
			});
			const rejectedReforge = reforgeSettledResults.find(result => result.status === 'rejected');
			if (rejectedReforge && rejectedReforge.status === 'rejected') {
				throw rejectedReforge.reason;
			}
			const reforgeResults = reforgeSettledResults
				.filter((result): result is PromiseFulfilledResult<Gear | null> => result.status === 'fulfilled')
				.map(result => result.value);

			reforgedGearSets.push(...reforgeResults.filter((gear): gear is Gear => !!gear));

			this.simStart = new Date().getTime();
			const totalSimRounds = reforgedGearSets.length + 1;
			const result = await this.runWithBulkAbort(this.runSingleGearSim(this.originalGear, 1, totalSimRounds), abortSignal);
			const referenceDpsMetrics = result!.raidMetrics!.dps!;

			for (let comboIdx = 0; comboIdx < reforgedGearSets.length; comboIdx++) {
				this.throwIfBulkAborted(abortSignal);

				const reforgedGear = reforgedGearSets[comboIdx];
				const result = await this.runWithBulkAbort(this.runSingleGearSim(reforgedGear, comboIdx + 2, totalSimRounds), abortSignal);

				const isOriginalGear = this.originalGear.equals(reforgedGear);
				if (!isOriginalGear) {
					const dpsMetrics = result!.raidMetrics!.dps!;
					dpsMetrics.hist = [];
					dpsMetrics.allValues = [];
					topGearResults.push({
						gear: reforgedGear,
						dpsMetrics,
					});
				}

				topGearResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);
				if (topGearResults.length > 5) topGearResults.pop();
			}

			this.topGearResults = topGearResults;
			this.originalGearResults = {
				gear: this.originalGear,
				dpsMetrics: referenceDpsMetrics,
			};

			this.topGearResults.push(this.originalGearResults);
			this.topGearResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);

			this.buildResultsTabContent();
		} catch (error) {
			console.error(error);
			if (!this.isCancelling && typeof error === 'string') {
				new Toast({
					variant: 'error',
					body: error,
				});
			}
		} finally {
			await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), this.originalGear!);
			this.bulkSimButton.disabled = false;
			if (this.isCancelling) {
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

	private async runSingleGearSim(gear: Gear, currentRound: number, totalRounds: number): Promise<RaidSimResult> {
		const response = await this.simUI.runSimLightweight(gear, (progressMetrics: ProgressMetrics) => {
			this.setSimProgress(progressMetrics, currentRound, totalRounds);
		});
		if (!response || (response && 'type' in response)) {
			throw new Error(response?.message);
		}

		const [_, result] = response;

		return result;
	}

	private async optimizeReforges(gear: Gear, playerPhase: boolean, signal: AbortSignal): Promise<Gear | null> {
		if (!this.simUI.reforger) {
			return gear;
		}

		this.throwIfBulkAborted(signal);

		this.simUI.reforger.setIncludeGems(TypedEvent.nextEventID(), true);
		this.simUI.reforger.setIncludeEOTBPGemSocket(TypedEvent.nextEventID(), playerPhase);
		this.updateRelativeStatCapReforges();

		try {
			return this.runWithBulkAbort(this.simUI.reforger.optimizeReforges(gear, true), signal);
		} catch {
			this.throwIfBulkAborted(signal);
			this.simUI.reforger.setIncludeGems(TypedEvent.nextEventID(), false);
			this.updateRelativeStatCapReforges();

			try {
				return this.runWithBulkAbort(this.simUI.reforger.optimizeReforges(gear, true), signal);
			} catch {
				this.throwIfBulkAborted(signal);
				return gear;
			}
		}
	}

	private setInheritUpgrades(newValue: boolean) {
		this.inheritUpgrades = newValue;
		this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
	}

	private async abortBulkSim() {
		if (this.isCancelling) return;

		try {
			this.isCancelling = true;
			await Promise.all([this.simUI.reforger?.abortReforgeOptimization(), this.simUI.sim.signalManager.abortType(RequestTypes.All)]);
			if (!this.bulkSimAbortController?.signal.aborted) {
				this.bulkSimAbortController?.abort();
				this.bulkSimAbortController = null;
			}
		} finally {
			this.bulkSimButton.disabled = false;
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
