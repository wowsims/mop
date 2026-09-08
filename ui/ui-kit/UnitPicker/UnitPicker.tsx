import { UnitReference } from '@generated/proto/common';
import { textClassName } from '@sim/proto/utils';
import { DropdownPicker } from '@ui-kit/DropdownPicker';
import type { UnitValue } from '@ui-kit/pickers/unit_picker';
import type { ClassValue } from 'clsx';

import { UnitIcon } from './UnitIcon';

export interface UnitPickerProps {
	/** On the trigger. */
	id?: string;
	options: Array<UnitValue>;
	value: UnitReference | undefined;
	onChange: (value: UnitReference | undefined) => void;
	/** On the root, beside `unit-picker-root`. */
	className?: ClassValue;
}

/** Two `UnitValue`s are the same unit; the display fields around the reference are deliberately not compared. */
const sameUnit = (a: UnitValue | undefined, b: UnitValue | undefined) =>
	UnitReference.equals(a?.value || UnitReference.create(), b?.value || UnitReference.create());

/**
 * A `DropdownPicker` over units. All it adds is the mapping — a `UnitValue`'s icon (an `ActionId`,
 * a Font Awesome glyph or an image url), its class colour and its text — onto the option props the
 * shared picker already takes, plus reference equality. Vanilla expressed that as a subclass
 * writing into the option `<button>`; there is no subclass here, and nothing about the menu is
 * re-stated.
 */
export const UnitPicker = ({ id, options, value, onChange, className }: UnitPickerProps) => (
	<DropdownPicker<UnitValue>
		id={id}
		className={['unit-picker-root', className]}
		options={options.map(unit => ({
			value: unit,
			label: unit.text,
			icon: unit.iconUrl ? <UnitIcon iconUrl={unit.iconUrl} /> : undefined,
			className: unit.color && textClassName(unit.color),
		}))}
		value={{ value }}
		onChange={unit => onChange(unit.value)}
		equals={sameUnit}
		defaultLabel="Unit"
	/>
);
