/**
 * The React list's own drag state, deliberately **not** shared with the vanilla
 * `pickers/list_picker.tsx` module global (`curDragData`).
 *
 * Two stacks can hold a drag at once only if a user could start two drags at once, which they
 * cannot. So each stack reads only its own slot, and a drag begun in the other stack reads as
 * `null` here: every drop test then fails, no handler calls `preventDefault`, and the browser
 * shows the no-drop cursor. That is the same answer the vanilla list gives for a foreign drag,
 * and it holds by construction rather than by the two agreeing on a shared shape.
 *
 * What crosses a list boundary is **data, not a component**: `take()` is a closure the source
 * list supplies, so a cross-list drop removes from the source through the source's own writer
 * instead of reaching into its config the way vanilla's `curDragData.listPicker.config` did.
 */
export interface ListDrag {
	/** Identity of the list the drag started in. */
	listId: string;
	/** Only a list with the same label accepts the drop — vanilla's first `invalidDropTarget` rule. */
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
 * Ends the drag and tells whoever is still painting drag feedback to stop. Vanilla did this by
 * stripping `.dragfrom,.dragto` off the whole document; here only the one or two items that
 * actually hold that state are listening, so nothing walks the DOM and nothing can strip a class
 * out from under React's own diff.
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
