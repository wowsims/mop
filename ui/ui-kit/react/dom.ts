/**
 * Puts an existing DOM node inside a React-rendered element. `InputConfig`'s `description` and
 * `labelTooltip` are `string | Element`, and the Element form is real — reforge_panel.tsx:527 passes
 * one — so a React picker has to render it rather than stringify it.
 */
export const adoptNode = (node: Node) => (host: HTMLElement | null) => {
	host?.replaceChildren(node);
};

export const isNode = (value: unknown): value is Node => typeof Node !== 'undefined' && value instanceof Node;
