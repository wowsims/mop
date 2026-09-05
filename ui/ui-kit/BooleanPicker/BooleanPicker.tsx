import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { adoptNode, isNode } from '@ui-kit/react/dom';
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
	const tooltip = config.labelTooltip;
	// tippy also accepts a function; nothing in the tree passes one, and silently dropping content
	// is how a tooltip goes missing without anything failing.
	if (tooltip !== undefined && typeof tooltip !== 'string' && !isNode(tooltip)) {
		console.warn(`BooleanPicker ${config.id}: labelTooltip is neither a string nor a node, so it is not rendered.`, tooltip);
	}
	const tooltipId = typeof tooltip === 'string' || isNode(tooltip) ? `${config.id}-tooltip` : undefined;

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
			{tooltipId && <Tooltip id={tooltipId} content={isNode(tooltip) ? <span ref={adoptNode(tooltip)} /> : (tooltip as string)} />}
			{config.description &&
				(isNode(config.description) ? (
					<div className="input-description" ref={adoptNode(config.description)} />
				) : (
					<div className="input-description">{config.description}</div>
				))}
			{config.reverse && input}
		</div>
	);
}
