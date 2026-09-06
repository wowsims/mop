import type { Encounter } from '@domain/encounter';

export const repairTargetInputs = (encounter: Encounter): void => {
	const presets = encounter.sim.db.getAllPresetTargets();
	const preset = presets.find(entry => encounter.primaryTarget.id === entry.target?.id);
	const targetInputs = preset?.target?.targetInputs || [];
	const current = encounter.primaryTarget.targetInputs;
	if (current.length === targetInputs.length && current.every((input, index) => input.label === targetInputs[index].label)) return;
	encounter.modifyTarget(0, target => {
		target.targetInputs = targetInputs;
	});
};
