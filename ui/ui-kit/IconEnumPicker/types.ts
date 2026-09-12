import type { ActionId } from '@sim/proto/action_id';
import type { InputConfig, StoreBinding } from '@ui-kit/input';

export enum IconEnumPickerDirection {
	Vertical = 'vertical',
	Horizontal = 'Horizontal',
}

export interface IconEnumValueConfig<ModObject, T> {
	value: T;
	// One of these should be set.
	// If actionId is set, shows the icon for that id.
	// If color is set, shows that color.
	// If iconUrl is set, shows that icon as grayscale
	actionId?: ActionId;
	color?: string;
	iconUrl?: string;
	// Text to be displayed on the icon.
	text?: string;
	// Hover tooltip.
	tooltip?: string;

	showWhen?: (obj: ModObject) => boolean;
}

interface IconEnumPickerBase<ModObject, T> extends InputConfig<ModObject, T> {
	numColumns?: number;
	values: Array<IconEnumValueConfig<ModObject, T>>;
	// Value that will be considered inactive.
	zeroValue: T;
	// Function for comparing two values.
	// Tooltip that will be shown whne hovering over the icon-picker-button
	tooltip?: string;
	// The direction the menu will open in relative to the root element
	direction?: IconEnumPickerDirection;
	equals: (a: T, b: T) => boolean;
	backupIconUrl?: (value: T) => ActionId;
	showWhen?: (obj: ModObject) => boolean;
}

// Required here: an icon enum picker has no parent that refreshes it.
export type IconEnumPickerConfig<ModObject, T> = IconEnumPickerBase<ModObject, T> & StoreBinding<ModObject>;
