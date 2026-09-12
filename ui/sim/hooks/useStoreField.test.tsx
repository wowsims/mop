import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { SimHostProvider } from '../context/SimHostContext';
import { Stats } from '../proto/stats';
import {
	createSimStore,
	patchKeyed,
	patchSlice,
	PLAYER_FIELDS,
	type PlayerSlice,
	REFORGE_FIELDS,
	type ReforgeSlice,
	seedKeyed,
	type SimStore,
	zeroVersions,
} from '../state/sim_store';
import type { StoreField } from './useStoreField';
import { useStoreField } from './useStoreField';

const KEY = 4;

const mount = (children: ReactNode) => {
	const store = createSimStore();
	seedKeyed(store, 'players', KEY, { name: 'Player', bonusStats: new Stats(), v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);
	seedKeyed(store, 'reforge', KEY, { statCaps: new Stats(), v: zeroVersions(REFORGE_FIELDS) } as unknown as ReforgeSlice);
	const sim = { store } as { store: SimStore; encounter: unknown; raid: unknown };
	sim.encounter = { sim };
	sim.raid = { sim };
	const player = { sim, storeKey: KEY };
	return { store, ...render(<SimHostProvider host={{ player, sim } as never}>{children}</SimHostProvider>) };
};

const watch = (field: StoreField | ReadonlyArray<StoreField>) => {
	let source;
	const Probe = () => {
		source = useStoreField(field);
		return null;
	};
	const { store } = mount(<Probe />);
	const fired = { n: 0 };
	source!(() => fired.n++);
	return { store, fired };
};

describe('useStoreField', () => {
	it('names no source when the config names no field, and needs no host to say so', () => {
		let source: unknown = 'unset';
		const Probe = () => {
			source = useStoreField(undefined);
			return null;
		};

		render(<Probe />);

		expect(source).toBeUndefined();
	});

	it('fires on the named field and on nothing else', () => {
		const { store, fired } = watch('bonusStats');

		act(() => patchKeyed(store, 'players', KEY, { name: 'Other' }, ['name']));
		expect(fired.n).toBe(0);

		act(() => patchKeyed(store, 'players', KEY, { bonusStats: new Stats() }, ['bonusStats']));
		expect(fired.n).toBe(1);
	});

	it('reaches every scope a picker can name', () => {
		const { store, fired } = watch(['sim:iterations', 'ui:showExperimental', 'encounter:duration', 'raid:targetDummies', 'reforge:statCaps']);

		act(() => patchSlice(store, 'sim', { iterations: 99 }));
		act(() => patchSlice(store, 'ui', { showExperimental: true }));
		act(() => patchSlice(store, 'encounter', { duration: 123 }));
		act(() => patchSlice(store, 'raid', { targetDummies: 2 }));
		act(() => patchKeyed(store, 'reforge', KEY, { statCaps: new Stats() }, ['statCaps']));

		expect(fired.n).toBe(5);
	});

	// The identity is what `useStoreSubscribe` re-subscribes on, so an unstable one would put the
	// picker back on the extra render this seam exists to remove.
	it('holds one source identity across renders, for a single field and for several', () => {
		const seen: Array<unknown> = [];
		let rerender = () => {};
		const Child = () => {
			seen.push(useStoreField('bonusStats'), useStoreField(['bonusStats', 'gear']));
			return null;
		};
		const Parent = () => {
			const [, setTick] = useState(0);
			rerender = () => setTick(tick => tick + 1);
			return <Child />;
		};

		mount(<Parent />);
		for (let i = 0; i < 5; i++) act(() => rerender());

		expect(new Set(seen).size).toBe(2);
	});
});
