import type { InputConfig } from '@ui-kit/input';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useMemo } from 'react';

import { adoptNode, isNode } from './dom';

export interface PickerShellProps<ModObject, T, V> {
	config: InputConfig<ModObject, T, V> & { id: string };
	/** The picker's own class, e.g. `number-picker-root`. */
	cssClass: string;
	hidden: boolean;
	disabled: boolean;
	/** Rendered before the label — the checkbox position, which vanilla gets by prepending. */
	leading?: ReactNode;
	children?: ReactNode;
}

/**
 * The root, label and description the vanilla `Input` constructor builds, in its order: label, then
 * description, then whatever the subclass appends. Class order matches too, `disabled`/`hide` last,
 * since vanilla toggles those after construction.
 */
export function PickerShell<ModObject, T, V>({ config, cssClass, hidden, disabled, leading, children }: PickerShellProps<ModObject, T, V>) {
	const tooltip = config.labelTooltip;
	// tippy also accepts a function; nothing in the tree passes one, and dropping content silently is
	// how a tooltip goes missing with nothing to notice it.
	if (tooltip !== undefined && typeof tooltip !== 'string' && !isNode(tooltip)) {
		console.warn(`${cssClass} ${config.id}: labelTooltip is neither a string nor a node, so it is not rendered.`, tooltip);
	}
	const tooltipId = typeof tooltip === 'string' || isNode(tooltip) ? `${config.id}-tooltip` : undefined;
	// Held across re-renders: a picker re-renders on every notification from its own source, and
	// re-mounting the tooltip would re-attach its anchor listeners each time.
	const tooltipNode = useMemo(
		() => (tooltipId ? <Tooltip id={tooltipId} content={isNode(tooltip) ? <span ref={adoptNode(tooltip)} /> : (tooltip as string)} /> : null),
		[tooltipId, tooltip],
	);

	return (
		<div className={clsx('input-root', cssClass, config.inline && 'input-inline', config.extraCssClasses, disabled && 'disabled', hidden && 'hide')}>
			{leading}
			{config.label && (
				<label htmlFor={config.id} className="form-label" title={config.label} data-tooltip-id={tooltipId}>
					{config.label}
				</label>
			)}
			{tooltipNode}
			{config.description &&
				(isNode(config.description) ? (
					<div className="input-description" ref={adoptNode(config.description)} />
				) : (
					<div className="input-description">{config.description}</div>
				))}
			{children}
		</div>
	);
}
