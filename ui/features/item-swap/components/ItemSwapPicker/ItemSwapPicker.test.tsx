import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { IndividualSimHost } from '@sim/sim_host';
import { ItemSlot } from '@generated/proto/common';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const noopSubscribe = () => () => {};
vi.mock('@sim/state/subscriptions', () => ({ subscribePlayerField: () => noopSubscribe, subscribeAll: () => noopSubscribe }));
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));
vi.mock('@sim/proto_utils/action_id/dom', () => ({ setEquippedItemWowheadData: () => {} }));
vi.mock('@ui-kit/BooleanPicker', () => ({ BooleanPicker: () => <div className="boolean-picker-root" /> }));

const { ItemSwapPicker } = await import('./ItemSwapPicker');

const SLOTS = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1];

const setup = (enabled: boolean) => {
	const player = {
		itemSwapSettings: { getEnableItemSwap: () => enabled, getItem: () => null },
		isBlacksmithing: () => false,
	} as unknown as Player<any>;
	const host = { player, itemSwapSelectorModal: { openTab: vi.fn() } } as unknown as IndividualSimHost<any>;
	return render(
		<SimHostProvider host={host}>
			<ItemSwapPicker itemSlots={SLOTS} />
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

	it('hides the picker row while item swap is off', () => {
		const { container } = setup(false);

		expect(container.querySelector('.input-item-swap-container')!.classList.contains('hide')).toBe(true);
	});
});
