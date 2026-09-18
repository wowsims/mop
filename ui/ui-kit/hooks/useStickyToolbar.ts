import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useMedia } from 'react-use';

/** The header a `useStickyToolbar` bar sticks below. Null until the shell has laid its own out. */
export const StickyHeaderContext = createContext<HTMLElement | null>(null);

// `--spacing-sim-header` is one height above `--breakpoint-lg` and another below it, so the header
// measured under one is the wrong shave under the other. Mirrors `breakpoints.css`.
const LG_BREAKPOINT = '(min-width: 992px)';

/**
 * A `position: sticky` toolbar that reports whether it is currently pinned, as `.stuck`.
 *
 * Parameterises the element type and takes the header from `StickyHeaderContext`; fixes the
 * observer — the toolbar has stuck exactly when it no longer fits whole under that header.
 */
export const useStickyToolbar = <T extends HTMLElement>() => {
	const header = useContext(StickyHeaderContext);
	const ref = useRef<T>(null);
	const [stuck, setStuck] = useState(false);
	const wide = useMedia(LG_BREAKPOINT);

	useEffect(() => {
		const element = ref.current;
		if (!element || !header) return;
		// One delivery can carry several records, oldest first, so the last is the current state — reading `[entry]` leaves the bar stuck on a stale ratio.
		const observer = new IntersectionObserver(entries => setStuck(element.clientHeight > 0 && entries[entries.length - 1].intersectionRatio < 1), {
			rootMargin: `-${header.offsetHeight + 1}px 0px 0px 0px`,
			// The 0 threshold is load-bearing. A bar built inside a hidden tab goes 0 -> pinned without ever passing through 1, and Chromium derives an entry's `isIntersecting` from the threshold index, so a [1]-only observer is never called again after that first hidden callback.
			threshold: [0, 1],
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [header, wide]);

	return { ref, stuck, className: 'ui-sticky-toolbar' };
};
