import { useEffect, useRef, useState } from 'react';

/**
 * A bar pinned against the viewport's last pixel: it reports `stuck` once it no longer fits whole
 * against that edge.
 *
 * The 0 threshold is load-bearing. A bar built inside a hidden tab goes 0 -> pinned without ever
 * passing through 1, so a [1]-only observer is never called again after that first hidden callback.
 * The **last** entry of a delivery is the current state: one delivery can carry several records,
 * oldest first, and a list growing under an already-pinned bar produces exactly that pair —
 * reading the first left the log pane unpinned on four of six specs, at random.
 */
export const useStickyViewportBottom = <T extends HTMLElement>() => {
	const ref = useRef<T>(null);
	const [stuck, setStuck] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new IntersectionObserver(entries => setStuck(element.clientHeight > 0 && entries[entries.length - 1].intersectionRatio < 1), {
			rootMargin: '0px 0px -1px 0px',
			threshold: [0, 1],
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return { ref, stuck };
};
