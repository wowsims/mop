import { createContext, useContext, useEffect, useRef, useState } from 'react';

/** The header a `useStickyToolbar` bar sticks below. Null until the shell has laid its own out. */
export const StickyHeaderContext = createContext<HTMLElement | null>(null);

export const STICKY_TOOLBAR_CLASSES =
	"sticky top-sim-header -mx-page w-[calc(100%+var(--spacing-page)*2)] flex px-page z-toolbar transition-colors duration-150 ease-in-out after:content-['_'] after:absolute after:-bottom-px after:inset-x-0 after:w-[calc(100%-2*var(--spacing-page))] after:h-px after:mx-auto after:bg-border after:transition-[width] after:duration-150 after:ease-in-out data-[stuck]:bg-sim-backdrop data-[stuck]:after:w-full";

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

	useEffect(() => {
		const element = ref.current;
		if (!element || !header) return;
		// One delivery can carry several records, oldest first, so the last is the current state — reading `[entry]` leaves the bar stuck on a stale ratio.
		const observer = new IntersectionObserver(entries => setStuck(element.clientHeight > 0 && entries[entries.length - 1].intersectionRatio < 1), {
			rootMargin: `-${header.offsetHeight + 1}px 0px 0px 0px`,
			threshold: [1],
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [header]);

	return { ref, stuck };
};
