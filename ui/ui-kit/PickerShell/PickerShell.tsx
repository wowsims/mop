import { Field } from '@base-ui/react/field';
import type { AnyInputConfig } from '@ui-kit/input';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { isValidElement, type ReactNode, type Ref, useMemo } from 'react';

import { adoptNode, isNode } from '../utils/dom';

const dedupe = (classes: string) => Array.from(new Set(classes.split(' '))).join(' ');

export interface PickerShellProps<ModObject, T, V> {
	config: AnyInputConfig<ModObject, T, V> & { id: string };
	className?: string;
	hidden: boolean;
	disabled: boolean;
	leading?: ReactNode;
	children?: ReactNode;
	ref?: Ref<HTMLDivElement>;
	testId?: string;
	inline?: boolean;
	iconField?: boolean;
}

export const PickerShell = <ModObject, T, V>({
	config,
	className,
	hidden,
	disabled,
	leading,
	children,
	ref,
	testId,
	inline: inlineProp,
	iconField: iconFieldProp,
}: PickerShellProps<ModObject, T, V>) => {
	const tooltip = config.labelTooltip;
	const renderable = typeof tooltip === 'string' || isNode(tooltip) || isValidElement(tooltip);
	if (tooltip !== undefined && !renderable) {
		console.warn(`${className} ${config.id}: labelTooltip is neither a string, a node nor an element, so it is not rendered.`, tooltip);
	}
	const tooltipId = renderable ? `${config.id}-tooltip` : undefined;
	const tooltipNode = useMemo(
		() => (tooltipId ? <Tooltip id={tooltipId} content={isNode(tooltip) ? <span ref={adoptNode(tooltip)} /> : (tooltip as ReactNode)} /> : null),
		[tooltipId, tooltip],
	);

	if (hidden) return null;

	const inline = inlineProp || config.inline;
	const iconField = iconFieldProp ?? !!className?.includes('ui-icon-field');

	return (
		<Field.Root
			ref={ref}
			disabled={disabled}
			data-disabled={disabled ? '' : undefined}
			data-layout={inline ? 'inline' : undefined}
			data-testid={testId ?? 'input-root'}
			data-input-root=""
			className={dedupe(
				clsx(
					config.description && 'flex-wrap',
					'ui-field',
					!inline && !iconField && 'max-md:flex-col max-md:items-start',
					className,
					config.extraClassNames,
				),
			)}>
			{leading}
			{config.label && (
				// `htmlFor` explicitly rather than letting Field derive it.
				<Field.Label htmlFor={config.id} className="ui-picker-label" title={config.label} data-testid="form-label" {...tooltipAnchorProps(tooltipId)}>
					{config.label}
				</Field.Label>
			)}
			{tooltipNode}
			{config.description &&
				(isNode(config.description) ? (
					<Field.Description render={<div />} className="ui-field-description" data-testid="input-description" ref={adoptNode(config.description)} />
				) : (
					<Field.Description render={<div />} className="ui-field-description" data-testid="input-description">
						{config.description}
					</Field.Description>
				))}
			{children}
		</Field.Root>
	);
};
