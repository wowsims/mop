import { OpenSelectorModalContext } from '@features/gear/hooks/useSelectorModal';
import type { GearData } from '@features/gear/types';
import { GemColor, ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Release = ReturnType<typeof vi.fn>;

const released: Release[] = [];

const recordingSubscribe = () => (_onChange: () => void) => {
	const release = vi.fn();
	released.push(release);
	return release;
};

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(recordingSubscribe()));

vi.mock('@ui-kit/hooks/useActionId', () => ({
	useActionId: (actionId?: { itemId: number }) =>
		actionId
			? { iconUrl: `icon-${actionId.itemId}.jpg`, name: `Item ${actionId.itemId}`, href: `https://wowhead.test/item=${actionId.itemId}`, ready: true }
			: { iconUrl: '', name: '', href: '', ready: true },
}));

const tooltip = { settles: [] as Array<(url: string) => void> };
vi.mock('@sim/proto/action_id/dom', () => ({
	equippedItemWowheadTooltipData: () => new Promise<string>(resolve => tooltip.settles.push(resolve)),
}));

const { ItemSwapIcon } = await import('./ItemSwapIcon');

const SLOTS = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2];

const equippedItem = (itemId: number, socketColors: GemColor[] = []) =>
	({
		asActionId: () => ({ itemId }),
		// The selector modal reads a swap item through the same decorators the gear picker uses, so the
		// double has to answer them or `createItemSwapGearData` throws before it returns anything.
		withChallengeMode() {
			return this;
		},
		withDynamicStats() {
			return this;
		},
		allSocketColors: () => socketColors,
		gems: socketColors.map(() => null),
		numPossibleSockets: socketColors.length,
		couldHaveExtraSocket: () => false,
	}) as unknown as EquippedItem;

const setup = (swap: Map<ItemSlot, EquippedItem> = new Map(), slots: ItemSlot[] = SLOTS) => {
	const equipItem = vi.fn();
	const openTab = vi.fn();
	const player = {
		sim: { store: createSimStore() },
		itemSwapSettings: { getItem: (slot: ItemSlot) => swap.get(slot) ?? null, equipItem },
		getChallengeModeEnabled: () => false,
	} as unknown as Player<any>;
	const host = fakeHost({ player });
	const view = render(
		<SimHostProvider host={host}>
			<OpenSelectorModalContext value={openTab}>
				{slots.map(slot => (
					<ItemSwapIcon key={slot} slot={slot} />
				))}
			</OpenSelectorModalContext>
		</SimHostProvider>,
	);
	return { view, equipItem, openTab };
};

const icons = (container: Element) => [...container.querySelectorAll<HTMLAnchorElement>('.icon-picker-root > a.icon-picker-button')];

beforeEach(() => {
	released.length = 0;
	tooltip.settles.length = 0;
});

describe('ItemSwapIcon', () => {
	it('renders one picker root per swap slot, unfilled and carrying the slot placeholder', () => {
		const { view } = setup();

		expect(view.container.querySelectorAll('.icon-picker-root.icon-picker')).toHaveLength(SLOTS.length);
		expect(icons(view.container).map(icon => icon.classList.contains('active'))).toEqual([false, false, false, false]);
		expect(icons(view.container)[0].style.backgroundImage).toContain('/mop/assets/item_slots/mainhand.jpg');
	});

	it('marks a filled slot active and links it to the item, which is what the swap probe reads', () => {
		const { view } = setup(new Map([[ItemSlot.ItemSlotMainHand, equippedItem(1234)]]));

		const [mainHand] = icons(view.container);
		expect(mainHand.classList.contains('active')).toBe(true);
		expect(mainHand.getAttribute('href')).toBe('https://wowhead.test/item=1234');
		expect(mainHand.style.backgroundImage).toContain('icon-1234.jpg');
	});

	it('writes the resolved tooltip data onto a filled slot, and marks it as carrying its own icon', async () => {
		const { view } = setup(new Map([[ItemSlot.ItemSlotMainHand, equippedItem(1234)]]));

		expect(icons(view.container).map(icon => icon.dataset.whtticon)).toEqual(['false', undefined, undefined, undefined]);
		expect(tooltip.settles).toHaveLength(1);

		tooltip.settles[0]('item=1234');
		await waitFor(() => expect(icons(view.container)[0].dataset.wowhead).toBe('item=1234'));
	});

	it('hangs the sockets off the picker root rather than inside the icon anchor', () => {
		const { view } = setup(new Map([[ItemSlot.ItemSlotMainHand, equippedItem(1234, [GemColor.GemColorRed, GemColor.GemColorBlue])]]));

		const root = view.container.querySelector('.icon-picker-root')!;
		expect([...root.children].map(child => `${child.tagName.toLowerCase()}.${[...child.classList].sort().join('.')}`)).toEqual([
			'a.active.icon-picker-button',
			'div.item-picker-sockets-container',
		]);
		expect(root.querySelectorAll('.item-picker-sockets-container .gem-socket-container')).toHaveLength(2);
		expect(root.querySelector('.icon-picker-button a')).toBeNull();
	});

	it('keeps the sockets container on an empty slot, so both builds serialise the same element', () => {
		const { view } = setup();

		expect(view.container.querySelectorAll('.item-picker-sockets-container')).toHaveLength(SLOTS.length);
		expect(view.container.querySelector('.item-picker-sockets-container')!.children).toHaveLength(0);
	});

	it('opens one shared modal on the slot the icon was clicked for', () => {
		const { view, openTab } = setup();

		icons(view.container).forEach(icon => icon.click());

		expect(openTab).toHaveBeenCalledTimes(SLOTS.length);
		expect(openTab.mock.calls.map(([slot]) => slot)).toEqual(SLOTS);
		expect(new Set(openTab.mock.instances)).toHaveProperty('size', 1);
		expect(openTab.mock.calls.map(([, tab]) => tab)).toEqual(['Items', 'Items', 'Items', 'Items']);
	});

	it('hands the modal gear data that reads and writes the swap set, not the equipped one', () => {
		const item = equippedItem(1234);
		const { view, openTab, equipItem } = setup(new Map([[ItemSlot.ItemSlotOffHand, item]]));

		icons(view.container)[1].click();

		const gearData = openTab.mock.calls[0][2] as GearData;
		expect(gearData.getEquippedItem()).toBe(item);
		gearData.equipItem(null);
		expect(equipItem).toHaveBeenCalledWith(ItemSlot.ItemSlotOffHand, null);
	});

	it('releases every store subscription when the icons unmount', () => {
		const { view } = setup();

		expect(released.length).toBe(SLOTS.length);
		expect(released.filter(release => release.mock.calls.length)).toHaveLength(0);

		view.unmount();

		expect(released.filter(release => release.mock.calls.length)).toHaveLength(released.length);
	});
});
