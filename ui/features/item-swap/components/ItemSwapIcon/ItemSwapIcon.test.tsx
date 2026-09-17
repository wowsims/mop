import { OpenSelectorModalContext } from '@features/gear/hooks/useSelectorModal';
import type { GearData } from '@features/gear/types';
import { GemColor, ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { ItemSwapGear } from '@sim/proto/gear';
import { createSimStore, PLAYER_FIELDS, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackReleases = (store: SimStore) => {
	const releases: Array<ReturnType<typeof vi.fn>> = [];
	const real = store.subscribe.bind(store) as (...args: Array<unknown>) => () => void;
	vi.spyOn(store, 'subscribe').mockImplementation(((...args: Array<unknown>) => {
		const release = vi.fn(real(...args));
		releases.push(release);
		return release;
	}) as unknown as SimStore['subscribe']);
	return releases;
};

vi.mock('@ui-kit/hooks/useActionId', () => ({
	useActionId: (actionId?: { itemId: number }) =>
		actionId
			? { iconUrl: `icon-${actionId.itemId}.jpg`, name: `Item ${actionId.itemId}`, href: `https://wowhead.test/item=${actionId.itemId}`, ready: true }
			: { iconUrl: '', name: '', href: '', ready: true },
}));

const tooltip = { settles: [] as Array<(url: string) => void> };
vi.mock('@sim/proto/action_id/tooltip_data', () => ({
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
	const store = createSimStore();
	const releases = trackReleases(store);
	const storeKey = 0;
	seedKeyed(store, 'players', storeKey, {
		itemSwapGear: new ItemSwapGear(Object.fromEntries(swap)),
		v: zeroVersions(PLAYER_FIELDS),
	} as never);
	const player = {
		storeKey,
		sim: { store },
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
	return { view, equipItem, openTab, releases };
};

const icons = (container: Element) => [
	...container.querySelectorAll<HTMLAnchorElement>('[data-testid="icon-picker-root"] > a[data-testid="icon-picker-button"]'),
];

beforeEach(() => {
	tooltip.settles.length = 0;
});

describe('ItemSwapIcon', () => {
	it('renders one picker root per swap slot, unfilled and carrying the slot placeholder', () => {
		const { view } = setup();

		expect(view.container.querySelectorAll('[data-testid="icon-picker-root"]')).toHaveLength(SLOTS.length);
		expect(icons(view.container).map(icon => icon.hasAttribute('data-active'))).toEqual([false, false, false, false]);
		expect(icons(view.container)[0].style.backgroundImage).toContain('/mop/assets/item_slots/mainhand.jpg');
	});

	it('marks a filled slot active and links it to the item, which is what the swap probe reads', () => {
		const { view } = setup(new Map([[ItemSlot.ItemSlotMainHand, equippedItem(1234)]]));

		const [mainHand] = icons(view.container);
		expect(mainHand.hasAttribute('data-active')).toBe(true);
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

		const root = view.container.querySelector('[data-testid="icon-picker-root"]')!;
		expect([...root.children].map(child => child.tagName.toLowerCase())).toEqual(['a', 'div']);
		expect(root.querySelector('[data-testid="icon-picker-button"][data-active]')).toBe(root.children[0]);
		expect(root.children[1].getAttribute('data-testid')).toBe('item-picker-sockets-container');
		expect(root.querySelectorAll('[data-testid="item-picker-sockets-container"] [data-testid="gem-socket-container"]')).toHaveLength(2);
		expect(root.querySelector('[data-testid="icon-picker-button"] a')).toBeNull();
	});

	it('keeps the sockets container on an empty slot, so both builds serialise the same element', () => {
		const { view } = setup();

		expect(view.container.querySelectorAll('[data-testid="item-picker-sockets-container"]')).toHaveLength(SLOTS.length);
		expect(view.container.querySelector('[data-testid="item-picker-sockets-container"]')!.children).toHaveLength(0);
	});

	it('opens one shared modal on the slot the icon was clicked for', () => {
		const { view, openTab } = setup();

		icons(view.container).forEach(icon => icon.click());

		expect(openTab).toHaveBeenCalledTimes(SLOTS.length);
		expect(openTab.mock.calls.map(([slot]) => slot)).toEqual(SLOTS);
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

	it('holds a live store listener per mounted icon, and releases every one of them on unmount', () => {
		const { view, releases } = setup();

		expect(releases.length).toBeGreaterThan(0);
		expect(releases.filter(release => release.mock.calls.length > 0)).toHaveLength(0);

		view.unmount();

		expect(releases.filter(release => release.mock.calls.length === 0)).toHaveLength(0);
	});
});
