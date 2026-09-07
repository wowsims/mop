import { useCallback, useEffect, useRef, useState } from 'react';
import { useCopyToClipboard as useClipboard } from 'react-use';

const COPIED_DURATION_MS = 1500;

export interface CopyToClipboard {
	copy: () => void;
	copied: boolean;
}

/** Adds the vanilla `CopyButton`'s 1.5s copied window to `react-use`'s clipboard write, and nothing else. `getContent` is read at click time. The re-entrancy guard is a ref rather than `copied`, so two clicks in one task cannot copy twice. */
export const useCopyToClipboard = (getContent: () => string): CopyToClipboard => {
	const getContentRef = useRef(getContent);
	getContentRef.current = getContent;

	const [, copyToClipboard] = useClipboard();
	const [copied, setCopied] = useState(false);
	const clickedRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const copy = useCallback(() => {
		if (clickedRef.current) return;

		clickedRef.current = true;
		copyToClipboard(getContentRef.current());
		setCopied(true);
		timerRef.current = setTimeout(() => {
			clickedRef.current = false;
			setCopied(false);
		}, COPIED_DURATION_MS);
	}, [copyToClipboard]);

	return { copy, copied };
};
