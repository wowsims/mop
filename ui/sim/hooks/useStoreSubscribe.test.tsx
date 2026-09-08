import { render } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { subscribeGated } from '../state/batch';
import { createSimStore, patchSlice, type SimState, type SimStore } from '../state/sim_store';
import type { StoreSubscribe } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

// Field sources built the way state/subscriptions.ts builds them, but without needing a Sim or a
// Player: the question under test is how React reacts to the store, not how the facades write to it.
const gated = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => subscribeGated(store.subscribe, selector, onChange)) as StoreSubscribe;

const probe = (store: SimStore, source: StoreSubscribe, read: (s: SimState) => unknown, renders: { n: number }) => {
	return function Probe() {
		const value = useStoreSubscribe(source, () => read(store.getState()));
		renders.n++;
		return <span>{String(value)}</span>;
	};
};

describe('useStoreSubscribe', () => {
	it('renders the current value and re-renders when the field changes', () => {
		const store = createSimStore();
		const renders = { n: 0 };
		const Probe = probe(
			store,
			gated(store, s => s.sim.iterations),
			s => s.sim.iterations,
			renders,
		);
		const { container } = render(<Probe />);
		expect(container.textContent).toBe(String(store.getState().sim.iterations));

		act(() => {
			patchSlice(store, 'sim', { iterations: 12345 });
		});
		expect(container.textContent).toBe('12345');
	});

	it('does not re-render when an unrelated field changes', () => {
		const store = createSimStore();
		const renders = { n: 0 };
		const Probe = probe(
			store,
			gated(store, s => s.sim.iterations),
			s => s.sim.iterations,
			renders,
		);
		render(<Probe />);
		const before = renders.n;
		act(() => {
			patchSlice(store, 'ui', { showEPValues: !store.getState().ui.showEPValues });
		});
		expect(renders.n).toBe(before);
	});

	it('unsubscribes on unmount', () => {
		const store = createSimStore();
		const renders = { n: 0 };
		const Probe = probe(
			store,
			gated(store, s => s.sim.iterations),
			s => s.sim.iterations,
			renders,
		);
		const { unmount } = render(<Probe />);
		unmount();
		const after = renders.n;
		act(() => {
			patchSlice(store, 'sim', { iterations: 999 });
		});
		expect(renders.n).toBe(after);
	});
});

// Most model getters here build a fresh value per call, so the cache is what makes them bindable.
describe('useStoreSubscribe snapshot caching', () => {
	it('re-reads once per notification, not once per render', () => {
		let reads = 0;
		const listeners = new Set<() => void>();
		const subscribe = (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		};
		const Probe = () => {
			const value = useStoreSubscribe(subscribe, () => {
				reads++;
				return ['a', 'b'];
			});
			return <span>{value.join(',')}</span>;
		};

		const { container } = render(<Probe />);
		expect(container.textContent).toBe('a,b');
		const afterMount = reads;

		act(() => listeners.forEach(listener => listener()));
		expect(reads).toBe(afterMount + 1);
	});
});
