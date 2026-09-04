import { v4 as uuidv4 } from 'uuid';

export const randomUUID = () => uuidv4();

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export function hashString(value: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0xcbf29ce4;
	for (let i = 0; i < value.length; i++) {
		const charCode = value.charCodeAt(i);
		h1 = Math.imul(h1 ^ charCode, 0x01000193) >>> 0;
		h2 = (Math.imul(h2, 33) ^ charCode) >>> 0;
	}
	return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
// Allows replacement of stringified objects based on the key and path.
// If handler returns a string, that string is used. Otherwise, the normal JSON.stringify result is returned.
export function jsonStringifyCustom(value: any, indent: number, handler: (value: any, path: Array<string>) => string | undefined | void): string {
	const indentStr = ' '.repeat(indent);
	return jsonStringifyCustomHelper(value, indentStr, [], handler);
}
function jsonStringifyCustomHelper(
	value: any,
	indentStr: string,
	path: Array<string>,
	handler: (value: any, path: Array<string>) => string | undefined | void,
): string {
	const handlerResult = handler(value, path);
	if (handlerResult != null) {
		return handlerResult;
	}

	if (!(value instanceof Object)) {
		return JSON.stringify(value);
	} else if (value instanceof Array) {
		let str = '[\n';
		const lines = value.map(
			(e, i) =>
				`${indentStr.repeat(path.length + 1)}${jsonStringifyCustomHelper(e, indentStr, path.slice().concat([i + '']), handler)}${
					i == value.length - 1 ? '' : ','
				}\n`,
		);
		str += lines.join('');
		str += indentStr.repeat(path.length) + ']';
		return str;
	} else {
		// Object
		let str = '{\n';
		const len = Object.keys(value).length;
		const lines = Object.entries(value).map(
			([fieldKey, fieldValue], i) =>
				`${indentStr.repeat(path.length + 1)}"${fieldKey}": ${jsonStringifyCustomHelper(
					fieldValue,
					indentStr,
					path.slice().concat([fieldKey]),
					handler,
				)}${i == len - 1 ? '' : ','}\n`,
		);
		str += lines.join('');
		str += indentStr.repeat(path.length) + '}';
		return str;
	}
}

// Pretty-prints the value in JSON form, but does not prettify (flattens) sub-values where handler returns true.
export function jsonStringifyWithFlattenedPaths(value: any, indent: number, handler: (value: any, path: Array<string>) => boolean): string {
	return jsonStringifyCustom(value, indent, (value, path) => (handler(value, path) ? JSON.stringify(value) : undefined));
}
