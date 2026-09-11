// BonusStatsLink's binding, measured both ways over one store. The sibling measurement in
// ui/sim/hooks/useStoreSubscribe.gate.test.tsx cannot host this one: ui/sim must not import
// @ui-kit, and the comparison needs the real useInput.
//
//   old   — InputConfig carries storeSubscribe (the bonusStats version counter) + getValue (the facade
//           read), and the picker's modObject is the Player.
//   owned — the component selects the value with usePlayerStore and the picker's modObject IS the
//           value; the config keeps only getValue/setValue over it and names no store at all.
//   field — InputConfig names the store field instead of building the source, and the picker's
//           modObject stays the Player. This is the shape `owned` was reaching for, without its cost.
import { Stat } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { Stats } from '@sim/proto/stats';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { act, render } from '@testing-library/react';
import { useInput } from '@ui-kit/hooks/useInput';
import { type ReactNode, useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';

const KEY = 3;
const AGI = Stat.StatAgility;

type FakePlayer = ReturnType<typeof makePlayer>;

const makePlayer = (store: SimStore) => {
	seedKeyed(store, 'players', KEY, { name: 'P', bonusStats: new Stats(), v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);
	return {
		sim: { store },
		storeKey: KEY,
		getBonusStats: () => store.getState().players[KEY].bonusStats,
		setBonusStats: (next: Stats) => patchKeyed(store, 'players', KEY, { bonusStats: next }, ['bonusStats']),
	};
};

const counts = { renders: 0, reads: 0 };
let commit = (_next: number) => {};

const OldChild = ({ player }: { player: FakePlayer }) => {
	const { value, setValue } = useInput(player, {
		storeSubscribe: subject => subscribePlayerField(subject as never, 'bonusStats'),
		getValue: subject => {
			counts.reads++;
			return subject.getBonusStats().getStat(AGI);
		},
		setValue: (subject, next) => subject.setBonusStats(subject.getBonusStats().withStat(AGI, next)),
	});
	counts.renders++;
	commit = setValue;
	return <span>{value}</span>;
};

const FieldChild = ({ player }: { player: FakePlayer }) => {
	const { value, setValue } = useInput(player, {
		storeField: 'bonusStats',
		getValue: subject => {
			counts.reads++;
			return subject.getBonusStats().getStat(AGI);
		},
		setValue: (subject, next) => subject.setBonusStats(subject.getBonusStats().withStat(AGI, next)),
	});
	counts.renders++;
	commit = setValue;
	return <span>{value}</span>;
};

const NewChild = ({ player }: { player: FakePlayer }) => {
	const stats = usePlayerStore('bonusStats');
	const { value, setValue } = useInput(stats, {
		getValue: current => {
			counts.reads++;
			return current.getStat(AGI);
		},
		setValue: (current, next) => player.setBonusStats(current.withStat(AGI, next)),
	});
	counts.renders++;
	commit = setValue;
	return <span>{value}</span>;
};

// The floor: the hook on its own, deriving under the selected value, with no picker in between.
const HookOnlyChild = ({ player }: { player: FakePlayer }) => {
	const stats = usePlayerStore('bonusStats');
	const value = useMemo(() => {
		counts.reads++;
		return stats.getStat(AGI);
	}, [stats]);
	counts.renders++;
	commit = next => player.setBonusStats(stats.withStat(AGI, next));
	return <span>{value}</span>;
};

const measure = (Child: (props: { player: FakePlayer }) => ReactNode) => {
	counts.renders = 0;
	counts.reads = 0;
	const store = createSimStore();
	const player = makePlayer(store);
	let rerenderParent = () => {};
	const Parent = () => {
		const [, setTick] = useState(0);
		rerenderParent = () => setTick(tick => tick + 1);
		return <Child player={player} />;
	};
	const view = render(<SimHostProvider host={{ player } as never}>{<Parent />}</SimHostProvider>);

	const step = (run: () => void) => {
		const before = { ...counts };
		act(run);
		return { renders: counts.renders - before.renders, reads: counts.reads - before.reads };
	};

	const external = step(() => player.setBonusStats(new Stats().withStat(AGI, 5)));
	const own = step(() => commit(9));
	const idle = { renders: 0, reads: 0 };
	for (let i = 0; i < 5; i++) {
		const one = step(() => rerenderParent());
		idle.renders += one.renders;
		idle.reads += one.reads;
	}
	const unrelated = step(() => patchKeyed(store, 'players', KEY, { name: 'Other' }, ['name']));
	const text = view.container.textContent;
	view.unmount();
	return { external, own, idle, unrelated, text };
};

describe('the BonusStatsLink binding, old shape vs new', () => {
	// Five parent re-renders that touch nothing, and a write to a field this binding does not select,
	// cost nothing under any of the three — the properties the hand-rolled snapshot cache was keeping.
	it('is idle under unrelated renders and unrelated writes, old and new alike', () => {
		for (const Child of [OldChild, NewChild, FieldChild, HookOnlyChild]) {
			const { idle, unrelated } = measure(Child);
			expect({ idle, unrelated }).toEqual({ idle: { renders: 5, reads: 0 }, unrelated: { renders: 0, reads: 0 } });
		}
	});

	// The cost of the conversion, and the reason the InputConfig side has to change for it to pay off.
	// `useInput` holds its value in a useStoreSubscribe cache invalidated only when the SUBSCRIPTION
	// identity changes, and that identity is `[modObject]`. Handing it a caller-owned value therefore
	// re-subscribes on every change, and the re-subscribe's consistency check — over a snapshot object
	// rebuilt per read — forces a second render that the old shape, with a fixed Player as modObject,
	// never pays. The hook itself is free: HookOnlyChild is one render per change.
	it('costs one extra render per change while it goes through an unchanged useInput', () => {
		expect(measure(OldChild)).toMatchObject({ external: { renders: 1, reads: 1 }, own: { renders: 1, reads: 1 }, text: '9' });
		expect(measure(NewChild)).toMatchObject({ external: { renders: 2, reads: 1 }, own: { renders: 2, reads: 2 }, text: '9' });
		expect(measure(HookOnlyChild)).toMatchObject({ external: { renders: 1, reads: 1 }, own: { renders: 1, reads: 1 }, text: '9' });
	});

	// Naming the field gives the caller what owning the value was for — no source to build, no facade
	// subscription to keep in step — at the source identity a fixed modObject had: one subscribe for the
	// life of the picker, so the consistency re-read never happens and the second render is gone.
	it('costs nothing once the field is named instead', () => {
		expect(measure(FieldChild)).toMatchObject({ external: { renders: 1, reads: 1 }, own: { renders: 1, reads: 1 }, text: '9' });
	});
});
