import { delegate, followCursor, Instance, Props } from 'tippy.js';

export const TOOLTIP_TARGET_ATTR = 'data-timeline-tooltip';
export const tooltipBuilders = new WeakMap<Element, () => Element>();

// Marks an element as a tooltip target for the delegate on its row.
export function addTooltip(reference: Element, buildContent: () => Element) {
	reference.setAttribute(TOOLTIP_TARGET_ATTR, '');
	tooltipBuilders.set(reference, buildContent);
}

export function delegateTooltips(container: Element): Instance {
	const built = new WeakSet<Element>();
	return delegate(container, {
		target: `[${TOOLTIP_TARGET_ATTR}]`,
		placement: 'bottom',
		content: '',
		plugins: [followCursor],
		followCursor: 'horizontal',
		popperOptions: {
			modifiers: [
				{ name: 'flip', options: { padding: 8 } },
				{ name: 'preventOverflow', options: { padding: 8, altAxis: true, tether: false } },
			],
		},
		onShow(instance) {
			const reference = instance.reference;
			const buildContent = tooltipBuilders.get(reference);
			if (!buildContent) return false;
			if (!built.has(reference)) {
				built.add(reference);
				instance.setContent(buildContent());
			}
			return undefined;
		},
	} as Partial<Props> & { target: string });
}
