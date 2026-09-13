import { Checkbox } from '@base-ui/react/checkbox';
import { Icon } from '@ui-kit/Icon';
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
		<Checkbox.Root
			id={config.id}
			className="boolean-picker-input form-check-input inline-flex items-center justify-center p-0"
			data-testid="boolean-picker-input"
			checked={value}
			disabled={disabled}
			onCheckedChange={checked => setValue(checked)}>
			<Checkbox.Indicator>
				<Icon name="check" className="text-primary-foreground" />
			</Checkbox.Indicator>
		</Checkbox.Root>
	);

	return (
		<PickerShell
			config={config}
			className={config.reverse ? 'boolean-picker-root form-check form-check-reverse' : 'boolean-picker-root form-check'}
			testId="boolean-picker-root"
			hidden={hidden}
			disabled={disabled}
			leading={config.reverse ? undefined : input}>
			{config.reverse ? input : undefined}
		</PickerShell>
	);
};
