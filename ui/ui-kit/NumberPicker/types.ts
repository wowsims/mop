import type { InputConfig } from '@ui-kit/input';

/**
 * Data for creating a number picker.
 */
export interface NumberPickerConfig<ModObject> extends InputConfig<ModObject, number> {
	id: string;
	// Whether the picker represents a float value. Default `false`
	float?: boolean;
	maxDecimalDigits?: number;
	// Whether to only allow positive values. Default `false`
	positive?: boolean;
	// Whether to show values of zero within the input. Default `true`
	showZeroes?: boolean;
}
