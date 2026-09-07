/** @jsxImportSource @jsx-vanilla */
import { sanitizeId } from '@domain/format';
import { mod } from '@domain/math';
import { Player } from '@domain/player';
import { setActionIdBackgroundAndHref, setEquippedItemWowheadData } from '@domain/proto_utils/action_id/dom';
import { EquippedItem, ReforgeData } from '@domain/proto_utils/equipped_item';
import { gemMatchesSocket, getEmptyGemSocketIconUrl } from '@domain/proto_utils/gems';
import { Stats } from '@domain/proto_utils/stats';
import { subscribeSimField, subscribeUiField } from '@domain/state/subscriptions';
import { randomUUID } from '@domain/utils';
import type { SimHost } from '@features/sim_host';
import { GemColor, ItemLevelState, ItemRandomSuffix, ItemSlot, Profession } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { translateSlotName, translateStat } from '@i18n/localization';
import { BaseModal } from '@ui-kit/base_modal';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { enchantsTabData, gemsTabData, itemsTabData, randomSuffixesTabData, reforgesTabData, tinkersTabData, upgradesTabData } from '../model/item_data';
import { resolveSelectedTab } from '../model/tab_eligibility';
import { GearData, getTranslatedTabLabel, ItemData, ItemListType, SelectorModalTabs, SlotRailEntry } from '../types';
import { createGemContainer, getEmptySlotIconUrl, setGemInContainer } from './gear_elements';
import ItemList from './item_list';

type SelectorModalOptions = {
	// This will add a unique ID to the modal, allowing multiple of the same modals to exist
	id: string;
	// Prevents rendering of certail tabs
	disabledTabs?: SelectorModalTabs[];
};
export default class SelectorModal extends BaseModal {
	private readonly simUI: SimHost;
	private player: Player<any>;
	private readonly slotRail: SlotRailEntry[];
	private ilists: ItemList<ItemListType>[] = [];

	private readonly itemSlotTabElems: HTMLElement[] = [];
	private readonly titleElem: HTMLElement;
	private readonly tabsElem: HTMLElement;
	private readonly contentElem: HTMLElement;

	private currentSlot: ItemSlot = ItemSlot.ItemSlotHead;
	private currentTab: SelectorModalTabs = SelectorModalTabs.Items;
	private disabledTabs: SelectorModalTabs[] = [];
	private options: SelectorModalOptions;

	constructor(parent: HTMLElement, simUI: SimHost, player: Player<any>, slotRail?: SlotRailEntry[], options?: Partial<SelectorModalOptions>) {
		super(parent, 'selector-modal', { disposeOnClose: false, size: 'xl' });

		this.simUI = simUI;
		this.player = player;
		this.slotRail = slotRail ?? [];
		this.options = { id: randomUUID(), ...options };
		this.disabledTabs = this.options.disabledTabs || [];

		this.addItemSlotTabs();

		this.header!.insertAdjacentElement(
			'afterbegin',
			<div>
				<h6 className="selector-modal-title" />
				<ul className="nav nav-tabs selector-modal-tabs"></ul>
			</div>,
		);

		this.body.appendChild(<div className="tab-content selector-modal-tab-content"></div>);

		this.titleElem = this.rootElem.querySelector<HTMLElement>('.selector-modal-title')!;
		this.tabsElem = this.rootElem.querySelector<HTMLElement>('.selector-modal-tabs')!;
		this.contentElem = this.rootElem.querySelector<HTMLElement>('.selector-modal-tab-content')!;

		this.body.appendChild(
			<div className="d-flex align-items-center form-text">
				<i className="fas fa-circle-exclamation fa-xl me-2"></i>
				<span>
					{i18n.t('gear_tab.gear_picker.missing_gear_message.title')}
					<br />
					{i18n.t('gear_tab.gear_picker.missing_gear_message.description')}
				</span>
			</div>,
		);
	}

	openTab(selectedSlot: ItemSlot, selectedTab: SelectorModalTabs, gearData: GearData) {
		this.titleElem.textContent = translateSlotName(selectedSlot) ?? '';
		this.setData(selectedSlot, selectedTab, gearData);
		this.setActiveItemSlotTab(selectedSlot);
		this.open();
	}

