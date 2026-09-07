import { type RefObject, useEffect, useRef } from 'react';

export type WowheadDatasetTarget = RefObject<HTMLElement | null>;

/** Clears `data-wowhead` on every target, then writes what `resolve` produces — `null` for a target with nothing to show, and a resolution that lost the race to a newer `resolve` is dropped. `resolve` is the effect's only dependency, so its identity is what says the target changed. */
export const useWowheadDataset = (target: WowheadDatasetTarget | Array<WowheadDatasetTarget>, resolve: (() => Promise<string>) | null) => {
	const targetRef = useRef(target);
	targetRef.current = target;

	useEffect(() => {
		const current = targetRef.current;
		const elements = (Array.isArray(current) ? current : [current]).map(ref => ref.current).filter((element): element is HTMLElement => !!element);
		elements.forEach(element => element.removeAttribute('data-wowhead'));
		if (!resolve) return;

		let live = true;
		resolve().then(url => {
			if (!live) return;
			elements.forEach(element => (element.dataset.wowhead = url));
		});
		return () => {
			live = false;
		};
	}, [resolve]);
};
