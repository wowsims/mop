import { Checkbox } from '@base-ui/react/checkbox';
import { useInput } from '@ui-kit/hooks/useInput';
import { Icon } from '@ui-kit/Icon';
import { PickerShell } from '@ui-kit/PickerShell';

import type { AnyBooleanPickerConfig } from './types';

export interface BooleanPickerProps<ModObject> {
	modObject: ModObject;
	config: AnyBooleanPickerConfig<ModObject>;
}

export const BooleanPicker = <ModObject,>({ modObject, config }: BooleanPickerProps<ModObject>) => {
	const { value, setValue, hidden, disabled } = useInput(modObject, config);

	const input = (
		<Checkbox.Root
			id={config.id}
			className="ui-boolean-picker-input inline-flex items-center justify-center p-0"
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
			className={config.reverse ? 'ui-boolean-picker ui-boolean-picker-reverse' : 'ui-boolean-picker'}
			testId="boolean-picker-root"
			hidden={hidden}
			disabled={disabled}
			leading={config.reverse ? undefined : input}>
			{config.reverse ? input : undefined}
		</PickerShell>
	);
};
