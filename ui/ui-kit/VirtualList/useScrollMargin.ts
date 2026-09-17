import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

const contentTop = (scroller: HTMLElement | Window | null) =>
	scroller instanceof HTMLElement ? scroller.getBoundingClientRect().top - scroller.scrollTop : -window.scrollY;

export const useScrollMargin = (list: RefObject<HTMLElement | null>, scroller: HTMLElement | Window | null, watch?: HTMLElement | null): number => {
	const [scrollMargin, setScrollMargin] = useState(0);

	useEffect(() => {
		const element = list.current;
		if (!element) return;

		const measure = () => {
			if (element.offsetParent === null) return;
			setScrollMargin(element.getBoundingClientRect().top - contentTop(scroller));
		};

		let frame: number | null = null;
		const observer = new ResizeObserver(() => {
			if (frame !== null) return;
			frame = requestAnimationFrame(() => {
				frame = null;
				measure();
			});
		});
		observer.observe(element);
		if (watch) observer.observe(watch);
		measure();

		return () => {
			observer.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [list, scroller, watch]);

	return scrollMargin;
};
