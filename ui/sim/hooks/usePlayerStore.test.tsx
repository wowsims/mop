import { APLRotation } from '@generated/proto/apl';
import { Stat } from '@generated/proto/common';
import { act, render } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SimHostProvider } from '../context/SimHostContext';
import { Stats } from '../proto/stats';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '../state/sim_store';
import { subscribePlayerField } from '../state/subscriptions';
import { useAplRotation } from './useAplRotation';
import { usePlayerStore } from './usePlayerStore';
import { useStoreSubscribe } from './useStoreSubscribe';

const KEY = 7;

const mount = (children: ReactNode) => {
	const store = createSimStore();
	seedKeyed(store, 'players', KEY, {
		name: 'Player',
		bonusStats: new Stats(),
		epWeights: new Stats(),
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);
	const player = { sim: { store }, storeKey: KEY, aplRotation: APLRotation.create() };
	const host = { player } as never;
	return { store, player, ...render(<SimHostProvider host={host}>{children}</SimHostProvider>) };
};

const bonus = (agility: number) => new Stats().withStat(Stat.StatAgility, agility);
const writeBonus = (store: SimStore, agility: number) => patchKeyed(store, 'players', KEY, { bonusStats: bonus(agility) }, ['bonusStats']);

describe('usePlayerStore', () => {
	it('renders the field value and re-renders when it changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			const stats = usePlayerStore('bonusStats');
			renders.n++;
			return <span>{stats.getStat(Stat.StatAgility)}</span>;
		};

		const { store, container } = mount(<Probe />);
		expect(container.textContent).toBe('0');
		const afterMount = renders.n;

		act(() => writeBonus(store, 42));

		expect(container.textContent).toBe('42');
		expect(renders.n - afterMount).toBe(1);
	});

	it('does not re-render when another player field changes', () => {
		const renders = { n: 0 };
		const Probe = () => {
			usePlayerStore('bonusStats');
			renders.n++;
			return null;
		};

		const { store } = mount(<Probe />);
		const afterMount = renders.n;

		act(() => patchKeyed(store, 'players', KEY, { name: 'Other' }, ['name']));

		expect(renders.n).toBe(afterMount);
	});

	// The slice values are replace-on-write, so the reference is the memo key a consumer needs; there
	// is no snapshot cache keeping it stable, only patchKeyed not replacing what did not change.
	it('returns a stable reference across renders that are not a change to that field', () => {
		const seen: Array<Stats> = [];
		let rerender = () => {};
		const Child = () => {
			seen.push(usePlayerStore('bonusStats'));
			return null;
		};
		const Parent = () => {
			const [, setTick] = useState(0);
			rerender = () => setTick(tick => tick + 1);
			return <Child />;
		};

		const { store } = mount(<Parent />);
		for (let i = 0; i < 5; i++) act(() => rerender());
		expect(new Set(seen.slice(-5)).size).toBe(1);

		act(() => writeBonus(store, 1));
		expect(seen.at(-1)).not.toBe(seen.at(-2));
	});
});

// `useReadyStoreSubscribe` exists because `useSyncExternalStore` calls its snapshot on the FIRST
// render, before any ready gate, so a read touching a null `sim.db` took the whole app down. These
// two tests establish which shapes can still do that.
describe('the first-render read that useReadyStoreSubscribe guards', () => {
	const uninitialised = () => {
		throw new TypeError("Cannot read properties of null (reading 'getItems')");
	};

	it('still bites useStoreSubscribe: the read runs on the first render', () => {
		const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
		const Probe = () => {
			const player = { sim: { store: createSimStore() }, storeKey: KEY } as never;
			return <span>{String(useStoreSubscribe(subscribePlayerField(player, 'gear'), uninitialised))}</span>;
		};

		expect(() => render(<Probe />)).toThrow(TypeError);
		silence.mockRestore();
	});

	it('cannot bite usePlayerStore: there is no read to run', () => {
		const Probe = () => <span>{String(usePlayerStore('gear'))}</span>;

		const { container } = mount(<Probe />);

		expect(container.textContent).toBe('undefined');
	});

	// The counter form keeps the hazard: useMemo runs during the first render exactly as
	// getSnapshot did, so a selector reaching sim.db must still be gated by its caller.
	it('still bites useAplRotation: the selector runs on the first render', () => {
		const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
		const Probe = () => <span>{String(useAplRotation(uninitialised))}</span>;

		expect(() => mount(<Probe />)).toThrow(TypeError);
		silence.mockRestore();
	});
});

describe('useAplRotation', () => {
	it('re-runs the selector when the rotation counter bumps, and not otherwise', () => {
		const selects = { n: 0 };
		let rerender = () => {};
		const Child = () => {
			const type = useAplRotation(rotation => {
				selects.n++;
				return rotation.type;
			});
			return <span>{type}</span>;
		};
		const Parent = () => {
			const [, setTick] = useState(0);
			rerender = () => setTick(tick => tick + 1);
			return <Child />;
		};

		const { store } = mount(<Parent />);
		const afterMount = selects.n;

		for (let i = 0; i < 5; i++) act(() => rerender());
		expect(selects.n).toBe(afterMount);

		act(() => patchKeyed(store, 'players', KEY, {}, ['rotation']));
		expect(selects.n).toBe(afterMount + 1);
	});
});
