import type { TalentTreeConfig } from '@domain/talents/config';
import { SimHostProvider } from '@features/SimHostContext';
import { Class, Spec } from '@generated/proto/common';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TalentTreePicker } from './TalentTreePicker';

// The icon and the wowhead href come from the database, which no unit test has. What is under test
// is the click behaviour, and `useActionId` has its own suite.
vi.mock('@ui-kit/hooks/useActionId', () => ({
	useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }),
}));

const ROWS = 6;
const COLS = 3;

const treeConfig: TalentTreeConfig<Record<string, never>> = {
	backgroundUrl: 'background.jpg',
	talents: Array.from({ length: ROWS * COLS }, (_, index) => ({
		fieldName: `talent${index}`,
		fancyName: `Talent ${index}`,
		location: { rowIdx: Math.floor(index / COLS), colIdx: index % COLS },
		spellId: 1000 + index,
	})),
};

// The component reads class and spec from the host rather than taking them as props, so the tests
// supply the smallest host that answers those two questions.
const host = { player: { getClass: () => Class.ClassWarrior, getSpec: () => Spec.SpecArmsWarrior } } as never;

const tree = (talentsString: string) => {
	const onChange = vi.fn();
	render(
		<SimHostProvider host={host}>
			<TalentTreePicker config={treeConfig} talentsString={talentsString} onChange={onChange} />
		</SimHostProvider>,
	);
	return onChange;
};

const talents = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('.talent-picker-root'));
const talentAt = (rowIdx: number, colIdx: number) => talents()[rowIdx * COLS + colIdx];

afterEach(() => vi.useRealTimers());

describe('TalentTreePicker', () => {
	it('lays the config out as a grid, one level gutter per row', () => {
		tree('000000');
		expect(talents()).toHaveLength(ROWS * COLS);
		expect(Array.from(document.querySelectorAll('.talent-tree-level')).map(el => el.textContent)).toEqual(['15', '30', '45', '60', '75', '90']);
	});

	// Three stylesheet rules read the value, one of them `.talent-tree-row:has([data-selected='true'])`,
	// so this has to be the string and not a boolean attribute that vanishes when false.
	it('marks the spent talent with data-selected="true" and every other with "false"', () => {
		tree('200000');
		expect(talentAt(0, 1).dataset.selected).toBe('true');
		expect(talents().filter(el => el.dataset.selected === 'true')).toHaveLength(1);
		expect(talents().every(el => el.dataset.selected !== undefined)).toBe(true);
	});

	it('spends a point on left mousedown, replacing whatever the row held', () => {
		const onChange = tree('100000');
		fireEvent.mouseDown(talentAt(0, 2), { button: 0 });
		expect(onChange).toHaveBeenCalledWith('300000');
	});

	it('writes a full six-digit string even from a source that is shorter', () => {
		const onChange = tree('');
		fireEvent.mouseDown(talentAt(3, 1), { button: 0 });
		expect(onChange).toHaveBeenCalledWith('000200');
	});

	it('unspends the point on right mousedown', () => {
		const onChange = tree('200000');
		fireEvent.mouseDown(talentAt(0, 1), { button: 2 });
		expect(onChange).toHaveBeenCalledWith('000000');
	});

	// Vanilla's `setSelected(false)` clears *this* talent, so the row's point survives — but
	// `inputChanged()` still writes, which is what fires the tab's analytics event.
	it('leaves the row alone when right-clicking a talent that does not hold its point, and still writes', () => {
		const onChange = tree('200000');
		fireEvent.mouseDown(talentAt(0, 2), { button: 2 });
		expect(onChange).toHaveBeenCalledWith('200000');
	});

	it('does not navigate the wowhead link a talent carries', () => {
		tree('000000');
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		talentAt(0, 0).dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
	});

	it('suppresses the context menu so a right click can unspend', () => {
		tree('000000');
		const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		talentAt(0, 0).dispatchEvent(menu);
		expect(menu.defaultPrevented).toBe(true);
	});

	// The touch handlers are native listeners rather than React props precisely so this holds: React
	// attaches touchstart passively, where preventDefault is a no-op — and without it the browser's
	// compatibility mousedown re-spends the point a long press has just cleared.
	it('prevents the default on touchstart, which a passive React listener could not', () => {
		tree('000000');
		const start = createEvent.touchStart(talentAt(0, 0));
		fireEvent(talentAt(0, 0), start);
		expect(start.defaultPrevented).toBe(true);
	});

	it('spends a point on a short tap', () => {
		const onChange = tree('000000');
		fireEvent.touchStart(talentAt(1, 0));
		fireEvent.touchEnd(talentAt(1, 0));
		expect(onChange).toHaveBeenCalledWith('010000');
	});

	// The long press is the touch equivalent of a right click, and the release afterwards must not
	// re-spend what it just cleared.
	it('unspends on a long press, and the release that follows changes nothing', () => {
		vi.useFakeTimers();
		const onChange = tree('010000');
		fireEvent.touchStart(talentAt(1, 0));
		vi.advanceTimersByTime(750);
		expect(onChange).toHaveBeenCalledWith('000000');

		onChange.mockClear();
		fireEvent.touchEnd(talentAt(1, 0));
		expect(onChange).not.toHaveBeenCalled();
	});

	it('cancels the long press when the finger moves', () => {
		vi.useFakeTimers();
		const onChange = tree('010000');
		fireEvent.touchStart(talentAt(1, 0));
		fireEvent.touchMove(talentAt(1, 0));
		vi.advanceTimersByTime(750);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('zeroes every row from the reset button', () => {
		const onChange = tree('123123');
		fireEvent.click(document.querySelector('.talent-tree-reset')!);
		expect(onChange).toHaveBeenCalledWith('000000');
	});

	it('keeps the reset button a bare btn, as the stylesheet expects', () => {
		tree('000000');
		expect(screen.getByRole('button').className.split(' ').sort()).toEqual(['btn', 'link-danger', 'talent-tree-reset']);
	});
});
