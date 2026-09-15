import type { InputConfig } from '@ui-kit/input';

/**
 * Data for creating a number list picker.
 */
export interface NumberListPickerConfig<ModObject> extends InputConfig<ModObject, Array<number>> {
	id: string;
	placeholder?: string;
}
