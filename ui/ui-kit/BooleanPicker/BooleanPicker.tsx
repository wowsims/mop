import { Input } from '@base-ui/react/input';
import { useInput } from '@ui-kit/hooks/useInput';
import { PickerShell } from '@ui-kit/PickerShell';

import type { BooleanPickerConfig } from './types';

export interface BooleanPickerProps<ModObject> {
	modObject: ModObject;
	config: BooleanPickerConfig<ModObject>;
}

export const BooleanPicker = <ModObject,>({ modObject, config }: BooleanPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled } = useInput(modObject, config);

	const input = (
		<Input
			type="checkbox"
			id={config.id}
			className="boolean-picker-input form-check-input"
			checked={value}
			disabled={disabled}
			onChange={event => setValue((event.target as HTMLInputElement).checked)}
		/>
	);

	return (
		<PickerShell
			config={config}
			className={config.reverse ? 'boolean-picker-root form-check form-check-reverse' : 'boolean-picker-root form-check'}
			hidden={hidden}
			disabled={disabled}
			leading={config.reverse ? undefined : input}>
			{config.reverse ? input : undefined}
		</PickerShell>
	);
};
