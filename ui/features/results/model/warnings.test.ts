import type { SimWarning } from '@sim/sim_host';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { describe, expect, it } from 'vitest';

import { WarningsRegistry } from './warnings';

const source = () => {
	const listeners: Array<() => void> = [];
	const subscribe = ((onChange: () => void) => {
		listeners.push(onChange);
		return () => {
			const index = listeners.indexOf(onChange);
			if (index != -1) listeners.splice(index, 1);
		};
	}) as StoreSubscribe;
	return {
		subscribe,
		fire: () => listeners.slice().forEach(listener => listener()),
		get listeners() {
			return listeners.length;
		},
	};
};

const warning = (getContent: SimWarning['getContent']) => {
	const store = source();
	return { store, warning: { updateOn: store.subscribe, getContent } satisfies SimWarning };
};

describe('WarningsRegistry', () => {
	it('starts empty', () => {
		expect(new WarningsRegistry().getContents()).toEqual([]);
	});

	it("treats '' as off", () => {
		const registry = new WarningsRegistry();
		let content = '';
		registry.add(warning(() => content).warning);

		expect(registry.getContents()).toEqual([]);
		content = 'gear';
		expect(registry.getContents()).toEqual(['gear']);
	});

	it('flattens an array return and drops only its empty entries', () => {
		const registry = new WarningsRegistry();
		registry.add(warning(() => ['one', '', 'two']).warning);
		registry.add(warning(() => 'three').warning);

		expect(registry.getContents()).toEqual(['one', 'two', 'three']);
	});

	// Risk 3 in the plan: `parity.mjs` compares `hide` on the warning item at load, so a filter widened
	// to `.trim()` would change that class on any spec whose warning returns whitespace.
	it('keeps a whitespace-only warning, because the filter is strict', () => {
		const registry = new WarningsRegistry();
		registry.add(warning(() => ' ').warning);

		expect(registry.getContents()).toEqual([' ']);
	});

	it('builds a fresh array per read', () => {
		const registry = new WarningsRegistry();
		registry.add(warning(() => 'gear').warning);

		expect(registry.getContents()).toEqual(registry.getContents());
		expect(registry.getContents()).not.toBe(registry.getContents());
	});

	it("notifies subscribers when a warning's own source fires", () => {
		const registry = new WarningsRegistry();
		const gear = warning(() => 'gear');
		registry.add(gear.warning);

		let notifications = 0;
		registry.subscribe(() => notifications++);
		gear.store.fire();
		gear.store.fire();

		expect(notifications).toBe(2);
	});

	it('notifies subscribers when a warning is added after them', () => {
		const registry = new WarningsRegistry();
		let notifications = 0;
		registry.subscribe(() => notifications++);

		registry.add(warning(() => 'gear').warning);

		expect(notifications).toBe(1);
	});

	it('stops notifying an unsubscribed listener', () => {
		const registry = new WarningsRegistry();
		const gear = warning(() => 'gear');
		registry.add(gear.warning);

		let notifications = 0;
		const unsubscribe = registry.subscribe(() => notifications++);
		gear.store.fire();
		unsubscribe();
		gear.store.fire();

		expect(notifications).toBe(1);
	});

	it('removes the warning and releases its source when the returned unsubscribe runs', () => {
		const registry = new WarningsRegistry();
		const gear = warning(() => 'gear');
		const talents = warning(() => 'talents');
		const remove = registry.add(gear.warning);
		registry.add(talents.warning);

		let notifications = 0;
		registry.subscribe(() => notifications++);
		expect(gear.store.listeners).toBe(1);

		remove();

		expect(registry.getContents()).toEqual(['talents']);
		expect(gear.store.listeners).toBe(0);
		expect(notifications).toBe(1);

		gear.store.fire();
		expect(notifications).toBe(1);
	});
});
