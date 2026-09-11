import { GemColor, ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { IndividualSimHost } from '@sim/sim_host';
import { act, fireEvent, render } from '@testing-library/react';
import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type OpenSelectorModal, type SelectorModalState, useSelectorModalState } from '../../hooks/useSelectorModal';
import { ALL_ITEM_SLOTS } from '../../model/gear_data';
import { type GearData, SelectorModalTabs } from '../../types';

const store = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		subscribe: (callback: () => void) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: () => store.subscribe,
	subscribeUiField: () => store.subscribe,
	subscribeAll: () => store.subscribe,
}));

const tabs = vi.hoisted(() => ({ build: vi.fn(), eligibility: vi.fn() }));
vi.mock('./utils', () => ({ buildSelectorTabs: tabs.build, eligibilityFor: tabs.eligibility }));

const panes = vi.hoisted(() => ({ rendered: [] as Array<{ label: string; slot: number }> }));
vi.mock('./ItemList', () => ({
	ItemList: ({ tab, slot }: any) => {
		panes.rendered.push({ label: tab.label, slot });
		return <div data-pane={tab.label} />;
	},
}));

vi.mock('./SlotRail', () => ({ SlotRail: () => <div className="gear-picker-modal-slots" /> }));

const { SelectorModal } = await import('./SelectorModal');

const tab = (label: SelectorModalTabs, socketIdx?: number) => ({
	label,
	socketColor: GemColor.GemColorRed,
	socketIdx,
	itemData: [],
	computeEP: () => 0,
	equippedToItem: () => null,
	onRemove: () => undefined,
});

const OPEN_SLOT = ALL_ITEM_SLOTS[3];

const item = (id: number): EquippedItem => {
	const stub = { id, gems: [], withChallengeMode: () => stub, withDynamicStats: () => stub };
	return stub as unknown as EquippedItem;
};

// `GearTabBody` holds the state and the pickers open it; the harness stands in for that pair, and
// records what the modal's own rail asks for.
const openSpy = vi.fn<OpenSelectorModal>();
let openModal: OpenSelectorModal;
let setModalOpen: (open: boolean) => void;
const Harness = () => {
	const state = useSelectorModalState();
	const wrapped = useMemo<SelectorModalState>(
		() => ({
			...state,
			openTab: (slot, tab, gearData) => {
				openSpy(slot, tab, gearData);
				state.openTab(slot, tab, gearData);
			},
		}),
		[state],
	);
	openModal = wrapped.openTab;
	setModalOpen = wrapped.setOpen;
	return <SelectorModal state={wrapped} />;
};

/** Cleared first, so only what the rail opens after this point is counted. */
const railOpens = () => {
	openSpy.mockClear();
	return openSpy;
};

