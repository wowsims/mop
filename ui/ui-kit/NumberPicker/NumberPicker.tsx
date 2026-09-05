import { formatToNumber } from '@domain/format';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { useInput } from '@ui-kit/react/input';
import { PickerShell } from '@ui-kit/react/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface NumberPickerProps<ModObject> {
	modObject: ModObject;
	config: NumberPickerConfig<ModObject>;
}

// The vanilla setInputValue: the format the field is given whenever it is synced from the source.
const formatSourceValue = (value: number, float: boolean, showZeroes: boolean, maxDecimalDigits: number): string => {
	if (value === 0 && !showZeroes) return '';
	if (float) return formatToNumber(value, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: maxDecimalDigits });
	return String(value);
};

// The vanilla `positive` change handler, which rewrites the field in place before the value is read
// back. It groups (formatToNumber's default) where formatSourceValue does not, and its integer
// branch turns an empty field into the literal "NaN". Both are odd; both are reproduced.
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

/**
 * The field is uncontrolled and synced imperatively, which is not the usual React shape but is what
 * faithfulness costs here: the vanilla picker commits on the native `change` event — blur *after an
 * edit*, and Enter — while React's onChange is the input event, which fires per keystroke. A
 * controlled value would also add a `value` attribute the vanilla DOM does not have, and would tie
 * the `size` attribute to every render rather than to typing.
 */
export const NumberPicker = <ModObject,>({ modObject, config }: NumberPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const inputRef = useRef<HTMLInputElement>(null);

	const float = config.float ?? false;
	const positive = config.positive ?? false;
	const showZeroes = config.showZeroes ?? true;
	const maxDecimalDigits = config.maxDecimalDigits ?? 2;

	const display = formatSourceValue(value, float, showZeroes, maxDecimalDigits);

	// init() sets the value and the size; refresh() only sets the value, so a source change leaves
	// the size where typing last put it.
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
			<input
				ref={inputRef}
				type="text"
				id={config.id}
				className="form-control number-picker-input"
				disabled={disabled}
				onInput={() => updateSize(inputRef.current)}
			/>
		</PickerShell>
	);
};
