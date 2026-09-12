import { Input } from '@base-ui/react/input';
import { useCommitChange } from '@ui-kit/hooks/useCommitChange';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { StringPickerConfig } from './types';

export interface AdaptiveStringPickerProps<ModObject> {
	modObject: ModObject;
	config: StringPickerConfig<ModObject>;
}

const updateSize = (input: HTMLInputElement | null) => {
	if (!input) return;
	const size = Math.max(3, input.value.length);
	if (input.size !== size) input.size = size;
};

export const AdaptiveStringPicker = <ModObject,>({ modObject, config }: AdaptiveStringPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const [input, setInput] = useState<HTMLInputElement | null>(null);
	const attachInput = useCallback((element: HTMLElement | null) => setInput(element instanceof HTMLInputElement ? element : null), []);

	useLayoutEffect(() => {
		if (!input) return;
		input.value = value;
		updateSize(input);
	}, [value, revision, input]);

	useCommitChange(input, committed => setValue(committed.value));

	return (
		<PickerShell config={config} className="adaptive-string-picker-root" hidden={hidden} disabled={disabled}>
			<Input type="text" ref={attachInput} id={config.id} className="form-control" disabled={disabled} onInput={() => updateSize(input)} />
		</PickerShell>
	);
};
