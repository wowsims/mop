// For a plain selector read, prefer zustand's own `useStore(sim.store, selector)`.
import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { StoreSubscribe } from '../state/subscriptions';

/**
 * Returning a new object from `getSnapshot` on every render is what React reports as "The result of getSnapshot should be cached to avoid an infinite loop", and most model getters here do exactly that.
 *
 * The cache is the contract: `read` runs again only on a store notification or a new `subscribe` identity, never
 * because a render brought a new closure. A `read` over props or state therefore keeps answering from the render that
 * filled the cache — a value the caller already holds belongs in a controlled `InputConfig`, or, for a plain value
 * keyed by a prop, in zustand's own `useStore(sim.store, selector)`, which re-reads every render.
 */
export const useStoreSubscribe = <T>(subscribe: StoreSubscribe, read: () => T): T => {
	// Held in a ref so only `subscribe` decides when React re-subscribes.
	const readRef = useRef(read);
	readRef.current = read;

	const snapshot = useRef<{ value: T } | null>(null);
	const stale = useRef(true);

	const subscribeFn = useCallback(
		(onStoreChange: () => void) => {
			// A different source: whatever was read from the old one no longer describes this one.
			stale.current = true;
			return subscribe(() => {
				stale.current = true;
				onStoreChange();
			});
		},
		[subscribe],
	);

	const getSnapshot = useCallback(() => {
		if (stale.current || !snapshot.current) {
			snapshot.current = { value: readRef.current() };
			stale.current = false;
		}
		return snapshot.current.value;
	}, []);

	return useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);
};
