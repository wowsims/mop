import { ItemSlot, WeaponType } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { bulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore } from '@sim/state/sim_store';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/bulk/utils', async () => {
	const actual = await vi.importActual<typeof import('@sim/bulk/utils')>('@sim/bulk/utils');
	const { WeaponType: Types } = await import('@generated/proto/common');
	return { ...actual, getBulkFreezeWeaponTypes: () => [Types.WeaponTypeSword, Types.WeaponTypeAxe] };
});

const { FreezeWeaponTypes } = await import('./FreezeWeaponTypes');

const STORE_KEY = 4;
const SWORD = `#bulk-${ItemSlot.ItemSlotMainHand}-weapon-type-${WeaponType.WeaponTypeSword}`;

const mount = () => {
	const store = createSimStore();
	const player = { sim: { store }, storeKey: STORE_KEY } as unknown as Player<any>;
	seedBulkSettings(player);
	const host = { player, sim: player.sim } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<FreezeWeaponTypes slot={ItemSlot.ItemSlotMainHand} />
		</SimHostProvider>,
	);
	return { player, container, sword: container.querySelector<HTMLInputElement>(SWORD)! };
};

const mainhandFilter = (player: Player<any>) => bulkState(player).weaponTypeFilters.get(ItemSlot.ItemSlotMainHand)!;

describe('FreezeWeaponTypes', () => {
	it('shows the type as ticked after one click', () => {
		const { player, sword } = mount();

		fireEvent.click(sword);

		expect(mainhandFilter(player)).toEqual([WeaponType.WeaponTypeSword]);
		expect(sword.checked).toBe(true);
	});

	it('does not write a duplicate type when the same box is clicked twice', () => {
		const { player, sword } = mount();

		fireEvent.click(sword);
		fireEvent.click(sword);

		expect(mainhandFilter(player)).toEqual([]);
		expect(sword.checked).toBe(false);
	});
});
