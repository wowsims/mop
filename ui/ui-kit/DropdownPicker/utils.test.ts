import { describe, expect, it, vi } from 'vitest';

import type { DropdownOption } from './types';
import { buildMenuTree, type MenuEntries, submenuLabel } from './utils';

// Only `resources` is translated here, so the untranslated branch is exercised too.
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => (key === 'rotation_tab.apl.submenus.resources' ? 'Resources' : key) } }));

const sameId = (a: string | undefined, b: string | undefined) => a === b;

/** A readable shape for the tree: options by value, submenus as `name(...)`. */
const shape = <V>(entries: MenuEntries<V>): string =>
	entries
		.map(entry =>
			entry.kind === 'option' ? String(entry.option.value) : `${entry.trigger ? `${entry.trigger.option.value}*` : entry.label}(${shape(entry.entries)})`,
		)
		.join(',');

describe('submenuLabel', () => {
	it('translates a lowercase_underscore segment through the APL submenu namespace', () => {
		expect(submenuLabel('resources')).toBe('Resources »');
	});

	it('leaves an already-worded segment alone but still marks it as a submenu', () => {
		expect(submenuLabel('Groups')).toBe('Groups »');
	});

	it('falls back to the segment when the namespace has no entry, where vanilla showed the key', () => {
		expect(submenuLabel('logic')).toBe('logic »');
	});

	it('has nothing to say about a value segment, whose trigger renders the option instead', () => {
		expect(submenuLabel({ id: 1 })).toBe('');
	});
});

describe('buildMenuTree', () => {
	const option = (value: string, submenu?: Array<string>, extra: Partial<DropdownOption<string>> = {}): DropdownOption<string> => ({
		value,
		label: value,
		submenu,
		...extra,
	});

	it('keeps flat options in order at the root', () => {
		expect(shape(buildMenuTree([option('a'), option('b')], sameId))).toBe('a,b');
	});

	it('files an option under the category its path names', () => {
		expect(shape(buildMenuTree([option('a'), option('b', ['logic'])], sameId))).toBe('a,logic »(b)');
	});

	it('creates a category once and keeps it in first-mention position', () => {
		expect(shape(buildMenuTree([option('a', ['logic']), option('b'), option('c', ['logic'])], sameId))).toBe('logic »(a,c),b');
	});

	it('nests a two-segment path, which is the deepest any caller uses', () => {
		const tree = buildMenuTree([option('chi', ['resources', 'chi']), option('rage', ['resources', 'rage'])], sameId);
		expect(shape(tree)).toBe('Resources »(chi »(chi),rage »(rage))');
	});

	// The pet case. A *string* segment is always a category name, so a value segment can only be
	// exercised with non-string values — which is what every real caller has.
	type Ref = { type: number };
	const byType = (a: Ref | undefined, b: Ref | undefined) => a?.type === b?.type;
	const self: DropdownOption<Ref> = { value: { type: 1 }, label: 'Self' };
	const pet = (owner: Ref): DropdownOption<Ref> => ({ value: { type: 2 }, label: 'Pet', submenu: [owner] });

	it('makes the option a value path names into that submenu’s trigger, and keeps it selectable', () => {
		const tree = buildMenuTree([self, pet(self.value)], byType);

		expect(tree).toHaveLength(1);
		const submenu = tree[0];
		if (submenu.kind !== 'submenu') throw new Error('expected a submenu');
		expect(submenu.trigger?.index).toBe(0);
		expect(submenu.trigger?.option.label).toBe('Self');
		expect(submenu.entries.map(entry => entry.kind === 'option' && entry.option.label)).toEqual(['Pet']);
	});

	it('leaves a submenu that has no trigger labelled, and one that has a trigger unlabelled', () => {
		const withTrigger = buildMenuTree([self, pet(self.value)], byType)[0];
		const byCategory = buildMenuTree([option('a', ['logic'])], sameId)[0];

		expect(withTrigger.kind === 'submenu' && withTrigger.label).toBe('');
		expect(byCategory.kind === 'submenu' && byCategory.label).toBe('logic »');
	});

	it('keeps the flat index on every option, because that is what the radio group compares', () => {
		const tree = buildMenuTree([option('a', ['logic']), option('b'), option('c', ['logic'])], sameId);
		const logic = tree[0];
		if (logic.kind !== 'submenu') throw new Error('expected a submenu');
		expect(logic.entries.map(entry => (entry.kind === 'option' ? entry.index : -1))).toEqual([0, 2]);
		expect(tree[1].kind === 'option' && tree[1].index).toBe(1);
	});

	it('reads a value segment through `equals`, not by identity', () => {
		// A *different object* with the same type: it must still find the owner.
		const tree = buildMenuTree([self, pet({ type: 1 })], byType);

		expect(tree).toHaveLength(1);
		expect(tree[0].kind === 'submenu' && tree[0].trigger?.option.label).toBe('Self');
	});
});
