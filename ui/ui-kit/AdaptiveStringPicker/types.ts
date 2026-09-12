import type { InputConfig } from '@ui-kit/input';

/**
 * Data for creating a string picker.
 */
export interface StringPickerConfig<ModObject> extends InputConfig<ModObject, string> {
	id: string;
}
