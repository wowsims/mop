// What CharacterStats re-renders on, old subscription set vs new, over one store.
//
//   old — subscribeAll([currentStats, subscribeSimChange(sim), talentsString]). subscribeSimChange
//         folds in sim settings + ui + encounter + the raid tuple, and the raid tuple carries every
//         member's PLAYER_CHANGE_FIELDS — so the old set is "currentStats plus everything".
//   new — one usePlayerStore per field the snapshot actually reads.
import { SimHostProvider } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { createSimStore, patchKeyed, patchSlice, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { subscribeAll, subscribePlayerField, subscribeSimChange } from '@sim/state/subscriptions';
import { act, render } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it } from 'vitest';

const KEY = 4;

type Counts = { old: number; new: number };

const stats = (health: number) => ({ finalStats: { stats: [health] } }) as never;

const setup = () => {
	const store = createSimStore();
	seedKeyed(store, 'players', KEY, {
		name: 'P',
		race: 1,
		gear: { id: 'gear' },
		bonusStats: { id: 'bonus' },
		talentsString: '',
		inFrontOfTarget: false,
		currentStats: stats(1),
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);
	// subscribeSimChange folds in raidTuple, which reaches the player through the composition.
	patchSlice(store, 'raid', { composition: [[KEY, null, null, null, null], [], [], [], []] });
	const sim = { store };
	const player = { sim, storeKey: KEY };
	return { store, sim, player };
};

const mount = () => {
	const { store, sim, player } = setup();
	const renders: Counts = { old: 0, new: 0 };
	const derives: Counts = { old: 0, new: 0 };

	const source = subscribeAll([
		subscribePlayerField(player as never, 'currentStats'),
		subscribeSimChange(sim as never),
		subscribePlayerField(player as never, 'talentsString'),
	]);

	const OldProbe = () => {
		const snapshot = useStoreSubscribe(source, () => {
			derives.old++;
			return { health: store.getState().players[KEY].currentStats };
		});
		renders.old++;
		return <span>{String(!!snapshot)}</span>;
	};

	const NewProbe = () => {
		const currentStats = usePlayerStore('currentStats');
		const bonusStats = usePlayerStore('bonusStats');
		const gear = usePlayerStore('gear');
		const race = usePlayerStore('race');
		const inFrontOfTarget = usePlayerStore('inFrontOfTarget');
		const snapshot = useMemo(() => {
			derives.new++;
			return { currentStats, bonusStats, gear, race, inFrontOfTarget };
		}, [currentStats, bonusStats, gear, race, inFrontOfTarget]);
		renders.new++;
		return <span>{String(!!snapshot)}</span>;
	};

	const host = { player } as never;
	const mounted = [
		render(<SimHostProvider host={host}>{<OldProbe />}</SimHostProvider>),
		render(<SimHostProvider host={host}>{<NewProbe />}</SimHostProvider>),
	];

	return {
		store,
		unmount: () => mounted.forEach(m => m.unmount()),
		step: (write: (store: SimStore) => void) => {
			const before = { renders: { ...renders }, derives: { ...derives } };
			act(() => write(store));
			return {
				renders: { old: renders.old - before.renders.old, new: renders.new - before.renders.new },
				derives: { old: derives.old - before.derives.old, new: derives.new - before.derives.new },
			};
		},
	};
};

describe('what CharacterStats re-renders on', () => {
	it('re-renders under both subscription sets for every field the snapshot reads', () => {
		const h = mount();
		const both = { old: 1, new: 1 };

		expect(h.step(s => patchKeyed(s, 'players', KEY, { currentStats: stats(2) }, ['currentStats'])).renders).toEqual(both);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { bonusStats: { id: 'bonus2' } as never }, ['bonusStats'])).renders).toEqual(both);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { gear: { id: 'gear2' } as never }, ['gear'])).renders).toEqual(both);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { race: 2 }, ['race'])).renders).toEqual(both);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { inFrontOfTarget: true }, ['inFrontOfTarget'])).renders).toEqual(both);

		h.unmount();
	});

	// The cost the aggregate was carrying. None of these change anything the snapshot reads; each one
	// reaches the display only once the worker's recompute writes currentStats back.
	it('no longer re-renders on the sim, ui, encounter and raid state the aggregate folded in', () => {
		const h = mount();
		const oldOnly = { old: 1, new: 0 };

		expect(h.step(s => patchSlice(s, 'sim', { iterations: 5000 })).renders).toEqual(oldOnly);
		expect(h.step(s => patchSlice(s, 'ui', { showEPValues: true })).renders).toEqual(oldOnly);
		expect(h.step(s => patchSlice(s, 'encounter', { duration: 42 })).renders).toEqual(oldOnly);
		expect(h.step(s => patchSlice(s, 'raid', { debuffs: {} as never })).renders).toEqual(oldOnly);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { talentsString: 'x' }, ['talentsString'])).renders).toEqual(oldOnly);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { buffs: {} as never }, ['buffs'])).renders).toEqual(oldOnly);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { reactionTime: 250 }, ['reactionTime'])).renders).toEqual(oldOnly);

		h.unmount();
	});

	// Both shapes tie the derivation to a change rather than to a render: the old one through
	// useStoreSubscribe's snapshot cache, the new one through useMemo over the selected values.
	it('derives once per change under both, and not at all under an unrelated write', () => {
		const h = mount();

		expect(h.step(s => patchKeyed(s, 'players', KEY, { currentStats: stats(3) }, ['currentStats'])).derives).toEqual({ old: 1, new: 1 });
		expect(h.step(s => patchKeyed(s, 'players', KEY, { name: 'Other' }, ['name'])).derives).toEqual({ old: 1, new: 0 });

		h.unmount();
	});
});
