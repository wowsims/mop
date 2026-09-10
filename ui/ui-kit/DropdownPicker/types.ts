import type { Menu } from '@base-ui/react/menu';
import type { ClassValue } from 'clsx';
import type { ReactNode } from 'react';

export interface DropdownOption<V> {
	value: V;
	/** Rendered after `icon`, in the option and on the trigger while that option is selected. */
	label?: ReactNode;
	icon?: ReactNode;
	/** Lands on the option **and** on the trigger while it is selected. */
	className?: ClassValue;
	/**
	 * Lands on the menu row only, never on the trigger.
	 *
	 * The two channels are not interchangeable: `.apl-list-item-picker .apl-prepull-actions-only`
	 * is `display: none`, so a pre-pull-only spell's class on the trigger would hide the whole
	 * picker the moment that spell was selected.
	 */
	itemClassName?: ClassValue;
	/**
	 * The category path this option is filed under. A string names a submenu; a value makes the
	 * option carrying it the submenu's trigger, which is how a pet is filed under its owner.
	 */
	submenu?: Array<string | V>;
	/** Hover text for this option alone. The APL kind pickers pass HTML built in `model/`. */
	tooltip?: string;
}

export interface DropdownPickerProps<V> {
	/** On the trigger. */
	id?: string;
	options: Array<DropdownOption<V>>;
	value: V | undefined;
	onChange: (value: V) => void;
	/** Two option values are the same selection. Held by the caller because a value is usually a message, not a primitive. */
	equals: (a: V | undefined, b: V | undefined) => boolean;
	/** The trigger's content while no option matches `value`. */
	defaultLabel: ReactNode;
	/**
	 * Show the selected option's icon but not its label on the trigger, while the selection is the
	 * default (falsy) one.
	 */
	hideLabelWhenDefault?: (value: V) => boolean;
	/** Which side of the trigger the menu opens on. */
	side?: Menu.Positioner.Props['side'];
	/**
	 * `'fixed'` takes the menu out of flow so an overflow-clipped ancestor cannot cut it off. It only
	 * holds while nothing between the menu and the viewport carries a `transform`, `filter` or
	 * `contain` — any of those becomes the containing block and the clip comes back.
	 */
	positionMethod?: Menu.Positioner.Props['positionMethod'];
	/** On the root. */
	className?: ClassValue;
}

/** The option shape the APL model still speaks; `DropdownOption` is what the component takes. */
export interface DropdownValueConfig<V> {
	value: V;
	submenu?: (string | V)[];
	headerText?: string;
	tooltip?: string;
	extraCssClasses?: string[];
}
