import type { StoreField } from '@sim/hooks/useStoreField';
import type { StoreSubscribe } from '@sim/state/subscriptions';

/**
 * Data for creating a new input UI element.
 */
export interface InputConfig<ModObject, T, V = T> {
	label?: string;
	labelTooltip?: string | Element;
	description?: string | Element;
	inline?: boolean;
	id?: string;
	extraClassNames?: Array<string>;

	defaultValue?: T;

	// The input's change source: given the mod object, returns a subscribe
	// function (see state/subscriptions.ts). Omit for inputs that are re-synced
	// by their parent (nested APL pickers, UI-local toggles).
	storeSubscribe?: (obj: ModObject) => StoreSubscribe;

	// The same change source named as data: the store field(s) this input reads,
	// resolved against the sim host (see hooks/useStoreField.ts). `storeSubscribe`
	// wins where a config carries both.
	storeField?: StoreField | ReadonlyArray<StoreField>;

	// Get and set the mapped value.
	getValue: (obj: ModObject) => T;
	setValue: (obj: ModObject, newValue: T) => void;

	// If set, will automatically disable the input when this evaluates to false.
	enableWhen?: (obj: ModObject) => boolean;

	// If set, will automatically hide the input when this evaluates to false.
	showWhen?: (obj: ModObject) => boolean;

	// Convert between source value and input value types. In most cases this is not needed
	// because source and input use the same type. These functions must be set if T != V.
	sourceToValue?: (src: T) => V;
	valueToSource?: (val: V) => T;
}
