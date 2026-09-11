import { Class, ItemSlot } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { SortDirection } from '@sim/constants/other';
import { subscribeSimField, subscribeUiField } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { Icon } from '@ui-kit/Icon';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { SearchBar } from '@ui-kit/SearchBar';
import { Tooltip } from '@ui-kit/Tooltip';
import { VirtualList } from '@ui-kit/VirtualList';
import clsx from 'clsx';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { applyFavourite, isItemFavourited } from '../../model/favourites';
import { getItemIdByItemType } from '../../model/item_ids';
import { matchesSearch } from '../../model/item_search';
import { defaultSortBy, ItemListSortBy, sortItemIdxs } from '../../model/item_sort';
import { type ItemDataFields, getTranslatedTabLabel, type ItemListType, SelectorModalTabs } from '../../types';
import { FiltersMenu } from '../FiltersMenu';
import { ItemListRow } from './ItemListRow';
import { columnHeaderLabel, removeButtonLabel, type SelectorTab } from './utils';

// Fixed: one row's height, applied to all of them.
const ROW_HEIGHT = 56;

export interface ItemListProps {
	tab: SelectorTab;
	slot: ItemSlot;
	equippedItem: EquippedItem | null;
}

export const ItemList = ({ tab, slot, equippedItem }: ItemListProps) => {
	const host = useSimHost();
	const player = host.player;
	const sim = player.sim;
	const { label, itemData, computeEP, equippedToItem, onRemove, socketColor } = tab;

	const [search, setSearch] = useState('');
	const [sortBy, setSortBy] = useState(() => defaultSortBy(slot, label));
	const [sortDirection, setSortDirection] = useState(SortDirection.DESC);
	const listRef = useRef<HTMLDivElement>(null);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const tooltipId = useId();

	const filters = useStoreSubscribe(subscribeSimField(sim, 'filters'), () => sim.getFilters());
	const phase = useStoreSubscribe(subscribeSimField(sim, 'phase'), () => sim.getPhase());
	const showEPValues = useStoreSubscribe(subscribeUiField(sim, 'showEPValues'), () => sim.getShowEPValues());

	const isFavourited = useCallback((row: ItemDataFields<ItemListType>) => isItemFavourited(filters, label, row), [filters, label]);

	const itemsToDisplay = useMemo(() => {
		let idxs = itemData.map((_, index) => index);
		const currentEquippedItem = player.getEquippedItem(slot);

		if (label === SelectorModalTabs.Items) {
			idxs = player.filterItemData(idxs, index => itemData[index].item as unknown as Item, slot);
		} else if (label === SelectorModalTabs.Enchants || label === SelectorModalTabs.Tinkers) {
			idxs = player.filterEnchantData(idxs, index => itemData[index].item as unknown as Enchant, slot, currentEquippedItem);
		} else if (label === SelectorModalTabs.Gem1 || label === SelectorModalTabs.Gem2 || label === SelectorModalTabs.Gem3) {
			idxs = player.filterGemData(idxs, index => itemData[index].item as unknown as Gem, slot, socketColor);
		}

		idxs = idxs.filter(index => itemData[index].phase <= phase && matchesSearch(search, itemData[index], npcId => sim.db.getNpc(npcId)?.name));
		return sortItemIdxs(idxs, itemData, { sortBy, sortDirection, computeEP, isFavourited });
	}, [itemData, player, sim, slot, label, socketColor, phase, search, sortBy, sortDirection, computeEP, isFavourited, filters]);

	const equipped = equippedToItem(equippedItem);
	const equippedId = getItemIdByItemType(label, equipped);
	const equippedEP = equipped !== null && equipped !== undefined ? computeEP(equipped) : null;

	const sort = (next: ItemListSortBy) => {
		setSortDirection(current => (sortBy === next ? 1 - current : SortDirection.DESC));
		setSortBy(next);
	};

	const toggleFavourite = (row: ItemDataFields<ItemListType>) => {
		const next = sim.getFilters();
		if (!applyFavourite(next, label, row, !isFavourited(row))) return;
		sim.setFilters(next);
	};

	const showEPOptions = ![ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2].includes(slot);
	const showWeaponOptions =
		label === SelectorModalTabs.Items &&
		player.getPlayerClass().weaponTypes.length > 0 &&
		(slot === ItemSlot.ItemSlotMainHand || (slot === ItemSlot.ItemSlotOffHand && player.getClass() === Class.ClassWarrior));

	return (
		<>
			<div className="selector-modal-filters">
				<SearchBar value={search} onChange={setSearch} placeholder={i18n.t('common.search')} className="selector-modal-search" />
				{label === SelectorModalTabs.Items && (
					<>
						<button type="button" className="selector-modal-filters-button btn btn-primary" onClick={() => setFiltersOpen(true)}>
							{i18n.t('gear_tab.gear_picker.filters_button')}
						</button>
						{/* Rendered inside the dialog's own React tree, which is how Base UI knows the two are nested: a press in this one is not an outside press for the selector modal underneath it. */}
						<FiltersMenu slot={slot} open={filtersOpen} onOpenChange={setFiltersOpen} />
					</>
				)}
				<div className="selector-modal-phase-selector">
					<EnumPicker
						modObject={sim}
						config={{
							id: 'phase-selector',
							extraClassNames: ['phase-selector'],
							values: [
								{ name: i18n.t('common.phases.1'), value: 1 },
								{ name: i18n.t('common.phases.2'), value: 2 },
								{ name: i18n.t('common.phases.3'), value: 3 },
								{ name: i18n.t('common.phases.4'), value: 4 },
								{ name: i18n.t('common.phases.5'), value: 5 },
							],
							storeSubscribe: subject => subscribeSimField(subject, 'phase'),
							getValue: subject => subject.getPhase(),
							setValue: (subject, newValue) => subject.setPhase(newValue),
						}}
					/>
				</div>
				{/* Both weapon boxes are on every slot and hide themselves; only the picker inside is conditional. */}
				<div className={clsx('sim-input selector-modal-boolean-option selector-modal-show-1h-weapons', !showWeaponOptions && 'hide')}>
					{showWeaponOptions && (
						<BooleanPicker
							modObject={sim}
							config={{
								id: 'show-1h-weapons-selector',
								extraClassNames: ['show-1h-weapons-selector', 'mb-0'],
								label: i18n.t('settings_tab.other.show_1h_weapons.label'),
								inline: true,
								storeSubscribe: subject => subscribeSimField(subject, 'filters'),
								getValue: subject => subject.getFilters().oneHandedWeapons,
								setValue: (subject, newValue) => {
									const next = subject.getFilters();
									next.oneHandedWeapons = newValue;
									subject.setFilters(next);
								},
							}}
						/>
					)}
				</div>
				<div className={clsx('sim-input selector-modal-boolean-option selector-modal-show-2h-weapons', !showWeaponOptions && 'hide')}>
					{showWeaponOptions && (
						<BooleanPicker
							modObject={sim}
							config={{
								id: 'show-2h-weapons-selector',
								extraClassNames: ['show-2h-weapons-selector', 'mb-0'],
								label: i18n.t('settings_tab.other.show_2h_weapons.label'),
								inline: true,
								storeSubscribe: subject => subscribeSimField(subject, 'filters'),
								getValue: subject => subject.getFilters().twoHandedWeapons,
								setValue: (subject, newValue) => {
									const next = subject.getFilters();
									next.twoHandedWeapons = newValue;
									subject.setFilters(next);
								},
							}}
						/>
					)}
				</div>
				<div className={clsx('sim-input selector-modal-boolean-option selector-modal-show-matching-gems', !label.startsWith('Gem') && 'hide')}>
					<BooleanPicker
						modObject={sim}
						config={{
							id: 'show-matching-gems-selector',
							extraClassNames: ['show-matching-gems-selector', 'input-inline', 'mb-0'],
							label: i18n.t('settings_tab.other.show_matching_gems.label'),
							inline: true,
							storeSubscribe: subject => subscribeSimField(subject, 'filters'),
							getValue: subject => subject.getFilters().matchingGemsOnly,
							setValue: (subject, newValue) => {
								const next = subject.getFilters();
								next.matchingGemsOnly = newValue;
								subject.setFilters(next);
							},
						}}
					/>
				</div>
				{showEPOptions && (
					<div className="sim-input selector-modal-boolean-option selector-modal-show-ep-values">
						<BooleanPicker
							modObject={sim}
							config={{
								id: 'show-ep-values-selector',
								extraClassNames: ['show-ep-values-selector', 'input-inline', 'mb-0'],
								label: i18n.t('settings_tab.other.show_ep_values.label'),
								inline: true,
								storeSubscribe: subject => subscribeUiField(subject, 'showEPValues'),
								getValue: subject => subject.getShowEPValues(),
								setValue: (subject, newValue) => subject.setShowEPValues(newValue),
							}}
						/>
					</div>
				)}
				<button type="button" className="selector-modal-remove-button btn btn-danger" onClick={onRemove}>
					{removeButtonLabel(label, key => i18n.t(key))}
				</button>
			</div>
			<div className="selector-modal-list-labels">
				{(label === SelectorModalTabs.Items || label === SelectorModalTabs.Upgrades) && (
					<h6 className="ilvl-label interactive" onClick={() => sort(ItemListSortBy.ILVL)}>
						{i18n.t('gear_tab.gear_picker.table_headers.ilvl')}
					</h6>
				)}
				<h6 className="item-label">{columnHeaderLabel(label, getTranslatedTabLabel)}</h6>
				{label === SelectorModalTabs.Items && <h6 className="source-label">{i18n.t('gear_tab.gear_picker.table_headers.source')}</h6>}
				<h6 className="ep-label interactive" style={{ display: showEPValues ? undefined : 'none' }} onClick={() => sort(ItemListSortBy.EP)}>
					<span>EP</span>
					<Icon name="plus-minus" size="2xs" />
					<button type="button" className="btn btn-link p-0 ms-1" data-tooltip-id={`${tooltipId}-ep`}>
						<Icon name="question-circle" style="regular" size="lg" />
					</button>
				</h6>
				<h6 className="favorite-label" />
				<h6 className={clsx('compare-label', label !== SelectorModalTabs.Items && 'hide')} />
			</div>
			<div ref={listRef} className={clsx('selector-modal-list', !showEPValues && 'hide-ep')} tabIndex={0}>
				<VirtualList
					count={itemsToDisplay.length}
					rowHeight={ROW_HEIGHT}
					getScrollElement={() => listRef.current}
					rowClassName={index => clsx('selector-modal-list-item', itemData[itemsToDisplay[index]].id === equippedId && 'active')}
					renderRow={index => {
						const row = itemData[itemsToDisplay[index]];
						return (
							<ItemListRow
								itemData={row}
								label={label}
								slot={slot}
								equippedEP={equippedEP}
								itemEP={computeEP(row.item)}
								favourited={isFavourited(row)}
								favouriteTooltipId={`${tooltipId}-favourite`}
								compareTooltipId={`${tooltipId}-compare`}
								onEquip={() => row.onEquip(row.item)}
								onToggleFavourite={() => toggleFavourite(row)}
							/>
						);
					}}
				/>
			</div>
			{showEPOptions && <Tooltip id={`${tooltipId}-ep`} content={i18n.t('gear_tab.gear_picker.ep_tooltip')} />}
			<Tooltip
				id={`${tooltipId}-favourite`}
				render={({ activeAnchor }) =>
					(activeAnchor as HTMLElement | null)?.dataset.favourited === 'true' ? 'Remove from favorites' : 'Add to favorites'
				}
			/>
			<Tooltip
				id={`${tooltipId}-compare`}
				render={({ activeAnchor }) => ((activeAnchor as HTMLElement | null)?.dataset.inBatch === 'true' ? 'Remove from Batch Sim' : 'Add to Batch Sim')}
			/>
		</>
	);
};
