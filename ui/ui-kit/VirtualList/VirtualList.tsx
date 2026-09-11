import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { WINDOW_SCROLLER } from './window_scroller';

export interface VirtualListProps {
	count: number;
	// Every row is exactly this tall. Rows are never measured — dynamic measurement would re-render
	// on every row that reports a different height, which is an easy infinite loop.
	rowHeight?: number;
	overscan?: number;
	// The element that scrolls. May be an ancestor the list shares with other content, or `window`
	// when the list scrolls with the page. Returning `window` switches the list into window mode, so
	// a caller resolving its scroller with `findScrollParent` may report either without knowing which
	// it will be until the list is in the document.
	getScrollElement: () => HTMLElement | Window | null;
	// Pixels of a shared scroller above the first row: sticky chrome, a header, a filter bar. In
	// window mode this is the list's own offset down the document.
	scrollMargin?: number;
	// The scroller's size before it has been measured. Without it the first render produces no rows,
	// which is also what happens in a DOM that reports every element as 0x0.
	initialRect?: { width: number; height: number };
	className?: string;
	rowClassName?: (index: number) => string | undefined;
	renderRow: (index: number) => ReactNode;
}

const DEFAULT_ROW_HEIGHT = 28;
const DEFAULT_OVERSCAN = 10;

/**
 * Rows are absolutely positioned and moved with `transform`, which is how `@tanstack/react-virtual`
 * is built to work.
 *
 * The consequence to know: **`:nth-child` striping does not work here.** A row's position among its
 * siblings is the position within the rendered window, not within the list, so it changes as you
 * scroll. Every row carries `data-index` and `data-stripe`, and stripes are styled off
 * `[data-stripe='odd']` instead.
 *
 * The transform is also a containing block for `position: fixed` descendants, so a tooltip, popover
 * or menu that a row renders **into itself** lands against the row rather than the viewport. Rows
 * that only ever anchor a popup rendered elsewhere — a Wowhead tooltip on `<body>`, a `Tooltip`
 * portalled out — are unaffected.
 */
export const VirtualList = ({
	count,
	rowHeight = DEFAULT_ROW_HEIGHT,
	overscan = DEFAULT_OVERSCAN,
	getScrollElement,
	scrollMargin = 0,
	initialRect,
	className,
	rowClassName,
	renderRow,
}: VirtualListProps) => {
	// Read every render, because a caller that walks up for its scrolling ancestor has nothing to
	// report until the list is in the document. `null` takes the element branch: neither mode can
	// measure without a scroller, and the element one is what a ref-held scroller resolves to.
	const scroller = getScrollElement();
	const scrollsWithWindow = scroller !== null && !(scroller instanceof HTMLElement);

	const virtualizer = useVirtualizer<HTMLElement, HTMLElement>({
		count,
		getScrollElement: getScrollElement as () => HTMLElement | null,
		estimateSize: () => rowHeight,
		overscan,
		scrollMargin,
		initialRect,
		...(scrollsWithWindow ? WINDOW_SCROLLER : {}),
	});

	return (
		<div className={clsx('virtual-list', className)} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
			{virtualizer.getVirtualItems().map(item => (
				<div
					key={item.key}
					data-index={item.index}
					data-stripe={item.index % 2 === 0 ? 'even' : 'odd'}
					className={clsx('virtual-list-row', rowClassName?.(item.index))}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						height: rowHeight,
						transform: `translateY(${item.start - scrollMargin}px)`,
					}}>
					{renderRow(item.index)}
				</div>
			))}
		</div>
	);
};
