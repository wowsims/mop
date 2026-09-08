import { ActionID as ActionIdProto, Cooldown, Cooldowns } from '@generated/proto/common';
import { ActionId } from '@sim/proto/action_id';
import { describe, expect, it, vi } from 'vitest';

import { actionPickerConfig, availableCooldowns, deleteCooldown, timingsPickerConfig } from './utils';

vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: () => () => () => undefined,
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const spell = (id: ActionId, isMajorCooldown: boolean) => ({ id, data: { isMajorCooldown } });

const playerWith = (spells: Array<ReturnType<typeof spell>>, hiddenMCDs: Array<number> = [], cooldowns = Cooldowns.create()) => {
	let stored = cooldowns;
	return {
		hiddenMCDs,
		getMetadata: () => ({ getSpells: () => spells }),
		getSimpleCooldowns: () => Cooldowns.clone(stored),
		setSimpleCooldowns: (next: Cooldowns) => {
			stored = next;
		},
		read: () => stored,
	} as any;
};

const spellId = 12345;
const itemId = 67890;

describe('availableCooldowns', () => {
	it('keeps only the major cooldowns', () => {
		const player = playerWith([spell(ActionId.fromSpellId(1), true), spell(ActionId.fromSpellId(2), false), spell(ActionId.fromSpellId(3), true)]);
		expect(availableCooldowns(player).map(id => id.spellId)).toEqual([1, 3]);
	});

	it('drops the spec’s hidden MCDs by spell id', () => {
		const player = playerWith([spell(ActionId.fromSpellId(1), true), spell(ActionId.fromSpellId(2), true)], [2]);
		expect(availableCooldowns(player).map(id => id.spellId)).toEqual([1]);
	});

	// A trinket cooldown carries no spellId, so the hidden check has to fall through to the item id.
	it('drops a hidden trinket by item id', () => {
		const player = playerWith([spell(ActionId.fromItemId(itemId), true), spell(ActionId.fromSpellId(1), true)], [itemId]);
		expect(availableCooldowns(player).map(id => id.spellId)).toEqual([1]);
	});
});

describe('actionPickerConfig', () => {
	const available = [ActionId.fromSpellId(spellId)];

	it('offers an empty grey value ahead of every cooldown', () => {
		const values = actionPickerConfig(available, 0).values;
		expect(values[0].color).toBe('#grey');
		expect(ActionIdProto.equals(values[0].value, ActionIdProto.create())).toBe(true);
		expect(values.slice(1).map(value => value.actionId)).toEqual(available);
	});

	it('reads the cooldown at its own index', () => {
		const cooldowns = Cooldowns.create({
			cooldowns: [Cooldown.create({ id: ActionId.fromSpellId(1).toProto() }), Cooldown.create({ id: ActionId.fromSpellId(2).toProto() })],
		});
		const player = playerWith([], [], cooldowns);
		expect(actionPickerConfig(available, 1).getValue(player).rawId).toEqual(ActionId.fromSpellId(2).toProto().rawId);
	});

	it('ignores a write of the empty value', () => {
		const player = playerWith([]);
		actionPickerConfig(available, 0).setValue(player, ActionIdProto.create());
		expect(player.read().cooldowns).toHaveLength(0);
	});

	// Picking a cooldown two rows down has to leave placeholders behind it, or the write lands at the
	// wrong index.
	it('pads the list up to the index it writes', () => {
		const player = playerWith([]);
		actionPickerConfig(available, 2).setValue(player, ActionId.fromSpellId(spellId).toProto());

		const written = player.read().cooldowns;
		expect(written).toHaveLength(3);
		expect(written.slice(0, 2)).toEqual([Cooldown.create(), Cooldown.create()]);
		expect(written[2].id!.rawId).toEqual(ActionId.fromSpellId(spellId).toProto().rawId);
	});

	it('clears the timings of the cooldown it replaces', () => {
		const cooldowns = Cooldowns.create({ cooldowns: [Cooldown.create({ id: ActionId.fromSpellId(1).toProto(), timings: [10, 20] })] });
		const player = playerWith([], [], cooldowns);
		actionPickerConfig(available, 0).setValue(player, ActionId.fromSpellId(spellId).toProto());
		expect(player.read().cooldowns[0].timings).toEqual([]);
	});
});

describe('deleteCooldown', () => {
	it('removes the row it names, not the last one', () => {
		const cooldowns = Cooldowns.create({ cooldowns: [1, 2, 3].map(id => Cooldown.create({ id: ActionId.fromSpellId(id).toProto() })) });
		const player = playerWith([], [], cooldowns);

		deleteCooldown(player, 0);

		expect(player.read().cooldowns.map((cooldown: Cooldown) => cooldown.id!.rawId)).toEqual([2, 3].map(id => ActionId.fromSpellId(id).toProto().rawId));
	});
});

describe('timingsPickerConfig', () => {
	const withCooldown = (id: ActionIdProto, timings: Array<number> = []) =>
		playerWith([], [], Cooldowns.create({ cooldowns: [Cooldown.create({ id, timings })] }));

	it('writes the timings of its own row', () => {
		const player = withCooldown(ActionId.fromSpellId(spellId).toProto());
		timingsPickerConfig(0).setValue(player, [5, 15]);
		expect(player.read().cooldowns[0].timings).toEqual([5, 15]);
		expect(timingsPickerConfig(0).getValue(player)).toEqual([5, 15]);
	});

	it('reads an empty list for a row that has no cooldown yet', () => {
		expect(timingsPickerConfig(3).getValue(playerWith([]))).toEqual([]);
	});

	it('stays disabled until the row has an action', () => {
		expect(timingsPickerConfig(0).enableWhen!(withCooldown(ActionIdProto.create()))).toBe(false);
		expect(timingsPickerConfig(0).enableWhen!(withCooldown(ActionId.fromSpellId(spellId).toProto()))).toBe(true);
		expect(timingsPickerConfig(0).enableWhen!(playerWith([]))).toBeFalsy();
	});
});
