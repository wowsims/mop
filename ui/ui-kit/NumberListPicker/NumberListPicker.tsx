import { arrayEquals } from '@domain/collections';
import { useInput } from '@ui-kit/hooks/useInput';
import type { NumberListPickerConfig } from '@ui-kit/pickers/number_list_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface NumberListPickerProps<ModObject> {
	modObject: ModObject;
	config: NumberListPickerConfig<ModObject>;
}

// The vanilla getInputValue: '' -> [], otherwise split(',').map(parseFloat), dropping NaN entries.
const parseInputValue = (text: string): Array<number> => {
	if (!text) return [];
	return text
		.split(',')
		.map(parseFloat)
		.filter(val => !isNaN(val));
};

/**
 * The field is uncontrolled and synced imperatively, exactly as NumberPicker is: the vanilla picker
 * commits on the native `change` event, not React's `onChange` (the input event), and re-syncs on
 * every notification (`revision`), not only on a value change.
 */
export const NumberListPicker = <ModObject,>({ modObject, config }: NumberListPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const inputRef = useRef<HTMLInputElement>(null);

	// The vanilla setInputValue: skip the write entirely when the field already parses to the same
	// value — this is what stops the field being rewritten mid-edit, e.g. while typing '1,2,'.
	useLayoutEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		if (arrayEquals(parseInputValue(input.value), value)) return;
		input.value = value.map(v => String(v)).join(',');
	}, [value, revision]);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		const onChange = () => {
			setValue(parseInputValue(input.value));
		};
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	}, [setValue]);

	return (
		<PickerShell config={config} cssClass="number-list-picker-root" hidden={hidden} disabled={disabled}>
			<input
				ref={inputRef}
				type="text"
				id={config.id}
				className="number-list-picker-input form-control"
				placeholder={config.placeholder || ''}
				disabled={disabled}
			/>
		</PickerShell>
	);
};
