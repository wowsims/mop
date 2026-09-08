import './DropdownPicker.scss';

import type { DropdownOption } from '@ui-kit/DropdownPicker';
import { useInput } from '@ui-kit/hooks/useInput';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import type { ReactNode } from 'react';

import { DropdownMenu } from './DropdownMenu';

export interface DropdownFieldProps<ModObject, T> {
	modObject: ModObject;
	config: InputConfig<ModObject, T> & { id: string };
	options: Array<DropdownOption<T>>;
	/** Two option values are the same selection. Defaults to `===`, which every enum caller wants. */
	equals?: (a: T | undefined, b: T | undefined) => boolean;
	defaultLabel: ReactNode;
	hideLabelWhenDefault?: (value: T) => boolean;
}

const identical = <T,>(a: T | undefined, b: T | undefined) => a === b;

/**
 * A dropdown bound to an `InputConfig` — `useInput` for the value, `PickerShell` for the label,
 * description and root classes.
 *
 * The root **is** the shell: vanilla's `TextDropdownPicker` extended `Input`, so its label, its
 * button and its menu were all children of one `div.input-root.dropdown-picker-root.dropdown`.
 * Wrapping `DropdownPicker` would have nested a second root inside the shell, and a wrapper element
 * the baseline does not have is what the rotation tab's parity line exists to catch.
 */
export const DropdownField = <ModObject, T>({
	modObject,
	config,
	options,
	equals = identical,
	defaultLabel,
	hideLabelWhenDefault,
}: DropdownFieldProps<ModObject, T>) => {
	const { value, setValue, hidden, disabled } = useInput(modObject, config);

	return (
		<PickerShell config={config} className="dropdown-picker-root dropdown" hidden={hidden} disabled={disabled}>
			<DropdownMenu<T>
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
