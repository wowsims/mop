import type { StoreField } from '@sim/hooks/useStoreField';
import type { StoreSubscribe } from '@sim/state/subscriptions';

export type StoreBinding<ModObject> =
	| { storeSubscribe: (obj: ModObject) => StoreSubscribe; storeField?: StoreField | ReadonlyArray<StoreField> }
	| { storeSubscribe?: undefined; storeField: StoreField | ReadonlyArray<StoreField> };

/** What an input renders, whichever end its value comes from. */
export interface InputChrome<ModObject> {
	label?: string;
	labelTooltip?: string | Element;
	description?: string | Element;
	inline?: boolean;
	id?: string;
	extraClassNames?: Array<string>;

	// If set, will automatically disable the input when this evaluates to false.
	enableWhen?: (obj: ModObject) => boolean;

	// If set, will automatically hide the input when this evaluates to false.
	showWhen?: (obj: ModObject) => boolean;
}

/**
 * Data for creating a new input UI element, reading its own value off the mod object.
 */
export interface InputConfig<ModObject, T, V = T> extends InputChrome<ModObject> {
	defaultValue?: T;

	// The input's change source: given the mod object, returns a subscribe
	// function (see state/subscriptions.ts). Omit for inputs that are re-synced
	// by their parent (nested APL pickers, UI-local toggles).
	storeSubscribe?: (obj: ModObject) => StoreSubscribe;

	// The same change source named as data: the store field(s) this input reads,
	// resolved against the sim host (see hooks/useStoreField.ts). `storeSubscribe`
	// wins where a config carries both.
	storeField?: StoreField | ReadonlyArray<StoreField>;

	// Get and set the mapped value. `getValue` is re-read on a notification, not on a render, so it
	// must read the model off `obj` — a value the surrounding render already holds belongs in a
	// controlled config instead (see ControlledConfig).
	getValue: (obj: ModObject) => T;
	setValue: (obj: ModObject, newValue: T) => void;

	// Convert between source value and input value types. In most cases this is not needed
	// because source and input use the same type. These functions must be set if T != V.
	sourceToValue?: (src: T) => V;
	valueToSource?: (val: V) => T;

	value?: undefined;
	onChange?: undefined;
}

/**
 * The other end: the value is already in hand — a hook read, a parent's state — so the input
 * neither reads nor subscribes, and cannot go stale against what the parent rendered.
 */
export type ControlledConfig<ModObject, V> = InputChrome<ModObject> & {
	value: V;
	onChange: (newValue: V) => void;

	defaultValue?: undefined;
	storeSubscribe?: undefined;
	storeField?: undefined;
	getValue?: undefined;
	setValue?: undefined;
	sourceToValue?: undefined;
	valueToSource?: undefined;
};

/** Either end, which is what `useInput` and the pickers that offer both accept. */
export type AnyInputConfig<ModObject, T, V = T> = InputConfig<ModObject, T, V> | ControlledConfig<ModObject, V>;
