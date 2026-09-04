// DOM helpers lifted out of ui/domain/utils.ts: they read `document` or the
// page location directly, which ui/domain is not allowed to do.
import { environmentOf, Environments } from '@domain/env';

export const existsInDOM = (element: HTMLElement | null) => document.body.contains(element);

export const fragmentToString = (element: Node | Element) => {
	const div = document.createElement('div');
	div.appendChild(element.cloneNode(true));
	return div.innerHTML;
};
export function downloadString(data: string, fileName: string) {
	const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
	const downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute('href', dataStr);
	downloadAnchorNode.setAttribute('download', fileName);
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

const hostname = window.location.hostname;
export const getEnvironment = (): Environments => environmentOf(hostname);

export const isNative = () => getEnvironment() === 'local';
export const isExternal = () => getEnvironment() === 'external';
