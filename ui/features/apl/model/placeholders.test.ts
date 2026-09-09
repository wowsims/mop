import type { APLGroup, APLRotation } from '@generated/proto/apl';
import { describe, expect, it } from 'vitest';

import { clearPlaceholder, findContainingGroup, placeholderNames, renamePlaceholder, visitObjects } from './placeholders';

describe('visitObjects', () => {
	it('visits the root itself before descending', () => {
		const calls: Array<unknown> = [];
		const root = { a: 1 };
		visitObjects(root, obj => {
			calls.push(obj);
			return false;
		});
		expect(calls[0]).toBe(root);
	});

	it('recurses into arrays and nested objects, and skips primitives', () => {
		const calls: Array<unknown> = [];
		const leaf = { z: 1 };
		const root = { list: [leaf, 'skip', 3], nested: { inner: leaf } };
		visitObjects(root, obj => {
			calls.push(obj);
			return false;
		});
		expect(calls).toEqual([root, root.list, leaf, root.nested, leaf]);
	});

	it('stops the walk as soon as visit returns true', () => {
		const calls: Array<unknown> = [];
		const target = { marker: true };
		const root = { a: { b: target }, c: { d: 1 } };
		const found = visitObjects(root, obj => {
			calls.push(obj);
			return obj === target;
		});
		expect(found).toBe(true);
		expect(calls).toEqual([root, root.a, target]);
	});
});

describe('findContainingGroup', () => {
	it('finds the group holding the target, by identity', () => {
		const target = { deep: true };
		const group1: APLGroup = { name: 'g1', actions: [{ hide: false, notes: '', action: { value: { nested: {} } } as any }], variables: [] };
		const group2: APLGroup = { name: 'g2', actions: [{ hide: false, notes: '', action: { value: { nested: target } } as any }], variables: [] };
		const rotation = { groups: [group1, group2] } as unknown as APLRotation;
		expect(findContainingGroup(rotation, target)).toBe(group2);
	});

	it('returns undefined when the target is in no group', () => {
		const group1: APLGroup = { name: 'g1', actions: [{ hide: false, notes: '', action: { value: { nested: {} } } as any }], variables: [] };
		const rotation = { groups: [group1] } as unknown as APLRotation;
		expect(findContainingGroup(rotation, { deep: true })).toBeUndefined();
	});
});

describe('placeholderNames', () => {
	const placeholderAction = (name: string) => ({
		hide: false,
		notes: '',
		action: { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name } } } as any,
	});

	it('de-duplicates and preserves first-seen order', () => {
		const group: APLGroup = { name: 'g', actions: [placeholderAction('b'), placeholderAction('a'), placeholderAction('b')], variables: [] };
		expect(placeholderNames(group)).toEqual(['b', 'a']);
	});

	it('returns an empty list for an undefined group', () => {
		expect(placeholderNames(undefined)).toEqual([]);
	});
});

describe('renamePlaceholder', () => {
	it('renames inside its own group and re-points matching groupReference.variables, leaving other groups alone', () => {
		const group: APLGroup = {
			name: 'g',
			actions: [{ hide: false, notes: '', action: { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name: 'old' } } } as any }],
			variables: [],
		};
		const groupH: APLGroup = {
			name: 'h',
			actions: [{ hide: false, notes: '', action: { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name: 'old' } } } as any }],
			variables: [],
		};
		const groupRefToG = { oneofKind: 'groupReference', groupReference: { groupName: 'g', variables: [{ name: 'old' }, { name: 'other' }] } };
		const groupRefToH = { oneofKind: 'groupReference', groupReference: { groupName: 'h', variables: [{ name: 'old' }] } };
		const rotation = {
			groups: [group, groupH],
			priorityList: [
				{ hide: false, notes: '', action: { value: groupRefToG } as any },
				{ hide: false, notes: '', action: { value: groupRefToH } as any },
			],
		} as unknown as APLRotation;

		renamePlaceholder(rotation, group, 'old', 'new');

		const groupPlaceholder = ((group.actions[0].action as any).value as any).variablePlaceholder;
		expect(groupPlaceholder.name).toBe('new');

		const otherGroupPlaceholder = ((groupH.actions[0].action as any).value as any).variablePlaceholder;
		expect(otherGroupPlaceholder.name).toBe('old');

		expect(groupRefToG.groupReference.variables[0].name).toBe('new');
		expect(groupRefToG.groupReference.variables[1].name).toBe('other');
		expect(groupRefToH.groupReference.variables[0].name).toBe('old');
	});
});

describe('clearPlaceholder', () => {
	it('empties the containing APLValue and returns true', () => {
		const placeholder = { name: 'p' };
		const holder = { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: placeholder } };
		const rotation = { groups: [], priorityList: [{ hide: false, notes: '', action: holder as any }] } as unknown as APLRotation;

		expect(clearPlaceholder(rotation, placeholder)).toBe(true);
		expect(holder.value).toEqual({ oneofKind: undefined });
	});

	it('returns false when the placeholder is not found', () => {
		const holder = { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name: 'p' } } };
		const rotation = { groups: [], priorityList: [{ hide: false, notes: '', action: holder as any }] } as unknown as APLRotation;

		expect(clearPlaceholder(rotation, { name: 'missing' })).toBe(false);
	});
});
