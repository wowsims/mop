import type { StringPickerConfig } from '@ui-kit/pickers/string_picker';
import { useInput } from '@ui-kit/react/input';
import { PickerShell } from '@ui-kit/react/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface AdaptiveStringPickerProps<ModObject> {
	modObject: ModObject;
	config: StringPickerConfig<ModObject>;
}

const updateSize = (input: HTMLInputElement | null) => {
	if (!input) return;
	const size = Math.max(3, input.value.length);
	if (input.size !== size) input.size = size;
};

/**
 * The field is uncontrolled and synced imperatively, exactly as NumberPicker is: the vanilla picker
 * commits on the native `change` event, not React's per-keystroke `onChange`.
 *
 * Unlike NumberPicker, the vanilla `setInputValue` here also calls `updateSize`, so a source-driven
 * change moves the `size` attribute too — not just typing.
 */
export const AdaptiveStringPicker = <ModObject,>({ modObject, config }: AdaptiveStringPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const inputRef = useRef<HTMLInputElement>(null);

	useLayoutEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		input.value = value;
		updateSize(input);
	}, [value, revision]);

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		const onChange = () => {
			setValue(input.value);
		};
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	}, [setValue]);

	return (
		<PickerShell config={config} cssClass="adaptive-string-picker-root" hidden={hidden} disabled={disabled}>
			<input ref={inputRef} type="text" id={config.id} className="form-control" disabled={disabled} onInput={() => updateSize(inputRef.current)} />
		</PickerShell>
	);
};
