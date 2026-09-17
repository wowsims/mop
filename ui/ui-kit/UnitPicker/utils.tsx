import { UnitReference } from '@generated/proto/common';
import { textClassName } from '@sim/proto/utils';
import type { DropdownOption } from '@ui-kit/DropdownPicker';

import type { UnitValue } from './types';
import { UnitIcon } from './UnitIcon';

/** Two `UnitValue`s are the same unit; the display fields around the reference are deliberately not compared. */
export const sameUnit = (a: UnitValue | undefined, b: UnitValue | undefined) =>
	UnitReference.equals(a?.value || UnitReference.create(), b?.value || UnitReference.create());

/**
 * A `UnitValue`'s icon, class colour and text as the option props the shared dropdown takes.
 *
 * Shared with the APL unit field, which binds the same options through `DropdownField` instead of
 * the unbound `UnitPicker` — a bound picker's root has to be the shell, not a wrapper around one.
 * `submenu` is the caller's: only the APL sets it, filing a pet under its owner.
 */
export const unitOption = (unit: UnitValue, submenu?: Array<string | UnitValue>): DropdownOption<UnitValue> => ({
	value: unit,
	label: unit.text,
	icon: unit.iconUrl ? <UnitIcon iconUrl={unit.iconUrl} /> : undefined,
	className: unit.color && textClassName(unit.color),
	submenu,
});
