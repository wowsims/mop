import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualList } from './VirtualList';

const ROW_HEIGHT = 20;
const VIEWPORT = 200;

// happy-dom reports every element as 0x0, so the virtualiser would render an empty window.
// `virtual-core`'s `getRect` reads `offsetWidth`/`offsetHeight` — not `getBoundingClientRect` — so
// those are the two properties a test has to answer.
const scroller = () => {
	const element = document.createElement('div');
	Object.defineProperty(element, 'offsetHeight', { value: VIEWPORT, configurable: true });
	Object.defineProperty(element, 'offsetWidth', { value: 400, configurable: true });
	document.body.appendChild(element);
	return element;
};

const renderList = (count: number, overscan = 2, scrollMargin = 0) => {
	const element = scroller();
	const view = render(
		<VirtualList
			count={count}
			rowHeight={ROW_HEIGHT}
			overscan={overscan}
			scrollMargin={scrollMargin}
			getScrollElement={() => element}
			initialRect={{ width: 400, height: VIEWPORT }}
			renderRow={index => <span>row {index}</span>}
		/>,
		{ container: element },
	);
	return { ...view, element };
};

const scrollTo = async (element: HTMLElement, top: number) => {
	Object.defineProperty(element, 'scrollTop', { value: top, configurable: true });
	await act(async () => {
		element.dispatchEvent(new Event('scroll'));
	});
};

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.virtual-list-row')];

describe('VirtualList', () => {
	it('reserves the full scroll height while rendering only a window of rows', () => {
		const { container } = renderList(1000);

		const list = container.querySelector<HTMLElement>('.virtual-list')!;
		expect(list.style.height).toBe(`${1000 * ROW_HEIGHT}px`);
		// A 200px viewport over 20px rows is ten rows, plus `overscan` on each side.
		expect(rows(container).length).toBe(VIEWPORT / ROW_HEIGHT + 2);
		expect(rows(container).map(row => Number(row.dataset.index))).toEqual([...Array(VIEWPORT / ROW_HEIGHT + 2).keys()]);
	});

	// The reason this component exists in this shape: rows are absolutely positioned, so a row's
	// position among its siblings is its position in the *window*, not in the list. At the top of the
	// list the two happen to agree, so this scrolls first — otherwise the assertion cannot tell an
	// index-based stripe from a sibling-based one, and a mutation swapping them passes.
	it('stripes from the absolute index, not the sibling position', async () => {
		const { container, element } = renderList(1000);
		await scrollTo(element, 15 * ROW_HEIGHT);

		const rendered = rows(container);
		expect(rendered.length).toBeGreaterThan(1);
		expect(Number(rendered[0].dataset.index)).toBeGreaterThan(0);
		// The window no longer starts at 0, so a sibling-based stripe would make the first row 'even'.
		expect(rendered.map(row => row.dataset.stripe)).toEqual(rendered.map(row => (Number(row.dataset.index) % 2 === 0 ? 'even' : 'odd')));
		expect(rendered.some(row => row.dataset.stripe === 'odd' && rendered.indexOf(row) % 2 === 0)).toBe(true);
	});

	it('offsets each row by its own start, so the window lands where the scroller is', () => {
		const { container } = renderList(1000);

		expect(rows(container).length).toBeGreaterThan(1);
		for (const row of rows(container)) {
			expect(row.style.transform).toBe(`translateY(${Number(row.dataset.index) * ROW_HEIGHT}px)`);
		}
	});

	// A shared scroller has chrome above the rows, and `scrollMargin` is how the virtualiser is told
	// about it. Without subtracting it back out of the transform every row sits that far too low.
	it('subtracts the scroll margin from each row offset', () => {
		const margin = 120;
		const { container } = renderList(1000, 2, margin);

		const rendered = rows(container);
		expect(rendered.length).toBeGreaterThan(1);
		for (const row of rendered) {
			expect(row.style.transform).toBe(`translateY(${Number(row.dataset.index) * ROW_HEIGHT}px)`);
		}
	});

	it('renders nothing but keeps its height at zero for an empty list', () => {
		const { container } = renderList(0);

		expect(container.querySelector<HTMLElement>('.virtual-list')!.style.height).toBe('0px');
		expect(rows(container)).toHaveLength(0);
	});
});
