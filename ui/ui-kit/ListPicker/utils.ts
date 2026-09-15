import { kebabCase } from '@sim/utils/format';

import type { ListItemActionName } from './types';

/** The per-item class taken from the item's label. */
export const listItemClassName = (itemLabel: string): string => kebabCase(itemLabel);

export const actionEnabled = (allowedActions: Array<ListItemActionName> | undefined, action: ListItemActionName): boolean =>
	!allowedActions || allowedActions.includes(action);

/** A drag must not start on a control the user is editing. */
export const isInteractiveTarget = (target: HTMLElement, container: HTMLElement): boolean => {
	const interactiveTags = new Set(['INPUT', 'TEXTAREA']);
	let el: HTMLElement | null = target;
	while (el && el !== container) {
		if (interactiveTags.has(el.tagName)) return true;
		if (el.getAttribute('contenteditable') === 'true') return true;
		el = el.parentElement;
	}
	return false;
};

/** The delete button is absent, not disabled, for the first `minimumItems` rows. */
export const canDeleteAt = (index: number, minimumItems: number | undefined): boolean => !minimumItems || index + 1 > minimumItems;

/** Dropping below a row's midpoint inserts after it, above it inserts before it. */
export const dropIndex = (targetIndex: number, clientY: number, rect: { top: number; height: number }): number =>
	clientY > rect.top + rect.height / 2 ? targetIndex + 1 : targetIndex;

/** Moves `from` to `to` in a copy of `list`, with `to` read against the pre-removal positions. */
export const moveItem = <T>(list: Array<T>, from: number, to: number): Array<T> => {
	const next = list.slice();
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
};
