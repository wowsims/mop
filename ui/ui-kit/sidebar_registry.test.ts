import { describe, expect, it, vi } from 'vitest';

import { isCustomEntry, SidebarRegistry } from './sidebar_registry';

const button = (id: string, order?: number) => ({ id, label: id, onClick: () => {}, order });

const ids = (registry: SidebarRegistry) => registry.getEntries().map(entry => entry.id);

describe('SidebarRegistry', () => {
	it('keeps registration order for entries that set no order', () => {
		const registry = new SidebarRegistry();
		registry.add(button('dps-action'));
		registry.add(button('spec-feature'));
		registry.add(button('ep-weights-action'));

		expect(ids(registry)).toEqual(['dps-action', 'spec-feature', 'ep-weights-action']);
	});

	it('sorts by order and leaves equal orders in registration order', () => {
		const registry = new SidebarRegistry();
		registry.add(button('first', -1));
		registry.add(button('unordered-a'));
		registry.add(button('last', 1));
		registry.add(button('unordered-b'));

		expect(ids(registry)).toEqual(['first', 'unordered-a', 'unordered-b', 'last']);
	});

	it('returns one stable snapshot until an entry changes, so useSyncExternalStore does not loop', () => {
		const registry = new SidebarRegistry();
		expect(registry.getEntries()).toBe(registry.getEntries());

		registry.add(button('dps-action'));
		const snapshot = registry.getEntries();
		expect(registry.getEntries()).toBe(snapshot);
	});

	it('merges an update in place, keeping the entry where it was', () => {
		const registry = new SidebarRegistry();
		const action = registry.add(button('dps-action'));
		registry.add(button('ep-weights-action'));

		action.update({ disabled: true });

		expect(ids(registry)).toEqual(['dps-action', 'ep-weights-action']);
		const [entry] = registry.getEntries();
		expect(entry).toMatchObject({ id: 'dps-action', label: 'dps-action', disabled: true });
	});

	it('notifies subscribers on add and on update, and stops after unsubscribe', () => {
		const registry = new SidebarRegistry();
		const listener = vi.fn();
		const unsubscribe = registry.subscribe(listener);

		const action = registry.add(button('dps-action'));
		expect(listener).toHaveBeenCalledTimes(1);

		action.update({ disabled: true });
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
		action.update({ disabled: false });
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('tells a custom entry from a button entry', () => {
		const registry = new SidebarRegistry();
		registry.add(button('dps-action'));
		registry.add({ id: 'suggest-reforges', render: () => null });

		expect(registry.getEntries().map(isCustomEntry)).toEqual([false, true]);
	});
});
