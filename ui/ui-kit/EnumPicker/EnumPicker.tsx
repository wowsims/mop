import { Select } from '@ui-kit/FormControl';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';
import clsx from 'clsx';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { AnyEnumPickerConfig } from './types';

export interface EnumPickerProps<ModObject> {
	modObject: ModObject;
	config: AnyEnumPickerConfig<ModObject>;
	/** For a select with no visible label. `config.label` renders one; this names it without adding markup. */
	ariaLabel?: string;
	selectClassName?: string;
	testId?: string;
}

export const EnumPicker = <ModObject,>({ modObject, config, ariaLabel, selectClassName, testId }: EnumPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled, revision } = useInput(modObject, config);
	const [select, setSelect] = useState<HTMLSelectElement | null>(null);
	const attachSelect = useCallback((element: HTMLElement | null) => setSelect(element instanceof HTMLSelectElement ? element : null), []);

	// Deliberately not keyed on config.values: config is usually an object literal in the parent's render, so that would re-assign select.value on every render — which closes the dropdown if the user has it open.
	useLayoutEffect(() => {
		if (!select) return;
		select.value = String(value);
	}, [value, revision, select]);

	return (
		<PickerShell config={config} hidden={hidden} disabled={disabled} testId={testId ?? 'enum-picker-root'}>
			<Select
				ref={attachSelect}
				id={config.id}
				className={clsx('w-auto max-w-full', selectClassName)}
				data-testid="enum-picker-selector"
				aria-label={ariaLabel}
				disabled={disabled}
				onChange={event => setValue(Number(event.currentTarget.value))}>
				{config.values.map(entry => (
					<option key={entry.value} value={String(entry.value)} title={entry.tooltip}>
						{entry.name}
					</option>
				))}
			</Select>
		</PickerShell>
	);
};
