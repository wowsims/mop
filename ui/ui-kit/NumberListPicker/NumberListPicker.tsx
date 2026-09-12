import { Input } from '@base-ui/react/input';
import { arrayEquals } from '@sim/utils/collections';
import { useCommitChange } from '@ui-kit/hooks/useCommitChange';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import { useCallback, useLayoutEffect, useState } from 'react';

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

const formatValue = (value: Array<number>): string => value.map(v => String(v)).join(',');

export const NumberListPicker = <ModObject,>({ modObject, config }: NumberListPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const [input, setInput] = useState<HTMLInputElement | null>(null);
	const attachInput = useCallback((element: HTMLElement | null) => setInput(element instanceof HTMLInputElement ? element : null), []);

	useLayoutEffect(() => {
		if (!input) return;
		if (arrayEquals(parseInputValue(input.value), value)) return;
		input.value = formatValue(value);
	}, [value, revision, input]);

	useCommitChange(input, committed => {
		const next = parseInputValue(committed.value);
		committed.value = formatValue(next);
		setValue(next);
	});

	return (
		<PickerShell config={config} className="number-list-picker-root" hidden={hidden} disabled={disabled}>
			<Input
				type="text"
				ref={attachInput}
				id={config.id}
				className="number-list-picker-input form-control"
				placeholder={config.placeholder || ''}
				disabled={disabled}
			/>
		</PickerShell>
	);
};
