import { Tab } from 'bootstrap';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { REPO_RELEASES_URL } from '../../constants/other';
import { IndividualSimUI } from '../../individual_sim_ui';
import i18n from '../../../i18n/config';
import { BulkSettings, DistributionMetrics, ProgressMetrics } from '../../proto/api';
import { Class, GemColor, HandType, ItemRandomSuffix, ItemSlot, ItemSpec, RangedWeaponType, ReforgeStat, Spec } from '../../proto/common';
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
import { getEnumValues, isExternal } from '../../utils';
import { ItemData } from '../gear_picker/item_list';
import SelectorModal from '../gear_picker/selector_modal';
import { ResultsViewer } from '../results_viewer';
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
import { t } from 'i18next';

const WEB_DEFAULT_ITERATIONS = 1000;
const WEB_ITERATIONS_LIMIT = 50_000;
const LOCAL_ITERATIONS_LIMIT = 1_000_000;

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

	private pendingDiv: HTMLDivElement;

	private setupTab: Tab;
	private resultsTab: Tab;
	private pendingResults: ResultsViewer;

	readonly selectorModal: SelectorModal;

	// The main array we will use to store items with indexes. Null values are the result of removed items to avoid having to shift pickers over and over.
	protected items: Array<ItemSpec | null> = new Array<ItemSpec | null>();
	protected pickerGroups: Map<BulkSimItemSlot, BulkItemPickerGroup> = new Map();

	protected combinations = 0;
	protected iterations = 0;

	inheritUpgrades: boolean;
	frozenItems: Map<BulkSimItemSlot, EquippedItem | null> = new Map([
		[BulkSimItemSlot.ItemSlotFinger, null],
		[BulkSimItemSlot.ItemSlotTrinket, null],
	]);
	defaultGems: SimGem[];
	gemIconElements: HTMLImageElement[];

	protected topGearResults: TopGearResult[] | null = null;
	protected originalGear: Gear | null = null;
	protected originalGearResults: TopGearResult | null = null;
	protected isRunning: boolean = false;

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
		this.pendingDiv = (<div className="results-pending-overlay" />) as HTMLDivElement;

		this.combinationsElem = combinationsElemRef.value!;
		this.bulkSimButton = bulkSimBtnRef.value!;
		this.settingsContainer = settingsContainerRef.value!;

		this.setupTab = new Tab(setupTabBtnRef.value!);
		this.resultsTab = new Tab(resultsTabBtnRef.value!);

		this.pendingResults = new ResultsViewer(this.pendingDiv);
		this.pendingResults.hideAll();
		this.selectorModal = new SelectorModal(this.simUI.rootElem, this.simUI, this.simUI.player, undefined, {
			id: 'bulk-selector-modal',
		});

		this.inheritUpgrades = true;
		this.defaultGems = Array.from({ length: 5 }, () => UIGem.create());
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
			loadEquippedItems();

			TypedEvent.onAny([this.simUI.player.challengeModeChangeEmitter, this.simUI.player.gearChangeEmitter]).on(() => loadEquippedItems());

			TypedEvent.onAny([this.settingsChangedEmitter, this.itemsChangedEmitter]).on(() => this.storeSettings());

			TypedEvent.onAny([this.itemsChangedEmitter, this.settingsChangedEmitter, this.simUI.sim.iterationsChangeEmitter]).on(() => {
				this.getCombinationsCount().then(result => this.combinationsElem.replaceChildren(result));
			});
			this.getCombinationsCount().then(result => this.combinationsElem.replaceChildren(result));
		});
	}

	private getSettingsKey(): string {
		return this.simUI.getStorageKey('bulk-settings.v1');
	}

	private loadSettings() {
		const storedSettings = window.localStorage.getItem(this.getSettingsKey());
		if (storedSettings != null) {
			const settings = BulkSettings.fromJsonString(storedSettings, {
				ignoreUnknownFields: true,
			});

			this.addItems(settings.items, true);
			this.setInheritUpgrades(settings.inheritUpgrades);
			this.defaultGems = new Array<SimGem>(
				SimGem.create({ id: settings.defaultRedGem }),
				SimGem.create({ id: settings.defaultYellowGem }),
				SimGem.create({ id: settings.defaultBlueGem }),
				SimGem.create({ id: settings.defaultMetaGem }),
				SimGem.create({ id: settings.defaultPrismaticGem }),
			);

			this.defaultGems.forEach((gem, idx) => {
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
			defaultRedGem: this.defaultGems[0].id,
			defaultYellowGem: this.defaultGems[1].id,
			defaultBlueGem: this.defaultGems[2].id,
			defaultMetaGem: this.defaultGems[3].id,
			defaultPrismaticGem: this.defaultGems[4].id,
			iterationsPerCombo: this.getDefaultIterationsCount(),
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
		for (const gem of this.defaultGems) {
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

		return allWeaponCombos;
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
					throw 'At least 2 items must be selected for ' + BulkSimItemSlot[bulkItemSlot];
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

	protected async calculateBulkCombinations() {
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
		this.isPending = false;
		this.resultsTab.show();
	}

	// Return whether or not the slot is considered secondary and the item should be grouped
	// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
	private isSecondaryItemSlot(slot: ItemSlot) {
		return isSecondaryItemSlot(slot) || (this.playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);
	}

	private set isPending(value: boolean) {
		if (value) {
			this.simUI.rootElem.classList.add('blurred');
			this.simUI.rootElem.insertAdjacentElement('afterend', this.pendingDiv);
		} else {
			this.simUI.rootElem.classList.remove('blurred');
			this.pendingDiv.remove();
			this.pendingResults.hideAll();
		}
	}

	protected buildBatchSettings() {
		this.isRunning = false;
		this.bulkSimButton.addEventListener('click', async () => {
			if (this.isRunning) return;
			trackEvent({
				action: 'sim',
				category: 'simulate',
				label: 'batch',
				value: this.combinations,
			});

			this.isRunning = true;
			this.bulkSimButton.disabled = true;
			this.isPending = true;
			let waitAbort = false;
			let isAborted = false;
			this.topGearResults = null;
			this.originalGearResults = null;
			const playerPhase = this.simUI.sim.getPhase() >= 2;
			const challengeModeEnabled = this.simUI.player.getChallengeModeEnabled();
			const hasBlacksmithing = this.simUI.player.isBlacksmithing();

			try {
				await this.simUI.sim.signalManager.abortType(RequestTypes.All);

				this.originalGear = this.simUI.player.getGear();
				let updatedGear: Gear = this.originalGear;
				let topGearResults: TopGearResult[] = [];

				this.pendingResults.addAbortButton(async () => {
					if (waitAbort) return;
					try {
						waitAbort = true;
						await this.simUI.sim.signalManager.abortType(RequestTypes.All);
					} catch (error) {
						console.error('Error on bulk sim abort!');
						console.error(error);
					} finally {
						waitAbort = false;
						isAborted = true;
						if (!this.isRunning) this.bulkSimButton.disabled = false;
					}
				});

				let simStart = new Date().getTime();

				this.resetResultsTabContent();
				await this.calculateBulkCombinations();
				await this.simUI.runSim((progressMetrics: ProgressMetrics) => {
					const msSinceStart = new Date().getTime() - simStart;
					this.setSimProgress(progressMetrics, msSinceStart / 1000, 0, this.combinations);
				});
				const referenceDpsMetrics = this.simUI.raidSimResultsManager!.currentData!.simResult!.getFirstPlayer()!.dps;

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
					defaultGemsByColor.set(color, this.simUI.sim.db.lookupGem(this.defaultGems[colorIdx].id));
				}

				for (let comboIdx = 0; comboIdx < this.combinations; comboIdx++) {
					if (isAborted) {
						throw new Error('Bulk Sim Aborted');
					}

					updatedGear = this.originalGear;

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

						updatedGear = updatedGear.withEquippedItem(itemSlot, updatedItem, this.playerIsFuryWarrior);

						for (const [socketIdx, socketColor] of equippedItem.curSocketColors(hasBlacksmithing).entries()) {
							if (defaultGemsByColor.get(socketColor)) {
								updatedGear = updatedGear.withGem(itemSlot, socketIdx, defaultGemsByColor.get(socketColor)!);
							}
						}
					}

					await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), updatedGear);

					if (this.simUI.reforger) {
						this.simUI.reforger.setIncludeGems(TypedEvent.nextEventID(), true);
						this.simUI.reforger.setIncludeEOTBPGemSocket(TypedEvent.nextEventID(), playerPhase);

						if (RelativeStatCap.hasRoRo(this.simUI.player) && this.simUI.reforger.relativeStatCapStat !== -1) {
							this.simUI.reforger.relativeStatCap = new RelativeStatCap(
								this.simUI.reforger.relativeStatCapStat,
								this.simUI.player,
								this.simUI.player.getClass(),
							);
						}

						try {
							await this.simUI.reforger.optimizeReforges(true);
						} catch (error) {
							await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), updatedGear);
							this.simUI.reforger.setIncludeGems(TypedEvent.nextEventID(), false);
							if (RelativeStatCap.hasRoRo(this.simUI.player) && this.simUI.reforger.relativeStatCapStat !== -1) {
								this.simUI.reforger.relativeStatCap = new RelativeStatCap(
									this.simUI.reforger.relativeStatCapStat,
									this.simUI.player,
									this.simUI.player.getClass(),
								);
							}

							try {
								await this.simUI.reforger.optimizeReforges(true);
							} catch (error) {
								continue;
							}
						}
					}

					const result = await this.simUI.runSim(
						(progressMetrics: ProgressMetrics) => {
							const msSinceStart = new Date().getTime() - simStart;
							this.setSimProgress(progressMetrics, msSinceStart / 1000, comboIdx + 1, this.combinations);
						},
						{ silent: true },
					);

					if (result && 'type' in result) {
						throw new Error(result.message);
					}

					updatedGear = this.simUI.player.getGear();
					const isOriginalGear = this.originalGear.equals(updatedGear);
					if (!isOriginalGear)
						topGearResults.push({
							gear: updatedGear,
							dpsMetrics: result!.getFirstPlayer()!.dps,
						});

					topGearResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);
					if (topGearResults.length > 5) topGearResults.pop();
				}

				await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), this.originalGear);

				this.topGearResults = topGearResults;
				this.originalGearResults = {
					gear: this.originalGear,
					dpsMetrics: referenceDpsMetrics,
				};

				this.topGearResults.push(this.originalGearResults);
				this.topGearResults.sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg);

				this.simUI.resultsViewer.hideAll();
				this.buildResultsTabContent();
			} catch (error) {
				console.error(error);
				await this.simUI.player.setGearAsync(TypedEvent.nextEventID(), this.originalGear!);
			} finally {
				this.isRunning = false;
				if (!waitAbort) this.bulkSimButton.disabled = false;
				if (isAborted) {
					new Toast({
						variant: 'error',
						body: i18n.t('bulk_tab.notifications.bulk_sim_cancelled'),
					});
				}
				this.simUI.resultsViewer.hideAll();
				this.isPending = false;
			}
		});

		const socketsContainerRef = ref<HTMLDivElement>();
		const inheritUpgradesDiv = ref<HTMLDivElement>();
		const frozenRingDiv = ref<HTMLDivElement>();
		const frozenTrinketDiv = ref<HTMLDivElement>();

		this.settingsContainer.appendChild(
			<>
				<div className="default-gem-container">
					<h6>{i18n.t('bulk_tab.settings.default_gems')}</h6>
					<div ref={socketsContainerRef} className="sockets-container"></div>
				</div>
				<div ref={inheritUpgradesDiv} className="inherit-upgrades-container"></div>
				<div ref={frozenRingDiv}></div>
				<div ref={frozenTrinketDiv}></div>
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
					{ name: i18n.t('gear_tab.slots.finger_1'), value: ItemSlot.ItemSlotFinger1 },
					{ name: i18n.t('gear_tab.slots.finger_2'), value: ItemSlot.ItemSlotFinger2 },
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
						this.frozenItems.set(BulkSimItemSlot.ItemSlotFinger, null);
						this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
						return -1;
					}
				},
				setValue: (eventID, _modObj, newValue) => {
					let newItem: EquippedItem | null = null;

					if (newValue != -1) {
						newItem = this.simUI.player.getGear().getEquippedItem(newValue);
					}

					if (newItem !== this.frozenItems.get(BulkSimItemSlot.ItemSlotFinger)) {
						this.frozenItems.set(BulkSimItemSlot.ItemSlotFinger, newItem);
						this.settingsChangedEmitter.emit(eventID);
					}
				},
			});

		if (frozenTrinketDiv.value)
			new EnumPicker<BulkTab>(frozenTrinketDiv.value, this, {
				id: 'freeze-trinket',
				label: i18n.t('bulk_tab.settings.freeze_trinket.label'),
				labelTooltip: i18n.t('bulk_tab.settings.freeze_trinket.tooltip'),
				values: [
					{ name: i18n.t('common.none'), value: -1 },
					{ name: i18n.t('gear_tab.slots.trinket_1'), value: ItemSlot.ItemSlotTrinket1 },
					{ name: i18n.t('gear_tab.slots.trinket_2'), value: ItemSlot.ItemSlotTrinket2 },
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
						this.frozenItems.set(BulkSimItemSlot.ItemSlotTrinket, null);
						this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
						return -1;
					}
				},
				setValue: (eventID, _modObj, newValue) => {
					let newItem: EquippedItem | null = null;

					if (newValue != -1) {
						newItem = this.simUI.player.getGear().getEquippedItem(newValue);
					}

					if (newItem !== this.frozenItems.get(BulkSimItemSlot.ItemSlotTrinket)) {
						this.frozenItems.set(BulkSimItemSlot.ItemSlotTrinket, newItem);
						this.settingsChangedEmitter.emit(eventID);
					}
				},
			});

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
					this.defaultGems[socketIndex] = itemData.item;
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
					this.defaultGems[socketIndex] = UIGem.create();
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

	private async getCombinationsCount(): Promise<Element> {
		await this.calculateBulkCombinations();
		this.bulkSimButton.disabled = this.combinations > 50000;

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
				content: i18n.t('bulk_tab.warning.iterations_limit', { limit: WEB_ITERATIONS_LIMIT }),
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

	private setSimProgress(progress: ProgressMetrics, totalElapsedSeconds: number, currentRound: number, rounds: number) {
		const roundsRemaining = rounds - currentRound + 1;
		const secondsRemaining = (totalElapsedSeconds * roundsRemaining) / currentRound;
		if (isNaN(Number(secondsRemaining))) return;

		this.pendingResults.setContent(
			<div className="results-sim">
				<div>{rounds > 0 && <>{i18n.t('bulk_tab.progress.refining_rounds', { current: currentRound, total: rounds })}</>}</div>
				<div
					innerHTML={i18n.t('bulk_tab.progress.iterations_complete', { completed: progress.completedIterations, total: progress.totalIterations })}
				/>
				<div>{i18n.t('bulk_tab.progress.seconds_remaining', { seconds: Math.round(secondsRemaining) })}</div>
			</div>,
		);
	}

	private setInheritUpgrades(newValue: boolean) {
		this.inheritUpgrades = newValue;
		this.settingsChangedEmitter.emit(TypedEvent.nextEventID());
	}
}
