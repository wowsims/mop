import type { Menu } from '@base-ui/react/menu';
import type { ClassValue } from 'clsx';
import type { ReactNode } from 'react';

export interface DropdownOption<V> {
	value: V;
	/** Rendered after `icon`, in the option and on the trigger while that option is selected. */
	label?: ReactNode;
	icon?: ReactNode;
	/** Lands on the option **and** on the trigger while it is selected — the axis vanilla's `setOptionContent(button, config, isSelectButton)` varied by writing the same content into two elements. */
	className?: ClassValue;
	/**
	 * The category path this option is filed under. A string names a submenu; a value makes the
	 * option carrying it the submenu's trigger, which is how a pet is filed under its owner.
	 */
	submenu?: Array<string | V>;
	/** Hover text for this option alone. The APL kind pickers pass HTML built in `model/`. */
	tooltip?: string;
}

export interface DropdownPickerProps<V> {
	/** On the trigger, as vanilla's `config.id` was. */
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
	 * default (falsy) one. Vanilla's `UnitPicker`-only `hideLabelWhenDefaultSelected`.
	 */
	hideLabelWhenDefault?: (value: V) => boolean;
	/** Which side of the trigger the menu opens on — `'top'` is what vanilla spelled as Bootstrap's `.dropup`. */
	side?: Menu.Positioner.Props['side'];
	/**
	 * `'fixed'` is vanilla's `popperConfig: { strategy: 'fixed' }`: it takes the menu out of flow so an
	 * overflow-clipped ancestor cannot cut it off. It only holds while nothing between the menu and
	 * the viewport carries a `transform`, `filter` or `contain` — any of those becomes the containing
	 * block and the clip comes back.
	 */
	positionMethod?: Menu.Positioner.Props['positionMethod'];
	/** On the root. */
	className?: ClassValue;
}
