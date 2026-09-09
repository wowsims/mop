import { Class, GemColor, ItemLevelState, ItemQuality, ItemSlot, ScalingItemProperties } from '@generated/proto/common';
import { DatabaseFilters, UIItem as Item } from '@generated/proto/ui';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { IndividualSimHost } from '@sim/sim_host';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ItemData, type ItemListType, SelectorModalTabs } from '../../types';
import type { SelectorTab } from './utils';

const store = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		subscribe: (callback: () => void) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeSimField: () => store.subscribe,
	subscribeUiField: () => store.subscribe,
	subscribeBulkField: () => store.subscribe,
	subscribeAll: () => store.subscribe,
}));

// Every row, so the assertions are about what the list selected rather than what it windowed.
vi.mock('@ui-kit/VirtualList', () => ({
	VirtualList: ({ count, rowClassName, renderRow }: any) => (
		<div className="virtual-list">
			{Array.from({ length: count }, (_unused, index) => (
				<div key={index} className={`virtual-list-row ${rowClassName?.(index) ?? ''}`}>
					{renderRow(index)}
				</div>
			))}
		</div>
	),
}));

vi.mock('./ItemListRow', () => ({
	ItemListRow: ({ itemData, itemEP, equippedEP, favourited, onToggleFavourite }: any) => (
		<span data-row={itemData.name} data-ep={itemEP} data-equipped-ep={String(equippedEP)} data-favourited={String(favourited)}>
			<button type="button" data-toggle={itemData.name} onClick={onToggleFavourite} />
		</span>
	),
}));

const filtersMenu = vi.hoisted(() => ({ opens: [] as boolean[], setOpen: null as ((open: boolean) => void) | null }));
vi.mock('../FiltersMenu', () => ({
	FiltersMenu: ({ open, onOpenChange, slot }: any) => {
		filtersMenu.opens.push(open);
		filtersMenu.setOpen = onOpenChange;
		return <span data-filters-menu={String(open)} data-filters-slot={slot} />;
	},
}));

const { ItemList } = await import('./ItemList');

// `sortItemIdxs` reads the base scaling entry, not `ilvl`, whenever it sorts by item level.
const item = (id: number, name: string, ilvl: number) =>
	Item.create({
		id,
		name,
		ilvl,
		quality: ItemQuality.ItemQualityEpic,
		scalingOptions: { [ItemLevelState.Base]: ScalingItemProperties.create({ ilvl }) },
	});

const row = (id: number, name: string, ilvl: number, phase = 1): ItemData<ItemListType, string> => ({
	item: item(id, name, ilvl) as unknown as ItemListType,
	name,
	searchText: name,
	id,
	actionId: { itemId: id } as any,
	quality: ItemQuality.ItemQualityEpic,
	phase,
	ilvl,
	ignoreEPFilter: false,
	nameDescription: '',
	onEquip: () => undefined,
});

const ROWS = [row(1, 'Alpha', 500), row(2, 'Beta', 520), row(3, 'Gamma', 510)];

