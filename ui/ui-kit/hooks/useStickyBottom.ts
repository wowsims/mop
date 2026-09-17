import { useEffect, useRef, useState } from 'react';

export const useStickyBottom = <T extends HTMLElement>() => {
	const ref = useRef<T>(null);
	const [stuck, setStuck] = useState(false);

	useEffect(() => {
		const element = ref.current;
		const scrollRoot = element?.parentElement;
		if (!element || !scrollRoot) return;
		const observer = new IntersectionObserver(entries => setStuck(!entries[entries.length - 1].isIntersecting), {
			root: scrollRoot,
			rootMargin: '-100% 0px 0px 0px',
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return { ref, stuck };
};
