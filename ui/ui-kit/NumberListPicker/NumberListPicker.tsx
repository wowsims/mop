import { Field } from '@base-ui/react/field';
import { arrayEquals } from '@domain/collections';
import { useInput } from '@ui-kit/hooks/useInput';
import type { NumberListPickerConfig } from '@ui-kit/pickers/number_list_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface NumberListPickerProps<ModObject> {
	modObject: ModObject;
	config: NumberListPickerConfig<ModObject>;
}

const parseInputValue = (text: string): Array<number> => {
	if (!text) return [];
	return text
		.split(',')
		.map(parseFloat)
		.filter(val => !isNaN(val));
};

export const NumberListPicker = <ModObject,>({ modObject, config }: NumberListPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const inputRef = useRef<HTMLInputElement>(null);

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
			<Field.Control
				render={<input type="text" />}
				ref={inputRef}
				id={config.id}
				className="number-list-picker-input form-control"
				placeholder={config.placeholder || ''}
				disabled={disabled}
			/>
		</PickerShell>
	);
};
