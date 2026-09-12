import { Field } from '@base-ui/react/field';
import { adoptNode, isNode } from '../utils/dom';
import type { InputConfig } from '@ui-kit/input';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, type Ref, useMemo } from 'react';

const dedupe = (classes: string) => Array.from(new Set(classes.split(' '))).join(' ');

export interface PickerShellProps<ModObject, T, V> {
	config: InputConfig<ModObject, T, V> & { id: string };
	className: string;
	hidden: boolean;
	disabled: boolean;
	leading?: ReactNode;
	children?: ReactNode;
	ref?: Ref<HTMLDivElement>;
}

export const PickerShell = <ModObject, T, V>({ config, className, hidden, disabled, leading, children, ref }: PickerShellProps<ModObject, T, V>) => {
	const tooltip = config.labelTooltip;
	if (tooltip !== undefined && typeof tooltip !== 'string' && !isNode(tooltip)) {
		console.warn(`${className} ${config.id}: labelTooltip is neither a string nor a node, so it is not rendered.`, tooltip);
	}
	const tooltipId = typeof tooltip === 'string' || isNode(tooltip) ? `${config.id}-tooltip` : undefined;
	const tooltipNode = useMemo(
		() => (tooltipId ? <Tooltip id={tooltipId} content={isNode(tooltip) ? <span ref={adoptNode(tooltip)} /> : (tooltip as string)} /> : null),
		[tooltipId, tooltip],
	);

	if (hidden) return null;

	return (
		<Field.Root
			ref={ref}
			disabled={disabled}
			className={dedupe(clsx('input-root', className, config.inline && 'input-inline', config.extraClassNames, disabled && 'disabled'))}>
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
