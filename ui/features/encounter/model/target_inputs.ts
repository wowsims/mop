import type { Encounter } from '@domain/encounter';

/**
 * Re-seeds the primary target's inputs from the preset it claims to be.
 *
 * They drift: selecting a custom AI leaves the target's id pointing at one preset while its inputs
 * belong to another, and the labels are what the pickers key off. Comparing length and labels rather
 * than values is what makes this a repair and not a reset — a matching shape keeps the user's
 * numbers.
 *
 * Needs the preset database, so it runs on `waitForInit`, and it must run *after* saved settings are
 * restored or it repairs a target that is about to be replaced.
 */
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
