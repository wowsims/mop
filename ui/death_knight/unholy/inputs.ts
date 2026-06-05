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

export const AMSNumTicksInput = InputHelpers.makeSpecOptionsEnumInput<Spec.SpecUnholyDeathKnight, number>({
	fieldName: 'amsNumTicks',
	label: 'AMS Damage Ticks',
	labelTooltip: 'Number of magic hits taken per AMS window — 1 lands at a random time, 2+ are evenly spaced. Each tick independently rolls Avg AMS Success %.',
	values: [
		{ name: '1', value: 1 },
		{ name: '2', value: 2 },
		{ name: '3', value: 3 },
		{ name: '4', value: 4 },
		{ name: '5', value: 5 },
	],
	// Old saved settings predate this field and deserialize to 0; show them as 1 tick.
	getValue: player => player.getSpecOptions().amsNumTicks || 1,
});
