import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { useInput } from '@ui-kit/react/input';
import { PickerShell } from '@ui-kit/react/PickerShell';

export interface BooleanPickerProps<ModObject> {
	modObject: ModObject;
	config: BooleanPickerConfig<ModObject>;
}

export const BooleanPicker = <ModObject,>({ modObject, config }: BooleanPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled } = useInput(modObject, config);

	const input = (
		<input
			type="checkbox"
			id={config.id}
			className="boolean-picker-input form-check-input"
			checked={value}
			disabled={disabled}
			onChange={event => setValue(event.target.checked)}
		/>
	);

	return (
		<PickerShell
			config={config}
			cssClass={config.reverse ? 'boolean-picker-root form-check form-check-reverse' : 'boolean-picker-root form-check'}
			hidden={hidden}
			disabled={disabled}
			leading={config.reverse ? undefined : input}>
			{config.reverse ? input : undefined}
		</PickerShell>
	);
};
