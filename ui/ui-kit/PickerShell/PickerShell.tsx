import { Field } from '@base-ui/react/field';
import { adoptNode, isNode } from '@ui-kit/dom_utils';
import type { InputConfig } from '@ui-kit/input';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, type Ref, useMemo } from 'react';

// `classList.add` drops a repeat; clsx does not, and two live configs pass `input-inline` in
// `extraCssClasses` as well as setting `inline` (`other_inputs.ts`, and `rotation_tab.tsx`, which
// pushes it into the config in place on every rebuild).
const dedupe = (classes: string) => Array.from(new Set(classes.split(' '))).join(' ');

export interface PickerShellProps<ModObject, T, V> {
	config: InputConfig<ModObject, T, V> & { id: string };
	/** The picker's own class, e.g. `number-picker-root`. */
	cssClass: string;
	hidden: boolean;
	disabled: boolean;
	/** Rendered before the label — the checkbox position, which vanilla gets by prepending. */
	leading?: ReactNode;
	children?: ReactNode;
	/**
	 * The root element. A picker whose vanilla constructor appended a still-vanilla component to its
	 * own root — `TalentsPicker` and its `GlyphsPicker` — mounts it here through `useLegacyMount`,
	 * which appends after the React children and so keeps the order vanilla built.
	 */
	ref?: Ref<HTMLDivElement>;
}

/**
 * The root, label and description the vanilla `Input` constructor builds, in its order: label, then
 * description, then whatever the subclass appends. Class order matches too, `disabled`/`hide` last,
 * since vanilla toggles those after construction.
 */
export const PickerShell = <ModObject, T, V>({ config, cssClass, hidden, disabled, leading, children, ref }: PickerShellProps<ModObject, T, V>) => {
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
		<Field.Root
			ref={ref}
			disabled={disabled}
			className={dedupe(clsx('input-root', cssClass, config.inline && 'input-inline', config.extraCssClasses, disabled && 'disabled', hidden && 'hide'))}>
			{leading}
			{config.label && (
				// `htmlFor` explicitly rather than letting Field derive it. Field points a label at the
				// `Field.Control` it finds, and generates an id when there is none — IconPicker renders
				// anchors, not a control, so its label would have pointed at an element that does not
				// exist. `config.id` is the value vanilla uses either way.
				<Field.Label htmlFor={config.id} className="form-label" title={config.label} data-tooltip-id={tooltipId}>
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
