import type { useVirtualizer } from '@tanstack/react-virtual';
import { observeWindowOffset, observeWindowRect, windowScroll } from '@tanstack/react-virtual';

type ElementVirtualizerOptions = Parameters<typeof useVirtualizer<HTMLElement, HTMLElement>>[0];

export type RectObserver = NonNullable<ElementVirtualizerOptions['observeElementRect']>;

/**
 * `useWindowVirtualizer` is `useVirtualizer` with exactly these four options, so borrowing them keeps
 * one hook call covering both modes — which is what lets the mode be decided by whatever
 * `getScrollElement` returns rather than by which hook the caller picked. The cast is the entire
 * cost: `useVirtualizer` is generic over `Element`, and these three observers are written against
 * `Virtualizer<Window>`.
 */
export const WINDOW_SCROLLER = {
	observeElementRect: observeWindowRect,
	observeElementOffset: observeWindowOffset,
	scrollToFn: windowScroll,
	initialOffset: () => (typeof document === 'undefined' ? 0 : window.scrollY),
} as unknown as Partial<ElementVirtualizerOptions>;
