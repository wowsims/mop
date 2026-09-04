// @ts-expect-error
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';

export const randomUUID = () => uuidv4();

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const existsInDOM = (element: HTMLElement | null) => document.body.contains(element);

export const cloneChildren = (element: HTMLElement) => [...(element.childNodes || [])].map(child => child.cloneNode(true));

/** Escape text for safe insertion into HTML (e.g. attribute or text node via innerHTML). */
export const encodeHTMLEntities = (text: string): string => {
	const textArea = document.createElement('textarea');
	textArea.textContent = text;
	return textArea.innerHTML;
};

export const sanitizeId = (id: string) => id.split(' ').join('').toLocaleLowerCase();

export const omitDeep = <T>(collection: T, excludeKeys: string[]): T => {
	const clonedCollection = cloneDeep(collection);

	const omitFn = (value: any) => {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			excludeKeys.forEach(key => {
				delete value[key];
			});
		}
	};

	const traverse = (value: any) => {
		if (Array.isArray(value)) {
			value.forEach(traverse);
		} else if (value && typeof value === 'object') {
			omitFn(value);
			Object.keys(value).forEach(key => traverse(value[key]));
		}
	};

	traverse(clonedCollection);
	return clonedCollection;
};

// Returns if the two items are equal, or if both are null / undefined.
export function equalsOrBothNull<T>(a: T, b: T, comparator?: (_a: NonNullable<T>, _b: NonNullable<T>) => boolean): boolean {
	if (a == null && b == null) return true;

	if (a == null || b == null) return false;

	return (comparator || ((_a: NonNullable<T>, _b: NonNullable<T>) => a == b))(a!, b!);
}

// Default comparator function for strings. Used with functions like Array.sort().
export function stringComparator(a: string, b: string): number {
	if (a < b) {
		return -1;
	} else if (b < a) {
		return 1;
	} else {
		return 0;
	}
}

// Sorts an objectArray by a property. Returns a new array.
// Can be called recursively.
export function sortByProperty(objArray: any[], prop: string, direct = 1) {
	if (!Array.isArray(objArray)) throw new Error('FIRST ARGUMENT NOT AN ARRAY');
	const clone = objArray.slice(0);
	const propPath = prop.constructor === Array ? prop : prop.split('.');
	clone.sort(function (a, b) {
		for (const p in propPath) {
			if (a[propPath[p]] && b[propPath[p]]) {
				a = a[propPath[p]];
				b = b[propPath[p]];
			}
		}
		// convert numeric strings to integers
		a = a.toString().match(/^\d+$/) ? +a : a;
		b = b.toString().match(/^\d+$/) ? +b : b;
		return a < b ? -1 * direct : a > b ? 1 * direct : 0;
	});
	return clone;
}

export function sum(arr: Array<number>): number {
	return arr.reduce((total, cur) => total + cur, 0);
}

export interface FormatDurationSecondsOptions {
	showMilliseconds?: boolean;
	millisecondDigits?: 1 | 2 | 3;
	separatorStyle?: 'colon' | 'unit';
	minimumUnit?: 'seconds' | 'minutes' | 'hours';
}

