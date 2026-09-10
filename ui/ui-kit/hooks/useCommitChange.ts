import { type RefObject, useEffect, useEffectEvent } from 'react';

// Native `change` fires when an edit is committed, on blur or Enter; React's onChange fires on every keystroke.
export const useCommitChange = (ref: RefObject<HTMLInputElement | null>, onCommit: (input: HTMLInputElement) => void) => {
	const commit = useEffectEvent(onCommit);
	useEffect(() => {
		const input = ref.current;
		if (!input) return;
		const onChange = () => commit(input);
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	}, [ref]);
};
