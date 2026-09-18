import { InputType, PresetTarget, Target as TargetProto, TargetInput } from '@generated/proto/common';
import { Encounter } from '@sim/raid/encounter';
import type { Sim } from '@sim/sim';
import { createSimStore } from '@sim/state/sim_store';
import { describe, expect, it } from 'vitest';

import { repairTargetInputs } from './target_inputs';

const DEFAULT_TARGET_ID = Encounter.defaultTargetProto().id;

const presetTarget = () =>
	PresetTarget.create({
		path: 'preset-boss',
		target: TargetProto.create({
			id: DEFAULT_TARGET_ID,
			name: 'Preset Boss',
			targetInputs: [TargetInput.create({ label: 'Adds', inputType: InputType.Number, numberValue: 3 })],
		}),
	});

const makeEncounter = (preset: PresetTarget) => {
	const store = createSimStore();
	const sim = { store, db: { getAllPresetTargets: () => [preset] } } as unknown as Sim;
	return new Encounter(sim);
};

describe('repairTargetInputs', () => {
	it('copies the database preset inputs rather than aliasing them', () => {
		const preset = presetTarget();
		const dbInputs = preset.target!.targetInputs;
		const encounter = makeEncounter(preset);

		repairTargetInputs(encounter);

		const stored = encounter.primaryTarget.targetInputs;
		expect(stored).not.toBe(dbInputs);
		expect(stored[0]).not.toBe(dbInputs[0]);
		expect(TargetInput.equals(stored[0], dbInputs[0])).toBe(true);
	});

	it('leaves the database preset untouched when a writer edits the repaired inputs in place', () => {
		const preset = presetTarget();
		const encounter = makeEncounter(preset);

		repairTargetInputs(encounter);
		encounter.primaryTarget.targetInputs[0].numberValue = 9;

		expect(preset.target!.targetInputs[0].numberValue).toBe(3);
	});
});
