import { Field } from '@base-ui/react/field';
import { adoptNode, isNode } from '@ui-kit/dom_utils';
import type { InputConfig } from '@ui-kit/input';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, type Ref, useMemo } from 'react';

const dedupe = (classes: string) => Array.from(new Set(classes.split(' '))).join(' ');

export interface PickerShellProps<ModObject, T, V> {
	config: InputConfig<ModObject, T, V> & { id: string };
	cssClass: string;
	hidden: boolean;
	disabled: boolean;
	leading?: ReactNode;
	children?: ReactNode;
	ref?: Ref<HTMLDivElement>;
}

export const PickerShell = <ModObject, T, V>({ config, cssClass, hidden, disabled, leading, children, ref }: PickerShellProps<ModObject, T, V>) => {
	const tooltip = config.labelTooltip;
	if (tooltip !== undefined && typeof tooltip !== 'string' && !isNode(tooltip)) {
		console.warn(`${cssClass} ${config.id}: labelTooltip is neither a string nor a node, so it is not rendered.`, tooltip);
	}
	const tooltipId = typeof tooltip === 'string' || isNode(tooltip) ? `${config.id}-tooltip` : undefined;
	const tooltipNode = useMemo(
		() => (tooltipId ? <Tooltip id={tooltipId} content={isNode(tooltip) ? <span ref={adoptNode(tooltip)} /> : (tooltip as string)} /> : null),
		[tooltipId, tooltip],
	);

	return (
		<Field.Root
			ref={ref}
			disabled={disabled}
			className={dedupe(clsx('input-root', cssClass, config.inline && 'input-inline', config.extraCssClasses, disabled && 'disabled', hidden && 'hide'))}>
			{leading}
			{config.label && (
				// `htmlFor` explicitly rather than letting Field derive it.
				<Field.Label htmlFor={config.id} className="form-label" title={config.label} {...tooltipAnchorProps(tooltipId)}>
					{config.label}
				</Field.Label>
			)}
			{tooltipNode}
			{config.description &&
				(isNode(config.description) ? (
					<Field.Description render={<div />} className="input-description" ref={adoptNode(config.description)} />
				) : (
					<Field.Description render={<div />} className="input-description">
						{config.description}
					</Field.Description>
				))}
			{children}
		</Field.Root>
	);
};
