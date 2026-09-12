// Does a React binding need state/batch.ts's gate?
//
// The gate exists for direct, non-React store subscribers: a batch() defers their listeners so a
// multi-slice write notifies once with final state. React has its own coalescing, so the plan
// listed "does React need subscribeGated?" as a question to settle by measurement. This is that
// measurement, over three bindings of the same store:
//
//   gated    — useStoreSubscribe over a subscribeGated source (what every ported component uses)
//   ungated  — useStoreSubscribe over a raw store.subscribe source
//   useStore — zustand's own React binding, which has no gate at all
import { act, render } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useStore } from 'zustand';

import { batch, subscribeGated } from '../state/batch';
import {
	createSimStore,
	deleteKeyed,
	patchSlice,
	PLAYER_FIELDS,
	type PlayerSlice,
	seedKeyed,
	type SimState,
	type SimStore,
	zeroVersions,
} from '../state/sim_store';
import type { StoreSubscribe } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

type Counts = { gated: number; ungated: number; useStore: number };

const gatedSource = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => subscribeGated(store.subscribe, selector, onChange)) as StoreSubscribe;

const ungatedSource = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => store.subscribe(selector, onChange)) as StoreSubscribe;

// One value spanning three slices — the shape subscribeAll folds several field sources into.
const triple = (s: SimState) => `${s.sim.iterations}|${s.ui.showEPValues}|${s.encounter.duration}`;
const INITIAL_TRIPLE = triple(createSimStore().getState());
const FINAL_TRIPLE = '777|true|42';

const SubscribeProbe = ({ store, source, log }: { store: SimStore; source: StoreSubscribe; log: Array<string> }) => {
	const value = useStoreSubscribe(source, () => triple(store.getState()));
	log.push(value);
	return <span>{value}</span>;
};

const UseStoreProbe = ({ store, log }: { store: SimStore; log: Array<string> }) => {
	const value = useStore(store, triple);
	log.push(value);
	return <span>{value}</span>;
};

// Mounts one probe per binding over its own store and hands back the rendered-value logs.
const mountAll = () => {
	const stores = { gated: createSimStore(), ungated: createSimStore(), useStore: createSimStore() };
	const logs: Record<keyof typeof stores, Array<string>> = { gated: [], ungated: [], useStore: [] };
	const mounted = [
		render(<SubscribeProbe store={stores.gated} source={gatedSource(stores.gated, triple)} log={logs.gated} />),
		render(<SubscribeProbe store={stores.ungated} source={ungatedSource(stores.ungated, triple)} log={logs.ungated} />),
		render(<UseStoreProbe store={stores.useStore} log={logs.useStore} />),
	];
	const baseline = { gated: logs.gated.length, ungated: logs.ungated.length, useStore: logs.useStore.length };
	return {
		stores,
		logs,
		unmount: () => mounted.forEach(m => m.unmount()),
		renders: (): Counts => ({
			gated: logs.gated.length - baseline.gated,
			ungated: logs.ungated.length - baseline.ungated,
			useStore: logs.useStore.length - baseline.useStore,
		}),
	};
};

const writeThree = (store: SimStore) => {
	patchSlice(store, 'sim', { iterations: 777 });
	patchSlice(store, 'ui', { showEPValues: !store.getState().ui.showEPValues });
	patchSlice(store, 'encounter', { duration: 42 });
};

describe('the gate at the store level (why it exists)', () => {
	it('collapses a three-slice batch() to one listener fire; raw subscribe fires three times', () => {
		const store = createSimStore();
		const fires = { gated: 0, ungated: 0 };
		const unsubs = [subscribeGated(store.subscribe, triple, () => fires.gated++), store.subscribe(triple, () => fires.ungated++)];

		batch(() => writeThree(store));

		expect(fires).toEqual({ gated: 1, ungated: 3 });
		unsubs.forEach(u => u());
	});

	it('cannot span an await — a batch() closes at the end of its synchronous body', async () => {
		const store = createSimStore();
		const fires = { gated: 0, ungated: 0 };
		const unsubs = [subscribeGated(store.subscribe, triple, () => fires.gated++), store.subscribe(triple, () => fires.ungated++)];

		await batch(async () => {
			patchSlice(store, 'sim', { iterations: 777 });
			await Promise.resolve();
			patchSlice(store, 'ui', { showEPValues: true });
			await Promise.resolve();
			patchSlice(store, 'encounter', { duration: 42 });
		});

		expect(fires).toEqual({ gated: 3, ungated: 3 });
		unsubs.forEach(u => u());
	});
});

