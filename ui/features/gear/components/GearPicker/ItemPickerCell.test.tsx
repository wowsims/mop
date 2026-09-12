import { ItemLevelState, ItemQuality, ItemSlot, Spec } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
const tooltip = vi.hoisted(() => ({ settles: [] as Array<(url: string) => void> }));

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(store.subscribe));
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));
vi.mock('@sim/proto/action_id/dom', () => ({
	equippedItemWowheadTooltipData: () => new Promise<string>(resolve => tooltip.settles.push(resolve)),
	actionIdWowheadTooltipData: () => new Promise<string>(() => {}),
}));

const { ItemPickerCell } = await import('./ItemPickerCell');

const equippedItem = (id: number) =>
	({
		item: { id, name: `Item ${id}`, quality: ItemQuality.ItemQualityEpic, nameDescription: '' },
		ilvl: 463,
		ilvlFromBase: 0,
		upgrade: ItemLevelState.Base,
		gems: [],
		numPossibleSockets: 0,
		randomSuffix: undefined,
		enchant: undefined,
		tinker: undefined,
		asActionId: () => ({ itemId: id, spellId: 0 }),
		getReforgeData: () => undefined,
		allSocketColors: () => [],
		couldHaveExtraSocket: () => false,
		hasRandomSuffixOptions: () => false,
	}) as any;

describe('ItemPickerCell', () => {
	const setup = () => {
		let gear = { getEquippedItem: () => equippedItem(1), asArray: () => [equippedItem(1)] };
		const player = {
			sim: { getShowQuickSwap: () => false, store: createSimStore() },
			getGear: () => gear,
			getSpec: () => Spec.SpecUnknown,
		} as unknown as Player<any>;
		const host = fakeHost({ player });

		tooltip.settles.length = 0;
		const { container } = render(
			<SimHostProvider host={host}>
				<ItemPickerCell slot={ItemSlot.ItemSlotHead} ready={false} />
			</SimHostProvider>,
		);
		return {
			container,
			equip: (id: number) =>
				act(() => {
					gear = { getEquippedItem: () => equippedItem(id), asArray: () => [equippedItem(id)] };
					store.notify();
				}),
		};
	};

	const anchors = (container: HTMLElement) => [
		container.querySelector<HTMLElement>('.item-picker-icon')!,
		container.querySelector<HTMLElement>('.item-picker-name-container')!,
	];

	it('shows the tooltip the equipped item resolved to, on both the icon and the name', async () => {
		const { container } = setup();

		tooltip.settles[0]('item=1');
		await waitFor(() => expect(anchors(container).map(element => element.dataset.wowhead)).toEqual(['item=1', 'item=1']));
		expect(anchors(container).map(element => element.dataset.whtticon)).toEqual(['false', 'false']);
	});

	// The defect: a tooltip request for the item that was in the slot a moment ago must not land
	// on the cell after the slot moved on.
	it('drops a tooltip that resolved after the equipped item changed', async () => {
		const { container, equip } = setup();

		equip(2);
		expect(anchors(container).some(element => element.hasAttribute('data-wowhead'))).toBe(false);
		expect(tooltip.settles).toHaveLength(2);

		tooltip.settles[1]('item=2');
		await waitFor(() => expect(anchors(container).map(element => element.dataset.wowhead)).toEqual(['item=2', 'item=2']));

		tooltip.settles[0]('item=1');
		await Promise.resolve();
		await Promise.resolve();
		expect(anchors(container).map(element => element.dataset.wowhead)).toEqual(['item=2', 'item=2']);
	});
});
