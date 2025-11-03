import * as InputHelpers from '../../core/components/input_helpers';
import { Spec } from '../../core/proto/common';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const MageRotationConfig = {
	inputs: [
		// ********************************************************
		//                       FIRE INPUTS
		// ********************************************************
		InputHelpers.makeRotationNumberInput<Spec.SpecFireMage>({
			fieldName: 'combustAlwaysSend',
			label: 'Combust Threshold - Always send',
			labelTooltip: 'The value at which Combustion should be sent regardless of other conditions. (Very RNG dependent)',
			changeEmitter: player => player.rotationChangeEmitter,
			getValue: player => player.getSimpleRotation().combustAlwaysSend,
			positive: true,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecFireMage>({
			fieldName: 'combustBloodlust',
			label: 'Combust Threshold - Bloodlust',
			labelTooltip: 'The value at which Combustion should be cast when Bloodlust is running.',
			changeEmitter: player => player.rotationChangeEmitter,
			getValue: player => player.getSimpleRotation().combustBloodlust,
			positive: true,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecFireMage>({
			fieldName: 'combustPostAlter',
			label: 'Combust Threshold - Alter Time',
			labelTooltip: 'The value at which Combustion should be cast after Alter Time was used.',
			changeEmitter: player => player.rotationChangeEmitter,
			getValue: player => player.getSimpleRotation().combustPostAlter,
			positive: true,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecFireMage>({
			fieldName: 'combustNoAlter',
			label: 'Combust Threshold - No CDs',
			labelTooltip: 'The value at which Combustion should be cast when you have no Alter Time window up.',
			changeEmitter: player => player.rotationChangeEmitter,
			getValue: player => player.getSimpleRotation().combustNoAlter,
			positive: true,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecFireMage>({
			fieldName: 'combustEndOfCombat',
			label: 'Combust Threshold - End of combat',
			labelTooltip: 'The value at which Combustion should be cast when combat is about to end.',
			changeEmitter: player => player.rotationChangeEmitter,
			getValue: player => player.getSimpleRotation().combustEndOfCombat,
			positive: true,
		}),
	],
};
