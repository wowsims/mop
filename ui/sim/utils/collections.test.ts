import { APLRotation, APLRotation_Type as APLRotationType, APLValue, SimpleRotation } from '@generated/proto/apl';
import { Cooldown, Cooldowns, UnitReference, UnitReference_Type } from '@generated/proto/common';
import { SavedRotation } from '@generated/proto/ui';
import { omitDeep } from '@sim/utils/collections';
import { describe, expect, it } from 'vitest';

const uid = (value: string) => ({ value });

const countKey = (value: unknown, key: string): number => {
	if (Array.isArray(value)) return value.reduce<number>((total, entry) => total + countKey(entry, key), 0);
	if (!value || typeof value !== 'object') return 0;
	const record = value as Record<string, unknown>;
	return (key in record ? 1 : 0) + Object.values(record).reduce<number>((total, entry) => total + countKey(entry, key), 0);
};

const buildRotation = () =>
	APLRotation.create({
		type: APLRotationType.TypeAPL,
		simple: SimpleRotation.create({
			specRotationJson: '{"unicode":"é☃"}',
			cooldowns: Cooldowns.create({
				hpPercentForDefensives: 0.35,
				cooldowns: [
					Cooldown.create({ id: { rawId: { oneofKind: 'spellId', spellId: 1234 }, tag: 0 }, timings: [1.5, 0, -2.25, NaN, Infinity] }),
					Cooldown.create({ id: { rawId: { oneofKind: 'itemId', itemId: 77 }, tag: 3 }, timings: [] }),
				],
			}),
		}),
		prepullActions: [
			{
				action: {
					action: {
						oneofKind: 'castSpell',
						castSpell: {
							spellId: { rawId: { oneofKind: 'spellId', spellId: 42 }, tag: 0 },
							target: UnitReference.create({
								type: UnitReference_Type.Pet,
								index: 2,
								owner: UnitReference.create({ type: UnitReference_Type.Self }),
							}),
						},
					},
				},
				doAtValue: APLValue.create({ uuid: uid('doat-1'), value: { oneofKind: 'const', const: { val: '-10s' } } }),
			},
		],
		priorityList: [
			{
				hide: true,
				notes: '',
				action: {
					action: {
						oneofKind: 'sequence',
						sequence: {
							name: 'seq',
							actions: [
								{
									action: {
										oneofKind: 'multidot',
										multidot: {
											spellId: { rawId: { oneofKind: 'otherId', otherId: 1 }, tag: 0 },
											maxDots: 3,
											maxOverlap: APLValue.create({ uuid: uid('val-1'), value: { oneofKind: 'const', const: { val: '0ms' } } }),
										},
									},
								},
								{ action: { oneofKind: undefined } },
							],
						},
					},
				},
			},
		],
	});

describe('omitDeep', () => {
	it('strips the key at every depth and leaves the source untouched', () => {
		const rotation = buildRotation();
		const before = countKey(rotation, 'uuid');
		expect(before).toBeGreaterThan(0);

		const stripped = omitDeep(rotation, ['uuid']);

		expect(countKey(stripped, 'uuid')).toBe(0);
		expect(countKey(rotation, 'uuid')).toBe(before);
	});

	it('returns a graph the caller can mutate without reaching the source', () => {
		const rotation = buildRotation();
		const stripped = omitDeep(rotation, ['uuid']);

		const sequence = stripped.priorityList[0].action!.action as { oneofKind: 'sequence'; sequence: { name: string; actions: unknown[] } };
		sequence.sequence.name = 'mutated';
		sequence.sequence.actions.push({});
		stripped.simple!.cooldowns!.cooldowns[0].timings.push(99);
		stripped.priorityList.push(stripped.priorityList[0]);

		const source = rotation.priorityList[0].action!.action as { sequence: { name: string; actions: unknown[] } };
		expect(source.sequence.name).toBe('seq');
		expect(source.sequence.actions).toHaveLength(2);
		expect(rotation.simple!.cooldowns!.cooldowns[0].timings).toEqual([1.5, 0, -2.25, NaN, Infinity]);
		expect(rotation.priorityList).toHaveLength(1);
	});

	it('survives the field shapes a rotation actually carries', () => {
		const stripped = omitDeep(buildRotation(), ['uuid']);
		const castSpell = (stripped.prepullActions[0].action!.action as any).castSpell;

		expect(stripped.simple!.cooldowns!.cooldowns[0].timings).toEqual([1.5, 0, -2.25, NaN, Infinity]);
		expect(stripped.simple!.specRotationJson).toBe('{"unicode":"é☃"}');
		expect(castSpell.target.owner.type).toBe(UnitReference_Type.Self);
		expect((stripped.priorityList[0].action!.action as any).sequence.actions[1].action).toHaveProperty('oneofKind');
	});

	it('leaves the result serialisable, matching a rotation that never had the key', () => {
		const stripped = omitDeep(buildRotation(), ['uuid']);
		const reference = omitDeep(buildRotation(), ['uuid']);

		expect(APLRotation.toBinary(stripped)).toEqual(APLRotation.toBinary(reference));
		expect(APLRotation.toJson(stripped)).toEqual(APLRotation.toJson(reference));
	});

	it('strips through the saved-rotation wrapper the APL codec uses', () => {
		const saved = SavedRotation.create({ rotation: buildRotation() });

		expect(countKey(omitDeep(saved, ['uuid']), 'uuid')).toBe(0);
	});
});
