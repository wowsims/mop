import { useSimHost } from '@domain/context/SimHostContext';
import { useSyncExternalStore } from 'react';

import type { SimResultData } from '../model/result_data';

/** The last completed sim run, or null before the first one. Replays for a component that mounts after it. */
export const useSimResult = (): SimResultData | null => {
	const { resultChannel } = useSimHost();
	return useSyncExternalStore(resultChannel.subscribe, resultChannel.getSnapshot);
};