export function formatDurationSeconds(seconds: number, options: FormatDurationSecondsOptions = {}): string {
	const showMilliseconds = options.showMilliseconds ?? false;
	const millisecondDigits = options.millisecondDigits ?? 1;
	const precision = showMilliseconds ? Math.pow(10, millisecondDigits) : 1;
	const totalUnits = Math.max(0, Math.round(seconds * precision));
	const totalSeconds = Math.floor(totalUnits / precision);
	const fractionalUnits = totalUnits % precision;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const remainingSeconds = totalSeconds % 60;
	const secondsSuffix = showMilliseconds ? `.${String(fractionalUnits).padStart(millisecondDigits, '0')}` : '';
	const paddedSeconds = String(remainingSeconds).padStart(2, '0');

	if (options.separatorStyle === 'colon') {
		const showHours = hours > 0 || options.minimumUnit === 'hours';
		const showMinutes = showHours || minutes > 0 || options.minimumUnit === 'minutes';

		if (showHours) {
			return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}${secondsSuffix}`;
		}
		if (showMinutes) {
			return `${minutes}:${paddedSeconds}${secondsSuffix}`;
		}
		return `${remainingSeconds}${secondsSuffix}s`;
	}

	if (hours > 0) {
		return `${hours}h ${String(minutes).padStart(2, '0')}m ${paddedSeconds}${secondsSuffix}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${paddedSeconds}${secondsSuffix}s`;
	}
	return `${remainingSeconds}${secondsSuffix}s`;
}

// Synchronous 64-bit string hash (FNV-1a paired with a djb2 variant). Collision-resistant
// enough for local cache keys and content-derived seeds; unlike crypto.subtle it costs no
// async round-trip.
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

export const Z_95 = 1.96;

// The sim's standard two-sample significance test; every "are these two results actually
// different" decision should go through this so thresholds never diverge.
export function zTest(
	n1: number,
	avg1: number,
	stdev1: number,
	n2: number,
	avg2: number,
	stdev2: number,
	preNormalized = false,
): { z: number; isDiff: boolean } {
	const delta = avg1 - avg2;
	const err1 = preNormalized ? stdev1 : stdev1 / Math.sqrt(n1);
	const err2 = preNormalized ? stdev2 : stdev2 / Math.sqrt(n2);
	const denom = Math.sqrt(Math.pow(err1, 2) + Math.pow(err2, 2));
	const z = Math.abs(delta / denom);
	return { z, isDiff: z > Z_95 };
}

// Swaps two elements in the given array.
export function swap<T>(arr: Array<T>, i: number, j: number) {
	[arr[i], arr[j]] = [arr[j], arr[i]];
}

// Returns a new array containing only elements present in both a and b.
export function arrayEquals<T>(a: Array<T>, b: Array<T>, comparator?: (a: T, b: T) => boolean): boolean {
	comparator = comparator || ((a: T, b: T) => a == b);
	return a.length == b.length && a.every((val, i) => comparator!(val, b[i]));
}

// Returns a new array containing only elements present in both a and b.
export function intersection<T>(a: Array<T>, b: Array<T>): Array<T> {
	return a.filter(value => b.includes(value));
}

// Returns a new array containing only distinct elements of arr.
// comparator should return true if the two elements are considered equal, and false otherwise.
export function distinct<T>(arr: Array<T>, comparator?: (a: T, b: T) => boolean): Array<T> {
	comparator = comparator || ((a: T, b: T) => a == b);
	const distinctArr: Array<T> = [];
	arr.forEach(val => {
		if (distinctArr.find(dVal => comparator!(dVal, val)) == null) {
			distinctArr.push(val);
		}
	});
	return distinctArr;
}

// Splits an array into buckets, where elements are placed in the same bucket if the
// toString function returns the same value.
export function bucket<T>(arr: Array<T>, toString: (val: T) => string): Record<string, Array<T>> {
	const buckets: Record<string, Array<T>> = {};
	arr.forEach(val => {
		const valString = toString(val);
		if (buckets[valString]) {
			buckets[valString].push(val);
		} else {
			buckets[valString] = [val];
		}
	});
	return buckets;
}

export function stDevToConf90(stDev: number, N: number) {
	return (1.645 * stDev) / Math.sqrt(N);
}

export function stDevToConf95(stDev: number, N: number) {
	return (Z_95 * stDev) / Math.sqrt(N);
}

export function getStDev(arr: Array<number>, sample = false): number {
	if (arr.length === 0 || (sample && arr.length === 1)) {
		return 0;
	}

	const mean = sum(arr) / arr.length;
	const variance = sum(arr.map(value => Math.pow(value - mean, 2))) / (sample ? arr.length - 1 : arr.length);
	return Math.sqrt(variance);
}

// Only works for numeric enums
export function getEnumValues<E>(enumType: any): Array<E> {
	return Object.keys(enumType)
		.filter(key => !isNaN(Number(enumType[key])))
		.map(key => parseInt(enumType[key]) as unknown as E);
}

// Whether a click event was a right click.
export function isRightClick(event: MouseEvent): boolean {
	return event.button == 2;
}

// Converts from '#ffffff' --> 'rgba(255, 255, 255, alpha)'
export function hexToRgba(hex: string, alpha: number): string {
	if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		let parts = hex.substring(1).split('');
		if (parts.length == 3) {
			parts = [parts[0], parts[0], parts[1], parts[1], parts[2], parts[2]];
		}
		const c: any = '0x' + parts.join('');
		return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
	}
	throw new Error('Invalid hex color: ' + hex);
}

export function camelToSnakeCase(str: string): string {
	let result = str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
	if (result.startsWith('_')) {
		result = result.substring(1);
	}
	return result;
}

export function downloadJson(json: any, fileName: string) {
	downloadString(JSON.stringify(json, null, 2), fileName);
}
export function downloadString(data: string, fileName: string) {
	const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
	const downloadAnchorNode = document.createElement('a');
	downloadAnchorNode.setAttribute('href', dataStr);
	downloadAnchorNode.setAttribute('download', fileName);
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

export function formatDeltaTextElem(
	elem: HTMLElement,
	before: number,
	after: number,
	precision: number,
	lowerIsBetter?: boolean,
	noColor?: boolean,
	showPercentage?: boolean,
) {
	const delta = after - before;
	const denom = Math.min(before, after);
	const deltaPct = Math.abs((delta / (denom === 0 ? 1 : denom)) * 100).toFixed(precision);
	let deltaStr = delta.toFixed(precision);
	if (delta >= 0) {
		deltaStr = `+${deltaStr}`;
	}
	if (showPercentage) {
		deltaStr = `${deltaStr} (${deltaPct}%)`;
	}

	elem.textContent = deltaStr;

	if (noColor || delta == 0) {
		elem.classList.remove('positive');
		elem.classList.remove('negative');
	} else if (delta > 0 != Boolean(lowerIsBetter)) {
		elem.classList.remove('negative');
		elem.classList.add('positive');
	} else {
		elem.classList.remove('positive');
		elem.classList.add('negative');
	}
}

// Returns all N pick K permutations of the elements in arr of size N.
export function permutations<T>(arr: Array<T>, k: number): Array<Array<T>> {
	if (k == 0) {
		return [];
	} else if (k == 1) {
		return arr.map(v => [v]);
	} else {
		return arr
			.map((v, i) => {
				const withoutThisElem = arr.slice();
				withoutThisElem.splice(i, 1);
				const permutationsWithoutThisElem = permutations(withoutThisElem, k - 1);
				return permutationsWithoutThisElem.map(perm => [v].concat(perm));
			})
			.flat();
	}
}

// Returns all N choose K combinations of the elements in arr of size N.
export function combinations<T>(arr: Array<T>, k: number, comparator?: (_a: T, _b: T) => number): Array<Array<T>> {
	const perms = permutations(arr, k);
	const sorted = perms.map(permutation => permutation.sort(comparator));

	const equals: (_a: T, _b: T) => boolean = comparator ? (a, b) => comparator(a, b) == 0 : (a, b) => a == b;
	return distinct(sorted, (permutationA, permutationB) => permutationA.every((elem, i) => equals(elem, permutationB[i])));
}

// Returns all N pick K permutations of the elements in arr of size N, allowing duplicates.
export function permutationsWithDups<T>(arr: Array<T>, k: number): Array<Array<T>> {
	if (k == 0) {
		return [];
	} else if (k == 1) {
		return arr.map(v => [v]);
	} else {
		const smaller = permutationsWithDups(arr, k - 1);
		return arr
			.map(v => {
				return smaller.map(permutation => {
					const newPerm = permutation.slice();
					newPerm.push(v);
					return newPerm;
				});
			})
			.flat();
	}
}

// Returns all N choose K combinations of the elements in arr of size N, allowing duplicates.
export function combinationsWithDups<T>(arr: Array<T>, k: number): Array<Array<T>> {
	const perms = permutationsWithDups(arr, k);
	const sorted = perms.map(permutation => permutation.sort());
	return distinct(sorted, (permutationA, permutationB) => permutationA.every((elem, i) => elem == permutationB[i]));
}

// Converts a Uint8Array into a hex string.
export function buf2hex(data: Uint8Array): string {
	return [...data].map(x => x.toString(16).padStart(2, '0')).join('');
}

const randomStringChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+';
export function randomString(len?: number): string {
	let str = '';
	const strLen = len || 10;
	for (let i = 0; i < strLen; i++) {
		str += randomStringChars[Math.floor(Math.random() * randomStringChars.length)];
	}
	return str;
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

export function htmlDecode(input: string) {
	const doc = new DOMParser().parseFromString(input, 'text/html');
	return doc.documentElement.textContent;
}

// JavaScript's built in modulo (%) has several issues. This is a fix that works similar to the intuitive way modulo works in most languages
export const mod = (n: number, m: number): number => {
	return ((n % m) + m) % m;
};

export const formatToCompactNumber: typeof formatToNumber = (number, options) => formatToNumber(number, { notation: 'compact', ...options });

export const formatToPercent: typeof formatToNumber = (number, options) => formatToNumber(number / 100, { style: 'percent', ...options });

export const formatToNumber = (number: number, options?: Intl.NumberFormatOptions & { fallbackString?: string }) => {
	if (!number && options?.fallbackString) return options.fallbackString;
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, ...options }).format(number);
};

type Environments = 'local' | 'external';

const hostname = window.location.hostname;
export const getEnvironment = (): Environments => {
	if (hostname.includes('localhost')) return 'local';
	return 'external';
};

export const isNative = () => getEnvironment() === 'local';
export const isExternal = () => getEnvironment() === 'external';
export const isDevMode = () => {
	return import.meta.env.DEV;
};
export const normalizeName = (name: string): string => {
	return name
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');
};
export const formatName = (name: string): string => {
	return name.replace('Food', '');
};

export const getEnumKeyFromValue = <T extends Record<string, string | number>>(enumObj: T, value: number): string | undefined => {
	return (enumObj as any)[value];
};

export const findInputItemForEnum = <T extends Record<string, string | number>, U extends { name: string }>(
	enumObj: T,
	enumValue: number,
	items: U[],
): U | undefined => {
	const targetEnumKey = getEnumKeyFromValue(enumObj, enumValue);
	if (!targetEnumKey) {
		return undefined;
	}
	return items.find(item => {
		return normalizeName(item.name) === formatName(targetEnumKey);
	});
};
