import type { ActionId } from '@sim/proto/action_id';
import { describe, expect, it } from 'vitest';

import type { ReplayAction, ReplayAura } from '../../model/replay';
import { auraKey, castKey } from './utils';

const spell = (id: string, name: string): ActionId => ({ name, toStringIgnoringTag: () => id }) as unknown as ActionId;

const cast = (time: number, name: string): ReplayAction => ({ time, name, actionId: spell(name, name), dmg: null, isCrit: false });

const aura = (gainedAt: number, id: string, name: string): ReplayAura => ({
	gainedAt,
	fadedAt: gainedAt + 5,
	name,
	actionId: spell(id, name),
	stacksChange: [],
});

describe('castKey', () => {
	it('tells two casts of the same spell apart', () => {
		expect(castKey(cast(1, 'Bolt'))).not.toBe(castKey(cast(2, 'Bolt')));
	});

	it('tells two spells cast in the same instant apart', () => {
		expect(castKey(cast(1, 'Bolt'))).not.toBe(castKey(cast(1, 'Shot')));
	});
});

describe('auraKey', () => {
	it('tells two spans of the same aura apart', () => {
		expect(auraKey(aura(1, 'spell=1', 'Rend'))).not.toBe(auraKey(aura(9, 'spell=1', 'Rend')));
	});

	// Two auras landing in the same instant is ordinary — a trinket and the cooldown that used it —
	// and React reuses the wrong row for a duplicate key, so the key has to carry the spell too.
	it('tells two auras that landed in the same instant apart', () => {
		expect(auraKey(aura(1, 'spell=1', 'Rend'))).not.toBe(auraKey(aura(1, 'spell=2', 'Rip')));
	});

	// Keyed on the spell rather than the name, as `mergeAdjacentAuras` is: MoP ships several
	// same-named auras behind different spells, and the name alone would fold them into one row.
	it('tells two same-named auras behind different spells apart', () => {
		expect(auraKey(aura(1, 'spell=1', 'Weakened Blows'))).not.toBe(auraKey(aura(1, 'spell=2', 'Weakened Blows')));
	});
});