	onShow() {
		if (this.slotRail.length) {
			// Allow you to switch between gear picker slots with the up and down arrows
			const switchToPreviousItemSlotTab = this.switchToPreviousItemSlotTab.bind(this);
			const switchToNextItemSlotTab = this.switchToNextItemSlotTab.bind(this);

			document.addEventListener('keydown', switchToPreviousItemSlotTab);
			document.addEventListener('keydown', switchToNextItemSlotTab);

			this.addOnHideCallback(() => document.removeEventListener('keydown', switchToPreviousItemSlotTab));
			this.addOnHideCallback(() => document.removeEventListener('keydown', switchToNextItemSlotTab));
		}
	}

	private setData(selectedSlot: ItemSlot, selectedTab: SelectorModalTabs, gearData: GearData) {
		this.tabsElem.innerText = '';
		this.contentElem.innerText = '';
		this.ilists = [];

		const equippedItem = gearData.getEquippedItem();

		const eligibleItems = this.player.getItems(selectedSlot);
		const eligibleEnchants = this.player.getEnchants(selectedSlot);
		const eligibleTinkers = this.player.getTinkers(selectedSlot);
		const hasEligibleReforges = equippedItem?.item ? !!this.player.getAvailableReforgings(equippedItem).length : false;
		const hasEligibleUpgrades = !this.player.getChallengeModeEnabled() && equippedItem?.item ? equippedItem.hasUpgradeOptions() : false;

		// If the enchant tab is selected but the item has no eligible enchants, default to items
		// If the reforge tab is selected but the item has no eligible reforges, default to items
		// If a gem tab is selected but the item has no eligible sockets, default to items
		selectedTab = resolveSelectedTab(selectedTab, {
			hasEnchants: !!eligibleEnchants.length,
			hasReforges: hasEligibleReforges,
			hasUpgrades: hasEligibleUpgrades,
			socketCount: equippedItem?.numSockets(this.player.isBlacksmithing()),
		});

		this.currentTab = selectedTab;
		this.currentSlot = selectedSlot;

		const hasItemTab = !this.disabledTabs?.includes(SelectorModalTabs.Items);
		if (hasItemTab)
			this.addTab<Item>({
				id: sanitizeId(`${this.options.id}-${SelectorModalTabs.Items}`),
				label: SelectorModalTabs.Items,
				gearData,
				itemData: itemsTabData(this.player, gearData, eligibleItems),
				computeEP: (item: Item) => this.player.computeItemEP(item, selectedSlot),
				equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.item,
				onRemove: () => {
					gearData.equipItem(null);
					this.removeTabs(SelectorModalTabs.Enchants);
					this.removeTabs(SelectorModalTabs.RandomSuffixes);
					this.removeTabs(SelectorModalTabs.Reforging);
					this.removeTabs(SelectorModalTabs.Upgrades);
					this.removeTabs('Gem');
				},
			});

		const hasEnchantTab = !this.disabledTabs?.includes(SelectorModalTabs.Enchants);
		if (hasEnchantTab)
			this.addTab<Enchant>({
				id: sanitizeId(`${this.options.id}-${SelectorModalTabs.Enchants}`),
				label: SelectorModalTabs.Enchants,
				gearData,
				itemData: enchantsTabData(gearData, eligibleEnchants),
				computeEP: (enchant: Enchant) => this.player.computeEnchantEP(enchant),
				equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.enchant,
				onRemove: () => {
					const equippedItem = gearData.getEquippedItem();
					if (equippedItem) gearData.equipItem(equippedItem.withEnchant(null));
				},
			});

		const hasTinkerTab = !this.disabledTabs?.includes(SelectorModalTabs.Tinkers);
		if (hasTinkerTab && this.player.hasProfession(Profession.Engineering)) {
			this.addTab<Enchant>({
				id: sanitizeId(`${this.options.id}-${SelectorModalTabs.Tinkers}`),
				label: SelectorModalTabs.Tinkers,
				gearData,
				itemData: tinkersTabData(gearData, eligibleTinkers),
				computeEP: (tinker: Enchant) => this.player.computeEnchantEP(tinker),
				equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.tinker,
				onRemove: () => {
					const equippedItem = gearData.getEquippedItem();
					if (equippedItem) gearData.equipItem(equippedItem.withTinker(null));
				},
			});
		}

		const hasRandomSuffixTab = !this.disabledTabs?.includes(SelectorModalTabs.RandomSuffixes);
		if (hasRandomSuffixTab) this.addRandomSuffixTab(equippedItem, gearData);
		const hasUpgradesTab = !this.disabledTabs?.includes(SelectorModalTabs.Upgrades);
		if (hasUpgradesTab) this.addUpgradesTab(equippedItem, gearData);
		const hasReforgingTab = !this.disabledTabs?.includes(SelectorModalTabs.Reforging);
		if (hasReforgingTab) this.addReforgingTab(equippedItem, gearData);
		const hasGemsTab = ![SelectorModalTabs.Gem1, SelectorModalTabs.Gem2, SelectorModalTabs.Gem3].some(gem => this.disabledTabs?.includes(gem));
		if (hasGemsTab) this.addGemTabs(selectedSlot, equippedItem, gearData);

		this.ilists.find(list => selectedTab === list.label)?.sizeRefresh();
	}

