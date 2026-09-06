import { Field } from '@base-ui/react/field';
import { useInput } from '@ui-kit/hooks/useInput';
import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface EnumPickerProps<ModObject> {
	modObject: ModObject;
	config: EnumPickerConfig<ModObject>;
}

export const EnumPicker = <ModObject,>({ modObject, config }: EnumPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const selectRef = useRef<HTMLSelectElement>(null);

	// Deliberately not keyed on config.values: config is usually an object literal in the parent's render, so that would re-assign select.value on every render — which closes the dropdown if the user has it open.
	useLayoutEffect(() => {
		const select = selectRef.current;
		if (!select) return;
		select.value = String(value);
	}, [value, revision]);

	useEffect(() => {
		const select = selectRef.current;
		if (!select) return;
		const onChange = () => setValue(Number(select.value));
		select.addEventListener('change', onChange);
		return () => select.removeEventListener('change', onChange);
	}, [setValue]);

	return (
		<PickerShell config={config} cssClass="enum-picker-root" hidden={hidden} disabled={disabled}>
			<Field.Control render={<select />} ref={selectRef} id={config.id} className="enum-picker-selector form-select" disabled={disabled}>
				{config.values.map(entry => (
					<option key={entry.value} value={String(entry.value)} title={entry.tooltip}>
						{entry.name}
					</option>
				))}
			</Field.Control>
		</PickerShell>
	);
};
