import { Field } from '@base-ui/react/field';
import { formatToNumber } from '@domain/format';
import { useInput } from '@ui-kit/hooks/useInput';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface NumberPickerProps<ModObject> {
	modObject: ModObject;
	config: NumberPickerConfig<ModObject>;
}

const formatSourceValue = (value: number, float: boolean, showZeroes: boolean, maxDecimalDigits: number): string => {
	if (value === 0 && !showZeroes) return '';
	if (float) return formatToNumber(value, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: maxDecimalDigits });
	return String(value);
};

const applyPositive = (text: string, float: boolean, maxDecimalDigits: number): string => {
	if (float) return formatToNumber(Math.abs(Number(text)), { minimumFractionDigits: 2, maximumFractionDigits: maxDecimalDigits });
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

export const NumberPicker = <ModObject,>({ modObject, config }: NumberPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const inputRef = useRef<HTMLInputElement>(null);

	const float = config.float ?? false;
	const positive = config.positive ?? false;
	const showZeroes = config.showZeroes ?? true;
	const maxDecimalDigits = config.maxDecimalDigits ?? 2;

	const display = formatSourceValue(value, float, showZeroes, maxDecimalDigits);

	useLayoutEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		input.value = display;
	}, [display, revision]);

	useLayoutEffect(() => {
		updateSize(inputRef.current);
	}, []);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		const onChange = () => {
			if (positive) input.value = applyPositive(input.value, float, maxDecimalDigits);
			setValue(parseValue(input.value, float));
		};
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	}, [positive, float, maxDecimalDigits, setValue]);

	return (
		<PickerShell config={config} cssClass="number-picker-root" hidden={hidden} disabled={disabled}>
			<Field.Control
				render={<input type="text" />}
				ref={inputRef}
				id={config.id}
				className="form-control number-picker-input"
				disabled={disabled}
				onInput={() => updateSize(inputRef.current)}
			/>
		</PickerShell>
	);
};