	private addItemSlotTabs() {
		if (!this.slotRail.length) {
			return;
		}

		this.dialog.prepend(
			<div className="gear-picker-modal-slots">
				{this.slotRail.map(entry => {
					const anchorRef = ref<HTMLAnchorElement>();
					const wrapper = (
						<div className="item-picker-icon-wrapper" dataset={{ slot: entry.slot }}>
							<a
								ref={anchorRef}
								className="item-picker-icon"
								href="javascript:void(0)"
								onclick={(e: Event) => {
									e.preventDefault();
									if (entry.slot != this.currentSlot) {
										entry.open(this.currentTab);
									}
								}}
								dataset={{ whtticon: 'false' }}
							/>
						</div>
					) as HTMLElement;

					const setItemData = () => {
						const item = entry.getItem();
						if (item) {
							setEquippedItemWowheadData(this.player, item, anchorRef.value!);
							item.asActionId()
								.fill()
								.then(filledId => {
									setActionIdBackgroundAndHref(filledId, anchorRef.value!);
								});
						} else {
							anchorRef.value!.style.backgroundImage = `url('${getEmptySlotIconUrl(entry.slot)}')`;
						}
					};
					setItemData();
					this.addOnDisposeCallback(entry.subscribe(setItemData));
					tippy(anchorRef.value!, {
						content: `Edit ${translateSlotName(entry.slot)}`,
						placement: 'left',
					});
					this.itemSlotTabElems.push(wrapper);
					return wrapper;
				})}
			</div>,
		);
	}

	private setActiveItemSlotTab(slot: ItemSlot) {
		this.itemSlotTabElems.forEach(elem => {
			if (elem.dataset.slot === slot.toString()) {
				elem.classList.add('active');
			} else if (elem.classList.contains('active')) {
				elem.classList.remove('active');
			}
		});
	}

