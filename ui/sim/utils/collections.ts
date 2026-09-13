// Array, object and enum helpers.

// @ts-expect-error
import cloneDeep from 'lodash/cloneDeep';

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

export function getEnumValues<E>(enumType: any): Array<E> {
	return Object.keys(enumType)
		.filter(key => !isNaN(Number(enumType[key])))
		.map(key => parseInt(enumType[key]) as unknown as E);
}

// Whether a click event was a right click.
export const getEnumKeyFromValue = <T extends Record<string, string | number>>(enumObj: T, value: number): string | undefined => {
	return (enumObj as any)[value];
};
