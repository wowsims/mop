import './DropdownPicker.scss';

import type { DropdownOption } from '@ui-kit/DropdownPicker';
import { useInput } from '@ui-kit/hooks/useInput';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import type { ReactNode } from 'react';

import { DropdownMenu } from './DropdownMenu';

export interface DropdownFieldProps<ModObject, T, V = T> {
	modObject: ModObject;
	/**
	 * `V` differs from `T` when the option type is not the stored type, bridged by the config's own
	 * `sourceToValue`/`valueToSource`. The APL action-id field stores an `ActionID` message and offers
	 * `ActionId` objects; its unit field stores a `UnitReference` and offers a `UnitValue` carrying
	 * that unit's icon and colour.
	 */
	config: InputConfig<ModObject, T, V> & { id: string };
	options: Array<DropdownOption<V>>;
	/** Two option values are the same selection. Defaults to `===`, which every enum caller wants. */
	equals?: (a: V | undefined, b: V | undefined) => boolean;
	defaultLabel: ReactNode;
	hideLabelWhenDefault?: (value: V) => boolean;
}

const identical = <V,>(a: V | undefined, b: V | undefined) => a === b;

/**
 * A dropdown bound to an `InputConfig` — `useInput` for the value, `PickerShell` for the label,
 * description and root classes.
 *
 * The root **is** the shell: the label, the button and the menu are all children of one
 * `div.input-root.dropdown-picker-root.dropdown`. Wrapping `DropdownPicker` would nest a second
 * root inside the shell, and a wrapper element the baseline does not have is what the rotation
 * tab's parity line exists to catch.
 */
export const DropdownField = <ModObject, T, V = T>({
	modObject,
	config,
	options,
	equals = identical,
	defaultLabel,
	hideLabelWhenDefault,
}: DropdownFieldProps<ModObject, T, V>) => {
	const { value, setValue, hidden, disabled } = useInput<ModObject, T, V>(modObject, config);

	return (
		<PickerShell config={config} className="dropdown-picker-root dropdown" hidden={hidden} disabled={disabled}>
			<DropdownMenu<V>
				id={config.id}
				options={options}
				value={value}
				onChange={setValue}
				equals={equals}
				defaultLabel={defaultLabel}
				hideLabelWhenDefault={hideLabelWhenDefault}
			/>
		</PickerShell>
	);
};
