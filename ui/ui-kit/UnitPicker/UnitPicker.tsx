import { UnitReference } from '@generated/proto/common';
import { DropdownPicker } from '@ui-kit/DropdownPicker';
import type { ClassValue } from 'clsx';

import type { UnitValue } from './types';
import { sameUnit, unitOption } from './utils';

export interface UnitPickerProps {
	/** On the trigger. */
	id?: string;
	options: Array<UnitValue>;
	value: UnitReference | undefined;
	onChange: (value: UnitReference | undefined) => void;
	/**
	 * Show the selected unit's icon but not its text while the default unit is selected. The APL unit
	 * pickers all set it.
	 */
	hideLabelWhenDefault?: boolean;
	/** On the root, beside `unit-picker-root`. */
	className?: ClassValue;
}

/**
 * A `DropdownPicker` over units. All it adds is the mapping — a `UnitValue`'s icon (an `ActionId`,
 * a Font Awesome glyph or an image url), its class colour and its text — onto the option props the
 * shared picker already takes, plus reference equality. The mapping itself is in `utils.tsx`,
 * because the APL's bound unit field needs the same options through `DropdownField`.
 */
export const UnitPicker = ({ id, options, value, onChange, hideLabelWhenDefault, className }: UnitPickerProps) => (
	<DropdownPicker<UnitValue>
		id={id}
		className={['unit-picker-root', className]}
		options={options.map(unit => unitOption(unit))}
		value={{ value }}
		onChange={unit => onChange(unit.value)}
		equals={sameUnit}
		defaultLabel="Unit"
		hideLabelWhenDefault={hideLabelWhenDefault ? unit => !unit.value : undefined}
	/>
);
