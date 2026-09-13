/**
 * The list's drag state: which item is being dragged, and how to take it out of its own list.
 *
 * What crosses a list boundary is **data, not a component**: `take()` is a closure the source
 * list supplies, so a cross-list drop removes from the source through the source's own writer
 * rather than reaching into another list's config.
 */
export interface ListDrag {
	/** Identity of the list the drag started in. */
	listId: string;
	/** Only a list with the same label accepts the drop. */
	itemLabel: string;
	dragGroup?: string;
	/** The dragged item's index in its source list. */
	index: number;
	/** The dragged item's container element, for the "cannot drop inside myself" test. */
	elem: HTMLElement;
	/** Removes the item from its source list and hands it back. Only called for a cross-list drop. */
	take: () => unknown;
}

let current: ListDrag | null = null;
const endListeners = new Set<() => void>();

export const getDrag = (): ListDrag | null => current;

export const beginDrag = (drag: ListDrag) => {
	current = drag;
};

/**
 * Ends the drag and tells whoever is still painting drag feedback to stop. Only the one or two
 * items that actually hold that state are listening, so nothing walks the DOM stripping classes out
 * from under React's own diff.
 */
export const endDrag = () => {
	current = null;
	for (const listener of [...endListeners]) listener();
};

export const subscribeDragEnd = (listener: () => void) => {
	endListeners.add(listener);
	return () => {
		endListeners.delete(listener);
	};
};
