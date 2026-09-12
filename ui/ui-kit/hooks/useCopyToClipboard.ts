import { useCallback, useEffect, useRef, useState } from 'react';

const COPIED_DURATION_MS = 1500;

export interface CopyToClipboard {
	copy: () => void;
	copied: boolean;
}

/** `getContent` is read at click time: one caller lazily re-exports and fires analytics inside it, so a value captured at mount would export stale data. The re-entrancy guard is a ref rather than `copied`, because state has not flushed when a second click lands in the same task. */
export const useCopyToClipboard = (getContent: () => string): CopyToClipboard => {
	const getContentRef = useRef(getContent);
	getContentRef.current = getContent;

	const [copied, setCopied] = useState(false);
	const clickedRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const copy = useCallback(() => {
		if (clickedRef.current) return;

		clickedRef.current = true;
		navigator.clipboard.writeText(getContentRef.current()).catch(console.error);
		setCopied(true);
		timerRef.current = setTimeout(() => {
			clickedRef.current = false;
			setCopied(false);
		}, COPIED_DURATION_MS);
	}, []);

	return { copy, copied };
};