describe('the gate at the React level (whether a binding needs it)', () => {
	it('a three-slice batch() is one render under every binding', () => {
		const h = mountAll();
		act(() => Object.values(h.stores).forEach(store => batch(() => writeThree(store))));

		expect(h.renders()).toEqual({ gated: 1, ungated: 1, useStore: 1 });
		// And that one render sees final state: no intermediate value was ever rendered.
		Object.values(h.logs).forEach(log => expect(log).toEqual([INITIAL_TRIPLE, FINAL_TRIPLE]));
		h.unmount();
	});

	it('three un-batched writes in one task are also one render under every binding', () => {
		const h = mountAll();
		act(() => Object.values(h.stores).forEach(writeThree));

		expect(h.renders()).toEqual({ gated: 1, ungated: 1, useStore: 1 });
		Object.values(h.logs).forEach(log => expect(log).toEqual([INITIAL_TRIPLE, FINAL_TRIPLE]));
		h.unmount();
	});

	it('three writes across await boundaries are three renders under every binding, batch() or not', async () => {
		const h = mountAll();
		const writes: Array<(store: SimStore) => void> = [
			store => patchSlice(store, 'sim', { iterations: 777 }),
			store => patchSlice(store, 'ui', { showEPValues: true }),
			store => patchSlice(store, 'encounter', { duration: 42 }),
		];
		for (const write of writes) {
			await act(async () => {
				// The gated store still wraps its write in a batch(); it cannot help across the await.
				batch(() => write(h.stores.gated));
				write(h.stores.ungated);
				write(h.stores.useStore);
			});
		}

		expect(h.renders()).toEqual({ gated: 3, ungated: 3, useStore: 3 });
		h.unmount();
	});
});

