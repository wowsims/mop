import i18n from '@i18n/config';
import type { ReactNode } from 'react';

import type { DropdownOption } from './types';

export interface MenuOptionEntry<V> {
	kind: 'option';
	/** Position in the flat `options` array — what the radio group compares. */
	index: number;
	option: DropdownOption<V>;
}

export interface MenuSubmenuEntry<V> {
	kind: 'submenu';
	/** Stable within its parent, for React keys. */
	key: string;
	label: ReactNode;
	entries: MenuEntries<V>;
	/**
	 * The option this submenu hangs off, when the path segment was a value rather than a category
	 * name. It stays selectable: vanilla put both a `data-bs-toggle` and a selection click handler
	 * on the same button, so the owner of a pet could be chosen *and* opened.
	 */
	trigger?: MenuOptionEntry<V>;
	/** The raw segment, so a later option can find this submenu by value. */
	segment: string | V;
}

export type MenuEntries<V> = Array<MenuOptionEntry<V> | MenuSubmenuEntry<V>>;

/**
 * Vanilla translated a lowercase_underscore segment through the APL submenu namespace and appended
 * a `»`. A segment that is not such a string — a value segment, or a category already in the user's
 * language — is used as it stands.
 *
 * The one change: `i18n.t` returns the *key* for a name the namespace does not carry, and vanilla
 * rendered that key. Falling back to the segment is what `translateItemLabel` already does for the
 * same situation, so a missing translation now degrades to the category name rather than to
 * `rotation_tab.apl.submenus.foo`.
 */
export const submenuLabel = (segment: unknown): string => {
	if (typeof segment !== 'string') return '';
	if (!/^[a-z_]+$/.test(segment)) return `${segment} »`;
	const key = `rotation_tab.apl.submenus.${segment}`;
	const translated = i18n.t(key);
	return `${translated === key ? segment : translated} »`;
};

const findSubmenu = <V>(entries: MenuEntries<V>, segment: string | V, equals: (a: V | undefined, b: V | undefined) => boolean) =>
	entries.find(
		(entry): entry is MenuSubmenuEntry<V> =>
			entry.kind === 'submenu' &&
			(typeof segment === 'string' ? entry.segment === segment : typeof entry.segment !== 'string' && equals(entry.segment as V, segment)),
	);

/**
 * Folds a flat option list into the nested menu the `submenu` paths describe.
 *
 * Two flavours of path segment, both of which the APL pickers use:
 * - a **string** names a category submenu (`['resources', 'chi']`, two deep at most today);
 * - a **value** makes the option carrying that value the submenu's trigger, which is how a pet is
 *   filed under its owner.
 *
 * `headerText` from the vanilla config is deliberately absent. It was already unreachable there:
 * the constructor and `setOptions` both drop every entry carrying one before anything renders, so
 * the four header entries in `model/action_id_sets.ts` have never produced an element.
 */
export const buildMenuTree = <V>(options: Array<DropdownOption<V>>, equals: (a: V | undefined, b: V | undefined) => boolean): MenuEntries<V> => {
	const root: MenuEntries<V> = [];

	const isSubmenuParent = (option: DropdownOption<V>) =>
		options.some(other => other.submenu?.some(segment => typeof segment !== 'string' && equals(segment as V, option.value)));

	const ensure = (path: Array<string | V>): MenuEntries<V> => {
		let entries = root;
		for (const segment of path) {
			let submenu = findSubmenu(entries, segment, equals);
			if (!submenu) {
				submenu = {
					kind: 'submenu',
					key: typeof segment === 'string' ? segment : `value-${entries.length}`,
					label: submenuLabel(segment),
					entries: [],
					segment,
				};
				entries.push(submenu);
			}
			entries = submenu.entries;
		}
		return entries;
	};

	options.forEach((option, index) => {
		const path = option.submenu ?? [];
		if (isSubmenuParent(option)) {
			// Create (or adopt) this option's own submenu and mark it selectable.
			ensure(path);
			const parent = ensure(path);
			let submenu = findSubmenu(parent, option.value, equals);
			if (!submenu) {
				submenu = { kind: 'submenu', key: `value-${parent.length}`, label: submenuLabel(option.value), entries: [], segment: option.value };
				parent.push(submenu);
			}
			submenu.trigger = { kind: 'option', index, option };
			submenu.label = '';
			return;
		}
		ensure(path).push({ kind: 'option', index, option });
	});

	return root;
};
