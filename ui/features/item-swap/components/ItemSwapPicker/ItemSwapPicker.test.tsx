import { OpenSelectorModalContext } from '@features/gear/hooks/useSelectorModal';
import { ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions());
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));
vi.mock('@sim/proto/action_id/dom', () => ({ setEquippedItemWowheadData: () => {} }));
vi.mock('@ui-kit/BooleanPicker', () => ({ BooleanPicker: () => <div className="boolean-picker-root" /> }));

const { ItemSwapPicker } = await import('./ItemSwapPicker');

const SLOTS = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1];

const setup = (enabled: boolean) => {
	const player = {
		sim: { store: createSimStore() },
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

		const group = container.querySelector('.picker-group.icon-group')!;
		expect(group.children).toHaveLength(SLOTS.length);
		expect([...group.children].every(child => child.classList.contains('icon-picker-root'))).toBe(true);
	});

	it('renders no picker row while item swap is off', () => {
		const { container } = setup(false);

		expect(container.querySelector('.input-item-swap-container')).toBeNull();
		expect(container.querySelector('.picker-group.icon-group')).toBeNull();
	});
});