	private switchToPreviousItemSlotTab(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' && this.slotRail.length) {
			event.preventDefault();
			const newSlot = mod(this.currentSlot - 1, Object.keys(ItemSlot).length / 2) as unknown as ItemSlot;
			this.slotRail.find(entry => entry.slot === newSlot)?.open(this.currentTab);
		}
	}

	private switchToNextItemSlotTab(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && this.slotRail.length) {
			event.preventDefault();
			const newSlot = mod(this.currentSlot + 1, Object.keys(ItemSlot).length / 2) as unknown as ItemSlot;
			this.slotRail.find(entry => entry.slot === newSlot)?.open(this.currentTab);
		}
	}

	private addGemTabs(_slot: ItemSlot, equippedItem: EquippedItem | null, gearData: GearData) {
		if (!equippedItem) {
			return;
		}

		const socketBonusEP = this.player.computeStatsEP(new Stats(equippedItem.item.socketBonus)) / (equippedItem.item.gemSockets.length || 1);
		equippedItem.curSocketColors(this.player.isBlacksmithing()).forEach((socketColor, socketIdx) => {
			const label = SelectorModalTabs[`Gem${socketIdx + 1}` as keyof typeof SelectorModalTabs];
			this.addTab<Gem>({
				id: sanitizeId(`${this.options.id}-${label}`),
				label,
				gearData,
				itemData: gemsTabData(gearData, this.player.getGems(socketColor), socketIdx),
				computeEP: (gem: Gem) => {
					let gemEP = this.player.computeGemEP(gem);
					if (gemMatchesSocket(gem, socketColor)) {
						gemEP += socketBonusEP;
					}
					return gemEP;
				},
				equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.gems[socketIdx],
				onRemove: () => {
					const equippedItem = gearData.getEquippedItem();
					if (equippedItem) gearData.equipItem(equippedItem.withGem(null, socketIdx));
				},
				setTabContent: tabButton => {
					const gemContainer = createGemContainer(socketColor, null, socketIdx);
					tabButton.appendChild(gemContainer);
					tabButton.classList.add('selector-modal-tab-gem');

					const emptySocketUrl = getEmptyGemSocketIconUrl(socketColor);

					const updateGemIcon = () => {
						setGemInContainer(gemContainer, gearData.getEquippedItem()?.gems[socketIdx] ?? null, emptySocketUrl);
					};

					this.addOnDisposeCallback(gearData.subscribe(updateGemIcon));
					updateGemIcon();
				},
				socketColor,
			});
		});
	}

	private addRandomSuffixTab(equippedItem: EquippedItem | null, gearData: GearData) {
		if (!equippedItem || !equippedItem.item.randomSuffixOptions.length) {
			return;
		}

		this.addTab<ItemRandomSuffix>({
			id: sanitizeId(`${this.options.id}-${SelectorModalTabs.RandomSuffixes}`),
			label: SelectorModalTabs.RandomSuffixes,
			gearData,
			itemData: randomSuffixesTabData(
				this.player,
				gearData,
				equippedItem,
				({ label, statString }) =>
					(
						<div className="d-flex flex-column">
							{label}
							<span className="fs-content positive mt-1">{statString}</span>
						</div>
					) as HTMLElement,
			),
			computeEP: (randomSuffix: ItemRandomSuffix) => this.player.computeRandomSuffixEP(randomSuffix),
			equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.randomSuffix,
			onRemove: () => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(equippedItem.item).withRandomSuffix(null));
				}
				this.removeTabs(SelectorModalTabs.Reforging);
				this.removeTabs(SelectorModalTabs.Upgrades);
			},
		});
	}

	private addReforgingTab(equippedItem: EquippedItem | null, gearData: GearData) {
		if (!equippedItem || (equippedItem.hasRandomSuffixOptions() && !equippedItem.randomSuffix)) {
			return;
		}

		this.addTab<ReforgeData>({
			id: sanitizeId(`${this.options.id}-${SelectorModalTabs.Reforging}`),
			label: SelectorModalTabs.Reforging,
			gearData,
			itemData: reforgesTabData(
				this.player,
				gearData,
				equippedItem,
				reforgeData =>
					(
						<div>
							<span className="reforge-value negative">
								{reforgeData.fromAmount} {translateStat(reforgeData.fromStat)}
							</span>
							<span className="reforge-value positive">
								+{reforgeData.toAmount} {translateStat(reforgeData.toStat)}
							</span>
						</div>
					) as HTMLElement,
			),
			computeEP: (reforge: ReforgeData) => this.player.computeReforgingEP(reforge),
			equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?.getReforgeData() || null,
			onRemove: () => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(equippedItem.item).withRandomSuffix(equippedItem._randomSuffix));
				}
			},
		});
	}

	private addUpgradesTab(equippedItem: EquippedItem | null, gearData: GearData) {
		if (!equippedItem || !equippedItem.hasUpgradeOptions() || (equippedItem.hasRandomSuffixOptions() && !equippedItem.randomSuffix)) {
			return;
		}

		this.addTab<ItemLevelState>({
			id: sanitizeId(`${this.options.id}-${SelectorModalTabs.Upgrades}`),
			label: SelectorModalTabs.Upgrades,
			gearData,
			itemData: upgradesTabData(
				gearData,
				equippedItem,
				({ index, ilvlDelta, upgradeStep, numberOfUpgrades }) =>
					(
						<>
							{index > 0 ? <>+ {ilvlDelta}</> : <>Base</>}{' '}
							<div className="selector-modal-list-item-upgrade-step-container ms-2">{`(${upgradeStep}/${numberOfUpgrades})`}</div>
						</>
					) as HTMLElement,
			),
			computeEP: (upgradeStep: ItemLevelState) => this.player.computeUpgradeEP(equippedItem, upgradeStep, this.currentSlot),
			equippedToItemFn: (equippedItem: EquippedItem | null) => equippedItem?._upgrade,
			onRemove: () => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withUpgrade(ItemLevelState.Base));
				}
			},
		});
	}

	/**
	 * Adds one of the tabs for the item selector menu.
	 *
	 * T is expected to be Item, Enchant, Upgrade, or Gem. Tab menus for all 4 looks extremely
	 * similar so this function uses extra functions to do it generically.
	 */
	private addTab<T extends ItemListType>({
		id,
		label,
		gearData,
		itemData,
		computeEP,
		equippedToItemFn,
		onRemove,
		setTabContent,
		socketColor,
	}: {
		id: string;
		label: SelectorModalTabs;
		gearData: GearData;
		itemData: ItemData<T>[];
		computeEP: (item: T) => number;
		equippedToItemFn: (equippedItem: EquippedItem | null) => T | null | undefined;
		onRemove: () => void;
		setTabContent?: (tabElem: HTMLButtonElement) => void;
		socketColor?: GemColor;
	}) {
		if (!itemData.length) {
			return;
		}
		const selected = label === this.currentTab;
		const tabButton = ref<HTMLButtonElement>();
		this.tabsElem.appendChild(
			<li className="nav-item">
				<button
					ref={tabButton}
					className={clsx('nav-link selector-modal-item-tab', selected && 'active')}
					dataset={{
						label,
						bsToggle: 'tab',
						bsTarget: `#${id}`,
					}}
					attributes={{
						role: 'tab',
						'aria-selected': selected,
					}}
				/>
			</li>,
		);

		if (setTabContent) {
			setTabContent(tabButton.value!);
		} else {
			tabButton.value!.textContent = getTranslatedTabLabel(label);
		}

		const ilist = new ItemList(
			id,
			this.contentElem,
			this.simUI,
			this.currentSlot,
			this.currentTab,
			this.player,
			label,
			gearData,
			itemData,
			socketColor || GemColor.GemColorUnknown,
			computeEP,
			equippedToItemFn,
			onRemove,
			itemData => {
				const prevItem = gearData.getEquippedItem();
				const item = itemData;
				itemData.onEquip(item.item);

				const isItemChange = Item.is(item.item);
				const newItem = gearData.getEquippedItem() || null;
				const isRandomSuffixChange = prevItem?._randomSuffix?.id !== newItem?.randomSuffix?.id;
				const isUpgradeChange = prevItem?.id === newItem?.id && prevItem?.upgrade !== newItem?.upgrade;

				// If the item changes, then gem slots and random suffix options will also change, so remove and recreate these tabs.
				if (isItemChange || isRandomSuffixChange || isUpgradeChange) {
					if (!isRandomSuffixChange) {
						this.removeTabs(SelectorModalTabs.RandomSuffixes);
						this.addRandomSuffixTab(newItem, gearData);
					}
					if (!isUpgradeChange) {
						this.removeTabs(SelectorModalTabs.Upgrades);
						this.addUpgradesTab(newItem, gearData);
					}

					this.removeTabs(SelectorModalTabs.Reforging);
					this.addReforgingTab(newItem, gearData);

					this.removeTabs('Gem');
					this.addGemTabs(this.currentSlot, newItem, gearData);
				}
			},
		);

		const invokeUpdate = () => {
			ilist.updateSelected();
		};
		const applyFilter = () => {
			ilist.applyFilters();
		};
		const hideOrShowEPValues = () => {
			ilist.hideOrShowEPValues();
		};
		// Add event handlers
		const unsubGear = gearData.subscribe(invokeUpdate);

		const unsubPhase = subscribeSimField(this.player.sim, 'phase')(applyFilter);
		const unsubFilters = subscribeSimField(this.player.sim, 'filters')(applyFilter);
		const unsubEPValues = subscribeUiField(this.player.sim, 'showEPValues')(hideOrShowEPValues);

		this.addOnDisposeCallback(() => {
			unsubGear();
			unsubPhase();
			unsubFilters();
			unsubEPValues();
			ilist.dispose();
		});

		tabButton.value!.addEventListener('click', _event => {
			this.currentTab = label;
		});
		tabButton.value!.addEventListener('shown.bs.tab', _event => {
			ilist.sizeRefresh();
		});

		this.ilists.push(ilist as unknown as ItemList<ItemListType>);
	}

	private removeTabs(labelSubstring: string) {
		const tabElems = [...this.tabsElem.querySelectorAll<HTMLElement>('.selector-modal-item-tab')].filter(tab =>
			tab.dataset?.label?.includes(labelSubstring),
		);

		const contentElems = tabElems.map(tabElem => document.querySelector(tabElem.dataset.bsTarget!)).filter(tabElem => Boolean(tabElem));
		tabElems.forEach(elem => elem.parentElement?.remove());
		contentElems.forEach(elem => elem!.remove());
	}
}
