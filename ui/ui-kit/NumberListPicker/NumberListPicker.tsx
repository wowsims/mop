import { Input } from '@base-ui/react/input';
import { arrayEquals } from '@sim/utils/collections';
import { useCommitChange } from '@ui-kit/hooks/useCommitChange';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import { useLayoutEffect, useRef } from 'react';

import type { NumberListPickerConfig } from './types';

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

	useCommitChange(inputRef, input => setValue(parseInputValue(input.value)));

	return (
		<PickerShell config={config} className="number-list-picker-root" hidden={hidden} disabled={disabled}>
			<Input
				type="text"
				ref={inputRef}
				id={config.id}
				className="number-list-picker-input form-control"
				placeholder={config.placeholder || ''}
				disabled={disabled}
			/>
		</PickerShell>
	);
};
