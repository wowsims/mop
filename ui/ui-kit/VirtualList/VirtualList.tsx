import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface VirtualListProps {
	count: number;
	// Every row is exactly this tall. Rows are never measured, matching the vanilla list this
	// replaces: it declared itself fixed-row-height, and dynamic measurement would re-render on every
	// row that reports a different height, which is an easy infinite loop.
	rowHeight?: number;
	overscan?: number;
	// The element that scrolls. May be an ancestor the list shares with other content.
	getScrollElement: () => HTMLElement | null;
	// Pixels of a shared scroller above the first row: sticky chrome, a header, a filter bar.
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
 * is built to work. That is a different DOM from the vanilla `VirtualList`, which keeps rows as real
 * sequential children between two spacer elements.
 *
 * The consequence to know: **`:nth-child` striping does not work here.** A row's position among its
 * siblings is the position within the rendered window, not within the list, so it changes as you
 * scroll. Every row carries `data-index` and `data-stripe`, and stripes are styled off
 * `[data-stripe='odd']` instead.
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
	const virtualizer = useVirtualizer({
		count,
		getScrollElement,
		estimateSize: () => rowHeight,
		overscan,
		scrollMargin,
		initialRect,
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
