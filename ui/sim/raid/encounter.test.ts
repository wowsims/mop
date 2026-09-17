import { InputType, PresetEncounter, PresetTarget, Target as TargetProto, TargetInput } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import type { Sim } from '../sim';
import { createSimStore } from '../state/sim_store';
import { Encounter } from './encounter';

const makeEncounter = () => new Encounter({ store: createSimStore() } as unknown as Sim);

const presetEncounter = () =>
	PresetEncounter.create({
		path: 'raid/preset-boss',
		targets: [
			PresetTarget.create({
				path: 'preset-boss',
				target: TargetProto.create({
					id: 71543,
					name: 'Preset Boss',
					level: 93,
					swingSpeed: 2,
					targetInputs: [TargetInput.create({ label: 'Adds', inputType: InputType.Number, numberValue: 3 })],
				}),
			}),
		],
	});

describe('Encounter', () => {
	describe('applyPreset', () => {
		it('stores a copy of every preset target, down to the nested target inputs', () => {
			const preset = presetEncounter();
			const dbTarget = preset.targets[0].target!;
			const encounter = makeEncounter();

			encounter.applyPreset(preset);

			const stored = encounter.getTarget(0)!;
			expect(stored).not.toBe(dbTarget);
			expect(stored.targetInputs[0]).not.toBe(dbTarget.targetInputs[0]);
			expect(TargetProto.equals(stored, dbTarget)).toBe(true);
		});
	});

	describe('applyPresetTarget', () => {
		it('stores a copy of the preset target at the given index', () => {
			const preset = presetEncounter().targets[0];
			const dbTarget = preset.target!;
			const encounter = makeEncounter();

			encounter.applyPresetTarget(preset, 0);

			const stored = encounter.getTarget(0)!;
			expect(stored).not.toBe(dbTarget);
			expect(stored.targetInputs[0]).not.toBe(dbTarget.targetInputs[0]);
			expect(TargetProto.equals(stored, dbTarget)).toBe(true);
		});
	});

	it('leaves the database preset untouched when a writer edits the applied target in place', () => {
		const preset = presetEncounter();
		const dbTarget = preset.targets[0].target!;
		const encounter = makeEncounter();

		encounter.applyPreset(preset);
		const stored = encounter.getTarget(0)!;
		stored.level = 88;
		stored.targetInputs[0].numberValue = 9;

		expect(dbTarget.level).toBe(93);
		expect(dbTarget.targetInputs[0].numberValue).toBe(3);
	});
});
