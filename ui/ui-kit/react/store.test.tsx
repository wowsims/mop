import { batch, subscribeGated } from '@domain/state/batch';
import { createSimStore, patchSlice, type SimState, type SimStore } from '@domain/state/sim_store';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { render } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { useStoreSubscribe } from './store';

// Field sources built the way state/subscriptions.ts builds them, but without needing a Sim or a
// Player: the question under test is how React reacts to the store, not how the facades write to it.
const gated = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => subscribeGated(store.subscribe, selector, onChange)) as StoreSubscribe;

const ungated = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => store.subscribe(selector, onChange)) as StoreSubscribe;

function probe(store: SimStore, source: StoreSubscribe, read: (s: SimState) => unknown, renders: { n: number }) {
	return function Probe() {
		const value = useStoreSubscribe(source, () => read(store.getState()));
		renders.n++;
		return <span>{String(value)}</span>;
	};
}

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

	// The open question from the plan: does React need state/batch.ts's gate, or does its own
	// batching already collapse a multi-slice write into one render? Measured, not assumed.
	it('collapses a multi-slice batch() into a single render — gated and ungated alike', () => {
		for (const [label, make] of [
			['gated', gated],
			['ungated', ungated],
		] as const) {
			const store = createSimStore();
			const renders = { n: 0 };
			// One component watching three slices at once, the shape subscribeAll produces.
			const Probe = () => {
				const v = useStoreSubscribe(
					make(store, s => `${s.sim.iterations}|${s.ui.showEPValues}|${s.encounter.duration}`),
					() => {
						const s = store.getState();
						return `${s.sim.iterations}|${s.ui.showEPValues}|${s.encounter.duration}`;
					},
				);
				renders.n++;
				return <span>{v}</span>;
			};
			const { container } = render(<Probe />);
			const before = renders.n;

			act(() => {
				batch(() => {
					patchSlice(store, 'sim', { iterations: 777 });
					patchSlice(store, 'ui', { showEPValues: !store.getState().ui.showEPValues });
					patchSlice(store, 'encounter', { duration: 42 });
				});
			});

			expect(renders.n - before, `${label}: expected exactly one render for a three-slice batch`).toBe(1);
			expect(container.textContent).toContain('777');
			expect(container.textContent).toContain('42');
		}
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
