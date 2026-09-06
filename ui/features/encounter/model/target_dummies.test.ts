import type { Player } from '@domain/player';
import type { Sim } from '@domain/sim';
import { createSimStore, patchKeyed, seedKeyed } from '@domain/state/sim_store';
import { PLAYER_CHANGE_FIELDS } from '@domain/state/subscriptions';
import { Spec } from '@generated/proto/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { watchTargetDummies } from './target_dummies';

// The rule reads four things off the player and writes one on the raid. A real `Player` needs a
// registered spec, a `Database` and a `Sim`; what it needs *here* is a store the subscription can
// select from, which is a slice with a version tuple in it.
const STORE_KEY = 0;

let store: ReturnType<typeof createSimStore>;
let dummies: number;
let sim: Sim;

const seedPlayerSlice = () => seedKeyed(store, 'players', STORE_KEY, { v: Object.fromEntries(PLAYER_CHANGE_FIELDS.map(f => [f, 0])) } as never);

/** Anything the store notices as a player change; the rule does not care which field. */
const changePlayer = () => patchKeyed(store, 'players', STORE_KEY, {}, ['talentsString']);

const makePlayer = (overrides: Partial<Record<string, unknown>> = {}) =>
	({
		storeKey: STORE_KEY,
		sim,
		getSpec: () => Spec.SpecArmsWarrior,
		canEnableTargetDummies: () => true,
		shouldEnableTargetDummies: () => false,
		...overrides,
	}) as unknown as Player<any>;

beforeEach(() => {
	store = createSimStore();
	dummies = 3;
	sim = {
		store,
		raid: { getTargetDummies: () => dummies, setTargetDummies: (value: number) => (dummies = value) },
	} as unknown as Sim;
	seedPlayerSlice();
});

describe('watchTargetDummies', () => {
	// The one that matters. Settings are restored on `waitForInit`, and raid settings and talents
	// come back separately — a rule that applied itself when it was armed would zero a saved count
	// against talents that had not arrived. Turning this into a `DerivedSetting`, whose contract is
	// apply-then-subscribe, is the refactor this test exists to fail.
	it('does not touch the count when it is armed', () => {
		watchTargetDummies(makePlayer(), sim);
		expect(dummies).toBe(3);
	});

	it('zeroes the count once the player can no longer enable them', () => {
		watchTargetDummies(makePlayer(), sim);
		changePlayer();
		expect(dummies).toBe(0);
	});

	it('leaves a count the player can still enable', () => {
		watchTargetDummies(makePlayer({ shouldEnableTargetDummies: () => true }), sim);
		changePlayer();
		expect(dummies).toBe(3);
	});

	it('never arms for a spec that cannot enable them at all', () => {
		watchTargetDummies(makePlayer({ canEnableTargetDummies: () => false }), sim);
		changePlayer();
		expect(dummies).toBe(3);
	});

	// Monks' count is talent-driven (sims/monk/shared/derived.ts) — the rule would fight the code
	// that sets it.
	it.each([Spec.SpecBrewmasterMonk, Spec.SpecWindwalkerMonk])('never arms for a monk (%i)', spec => {
		watchTargetDummies(makePlayer({ getSpec: () => spec }), sim);
		changePlayer();
		expect(dummies).toBe(3);
	});
});
