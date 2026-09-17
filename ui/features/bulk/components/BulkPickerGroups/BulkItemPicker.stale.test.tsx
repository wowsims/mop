import { ItemSlot, ItemSpec } from '@generated/proto/common';
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { bulkState, patchBulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore, patchKeyed, PLAYER_FIELDS, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@features/gear/components/ItemCell', () => ({
	ItemDetailCell: ({
		className,
		rootDataAttributes,
		action,
		testId,
	}: {
		className?: unknown;
		rootDataAttributes?: Record<string, string>;
		action?: unknown;
		testId?: string;
	}) => (
		<div data-testid={testId} className={String(className)} {...rootDataAttributes}>
			{action as never}
		</div>
	),
}));

vi.mock('@sim/proto/items', async () => {
	const actual = await vi.importActual<typeof import('@sim/proto/items')>('@sim/proto/items');
	return { ...actual, getEligibleItemSlots: () => [ItemSlot.ItemSlotFinger1], canEquipItem: () => true };
});

vi.mock('@sim/player/classes/capabilities', async () => {
	const actual = await vi.importActual<typeof import('@sim/player/classes/capabilities')>('@sim/player/classes/capabilities');
	return { ...actual, isSpecDualWield2HCapable: () => false };
});

vi.mock('@sim/bulk/utils', async () => {
	const actual = await vi.importActual<typeof import('@sim/bulk/utils')>('@sim/bulk/utils');
	return { ...actual, getBulkPlayerCanDualWield: () => true };
});

const { BulkPickerGroups } = await import('./BulkPickerGroups');
const { createBulkGearData } = await import('../../model/gear_data');
const { addBulkItems, loadEquippedBulkItems, seedBulkPickerGroups } = await import('../../model/items');

const STORE_KEY = 7;

const fakeItem = (id: number, name: string): EquippedItem => {
	const item = {
		id,
		item: { id, name, unique: false },
		_item: { id, name, unique: false },
		asSpec: () => ItemSpec.create({ id }),
		equals: (other: EquippedItem | null) => !!other && other.id === id,
		withChallengeMode: () => item as unknown as EquippedItem,
		withDynamicStats: () => item as unknown as EquippedItem,
	};
	return item as unknown as EquippedItem;
};

const BATCHED = fakeItem(1, 'Batched Ring');
const WORN = fakeItem(2, 'Worn Ring');

const mount = () => {
	const store = createSimStore();
	const gear = { getEquippedItem: () => null };
	seedKeyed(store, 'players', STORE_KEY, { gear, v: zeroVersions(PLAYER_FIELDS) } as never);

	const db = { lookupItemSpec: (spec: ItemSpec) => (spec.id === WORN.id ? WORN : spec.id === BATCHED.id ? BATCHED : null) };
	const player = {
		sim: { store, db, isNative: false },
		storeKey: STORE_KEY,
		getGear: () => gear,
		getEquippedItems: () => [WORN],
		getChallengeModeEnabled: () => false,
		getSpec: () => 0,
		getPlayerSpec: () => ({ friendlyName: 'test' }),
	} as unknown as Player<any>;

	seedBulkSettings(player);
	seedBulkPickerGroups(player);
	addBulkItems(player, [BATCHED.asSpec()], true);

	const host = { player, sim: player.sim } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<BulkPickerGroups />
		</SimHostProvider>,
	);

	const cell = () => container.querySelector<HTMLElement>('[data-testid="bulk-item-picker"]')!;
	return {
		player,
		cell,
		view: () => ({
			equipped: cell().hasAttribute('data-equipped'),
			border: cell().className.includes('border-brand') ? 'brand' : 'plain',
			removable: !!cell().querySelector('[data-testid="item-picker-actions-btn"]'),
		}),
	};
};

const WEAPON_BEFORE = fakeItem(11, 'Old Axe');
const WEAPON_AFTER = fakeItem(12, 'New Axe');

