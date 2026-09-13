import './DropdownPicker.scss';

import clsx from 'clsx';

import { DropdownMenu } from './DropdownMenu';
import type { DropdownPickerProps } from './types';

/**
 * A value picker with rich options — an icon, a label, a class list, a tooltip and a category path
 * per entry.
 *
 * It parameterises the option list, how two values compare and what each option renders; it fixes
 * the trigger-and-menu markup and that picking an option closes the menu. It is **not** an
 * `InputConfig` picker: `value`/`onChange` are the whole binding, so a caller whose selection is
 * UI-local state needs no store to write it through. A bound caller reaches for `DropdownField`,
 * the same split `CopyButton`/`useCopyToClipboard` and `SavedDataPanel`/`useSavedData` make.
 *
 * The APL action-id pickers replace their list on every unit-metadata change, which is a prop
 * update here rather than a rebuild-and-compare.
 */
export const DropdownPicker = <V,>({ className, ...menu }: DropdownPickerProps<V>) => (
	<div className={clsx('dropdown-picker-root', 'dropdown', className)}>
		<DropdownMenu<V> {...menu} />
	</div>
);
