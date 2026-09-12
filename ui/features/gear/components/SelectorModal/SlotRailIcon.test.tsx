import { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getEmptySlotIconUrl } from '../../model/empty_slot_icons';

const useActionId = vi.hoisted(() => vi.fn(() => ({ iconUrl: 'item-icon.jpg', name: '', href: 'https://wowhead.com/item=1', ready: true })));
const useWowheadDataset = vi.hoisted(() => vi.fn());

vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId }));
vi.mock('@ui-kit/hooks/useWowheadDataset', () => ({ useWowheadDataset }));
vi.mock('@sim/proto/action_id/dom', () => ({
	equippedItemWowheadTooltipData: () => Promise.resolve(''),
}));

const { SlotRailIcon } = await import('./SlotRailIcon');

const equippedItem = (id: number) =>
	({
		asActionId: () => ({ itemId: id, spellId: 0 }),
	}) as unknown as EquippedItem;

const setup = (props: Partial<Parameters<typeof SlotRailIcon>[0]> = {}) => {
	const host = fakeHost();
	const onOpen = vi.fn();
	const result = render(
		<SimHostProvider host={host}>
			<SlotRailIcon slot={ItemSlot.ItemSlotHead} item={null} isBlacksmithing={false} active={false} tooltipId="rail-tooltip" onOpen={onOpen} {...props} />
		</SimHostProvider>,
	);
	return { ...result, onOpen };
};

describe('SlotRailIcon', () => {
	it('marks the wrapper with the slot and only goes active when told to', () => {
		const { container, rerender } = setup({ slot: ItemSlot.ItemSlotFeet, active: false });
		let wrapper = container.querySelector<HTMLElement>('.item-picker-icon-wrapper')!;
		expect(wrapper.dataset.slot).toBe(String(ItemSlot.ItemSlotFeet));
		expect(wrapper.classList.contains('active')).toBe(false);

		rerender(
			<SimHostProvider host={fakeHost()}>
				<SlotRailIcon slot={ItemSlot.ItemSlotFeet} item={null} isBlacksmithing={false} active={true} tooltipId="rail-tooltip" onOpen={vi.fn()} />
			</SimHostProvider>,
		);
		wrapper = container.querySelector<HTMLElement>('.item-picker-icon-wrapper')!;
		expect(wrapper.classList.contains('active')).toBe(true);
	});

	it('shows the equipped item icon when a slot is filled', () => {
		const { container } = setup({ item: equippedItem(1) });
		const anchor = container.querySelector<HTMLElement>('.item-picker-icon')!;
		expect(anchor.style.backgroundImage).toContain('item-icon.jpg');
	});

	it('falls back to the empty slot icon, which differs per slot, when no item is equipped', () => {
		const head = setup({ slot: ItemSlot.ItemSlotHead, item: null });
		const feet = setup({ slot: ItemSlot.ItemSlotFeet, item: null });
		const headAnchor = head.container.querySelector<HTMLElement>('.item-picker-icon')!;
		const feetAnchor = feet.container.querySelector<HTMLElement>('.item-picker-icon')!;
		expect(headAnchor.style.backgroundImage).toContain(getEmptySlotIconUrl(ItemSlot.ItemSlotHead));
		expect(feetAnchor.style.backgroundImage).toContain(getEmptySlotIconUrl(ItemSlot.ItemSlotFeet));
		expect(headAnchor.style.backgroundImage).not.toBe(feetAnchor.style.backgroundImage);
	});

	it('opens the picker exactly once on click and links to the resolved action id', () => {
		const { container, onOpen } = setup({ item: equippedItem(1) });
		const anchor = container.querySelector<HTMLAnchorElement>('.item-picker-icon')!;
		expect(anchor.href).toBe('https://wowhead.com/item=1');

		anchor.click();
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it('carries the shared tooltip id and the translated slot label', () => {
		const { container } = setup({ slot: ItemSlot.ItemSlotWaist, tooltipId: 'rail-tooltip' });
		const anchor = container.querySelector<HTMLElement>('.item-picker-icon')!;
		expect(anchor.dataset.tooltipId).toBe('rail-tooltip');
		expect(anchor.dataset.slotLabel).toBe(translateSlotName(ItemSlot.ItemSlotWaist));
	});

	it('only asks for a wowhead tooltip resolver when a slot is filled', () => {
		setup({ item: equippedItem(1) });
		expect(useWowheadDataset).toHaveBeenLastCalledWith(expect.any(Function));

		useWowheadDataset.mockClear();
		setup({ item: null });
		expect(useWowheadDataset).toHaveBeenLastCalledWith(null);
	});
});
