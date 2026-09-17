import { OpenSelectorModalContext } from '@features/gear/hooks/useSelectorModal';
import { ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { ItemSwapGear } from '@sim/proto/gear';
import { createSimStore, PLAYER_FIELDS, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions());
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));
vi.mock('@ui-kit/BooleanPicker', () => ({ BooleanPicker: () => <div className="boolean-picker-root" /> }));

const { ItemSwapPicker } = await import('./ItemSwapPicker');

const SLOTS = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1];

const setup = (enabled: boolean) => {
	const store = createSimStore();
	const storeKey = 0;
	seedKeyed(store, 'players', storeKey, { itemSwapEnabled: enabled, itemSwapGear: new ItemSwapGear({}), v: zeroVersions(PLAYER_FIELDS) } as never);
	const player = {
		storeKey,
		sim: { store },
		itemSwapSettings: { getEnableItemSwap: () => enabled, getItem: () => null },
	} as unknown as Player<any>;
	const host = fakeHost({ player });
	return render(
		<SimHostProvider host={host}>
			<OpenSelectorModalContext value={vi.fn()}>
				<ItemSwapPicker itemSlots={SLOTS} />
			</OpenSelectorModalContext>
		</SimHostProvider>,
	);
};

describe('ItemSwapPicker', () => {
	it('puts one icon per swap slot directly in the icon group', () => {
		const { container } = setup(true);

		const group = container.querySelector('[data-picker-group].ui-picker-group-icons')!;
		expect(group.children).toHaveLength(SLOTS.length);
		expect([...group.children].every(child => child.getAttribute('data-testid') === 'icon-picker-root')).toBe(true);
	});

	it('renders no picker row while item swap is off', () => {
		const { container } = setup(false);

		expect(container.querySelector('[data-testid="input-item-swap-container"]')).toBeNull();
		expect(container.querySelector('.picker-group.ui-picker-group-icons')).toBeNull();
	});
});
