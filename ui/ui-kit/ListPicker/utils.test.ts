import { describe, expect, it } from 'vitest';

import { actionEnabled, canDeleteAt, carryId, dropIndex, isInteractiveTarget, keyFor, listItemClassName, moveItem } from './utils';

describe('listItemClassName', () => {
	it('kebab-cases the label, agreeing with the vanilla list on every label a caller passes', () => {
		// `.toLowerCase().replace(' ', '-')` replaces only the first space. These are the labels the
		// eleven call sites actually pass, and none has a second space for the two to differ on.
		const labels = ['Action', 'action', 'Pre-Pull Action', 'Action Group', 'Variable', 'Value', 'Target', 'Target Input'];
		for (const label of labels) {
			expect(listItemClassName(label)).toBe(label.toLowerCase().replace(' ', '-'));
		}
	});

	it('differs from the vanilla expression only for a label with two spaces, which none has', () => {
		expect(listItemClassName('a b c')).toBe('a-b-c');
		expect('a b c'.toLowerCase().replace(' ', '-')).toBe('a-b c');
	});
});

describe('actionEnabled', () => {
	it('allows everything when no list is given', () => {
		expect(actionEnabled(undefined, 'create')).toBe(true);
		expect(actionEnabled(undefined, 'move')).toBe(true);
	});

	it('allows only what the list names', () => {
		expect(actionEnabled(['copy', 'delete'], 'copy')).toBe(true);
		expect(actionEnabled(['copy', 'delete'], 'create')).toBe(false);
		expect(actionEnabled([], 'delete')).toBe(false);
	});
});

describe('canDeleteAt', () => {
	it('allows every row when there is no minimum', () => {
		expect(canDeleteAt(0, undefined)).toBe(true);
		expect(canDeleteAt(0, 0)).toBe(true);
	});

	it('withholds delete from exactly the first minimumItems rows', () => {
		expect([0, 1, 2].map(index => canDeleteAt(index, 1))).toEqual([false, true, true]);
		expect([0, 1, 2].map(index => canDeleteAt(index, 2))).toEqual([false, false, true]);
	});
});

describe('dropIndex', () => {
	// The rect the component reads is real in a browser and all-zero in happy-dom, which is why the
	// midpoint rule is pinned here rather than through a synthetic drop event.
	const row = { top: 100, height: 40 };

	it('inserts before the row when released above its midpoint', () => {
		expect(dropIndex(3, 100, row)).toBe(3);
		expect(dropIndex(3, 119, row)).toBe(3);
		expect(dropIndex(3, 120, row)).toBe(3);
	});

	it('inserts after the row when released below its midpoint', () => {
		expect(dropIndex(3, 121, row)).toBe(4);
		expect(dropIndex(3, 140, row)).toBe(4);
	});

	it('reads the midpoint off the row, not off the viewport', () => {
		expect(dropIndex(0, 10, { top: 0, height: 40 })).toBe(0);
		expect(dropIndex(0, 10, { top: 0, height: 4 })).toBe(1);
	});
});

describe('moveItem', () => {
	const list = ['a', 'b', 'c', 'd'];

	it('moves forwards to exactly where the drop cue says', () => {
		expect(moveItem(list, 0, 2)).toEqual(['b', 'a', 'c', 'd']);
		expect(moveItem(list, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
	});

	it('leaves the order unchanged for a destination on either side of the item itself', () => {
		expect(moveItem(list, 1, 1)).toEqual(list);
		expect(moveItem(list, 1, 2)).toEqual(list);
	});

	it('moves backwards to exactly the destination index', () => {
		expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
	});

	it('appends when the destination is past the end', () => {
		expect(moveItem(list, 0, 4)).toEqual(['b', 'c', 'd', 'a']);
	});

	it('leaves the source array alone', () => {
		moveItem(list, 0, 3);
		expect(list).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('keyFor', () => {
	it('mints one id per object and keeps returning it', () => {
		const item = { name: 'a' };
		const id = keyFor(item, 0);
		expect(keyFor(item, 5)).toBe(id);
	});

	it('mints different ids for different objects, including ones at the same index', () => {
		expect(keyFor({ name: 'a' }, 0)).not.toBe(keyFor({ name: 'b' }, 0));
	});

	it('falls back to a per-index id for a nullish item, never throwing', () => {
		expect(() => keyFor(undefined, 3)).not.toThrow();
		expect(keyFor(undefined, 3)).toBe(keyFor(undefined, 3));
		expect(keyFor(undefined, 3)).not.toBe(keyFor(undefined, 4));
	});

	it('never collides a nullish fallback id with a real object id', () => {
		const item = { name: 'a' };
		expect(keyFor(item, 0)).not.toBe(keyFor(undefined, 0));
	});
});

describe('carryId', () => {
	it('moves the old id onto the new object, so it resolves to the same key', () => {
		const oldItem = { name: 'a' };
		const newItem = { name: 'a2' };
		const id = keyFor(oldItem, 0);

		carryId(oldItem, newItem);

		expect(keyFor(newItem, 0)).toBe(id);
	});

	it('does nothing for a nullish old or new item', () => {
		expect(() => carryId(undefined, { name: 'a' })).not.toThrow();
		expect(() => carryId({ name: 'a' }, undefined)).not.toThrow();
	});
});

describe('isInteractiveTarget', () => {
	const build = (inner: string) => {
		const container = document.createElement('div');
		container.innerHTML = inner;
		return container;
	};

	it('reports a text input the pointer went down on', () => {
		const container = build('<div><input type="text" /></div>');
		expect(isInteractiveTarget(container.querySelector('input')!, container)).toBe(true);
	});

	it('reports a textarea and a contenteditable ancestor', () => {
		const textarea = build('<textarea></textarea>');
		expect(isInteractiveTarget(textarea.querySelector('textarea')!, textarea)).toBe(true);

		const editable = build('<div contenteditable="true"><span></span></div>');
		expect(isInteractiveTarget(editable.querySelector('span')!, editable)).toBe(true);
	});

	it('reports a plain element as draggable, and stops at the container', () => {
		const container = build('<div><span></span></div>');
		expect(isInteractiveTarget(container.querySelector('span')!, container)).toBe(false);

		// An input *outside* the walked container must not be found by walking upwards past it.
		const outer = document.createElement('input');
		outer.appendChild(container);
		expect(isInteractiveTarget(container.querySelector('span')!, container)).toBe(false);
	});
});
