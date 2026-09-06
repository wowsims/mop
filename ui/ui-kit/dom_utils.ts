// DOM helpers lifted out of ui/domain/utils.ts: they read `document` or the
// page location directly, which ui/domain is not allowed to do.
import { environmentOf, Environments } from '@domain/env';

export const existsInDOM = (element: HTMLElement | null) => document.body.contains(element);

// Nearest ancestor the user can scroll vertically, or null when the page itself is it. An
// overflow-y: hidden box is skipped: it clips but never scrolls, and the log's sideways scroller
// is one, sitting between the rows and the pane that really moves them.
export const findScrollParent = (elem: HTMLElement): HTMLElement | null => {
	for (let node = elem.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
		const overflowY = getComputedStyle(node).overflowY;
		if (overflowY === 'auto' || overflowY === 'scroll') return node;
	}
	return null;
};

export const downloadString = (data: string, fileName: string, mimeType = 'text/json') => {
	const dataStr = `data:${mimeType};charset=utf-8,` + encodeURIComponent(data);
	const downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute('href', dataStr);
	downloadAnchorNode.setAttribute('download', fileName);
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
};

const hostname = window.location.hostname;
export const getEnvironment = (): Environments => environmentOf(hostname);

export const isNative = () => getEnvironment() === 'local';
export const isExternal = () => getEnvironment() === 'external';

/** Puts an existing DOM node inside a React-rendered element. */
export const adoptNode = (node: Node) => (host: HTMLElement | null) => {
	host?.replaceChildren(node);
};

export const isNode = (value: unknown): value is Node => typeof Node !== 'undefined' && value instanceof Node;
