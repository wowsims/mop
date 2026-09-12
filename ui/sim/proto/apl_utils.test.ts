import { APLRotation, APLRotation_Type } from '@generated/proto/apl';
import { ActionID, type Spec } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import type { Player } from '../player/player';
import { isEqualAPLRotation } from './apl_utils';

// Only the TypeSimple branch reaches the player, and none of these cases take it.
const player = null as unknown as Player<Spec>;

const rotation = (type: APLRotation_Type, spellId: number) =>
	APLRotation.create({
		type,
		priorityList: [
			{ action: { action: { oneofKind: 'castSpell', castSpell: { spellId: ActionID.create({ rawId: { oneofKind: 'spellId', spellId } }) } } } },
		],
	});

describe('isEqualAPLRotation', () => {
	it('matches an Auto rotation against the APL rotation it resolves to', () => {
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAuto, 100), rotation(APLRotation_Type.TypeAPL, 100))).toBe(true);
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAPL, 100), rotation(APLRotation_Type.TypeAuto, 100))).toBe(true);
	});

	it('still separates rotations that differ below the type', () => {
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAuto, 100), rotation(APLRotation_Type.TypeAPL, 200))).toBe(false);
	});

	it('leaves both arguments untouched', () => {
		const auto = rotation(APLRotation_Type.TypeAuto, 100);
		const apl = rotation(APLRotation_Type.TypeAPL, 100);
		isEqualAPLRotation(player, auto, apl);
		expect(auto.type).toBe(APLRotation_Type.TypeAuto);
		expect(apl.type).toBe(APLRotation_Type.TypeAPL);
	});

	it('treats a missing rotation as unequal to a present one', () => {
		expect(isEqualAPLRotation(player, undefined, rotation(APLRotation_Type.TypeAPL, 100))).toBe(false);
		expect(isEqualAPLRotation(player, undefined, undefined)).toBe(true);
	});
});
