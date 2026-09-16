// For a plain selector read, prefer zustand's own `useStore(sim.store, selector)`.
import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { StoreSubscribe } from '../state/subscriptions';

/**
 * Returning a new object from `getSnapshot` on every render is what React reports as "The result of getSnapshot should be cached to avoid an infinite loop", and most model getters here do exactly that.
 *
 * The cache is the contract: `read` runs again only on a store notification or a new `subscribe` identity, never
 * because a render brought a new closure. So `read` may only touch live model state. Anything it captures that the
 * store does not carry — a prop, a piece of component state — is answered **one notification late, permanently**:
 * React calls `getSnapshot` synchronously inside the notification, before re-rendering, so the value it caches was
 * computed with the previous render's closure, and that is what the render then returns. Holding `read` in a second
 * ref does not help; this hook already refreshes `readRef` every render, and a ref changes what the read does when it
 * is invoked, not when it is invoked.
 *
 * Two shapes are safe by construction: read only live model state and let a captured value be inert, as `useInput`
 * does with its `configRef`; or, for a value keyed by a prop, use zustand's own `useStore(sim.store, selector)` and
 * derive in the render body, which re-reads every render.
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
