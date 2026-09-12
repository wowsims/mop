import { ItemSlot } from '@generated/proto/common';
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { bulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore } from '@sim/state/sim_store';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/bulk/utils', async () => {
	const actual = await vi.importActual<typeof import('@sim/bulk/utils')>('@sim/bulk/utils');
	return { ...actual, getBulkPlayerCanDualWield: () => true, getBulkFreezeWeaponTypes: () => [] };
});
vi.mock('../../model/run', () => ({ runBulkBatch: vi.fn() }));

const { BulkSettings } = await import('./BulkSettings');

const STORE_KEY = 5;
const RING = { id: 1, equals: () => false } as unknown as EquippedItem;

const mount = () => {
	const store = createSimStore();
	const gear = { getEquippedItem: (slot: ItemSlot) => (slot === ItemSlot.ItemSlotFinger1 ? RING : null) };
	const player = { sim: { store, isNative: false }, storeKey: STORE_KEY, getGear: () => gear } as unknown as Player<any>;
	seedBulkSettings(player);
	const host = { player, sim: player.sim } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<BulkSettings />
		</SimHostProvider>,
	);
	const select = (id: string) => container.querySelector<HTMLSelectElement>(`#${id}`)!;
	return { player, container, select, checkbox: (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)! };
};

describe('BulkSettings', () => {
	it('shows the legacy bulk sim toggle as ticked after one click', () => {
		const { player, checkbox } = mount();
		const input = checkbox('use-legacy-bulk-sim');

		fireEvent.click(input);

		expect(bulkState(player).useLegacyBulkSim).toBe(true);
		expect(input.checked).toBe(true);
	});

	it('shows the inherit upgrades toggle as unticked after one click', () => {
		const { player, checkbox } = mount();
		const input = checkbox('inherit-upgrades');
		expect(input.checked).toBe(true);

		fireEvent.click(input);

		expect(bulkState(player).inheritUpgrades).toBe(false);
		expect(input.checked).toBe(false);
	});

	it('keeps the picked slot in the freeze ring select', () => {
		const { player, select } = mount();
		const ring = select('freeze-ring');

		fireEvent.change(ring, { target: { value: String(ItemSlot.ItemSlotFinger1) } });

		expect(bulkState(player).frozenItems.get(BulkSimItemSlot.ItemSlotFinger)).toBe(RING);
		expect(ring.value).toBe(String(ItemSlot.ItemSlotFinger1));
	});

	it('keeps the picked slot in the freeze weapon select', () => {
		const { player, select } = mount();
		const weapon = select('freeze-weapon');

		fireEvent.change(weapon, { target: { value: String(ItemSlot.ItemSlotMainHand) } });

		expect(bulkState(player).frozenWeaponSlot).toBe(ItemSlot.ItemSlotMainHand);
		expect(weapon.value).toBe(String(ItemSlot.ItemSlotMainHand));
	});
});