// Player.dispose() defers deleteKeyed to a timeout precisely because a subscriber can outlive the
// slice it selects. subscribeWithSelector runs EVERY registered selector on EVERY setState, so the
// `?.` in `s.players[key]?.v[field]` is load-bearing regardless of binding; the question is whether
// a render can also observe the gap.
describe('a slice deleted under a mounted subscriber', () => {
	const KEY = 1;
	const seed = (store: SimStore) => seedKeyed(store, 'players', KEY, { name: 'before', v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);

	it('is seen by the selector and by exactly one render, under every binding', () => {
		const stores = { gated: createSimStore(), ungated: createSimStore(), useStore: createSimStore() };
		Object.values(stores).forEach(seed);
		const renders: Counts = { gated: 0, ungated: 0, useStore: 0 };
		const selectorMisses: Counts = { gated: 0, ungated: 0, useStore: 0 };
		const readMisses: Counts = { gated: 0, ungated: 0, useStore: 0 };

		const selectorFor = (column: keyof Counts) => (s: SimState) => {
			if (!s.players[KEY]) selectorMisses[column]++;
			return s.players[KEY]?.v.name;
		};
		const readFor = (store: SimStore, column: keyof Counts) => () => {
			const slice = store.getState().players[KEY];
			if (!slice) readMisses[column]++;
			return slice?.name ?? '(gone)';
		};

		const NameProbe = ({ source, read, column }: { source: StoreSubscribe; read: () => string; column: keyof Counts }) => {
			const value = useStoreSubscribe(source, read);
			renders[column]++;
			return <span>{value}</span>;
		};
		// Hoisted: zustand rebuilds getSnapshot every render, and a fresh selector on top of that
		// would add render passes of its own.
		const useStoreSelector = selectorFor('useStore');
		const UseStoreNameProbe = ({ store, read }: { store: SimStore; read: () => string }) => {
			useStore(store, useStoreSelector);
			renders.useStore++;
			return <span>{read()}</span>;
		};

		const mounted = [
			render(<NameProbe column="gated" source={gatedSource(stores.gated, selectorFor('gated'))} read={readFor(stores.gated, 'gated')} />),
			render(<NameProbe column="ungated" source={ungatedSource(stores.ungated, selectorFor('ungated'))} read={readFor(stores.ungated, 'ungated')} />),
			render(<UseStoreNameProbe store={stores.useStore} read={readFor(stores.useStore, 'useStore')} />),
		];
		mounted.forEach(m => expect(m.container.textContent).toBe('before'));
		const baseline = { ...renders };

		act(() => Object.values(stores).forEach(store => deleteKeyed(store, KEY)));

		mounted.forEach(m => expect(m.container.textContent).toBe('(gone)'));
		expect({
			gated: renders.gated - baseline.gated,
			ungated: renders.ungated - baseline.ungated,
			useStore: renders.useStore - baseline.useStore,
		}).toEqual({ gated: 1, ungated: 1, useStore: 1 });
		// One render each — and one read of the missing slice each. The gap is observable in the
		// render body, so a facade getter that would throw on a missing slice needs the same care
		// under every binding; `?.` is not decoration.
		expect(readMisses).toEqual({ gated: 1, ungated: 1, useStore: 1 });
		// The one place the bindings differ. subscribeWithSelector evaluates a source's selector
		// exactly once per setState; zustand's useStore rebuilds getSnapshot every render, so React
		// re-reads it several times per change (4 at react 19.2.8 / zustand 5.0.15). Cheap for a
		// counter, but a selector that allocates — the array subscribeAll folds — pays it each time.
		expect(selectorMisses.gated).toBe(1);
		expect(selectorMisses.ungated).toBe(1);
		expect(selectorMisses.useStore).toBeGreaterThan(1);
		mounted.forEach(m => m.unmount());
	});
});

// The gate question is settled above; this is the other half of "should the hook still exist".
// useStore selects a notification key and the component derives from the facade in its render body,
// so the derivation is tied to renders. useStoreSubscribe ties it to notifications instead.
describe('what the snapshot cache buys', () => {
	it('ties the facade read to notifications, not to renders — and so does useStore + useMemo', () => {
		const store = createSimStore();
		const reads = { subscribe: 0, useStore: 0, useStoreMemo: 0 };
		// Stands in for a facade getter: fresh object per call, like Player.getGear().
		const readFor = (column: keyof typeof reads) => () => {
			reads[column]++;
			return { iterations: store.getState().sim.iterations };
		};
		const iterations = (s: SimState) => s.sim.iterations;

		const subscribeRead = readFor('subscribe');
		const source = gatedSource(store, iterations);
		const seenBy: Record<keyof typeof reads, Array<object>> = { subscribe: [], useStore: [], useStoreMemo: [] };
		const SubscribeChild = () => {
			seenBy.subscribe.push(useStoreSubscribe(source, subscribeRead));
			return null;
		};

		// Reading straight from the facade in the render body — the naive shape.
		const useStoreRead = readFor('useStore');
		const UseStoreChild = () => {
			useStore(store, iterations);
			seenBy.useStore.push(useStoreRead());
			return null;
		};

		// The shape one would actually write: select the notification key, derive under it.
		const useStoreMemoRead = readFor('useStoreMemo');
		const UseStoreMemoChild = () => {
			const key = useStore(store, iterations);
			seenBy.useStoreMemo.push(useMemo(useStoreMemoRead, [key]));
			return null;
		};

		let rerender = () => {};
		// Child is rendered by Parent (not passed as children), so a Parent render is a Child render.
		const Parent = ({ Child }: { Child: () => null }) => {
			const [, setTick] = useState(0);
			rerender = () => setTick(t => t + 1);
			return <Child />;
		};

		const extraReads = {} as Record<keyof typeof reads, number>;
		for (const [column, Child] of [
			['subscribe', SubscribeChild],
			['useStore', UseStoreChild],
			['useStoreMemo', UseStoreMemoChild],
		] as const) {
			render(<Parent Child={Child} />);
			const afterMount = reads[column];
			// Five parent re-renders that touch nothing in the store.
			for (let i = 0; i < 5; i++) act(() => rerender());
			extraReads[column] = reads[column] - afterMount;
		}
		expect(extraReads).toEqual({ subscribe: 0, useStore: 5, useStoreMemo: 0 });

		// And so the value a downstream useMemo/memo() sees is stable across those five renders —
		// under the hook, and equally under useStore once the derivation hangs off the key rather
		// than the render. Only the bare render-body read churns. (Mount itself reads twice under
		// useStoreSubscribe: subscribing marks the snapshot stale, so React's post-subscribe
		// consistency check re-reads.)
		expect(new Set(seenBy.subscribe.slice(-5)).size).toBe(1);
		expect(new Set(seenBy.useStore.slice(-5)).size).toBe(5);
		expect(new Set(seenBy.useStoreMemo.slice(-5)).size).toBe(1);
	});
});
