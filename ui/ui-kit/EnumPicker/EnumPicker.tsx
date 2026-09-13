import { Field } from '@base-ui/react/field';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { AnyEnumPickerConfig } from './types';

export interface EnumPickerProps<ModObject> {
	modObject: ModObject;
	config: AnyEnumPickerConfig<ModObject>;
	/** For a select with no visible label. `config.label` renders one; this names it without adding markup. */
	ariaLabel?: string;
}

export const EnumPicker = <ModObject,>({ modObject, config, ariaLabel }: EnumPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const [select, setSelect] = useState<HTMLSelectElement | null>(null);
	const attachSelect = useCallback((element: HTMLElement | null) => setSelect(element instanceof HTMLSelectElement ? element : null), []);

	// Deliberately not keyed on config.values: config is usually an object literal in the parent's render, so that would re-assign select.value on every render — which closes the dropdown if the user has it open.
	useLayoutEffect(() => {
		if (!select) return;
		select.value = String(value);
	}, [value, revision, select]);

	return (
		<PickerShell config={config} className="enum-picker-root" hidden={hidden} disabled={disabled}>
			<Field.Control
				render={<select />}
				ref={attachSelect}
				id={config.id}
				className="enum-picker-selector form-select"
				aria-label={ariaLabel}
				disabled={disabled}
				onChange={event => setValue(Number(event.currentTarget.value))}>
				{config.values.map(entry => (
					<option key={entry.value} value={String(entry.value)} title={entry.tooltip}>
						{entry.name}
					</option>
				))}
			</Field.Control>
		</PickerShell>
	);
};
