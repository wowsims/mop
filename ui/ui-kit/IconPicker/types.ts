import type { ActionId } from '@sim/proto/action_id';
import type { InputConfig, StoreBinding } from '@ui-kit/input';

// Data for creating an icon-based input component.
//
// E.g. one of these for arcane brilliance, another for kings, etc.
// ModObject is the object being modified (Sim, Player, or Target).
// ValueType is either number or boolean.
interface IconPickerBase<ModObject, ValueType> extends InputConfig<ModObject, ValueType> {
	actionId: ActionId;

	// The number of possible 'states' this icon can have. Most inputs will use 2
	// for a bi-state icon (on or off). 0 indicates an unlimited number of states.
	states: number;

	// Only used if states >= 3.
	improvedId?: ActionId;

	// Only used if states >= 4.
	improvedId2?: ActionId;
}

// Required here: an icon picker has no parent that refreshes it.
export type IconPickerConfig<ModObject, ValueType> = IconPickerBase<ModObject, ValueType> & StoreBinding<ModObject>;