describe('SelectorModal', () => {
	let equippedItems: Map<ItemSlot, EquippedItem | null>;
	let getEquippedItem: ReturnType<typeof vi.fn<() => EquippedItem | null>>;
	let host: IndividualSimHost<any>;
	let gearData: GearData;

	const setup = ({ tabSet = [tab(SelectorModalTabs.Items), tab(SelectorModalTabs.Enchants)], requestTab = SelectorModalTabs.Items } = {}) => {
		tabs.build.mockReturnValue(tabSet);
		const result = render(
			<SimHostProvider host={host}>
				<Harness />
			</SimHostProvider>,
		);
		act(() => openModal(OPEN_SLOT, requestTab, gearData));
		return result;
	};

	const tabButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.selector-modal-tabs .nav-link'));
	const openPanes = () => Array.from(document.querySelectorAll<HTMLElement>('.selector-modal-tab-pane.active [data-pane]')).map(pane => pane.dataset.pane);
	const popup = () => document.querySelector('.sim-dialog-popup.selector-modal')!;

	beforeEach(() => {
		openSpy.mockClear();
		panes.rendered.length = 0;
		equippedItems = new Map(ALL_ITEM_SLOTS.map(slot => [slot, item(slot)]));
		getEquippedItem = vi.fn(() => equippedItems.get(OPEN_SLOT) ?? null);
		gearData = { equipItem: () => undefined, getEquippedItem, subscribe: () => () => undefined };
		tabs.eligibility.mockReturnValue({ hasEnchants: true, hasReforges: true, hasUpgrades: true, socketCount: 2 });

		const rootElem = document.createElement('div');
		rootElem.className = 'sim-ui';
		document.body.appendChild(rootElem);
		host = {
			rootElem,
			player: {
				sim: {},
				getGear: () => ({ getEquippedItem: (slot: ItemSlot) => equippedItems.get(slot) ?? null }),
				isBlacksmithing: () => false,
				getChallengeModeEnabled: () => false,
				equipItem: () => undefined,
				getEquippedItem: (slot: ItemSlot) => equippedItems.get(slot) ?? null,
			},
		} as unknown as IndividualSimHost<any>;
	});

	afterEach(() => {
		host.rootElem.remove();
	});

	it('renders one tab button and one pane per tab the data earned, wired to each other', () => {
		setup({ tabSet: [tab(SelectorModalTabs.Items), tab(SelectorModalTabs.Reforging), tab(SelectorModalTabs.Gem1, 0)] });

		expect(tabButtons().map(button => button.dataset.label)).toEqual([SelectorModalTabs.Items, SelectorModalTabs.Reforging, SelectorModalTabs.Gem1]);
		expect(panes.rendered.map(pane => pane.label)).toEqual([SelectorModalTabs.Items, SelectorModalTabs.Reforging, SelectorModalTabs.Gem1]);
		for (const button of tabButtons()) {
			const pane = document.getElementById(button.getAttribute('aria-controls')!);
			expect(pane).not.toBeNull();
			expect(pane!.getAttribute('aria-labelledby')).toBe(button.id);
		}
	});

	it('marks a gem tab and gives it an icon instead of a label', () => {
		setup({ tabSet: [tab(SelectorModalTabs.Items), tab(SelectorModalTabs.Gem1, 0), tab(SelectorModalTabs.Gem2, 1)] });

		expect(tabButtons().map(button => button.classList.contains('selector-modal-tab-gem'))).toEqual([false, true, true]);
		expect(document.querySelectorAll('.selector-modal-tab-gem .gem-socket-container')).toHaveLength(2);
	});

	it('opens on the requested tab, and on Items when the request is one the slot no longer offers', () => {
		tabs.eligibility.mockReturnValue({ hasEnchants: false, hasReforges: true, hasUpgrades: true, socketCount: 2 });
		setup({ requestTab: SelectorModalTabs.Enchants });

		expect(tabButtons().find(button => button.classList.contains('active'))?.dataset.label).toBe(SelectorModalTabs.Items);
	});

	it('keeps the tab the user picks for the life of one request, and resets on the next', () => {
		setup();

		act(() => tabButtons()[1].click());
		expect(tabButtons().find(button => button.classList.contains('active'))?.dataset.label).toBe(SelectorModalTabs.Enchants);

		act(() => openModal(OPEN_SLOT, SelectorModalTabs.Items, gearData));
		expect(tabButtons().find(button => button.classList.contains('active'))?.dataset.label).toBe(SelectorModalTabs.Items);
	});

	it('falls back to the first tab when the one you were on is gone', () => {
		setup({ tabSet: [tab(SelectorModalTabs.Items), tab(SelectorModalTabs.Reforging), tab(SelectorModalTabs.Gem1, 0)] });

		act(() => tabButtons()[2].click());
		expect(tabButtons().find(button => button.classList.contains('active'))?.dataset.label).toBe(SelectorModalTabs.Gem1);

		panes.rendered.length = 0;
		tabs.build.mockReturnValue([tab(SelectorModalTabs.Items), tab(SelectorModalTabs.Reforging)]);
		act(() => {
			equippedItems.set(OPEN_SLOT, item(999));
			store.notify();
		});

		expect(tabButtons().find(button => button.classList.contains('active'))?.dataset.label).toBe(SelectorModalTabs.Items);
		expect(openPanes()).toEqual([SelectorModalTabs.Items]);
	});

	// Base UI stops keydown propagation at the popup, so the rail must listen on the popup rather
	// than the document.
	it('navigates the rail from the popup and not from the document', () => {
		setup();
		const openTab = railOpens();

		fireEvent.keyDown(document, { key: 'ArrowDown' });
		fireEvent.keyDown(document.body, { key: 'ArrowDown' });
		expect(openTab).not.toHaveBeenCalled();

		fireEvent.keyDown(popup(), { key: 'ArrowDown' });
		expect(openTab).toHaveBeenCalledTimes(1);
		expect(openTab.mock.calls[0][0]).toBe(ALL_ITEM_SLOTS[4]);
	});

	it('steps the rail by its own indices and wraps at both ends', () => {
		setup();
		const openTab = railOpens();

		fireEvent.keyDown(popup(), { key: 'ArrowUp' });
		expect(openTab.mock.calls[0][0]).toBe(ALL_ITEM_SLOTS[2]);

		act(() => openModal(ALL_ITEM_SLOTS[0], SelectorModalTabs.Items, gearData));
		fireEvent.keyDown(popup(), { key: 'ArrowUp' });
		expect(openTab.mock.calls.at(-1)![0]).toBe(ALL_ITEM_SLOTS.at(-1));

		act(() => openModal(ALL_ITEM_SLOTS.at(-1)!, SelectorModalTabs.Items, gearData));
		fireEvent.keyDown(popup(), { key: 'ArrowDown' });
		expect(openTab.mock.calls.at(-1)![0]).toBe(ALL_ITEM_SLOTS[0]);
	});

	it('carries the tab you are on into the slot the rail moves to', () => {
		setup();
		const openTab = railOpens();

		act(() => tabButtons()[1].click());
		fireEvent.keyDown(popup(), { key: 'ArrowDown' });
		expect(openTab.mock.calls[0][1]).toBe(SelectorModalTabs.Enchants);
	});

	it('leaves the rail keys alone once the modal is closed', () => {
		setup();
		const openTab = railOpens();
		const element = popup();

		act(() => setModalOpen(false));
		fireEvent.keyDown(element, { key: 'ArrowDown' });
		expect(openTab).not.toHaveBeenCalled();
	});

	// `Gear` copies the untouched slots' references forward, so the tab data is keyed on the open
	// slot's stored item rather than on the gear object.
	it('does not rebuild the tab data when a different slot changes', () => {
		setup();
		const before = getEquippedItem.mock.calls.length;

		act(() => {
			equippedItems.set(ALL_ITEM_SLOTS[0], item(42));
			store.notify();
		});
		expect(getEquippedItem.mock.calls.length).toBe(before);

		act(() => {
			equippedItems.set(OPEN_SLOT, item(43));
			store.notify();
		});
		expect(getEquippedItem.mock.calls.length).toBe(before + 1);
	});
});
