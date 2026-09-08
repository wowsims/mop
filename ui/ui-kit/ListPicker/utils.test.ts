import { describe, expect, it } from 'vitest';

import { actionEnabled, canDeleteAt, dropIndex, isInteractiveTarget, listItemClassName, moveItem } from './utils';

describe('listItemClassName', () => {
	it('kebab-cases the label, agreeing with the vanilla list on every label a caller passes', () => {
		// Vanilla wrote `.toLowerCase().replace(' ', '-')` — first space only. These are the labels
		// the eleven call sites actually pass, and none has a second space for the two to differ on.
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

	it('removes before inserting, so a forward move lands one place later than the drop cue', () => {
		// The destination is computed against the *pre-removal* positions and then applied after the
		// removal has shifted everything down. Dropping 'a' on the top half of 'c' (index 2) puts it
		// after 'c' rather than before it. Vanilla did exactly this and the port keeps it: the rule
		// is drag behaviour, not markup, so changing it here would be a silent behaviour change.
		expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		// A backwards move has no shift to absorb and lands where the cue says.
		expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
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
