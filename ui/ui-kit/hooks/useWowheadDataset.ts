import { useEffect, useMemo, useState } from 'react';

export interface WowheadDatasetProps {
	'data-wowhead'?: string;
}

/** Resolves one Wowhead tooltip query and returns it as props to spread onto the anchor it describes. `null` is a subject with nothing to show, and `resolve`'s identity is what says the subject changed. */
export const useWowheadDataset = (resolve: (() => Promise<string>) | null): WowheadDatasetProps => {
	const [resolved, setResolved] = useState<{ resolve: typeof resolve; url?: string }>({ resolve });

	if (resolved.resolve !== resolve) setResolved({ resolve });

	useEffect(() => {
		if (!resolve) return;
		resolve().then(url => setResolved(current => (current.resolve === resolve ? { resolve, url } : current)));
	}, [resolve]);

	return useMemo(() => ({ 'data-wowhead': resolved.resolve === resolve ? resolved.url : undefined }), [resolve, resolved]);
};
