import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { bulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore } from '@sim/state/sim_store';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const SET_ID = 1144;

vi.mock('../../model/selectors', async () => {
	const actual = await vi.importActual<typeof import('../../model/selectors')>('../../model/selectors');
	// One identity: zustand compares the selector's result, so a fresh array per call renders forever.
	const setBonuses = [{ setId: SET_ID, setName: 'Battlegear', totalPieces: 5 }];
	return { ...actual, availableSetBonuses: () => setBonuses, setBonusFeasibility: () => () => true };
});

const { RequiredSetBonuses } = await import('./RequiredSetBonuses');

const STORE_KEY = 6;

const mount = () => {
	const store = createSimStore();
	const player = { sim: { store }, storeKey: STORE_KEY } as unknown as Player<any>;
	seedBulkSettings(player);
	const host = { player, sim: player.sim } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<RequiredSetBonuses />
		</SimHostProvider>,
	);
	const box = (suffix: string) => container.querySelectorAll<HTMLInputElement>('.boolean-picker-input')[suffix === '2p' ? 0 : 1];
	return { player, box };
};

const requiredPieces = (player: Player<any>) => bulkState(player).requiredSetBonuses.get(SET_ID)?.pieces;

describe('RequiredSetBonuses', () => {
	it('shows the 2P box as ticked after one click', () => {
		const { player, box } = mount();
		const twoPiece = box('2p');

		fireEvent.click(twoPiece);

		expect(requiredPieces(player)).toBe(2);
		expect(twoPiece.checked).toBe(true);
	});

	it('shows the 4P box as ticked after one click', () => {
		const { player, box } = mount();
		const fourPiece = box('4p');

		fireEvent.click(fourPiece);

		expect(requiredPieces(player)).toBe(4);
		expect(fourPiece.checked).toBe(true);
	});
});
