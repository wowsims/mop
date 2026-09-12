import type { ControlledConfig, InputConfig } from '@ui-kit/input';

/**
 * Data for creating a boolean picker (checkbox).
 */
export interface BooleanPickerConfig<ModObject> extends InputConfig<ModObject, boolean> {
	id: string;
	reverse?: boolean;
}

export type ControlledBooleanPickerConfig<ModObject> = ControlledConfig<ModObject, boolean> & { id: string; reverse?: boolean };

export type AnyBooleanPickerConfig<ModObject> = BooleanPickerConfig<ModObject> | ControlledBooleanPickerConfig<ModObject>;
