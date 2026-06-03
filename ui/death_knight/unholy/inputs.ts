import * as InputHelpers from '../../core/components/input_helpers.js';
import { Spec } from '../../core/proto/common.js';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const AvgAMSHitInput = InputHelpers.makeSpecOptionsNumberInput<Spec.SpecUnholyDeathKnight>({
	fieldName: 'avgAmsHit',
	label: 'Avg AMS Hit',
	labelTooltip: 'How much on average (+-10%) the character is hit for when AMS is successful. Set to 0 to disable AMS damage intake.',
});

export const AvgAMSSuccessRateInput = InputHelpers.makeSpecOptionsNumberInput<Spec.SpecUnholyDeathKnight>({
	fieldName: 'avgAmsSuccessRate',
	label: 'Avg AMS Success %',
	labelTooltip: 'Chance for damage to be taken during the 5 second window of AMS.',
	percent: true,
});
