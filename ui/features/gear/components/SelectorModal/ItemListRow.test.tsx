import { ItemQuality, ItemSlot, type ItemSpec } from '@generated/proto/common';
import type { UIItem as Item } from '@generated/proto/ui';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { fakeHost } from '@sim/testing';
import { fireEvent, render } from '@testing-library/react';
import { itemQualityClassName } from '@ui-kit/utils/css';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ItemData, ItemListType } from '../../types';
import { SelectorModalTabs } from '../../types';

// The batch seam is mocked rather than driven: the row only asks whether the item is in the batch
// and calls one of two writes, and both are plain functions over the player now.
const batch = vi.hoisted(() => ({
	hasItem: vi.fn((_spec?: unknown) => false),
	addItem: vi.fn((_spec?: unknown) => undefined),
	removeItem: vi.fn((_spec?: unknown) => undefined),
}));

const store = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	const state = {};
	return {
		subscribe: (callback: () => void) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		getState: () => state,
		getInitialState: () => state,
	};
});

vi.mock('@ui-kit/hooks/useActionId', () => ({
	useActionId: () => ({ iconUrl: 'icon-url.png', name: 'item-name', href: 'https://example.com/item', ready: true }),
}));
vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(store.subscribe));
vi.mock('@features/bulk/model/items', () => ({
	hasBulkItem: (_player: unknown, spec: ItemSpec) => batch.hasItem(spec),
	addBulkItem: (_player: unknown, spec: ItemSpec) => batch.addItem(spec),
	removeBulkItem: (_player: unknown, spec: ItemSpec) => batch.removeItem(spec),
}));
vi.mock('../../../../tracking/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('./ItemSource', () => ({ ItemSource: () => <div data-testid="item-source-marker" /> }));
vi.mock('../GearPicker/ItemNoticeIcon', () => ({ ItemNoticeIcon: () => <div data-testid="item-notice-marker" /> }));

const { ItemListRow } = await import('./ItemListRow');
type ItemListRowProps = Parameters<typeof ItemListRow>[0];

const makeItemData = (overrides: Partial<ItemData<ItemListType, ReactNode>> = {}): ItemData<ItemListType, ReactNode> => ({
	item: { id: 1, ilvl: 0 } as Item,
	searchText: '',
	id: 1,
	actionId: {} as ItemData<ItemListType, ReactNode>['actionId'],
	quality: ItemQuality.ItemQualityEpic,
	phase: 1,
	ignoreEPFilter: false,
	nameDescription: '',
	onEquip: vi.fn(),
	name: 'Test Item',
	...overrides,
});

const renderRow = (
	overrides: Partial<ItemListRowProps> = {},
	batchOverrides: Partial<{ hasItem: ReturnType<typeof vi.fn>; addItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> }> = {},
	onWrapperClick?: () => void,
) => {
	Object.assign(batch, { hasItem: vi.fn(() => false), addItem: vi.fn(), removeItem: vi.fn() }, batchOverrides);
	const host = fakeHost({ sim: { store } });

	const props: ItemListRowProps = {
		itemData: makeItemData(),
		label: SelectorModalTabs.Items,
		slot: ItemSlot.ItemSlotHead,
		equippedEP: null,
		itemEP: 0,
		favourited: false,
		favouriteTooltipId: 'fav-tooltip',
		compareTooltipId: 'compare-tooltip',
		onEquip: vi.fn(),
		onToggleFavourite: vi.fn(),
		...overrides,
	};

	const tree = (next: ItemListRowProps) => (
		<SimHostProvider host={host}>
			<div onClick={onWrapperClick}>
				<ItemListRow {...next} />
			</div>
		</SimHostProvider>
	);
	const { container, rerender } = render(tree(props));

	return {
		container,
		wrapper: container.firstElementChild as HTMLElement,
		batch,
		props,
		rerender: (next: Partial<ItemListRowProps>) => rerender(tree({ ...props, ...next })),
	};
};

describe('ItemListRow', () => {
	it('renders the six list cells in order on the items tab', () => {
		const { wrapper } = renderRow();
		expect(Array.from(wrapper.children).map(child => child.className)).toEqual([
			'selector-modal-list-item-ilvl-container',
			'selector-modal-list-label-cell gap-1',
			'selector-modal-list-item-source-container',
			'selector-modal-list-item-ep',
			'selector-modal-list-item-favorite-container',
			'selector-modal-list-item-compare-container',
		]);
	});

	it('omits the ilvl cell outside the items and upgrades tabs', () => {
		const { container } = renderRow({ label: SelectorModalTabs.Enchants });
		expect(container.querySelector('.selector-modal-list-item-ilvl-container')).toBeNull();
	});

	it('prefers the itemData ilvl over the item ilvl', () => {
		const { container } = renderRow({ itemData: makeItemData({ ilvl: 500, item: { id: 1, ilvl: 400 } as Item }) });
		expect(container.querySelector('.selector-modal-list-item-ilvl-container')?.textContent).toBe('500');
	});

	it('falls back to the item ilvl when the itemData ilvl is unset', () => {
		const { container } = renderRow({ itemData: makeItemData({ ilvl: 0, item: { id: 1, ilvl: 450 } as Item }) });
		expect(container.querySelector('.selector-modal-list-item-ilvl-container')?.textContent).toBe('450');
	});

	it('renders the item source cell only on the items tab', () => {
		const items = renderRow({ label: SelectorModalTabs.Items });
		expect(items.container.querySelector('.selector-modal-list-item-source-container')).not.toBeNull();

		const upgrades = renderRow({ label: SelectorModalTabs.Upgrades });
		expect(upgrades.container.querySelector('.selector-modal-list-item-source-container')).toBeNull();
	});

	it('hides the ep cell for trinket slots', () => {
		const trinket1 = renderRow({ slot: ItemSlot.ItemSlotTrinket1 });
		expect(trinket1.container.querySelector('.selector-modal-list-item-ep')).toBeNull();

		const trinket2 = renderRow({ slot: ItemSlot.ItemSlotTrinket2 });
		expect(trinket2.container.querySelector('.selector-modal-list-item-ep')).toBeNull();

		const head = renderRow({ slot: ItemSlot.ItemSlotHead });
		expect(head.container.querySelector('.selector-modal-list-item-ep')).not.toBeNull();
	});

	it('formats ep with one decimal below the rounding boundary and rounds at or above it', () => {
		const below = renderRow({ itemEP: 9.94 });
		expect(below.container.querySelector('.selector-modal-list-item-ep-value')?.textContent).toBe('9.9');

		const above = renderRow({ itemEP: 9.95 });
		expect(above.container.querySelector('.selector-modal-list-item-ep-value')?.textContent).toBe('10');
	});

	it('omits the delta when there is no equipped item to compare against', () => {
		const { container } = renderRow({ equippedEP: null, itemEP: 5 });
		expect(container.querySelector('.selector-modal-list-item-ep-delta')?.textContent).toBe('');
	});

	it('omits the delta when the equipped and candidate ep are equal', () => {
		const { container } = renderRow({ equippedEP: 5, itemEP: 5 });
		expect(container.querySelector('.selector-modal-list-item-ep-delta')?.textContent).toBe('');
	});

	it('shows a positive delta for a higher-ep item', () => {
		const { container } = renderRow({ equippedEP: 5, itemEP: 8 });
		const delta = container.querySelector('.selector-modal-list-item-ep-delta');
		expect(delta?.textContent).toBe('+3');
		expect(delta?.classList.contains('positive')).toBe(true);
	});

	it('shows a negative delta for a lower-ep item', () => {
		const { container } = renderRow({ equippedEP: 8, itemEP: 5 });
		const delta = container.querySelector('.selector-modal-list-item-ep-delta');
		expect(delta?.textContent).toBe('-3');
		expect(delta?.classList.contains('negative')).toBe(true);
	});

	it('carries the item quality class on the name, and wires the icon and anchor to useActionId', () => {
		const { container } = renderRow({ itemData: makeItemData({ quality: ItemQuality.ItemQualityLegendary }) });
		const name = container.querySelector('.selector-modal-list-item-name');
		expect(name?.classList.contains(itemQualityClassName(ItemQuality.ItemQualityLegendary)!)).toBe(true);
		expect(container.querySelector('.selector-modal-list-item-icon')?.getAttribute('src')).toBe('icon-url.png');
		expect(container.querySelector('.selector-modal-list-item-link')?.getAttribute('href')).toBe('https://example.com/item');
	});

	it('renders the name description label only when set', () => {
		const withDescription = renderRow({ itemData: makeItemData({ nameDescription: 'Heroic' }) });
		expect(withDescription.container.querySelector('.heroic-label')?.textContent).toBe('(Heroic)');

		const withoutDescription = renderRow({ itemData: makeItemData({ nameDescription: '' }) });
		expect(withoutDescription.container.querySelector('.heroic-label')).toBeNull();
	});

	it('calls onEquip when the row link is clicked', () => {
		const onEquip = vi.fn();
		const { container } = renderRow({ onEquip });
		fireEvent.click(container.querySelector('.selector-modal-list-item-link')!);
		expect(onEquip).toHaveBeenCalledTimes(1);
	});

	it('clicking the favourite star toggles favourite and does not bubble to the row or equip', () => {
		const onEquip = vi.fn();
		const onToggleFavourite = vi.fn();
		const onWrapperClick = vi.fn();
		const { container } = renderRow({ onEquip, onToggleFavourite }, {}, onWrapperClick);

		fireEvent.click(container.querySelector('.selector-modal-list-item-favorite')!);

		expect(onToggleFavourite).toHaveBeenCalledTimes(1);
		expect(onEquip).not.toHaveBeenCalled();
		expect(onWrapperClick).not.toHaveBeenCalled();
	});

	it('marks the favourite button data attributes and swaps the star style', () => {
		const favouritedRow = renderRow({ favourited: true, favouriteTooltipId: 'fav-42' });
		const favouritedButton = favouritedRow.container.querySelector('.selector-modal-list-item-favorite')!;
		expect(favouritedButton.getAttribute('data-favourited')).toBe('true');
		expect(favouritedButton.getAttribute('data-tooltip-id')).toBe('fav-42');
		expect(favouritedButton.querySelector('i')?.classList.contains('fas')).toBe(true);

		const unfavouritedRow = renderRow({ favourited: false });
		const unfavouritedButton = unfavouritedRow.container.querySelector('.selector-modal-list-item-favorite')!;
		expect(unfavouritedButton.getAttribute('data-favourited')).toBe('false');
		expect(unfavouritedButton.querySelector('i')?.classList.contains('far')).toBe(true);
	});

	it('reflects whether the item is already in the bulk batch', () => {
		const inBatch = renderRow({}, { hasItem: vi.fn(() => true) });
		expect(inBatch.container.querySelector('.selector-modal-list-item-compare')?.getAttribute('data-in-batch')).toBe('true');

		const notInBatch = renderRow({}, { hasItem: vi.fn(() => false) });
		expect(notInBatch.container.querySelector('.selector-modal-list-item-compare')?.getAttribute('data-in-batch')).toBe('false');
	});

	it('adds the item to the batch when absent, and removes it when present', () => {
		const notInBatch = renderRow({ itemData: makeItemData({ id: 7 }) }, { hasItem: vi.fn(() => false) });
		fireEvent.click(notInBatch.container.querySelector('.selector-modal-list-item-compare')!);
		expect(notInBatch.batch.addItem).toHaveBeenCalledTimes(1);
		expect(notInBatch.batch.removeItem).not.toHaveBeenCalled();

		const inBatch = renderRow({ itemData: makeItemData({ id: 7 }) }, { hasItem: vi.fn(() => true) });
		fireEvent.click(inBatch.container.querySelector('.selector-modal-list-item-compare')!);
		expect(inBatch.batch.removeItem).toHaveBeenCalledTimes(1);
		expect(inBatch.batch.addItem).not.toHaveBeenCalled();
	});

	it('re-reads the batch flag when a recycled row is handed a different item', () => {
		const { container, rerender } = renderRow({ itemData: makeItemData({ id: 1 }) }, { hasItem: vi.fn((spec: any) => spec.id === 2) });
		const compare = () => container.querySelector('.selector-modal-list-item-compare')!;
		expect(compare().getAttribute('data-in-batch')).toBe('false');

		rerender({ itemData: makeItemData({ id: 2 }) });

		expect(compare().getAttribute('data-in-batch')).toBe('true');
	});

	it('acts on the item the recycled row now shows, not the one it showed before', () => {
		const { container, batch, rerender } = renderRow({ itemData: makeItemData({ id: 1 }) }, { hasItem: vi.fn((spec: any) => spec.id === 1) });

		rerender({ itemData: makeItemData({ id: 2 }) });
		fireEvent.click(container.querySelector('.selector-modal-list-item-compare')!);

		expect(batch.addItem).toHaveBeenCalledTimes(1);
		expect(batch.removeItem).not.toHaveBeenCalled();
	});

	it('renders the compare container on the items tab alone', () => {
		const items = renderRow({ label: SelectorModalTabs.Items });
		expect(items.container.querySelector('.selector-modal-list-item-compare-container')).not.toBeNull();

		const enchants = renderRow({ label: SelectorModalTabs.Enchants });
		expect(enchants.container.querySelector('.selector-modal-list-item-compare-container')).toBeNull();
	});
});
