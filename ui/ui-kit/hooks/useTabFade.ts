import { useEffect, useRef, useState } from 'react';

/**
 * Which pane carries `show`, which is `null` for the one frame between `active` and it.
 *
 * Bootstrap's tab plugin set `active` first and `show` a frame later when switching, so its `.15s`
 * `.fade` transition ran; on the first render it set both at once. The gap resolves to `null` rather
 * than to the outgoing pane, so a caller writes `shownId === id` and cannot leave the pane it is
 * leaving wearing `show` without `active`.
 */
export const useTabFade = (activeId: string): string | null => {
	const [shownId, setShownId] = useState(activeId);
	const lastShown = useRef<string | null>(null);

	useEffect(() => {
		const isSwitch = lastShown.current !== null && lastShown.current !== activeId;
		lastShown.current = activeId;
		if (!isSwitch) {
			setShownId(activeId);
			return;
		}
		const frame = requestAnimationFrame(() => setShownId(activeId));
		return () => cancelAnimationFrame(frame);
	}, [activeId]);

	return shownId === activeId ? shownId : null;
};
