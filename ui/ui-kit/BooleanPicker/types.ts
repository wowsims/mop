import type { InputConfig } from '@ui-kit/input';

/**
 * Data for creating a boolean picker (checkbox).
 */
export interface BooleanPickerConfig<ModObject> extends InputConfig<ModObject, boolean> {
	id: string;
	reverse?: boolean;
}
