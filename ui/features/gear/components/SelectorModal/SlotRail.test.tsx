import { ItemSlot } from '@generated/proto/common';
import type { Gear } from '@sim/proto/gear';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ALL_ITEM_SLOTS } from '../../model/gear_data';

vi.mock('./SlotRailIcon', () => ({
	SlotRailIcon: ({ slot, active, onOpen }: { slot: ItemSlot; active: boolean; onOpen: () => void }) => (
		<button data-slot={slot} data-active={String(active)} onClick={onOpen} />
	),
}));
vi.mock('@ui-kit/Tooltip', () => ({ Tooltip: ({ id }: { id: string }) => <div data-testid="rail-tooltip" data-id={id} /> }));

const { SlotRail } = await import('./SlotRail');

describe('SlotRail', () => {
	const equippedItems = new Map(ALL_ITEM_SLOTS.map(slot => [slot, { slot }]));
	const gear = { getEquippedItem: vi.fn((slot: ItemSlot) => equippedItems.get(slot)) } as unknown as Gear;

	it('renders one icon per slot, in slot order, inside the slots container', () => {
		const { container } = render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={null} onOpen={vi.fn()} />);

		const slotsContainer = container.querySelector('.gear-picker-modal-slots')!;
		const buttons = slotsContainer.querySelectorAll<HTMLButtonElement>('button');
		expect(buttons.length).toBe(ALL_ITEM_SLOTS.length);
		expect(Array.from(buttons).map(button => Number(button.dataset.slot))).toEqual(ALL_ITEM_SLOTS);
	});

	it('marks only the icon matching currentSlot as active', () => {
		const { container } = render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={ItemSlot.ItemSlotFeet} onOpen={vi.fn()} />);

		const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
		expect(buttons.filter(button => button.dataset.active === 'true').map(button => Number(button.dataset.slot))).toEqual([ItemSlot.ItemSlotFeet]);
	});

	it('marks no icon active when currentSlot is null', () => {
		const { container } = render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={null} onOpen={vi.fn()} />);

		const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
		expect(buttons.some(button => button.dataset.active === 'true')).toBe(false);
	});

	it('passes each icon the equipped item for its own slot', () => {
		render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={null} onOpen={vi.fn()} />);

		ALL_ITEM_SLOTS.forEach(slot => {
			expect(gear.getEquippedItem).toHaveBeenCalledWith(slot);
		});
		expect(gear.getEquippedItem).toHaveReturnedWith(equippedItems.get(ItemSlot.ItemSlotFeet));
	});

	it('opens the clicked slot, not the first one', () => {
		const onOpen = vi.fn();
		const { container } = render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={null} onOpen={onOpen} />);

		const targetSlot = ALL_ITEM_SLOTS[3];
		container.querySelector<HTMLButtonElement>(`button[data-slot="${targetSlot}"]`)!.click();
		expect(onOpen).toHaveBeenCalledExactlyOnceWith(targetSlot);
	});

	it('renders a single shared tooltip for the whole rail', () => {
		const { container } = render(<SlotRail gear={gear} isBlacksmithing={false} currentSlot={null} onOpen={vi.fn()} />);

		expect(container.querySelectorAll('[data-testid="rail-tooltip"]')).toHaveLength(1);
	});
});
