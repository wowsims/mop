// For a plain selector read, prefer zustand's own `useStore(sim.store, selector)`.
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Binds a `StoreSubscribe` source to a component. `read` must return a value that is stable while
 * the state is unchanged — a fresh object or array every call renders forever.
 */
export function useStoreSubscribe<T>(subscribe: StoreSubscribe, read: () => T): T {
	// Held in a ref so only `subscribe` decides when React re-subscribes.
	const readRef = useRef(read);
	readRef.current = read;

	const subscribeFn = useCallback((onStoreChange: () => void) => subscribe(onStoreChange), [subscribe]);
	const getSnapshot = useCallback(() => readRef.current(), []);

	return useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);
}
