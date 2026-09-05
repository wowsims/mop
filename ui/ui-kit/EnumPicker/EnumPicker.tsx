import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';
import { useInput } from '@ui-kit/react/input';
import { PickerShell } from '@ui-kit/react/picker_shell';
import { useEffect, useLayoutEffect, useRef } from 'react';

export interface EnumPickerProps<ModObject> {
	modObject: ModObject;
	config: EnumPickerConfig<ModObject>;
}

/**
 * Synced imperatively for the same reason as NumberPicker: assigning `select.value` leaves a value
 * that is not in the option list unselected (`selectedIndex === -1`), which is what the vanilla
 * picker does, whereas a React-controlled select owns that case differently.
 */
export const EnumPicker = <ModObject,>({ modObject, config }: EnumPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const selectRef = useRef<HTMLSelectElement>(null);

	// Deliberately not keyed on config.values: config is usually an object literal in the parent's
	// render, so that would re-assign select.value on every render — which closes the dropdown if the
	// user has it open. Vanilla re-assigns on notification only, which is what `revision` is.
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
			<select ref={selectRef} id={config.id} className="enum-picker-selector form-select" disabled={disabled}>
				{config.values.map(entry => (
					<option key={entry.value} value={String(entry.value)} title={entry.tooltip}>
						{entry.name}
					</option>
				))}
			</select>
		</PickerShell>
	);
};
