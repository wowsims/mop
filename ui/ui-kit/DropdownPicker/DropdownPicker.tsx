import './DropdownPicker.scss';

import { Menu } from '@base-ui/react/menu';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import { type ReactNode, useState } from 'react';

// Bootstrap's dropdown plugin offsets its menu by [0, 2] from the toggle.
const BOOTSTRAP_DROPDOWN_OFFSET = 2;

export interface DropdownOption<V> {
	value: V;
	/** Rendered after `icon`, in the option and on the trigger while that option is selected. */
	label?: ReactNode;
	icon?: ReactNode;
	/** Lands on the option **and** on the trigger while it is selected — the axis vanilla's `setOptionContent(button, config, isSelectButton)` varied by writing the same content into two elements. */
	className?: ClassValue;
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

/**
 * A value picker with rich options — an icon, a label and a class list per entry.
 *
 * It parameterises the option list, how two values compare and what each option renders; it fixes
 * the trigger-and-menu markup and that picking an option closes the menu. It is **not** an
 * `InputConfig` picker: `value`/`onChange` are the whole binding, so a caller whose selection is
 * UI-local state needs no store to write it through. A bound caller wraps it in `useInput` and
 * `PickerShell`, the same split `CopyButton`/`useCopyToClipboard` and `SavedDataPanel`/`useSavedData` make.
 */
export const DropdownPicker = <V,>({ id, options, value, onChange, equals, defaultLabel, side, positionMethod, className }: DropdownPickerProps<V>) => {
	// null is Base UI's "not resolved yet"; anything else falls back to <body>, which is outside `.sim-ui` and its theme.
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);

	// The index, not the value, is what the radio group compares: an option value is an object here, and Base UI matches a selected radio by identity.
	const selectedIndex = options.findIndex(option => equals(option.value, value));
	const selected = options[selectedIndex] as DropdownOption<V> | undefined;

	return (
		<div className={clsx('dropdown-picker-root', 'dropdown', className)}>
			<Menu.Root open={open} onOpenChange={setOpen} modal={false}>
				<Menu.Trigger id={id} className={clsx('dropdown-picker-button', 'btn', 'dropdown-toggle', selected?.className)}>
					{selected ? (
						<>
							{selected.icon}
							{selected.label}
						</>
					) : (
						defaultLabel
					)}
				</Menu.Trigger>
				{/* The slot holds the place vanilla's `<ul>` had after the button, which a portal aimed at the root cannot: Base UI appends its element in a later commit than React places the root's own children. */}
				<div className="dropdown-picker-slot" ref={setSlot} />
				<Menu.Portal container={slot} keepMounted className="dropdown-picker-portal">
					<Menu.Positioner
						align="start"
						side={side}
						positionMethod={positionMethod}
						sideOffset={BOOTSTRAP_DROPDOWN_OFFSET}
						className="dropdown-picker-positioner">
						<Menu.Popup className="dropdown-picker-menu">
							<Menu.RadioGroup
								render={<ul />}
								className="dropdown-picker-list"
								value={selectedIndex}
								onValueChange={(index: number) => onChange(options[index].value)}>
								{/* Built on open and dropped on close, as vanilla's `show.bs.dropdown` / `hidden.bs.dropdown` pair did. */}
								{open &&
									options.map((option, index) => (
										<Menu.RadioItem
											key={index}
											render={<li />}
											value={index}
											closeOnClick
											className={clsx('dropdown-picker-item', option.className)}>
											{option.icon}
											{option.label}
										</Menu.RadioItem>
									))}
							</Menu.RadioGroup>
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
		</div>
	);
};
