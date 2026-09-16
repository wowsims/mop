import { formatToNumber } from '@sim/utils/format';
import { Input } from '@ui-kit/FormControl';
import { useCommitChange } from '@ui-kit/hooks/useCommitChange';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import clsx from 'clsx';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { NumberPickerConfig } from './types';

export interface NumberPickerProps<ModObject> {
	modObject: ModObject;
	config: NumberPickerConfig<ModObject>;
	inputClassName?: string;
	testId?: string;
}

const formatSourceValue = (value: number, float: boolean, showZeroes: boolean, maxDecimalDigits: number): string => {
	if (value === 0 && !showZeroes) return '';
	if (float) return formatToNumber(value, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: maxDecimalDigits });
	return String(value);
};

const applyPositive = (text: string, float: boolean, maxDecimalDigits: number): string => {
	if (float) return formatToNumber(Math.abs(Number(text)), { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: maxDecimalDigits });
	return Math.abs(parseInt(text)).toString();
};

const parseValue = (text: string, float: boolean): number => {
	return float ? Number(text || '') || 0 : parseInt(text || '') || 0;
};

const updateSize = (input: HTMLInputElement | null) => {
	if (!input) return;
	const size = Math.max(3, input.value.length);
	if (input.size !== size) input.size = size;
};

export const NumberPicker = <ModObject,>({ modObject, config, inputClassName, testId }: NumberPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const [input, setInput] = useState<HTMLInputElement | null>(null);
	const attachInput = useCallback((element: HTMLElement | null) => setInput(element instanceof HTMLInputElement ? element : null), []);

	const float = config.float ?? false;
	const positive = config.positive ?? false;
	const showZeroes = config.showZeroes ?? true;
	const maxDecimalDigits = config.maxDecimalDigits ?? 2;

	const display = formatSourceValue(value, float, showZeroes, maxDecimalDigits);

	useLayoutEffect(() => {
		if (!input) return;
		input.value = display;
	}, [display, revision, input]);

	useLayoutEffect(() => {
		updateSize(input);
	}, [input]);

	useCommitChange(input, committed => {
		if (positive) committed.value = applyPositive(committed.value, float, maxDecimalDigits);
		const parsed = parseValue(committed.value, float);
		// A source that has nothing new to report never rings, and the effect above is all that
		// rewrites the field — so the text the user committed has to be normalised here.
		committed.value = formatSourceValue(parsed, float, showZeroes, maxDecimalDigits);
		setValue(parsed);
	});

	return (
		<PickerShell config={config} className="ui-number-picker-root" testId={testId ?? 'number-picker-root'} hidden={hidden} disabled={disabled}>
			<Input
				type="text"
				ref={attachInput}
				id={config.id}
				className={clsx('ui-number-picker-input', config.inputClassName, inputClassName)}
				data-testid="number-picker-input"
				disabled={disabled}
				onInput={() => updateSize(input)}
			/>
		</PickerShell>
	);
};