describe('ItemList', () => {
	let filters: DatabaseFilters;
	let showEPValues: boolean;
	let host: IndividualSimHost<any>;
	let setFilters: ReturnType<typeof vi.fn>;

	const tab = (label: SelectorModalTabs, over: Partial<SelectorTab> = {}): SelectorTab =>
		({
			label,
			socketColor: GemColor.GemColorRed,
			itemData: ROWS,
			computeEP: (candidate: any) => candidate?.ilvl ?? 0,
			equippedToItem: (equipped: EquippedItem | null) => equipped?.item ?? null,
			onRemove: () => undefined,
			...over,
		}) as SelectorTab;

	const setup = ({
		label = SelectorModalTabs.Items,
		slot = ItemSlot.ItemSlotHead,
		equipped = null as EquippedItem | null,
		over = {} as Partial<SelectorTab>,
	} = {}) =>
		render(
			<SimHostProvider host={host}>
				<ItemList id="pane" tabId="pane-tab" tab={tab(label, over)} slot={slot} equippedItem={equipped} active />
			</SimHostProvider>,
		);

	const names = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-row]')).map(node => (node as HTMLElement).dataset.row);
	const headers = (container: HTMLElement) =>
		Array.from(container.querySelectorAll('.selector-modal-list-labels h6')).map(node => Array.from(node.classList)[0]);

	beforeEach(() => {
		filtersMenu.opens.length = 0;
		filters = DatabaseFilters.create({});
		showEPValues = true;
		setFilters = vi.fn((next: DatabaseFilters) => {
			filters = next;
		});
		host = {
			player: {
				sim: {
					db: { getNpc: () => undefined },
					getFilters: () => DatabaseFilters.clone(filters),
					setFilters,
					getPhase: () => 5,
					getShowEPValues: () => showEPValues,
				},
				getEquippedItem: () => null,
				getPlayerClass: () => ({ weaponTypes: [{ weaponType: 1 }] }),
				getClass: () => Class.ClassWarrior,
				filterItemData: (idxs: number[]) => idxs,
				filterEnchantData: (idxs: number[]) => idxs,
				filterGemData: (idxs: number[]) => idxs,
			},
		} as unknown as IndividualSimHost<any>;
	});

	it('offers the filters button and its dialog only on the items tab', () => {
		const { container, unmount } = setup();
		expect(container.querySelector('.selector-modal-filters-button')).not.toBeNull();
		expect(container.querySelector('[data-filters-menu]')?.getAttribute('data-filters-slot')).toBe(String(ItemSlot.ItemSlotHead));
		unmount();

		const enchants = setup({ label: SelectorModalTabs.Enchants });
		expect(enchants.container.querySelector('.selector-modal-filters-button')).toBeNull();
		expect(enchants.container.querySelector('[data-filters-menu]')).toBeNull();
	});

	it('opens the filters dialog from the filters button', () => {
		const { container } = setup();
		expect(container.querySelector('[data-filters-menu]')?.getAttribute('data-filters-menu')).toBe('false');

		act(() => container.querySelector<HTMLButtonElement>('.selector-modal-filters-button')!.click());
		expect(container.querySelector('[data-filters-menu]')?.getAttribute('data-filters-menu')).toBe('true');

		act(() => filtersMenu.setOpen!(false));
		expect(container.querySelector('[data-filters-menu]')?.getAttribute('data-filters-menu')).toBe('false');
	});

	it('withholds the EP option and the EP column from a trinket slot, which it computes no EP for', () => {
		const { container, unmount } = setup({ slot: ItemSlot.ItemSlotTrinket1 });
		expect(container.querySelector('.selector-modal-show-ep-values')).toBeNull();
		expect(container.querySelector('#show-ep-values-selector')).toBeNull();
		unmount();

		const head = setup();
		expect(head.container.querySelector('.selector-modal-show-ep-values')).not.toBeNull();
		expect(head.container.querySelector('#show-ep-values-selector')).not.toBeNull();
	});

	it('shows the matching-gems option on a gem tab and hides it everywhere else', () => {
		const { container, unmount } = setup();
		expect(container.querySelector('.selector-modal-show-matching-gems')!.classList.contains('hide')).toBe(true);
		unmount();

		const gems = setup({ label: SelectorModalTabs.Gem2 });
		expect(gems.container.querySelector('.selector-modal-show-matching-gems')!.classList.contains('hide')).toBe(false);
	});

	it('offers the weapon options in a main hand and, for a warrior, an off hand — never in another slot', () => {
		const shown = (slot: ItemSlot, label = SelectorModalTabs.Items) => {
			const { container, unmount } = setup({ slot, label });
			const hidden = container.querySelector('.selector-modal-show-1h-weapons')!.classList.contains('hide');
			expect(!!container.querySelector('#show-1h-weapons-selector')).toBe(!hidden);
			unmount();
			return !hidden;
		};

		expect(shown(ItemSlot.ItemSlotMainHand)).toBe(true);
		expect(shown(ItemSlot.ItemSlotOffHand)).toBe(true);
		expect(shown(ItemSlot.ItemSlotHead)).toBe(false);
		expect(shown(ItemSlot.ItemSlotMainHand, SelectorModalTabs.Enchants)).toBe(false);
	});

	it('withholds the off hand weapon options from a class that is not a warrior', () => {
		(host.player as any).getClass = () => Class.ClassRogue;
		const { container } = setup({ slot: ItemSlot.ItemSlotOffHand });
		expect(container.querySelector('.selector-modal-show-2h-weapons')!.classList.contains('hide')).toBe(true);
	});

	it('names the remove button after the tab it is on', () => {
		const labelFor = (label: SelectorModalTabs) => {
			const { container, unmount } = setup({ label });
			const text = container.querySelector('.selector-modal-remove-button')!.textContent;
			unmount();
			return text;
		};

		expect(labelFor(SelectorModalTabs.Items)).toContain('unequip_item');
		expect(labelFor(SelectorModalTabs.Enchants)).toContain('remove_enchant');
		expect(labelFor(SelectorModalTabs.Gem3)).toContain('remove_gem');
	});

	it('gives the ilvl column to items and upgrades and the source column to items alone', () => {
		const { container, unmount } = setup();
		expect(headers(container)).toEqual(['ilvl-label', 'item-label', 'source-label', 'ep-label', 'favorite-label', 'compare-label']);
		unmount();

		const upgrades = setup({ label: SelectorModalTabs.Upgrades });
		expect(headers(upgrades.container)).toEqual(['ilvl-label', 'item-label', 'ep-label', 'favorite-label', 'compare-label']);
		upgrades.unmount();

		const enchants = setup({ label: SelectorModalTabs.Enchants });
		expect(headers(enchants.container)).toEqual(['item-label', 'ep-label', 'favorite-label', 'compare-label']);
	});

	it('narrows the rows to the search, without losing the sort the user chose', () => {
		const { container } = setup();
		expect(names(container)).toEqual(['Beta', 'Gamma', 'Alpha']);

		act(() => container.querySelector<HTMLElement>('.ilvl-label')!.click());
		expect(names(container)).toEqual(['Beta', 'Gamma', 'Alpha']);
		act(() => container.querySelector<HTMLElement>('.ilvl-label')!.click());
		expect(names(container)).toEqual(['Alpha', 'Gamma', 'Beta']);

		// The vanilla list re-derived `sortBy` on every keystroke, so a chosen sort was undone by the
		// next character typed.
		fireEvent.change(container.querySelector('.selector-modal-search')!, { target: { value: 'a' } });
		expect(names(container)).toEqual(['Alpha', 'Gamma', 'Beta']);

		fireEvent.change(container.querySelector('.selector-modal-search')!, { target: { value: 'bet' } });
		expect(names(container)).toEqual(['Beta']);
	});

	it('drops a row from a later phase than the one the sim is on', () => {
		(host.player.sim as any).getPhase = () => 2;
		const { container } = setup({ over: { itemData: [row(1, 'Alpha', 500, 1), row(2, 'Beta', 520, 5)] } });
		expect(names(container)).toEqual(['Alpha']);
	});

	it('marks the equipped row active and hands the row its EP against the equipped one', () => {
		const equipped = { item: item(2, 'Beta', 520) } as unknown as EquippedItem;
		const { container } = setup({ equipped });

		const rows = Array.from(container.querySelectorAll('.virtual-list-row'));
		expect(rows.map(node => node.classList.contains('active'))).toEqual([true, false, false]);
		expect(Array.from(container.querySelectorAll('[data-row]')).map(node => (node as HTMLElement).dataset.equippedEp)).toEqual(['520', '520', '520']);
	});

	it('floats a favourited row to the top and writes a toggle back through the sim', () => {
		filters = DatabaseFilters.create({ favoriteItems: [1] });
		const { container } = setup();
		expect(names(container)).toEqual(['Alpha', 'Beta', 'Gamma']);
		expect(Array.from(container.querySelectorAll('[data-row]')).map(node => (node as HTMLElement).dataset.favourited)).toEqual(['true', 'false', 'false']);

		act(() => container.querySelector<HTMLButtonElement>('[data-toggle=Beta]')!.click());
		expect(setFilters.mock.calls[0][0].favoriteItems).toEqual([1, 2]);

		act(() => container.querySelector<HTMLButtonElement>('[data-toggle=Alpha]')!.click());
		expect(setFilters.mock.calls[1][0].favoriteItems).toEqual([2]);
	});

	it('hides the EP column through the list class when EP values are off', () => {
		showEPValues = false;
		const { container } = setup();
		expect(container.querySelector('.selector-modal-list')!.classList.contains('hide-ep')).toBe(true);
		expect(container.querySelector<HTMLElement>('.ep-label')!.style.display).toBe('none');
	});

	it('re-reads the rows when the sim announces a filter change', () => {
		const { container } = setup();
		expect(names(container)).toEqual(['Beta', 'Gamma', 'Alpha']);

		act(() => {
			filters = DatabaseFilters.create({ favoriteItems: [3] });
			store.notify();
		});
		expect(names(container)).toEqual(['Gamma', 'Beta', 'Alpha']);
	});
});