const mountFrozenWeapon = () => {
	const store = createSimStore();
	let worn = WEAPON_BEFORE;
	const gearOf = (weapon: EquippedItem) => ({ getEquippedItem: (slot: ItemSlot) => (slot === ItemSlot.ItemSlotMainHand ? weapon : null) });
	let gear = gearOf(worn);
	seedKeyed(store, 'players', STORE_KEY, { gear, v: zeroVersions(PLAYER_FIELDS) } as never);

	const player = {
		sim: { store, db: { lookupItemSpec: () => null }, isNative: false },
		storeKey: STORE_KEY,
		getGear: () => gear,
		getEquippedItems: () => {
			const slots: Array<EquippedItem> = [];
			slots[ItemSlot.ItemSlotMainHand] = worn;
			return slots;
		},
		getChallengeModeEnabled: () => false,
		getSpec: () => 0,
		getPlayerSpec: () => ({ friendlyName: 'test' }),
	} as unknown as Player<any>;

	seedBulkSettings(player);
	seedBulkPickerGroups(player);
	patchBulkState(player, { frozenWeaponSlot: ItemSlot.ItemSlotMainHand });
	loadEquippedBulkItems(player);

	const host = { player, sim: player.sim } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<BulkPickerGroups />
		</SimHostProvider>,
	);

	const cell = () => container.querySelector<HTMLElement>('[data-testid="bulk-item-picker"]')!;
	return {
		player,
		cell,
		swapWeapon: () =>
			act(() => {
				worn = WEAPON_AFTER;
				gear = gearOf(worn);
				patchKeyed(store, 'players', STORE_KEY, { gear } as never, ['gear']);
				loadEquippedBulkItems(player);
			}),
		frozen: () => cell().hasAttribute('data-frozen'),
	};
};

describe('BulkItemPicker when the batch entry is swapped for an item the player is wearing', () => {
	it('seeds one editable cell for the batched ring', () => {
		const h = mount();
		expect(bulkState(h.player).pickerGroups.get(BulkSimItemSlot.ItemSlotFinger)).toEqual([{ index: 0, item: BATCHED }]);
		expect(h.view()).toEqual({ equipped: false, border: 'plain', removable: true });
	});

	it('replaces the entry item in the store while keeping the same mounted instance', () => {
		const h = mount();
		const before = h.cell();

		act(() => createBulkGearData(h.player, BulkSimItemSlot.ItemSlotFinger, 0).equipItem(WORN));

		expect(bulkState(h.player).pickerGroups.get(BulkSimItemSlot.ItemSlotFinger)).toEqual([{ index: 0, item: WORN }]);
		expect(h.cell()).toBe(before);
	});

	it('marks the cell as equipped and non-removable in the commit that brings the worn item', () => {
		const h = mount();

		act(() => createBulkGearData(h.player, BulkSimItemSlot.ItemSlotFinger, 0).equipItem(WORN));

		expect(h.view()).toEqual({ equipped: true, border: 'brand', removable: false });
	});

	it('catches up on the next unrelated bulk notification, showing the value is one behind rather than lost', () => {
		const h = mount();

		act(() => createBulkGearData(h.player, BulkSimItemSlot.ItemSlotFinger, 0).equipItem(WORN));
		act(() => patchBulkState(h.player, {}, ['items']));

		expect(h.view()).toEqual({ equipped: true, border: 'brand', removable: false });
	});
});

describe('BulkItemPicker on the frozen main-hand cell when the player swaps that weapon', () => {
	it('shows the frozen weapon cell as frozen before the swap', () => {
		const h = mountFrozenWeapon();
		expect(bulkState(h.player).pickerGroups.get(BulkSimItemSlot.ItemSlotHandWeapon)).toEqual([{ index: -1, item: WEAPON_BEFORE }]);
		expect(h.frozen()).toBe(true);
	});

	it('keeps the same mounted instance while the equipped entry item is replaced', () => {
		const h = mountFrozenWeapon();
		const before = h.cell();

		h.swapWeapon();

		expect(bulkState(h.player).pickerGroups.get(BulkSimItemSlot.ItemSlotHandWeapon)).toEqual([{ index: -1, item: WEAPON_AFTER }]);
		expect(h.cell()).toBe(before);
	});

	it('keeps the frozen slot marked frozen in the commit that brings the new weapon', () => {
		const h = mountFrozenWeapon();

		h.swapWeapon();

		expect(h.frozen()).toBe(true);
	});

	it('restores the frozen marking on the next unrelated bulk notification', () => {
		const h = mountFrozenWeapon();

		h.swapWeapon();
		act(() => patchBulkState(h.player, {}, ['items']));

		expect(h.frozen()).toBe(true);
	});
});
