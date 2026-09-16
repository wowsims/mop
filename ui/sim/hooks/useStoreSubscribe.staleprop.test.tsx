import { act, render } from '@testing-library/react';
import { useMemo, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useStore } from 'zustand';

import { subscribeGated } from '../state/batch';
import { createSimStore, patchSlice, type SimState, type SimStore } from '../state/sim_store';
import type { StoreSubscribe } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

const gated = <U,>(store: SimStore, selector: (s: SimState) => U): StoreSubscribe =>
	((onChange: () => void) => subscribeGated(store.subscribe, selector, onChange)) as StoreSubscribe;

const iterations = (s: SimState) => s.sim.iterations;

interface ProbeProps {
	store: SimStore;
	source: StoreSubscribe;
	prop: string;
}

const Direct = ({ store, source, prop }: ProbeProps) => {
	const view = useStoreSubscribe(source, () => `${prop}@${iterations(store.getState())}`);
	return <span data-testid="direct">{view}</span>;
};

const ViaRef = ({ store, source, prop }: ProbeProps) => {
	const propRef = useRef(prop);
	propRef.current = prop;
	const view = useStoreSubscribe(source, () => `${propRef.current}@${iterations(store.getState())}`);
	return <span data-testid="via-ref">{view}</span>;
};

const Keyed = ({ store, prop }: Omit<ProbeProps, 'source'>) => {
	const version = useStore(store, iterations);
	const view = useMemo(() => `${prop}@${version}`, [prop, version]);
	return <span data-testid="keyed">{view}</span>;
};

interface TreeProps {
	store: SimStore;
	source: StoreSubscribe;
	suffix: string;
}

const Tree = ({ store, source, suffix }: TreeProps) => {
	const version = useStore(store, iterations);
	const prop = `v${version}${suffix}`;
	return (
		<>
			<Direct store={store} source={source} prop={prop} />
			<ViaRef store={store} source={source} prop={prop} />
			<Keyed store={store} prop={prop} />
		</>
	);
};

const mountTree = () => {
	const store = createSimStore();
	patchSlice(store, 'sim', { iterations: 1 });
	const source = gated(store, iterations);
	const view = render(<Tree store={store} source={source} suffix="" />);
	return {
		store,
		write: (next: number) => act(() => patchSlice(store, 'sim', { iterations: next })),
		rerenderOnly: (suffix: string) => act(() => view.rerender(<Tree store={store} source={source} suffix={suffix} />)),
		read: () => ({
			direct: view.getByTestId('direct').textContent,
			viaRef: view.getByTestId('via-ref').textContent,
			keyed: view.getByTestId('keyed').textContent,
		}),
	};
};

describe('useStoreSubscribe and a read that closes over a prop', () => {
	it('mounts with every probe agreeing', () => {
		const h = mountTree();
		expect(h.read()).toEqual({ direct: 'v1@1', viaRef: 'v1@1', keyed: 'v1@1' });
	});

	it('applies a prop that changed in the same commit as the notification one notification late, because the notification re-reads before the render that brings the new prop', () => {
		const h = mountTree();

		h.write(2);
		expect(h.read()).toEqual({ direct: 'v1@2', viaRef: 'v1@2', keyed: 'v2@2' });

		h.write(3);
		expect(h.read()).toEqual({ direct: 'v2@3', viaRef: 'v2@3', keyed: 'v3@3' });
	});

	it('is exactly as late when the read reaches the prop through a ref, so holding the read in a ref is not a fix for this', () => {
		const h = mountTree();
		h.write(2);
		const { direct, viaRef } = h.read();
		expect(viaRef).toBe(direct);
	});

	it('never applies a prop change that arrives without a notification', () => {
		const h = mountTree();

		h.rerenderOnly('-b');
		expect(h.read()).toEqual({ direct: 'v1@1', viaRef: 'v1@1', keyed: 'v1-b@1' });
	});

	it('is current in both cases when the value is derived under a useStore key instead of cached by the hook', () => {
		const h = mountTree();

		h.rerenderOnly('-b');
		expect(h.read().keyed).toBe('v1-b@1');

		h.write(2);
		expect(h.read().keyed).toBe('v2-b@2');
	});
});
