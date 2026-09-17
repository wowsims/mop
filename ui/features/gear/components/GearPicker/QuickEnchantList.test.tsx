import { ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { createSimStore, patchSlice, PLAYER_FIELDS, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));

const { QuickEnchantList } = await import('./QuickEnchantList');

const ENCHANT = { effectId: 4444, type: 0, name: 'Test Enchant', quality: 4, spellId: 9, itemId: 0 };

const equippedItem = (id: string) => ({
	id,
	enchant: undefined,
	tinker: undefined,
	withEnchant: (enchant: typeof ENCHANT) => ({ id, enchant }),
});

describe('QuickEnchantList', () => {
	const setup = () => {
		let equipped = equippedItem('first');
		const equipItem = vi.fn();
		const storeKey = 0;
		const store = createSimStore();
		seedKeyed(store, 'players', storeKey, { gear: { getEquippedItem: () => equipped }, v: zeroVersions(PLAYER_FIELDS) } as never);
		patchSlice(store, 'sim', { filters: { favoriteEnchants: ['4444-0'] } as never });
		const player = {
			storeKey,
			sim: { store },
			getEnchants: () => [ENCHANT],
			getTinkers: () => [],
			getEquippedItem: () => equipped,
			equipItem,
		} as unknown as Player<any>;
		const host = fakeHost({ player, sim: { store } });
		const view = render(
			<SimHostProvider host={host}>
				<QuickEnchantList slot={ItemSlot.ItemSlotHead} onOpenDetail={() => {}} />
			</SimHostProvider>,
		);
		return { view, equipItem, swapSlotTo: (id: string) => (equipped = equippedItem(id)) };
	};

	it('lists the eligible favourites', () => {
		const { view } = setup();

		expect([...view.container.querySelectorAll('[data-testid="tooltip-quick-swap__label"]')].map(label => label.textContent)).toEqual(['Test Enchant']);
	});

	it('enchants the item that is in the slot at click time, not the one it rendered', () => {
		const { view, equipItem, swapSlotTo } = setup();

		swapSlotTo('second');
		view.container.querySelector<HTMLAnchorElement>('[data-testid="tooltip-quick-swap__anchor"]')!.click();

		expect(equipItem).toHaveBeenCalledWith(ItemSlot.ItemSlotHead, { id: 'second', enchant: ENCHANT });
	});
});
