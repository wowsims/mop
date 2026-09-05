import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { useInput } from '@ui-kit/react/input';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';

export interface BooleanPickerProps<ModObject> {
	modObject: ModObject;
	config: BooleanPickerConfig<ModObject>;
}

export function BooleanPicker<ModObject>({ modObject, config }: BooleanPickerProps<ModObject>) {
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
	const tooltipId = typeof config.labelTooltip === 'string' ? `${config.id}-tooltip` : undefined;

	return (
		<div
			className={clsx(
				'input-root',
				'boolean-picker-root',
				'form-check',
				config.inline && 'input-inline',
				config.reverse && 'form-check-reverse',
				disabled && 'disabled',
				hidden && 'hide',
				config.extraCssClasses,
			)}>
			{!config.reverse && input}
			{config.label && (
				<label htmlFor={config.id} className="form-label" title={config.label} data-tooltip-id={tooltipId}>
					{config.label}
				</label>
			)}
			{tooltipId && <Tooltip id={tooltipId} content={config.labelTooltip as string} />}
			{config.description && <div className="input-description">{config.description as string}</div>}
			{config.reverse && input}
		</div>
	);
}
