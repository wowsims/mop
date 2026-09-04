// React bindings for the sim store.
//
// For a plain selector read, prefer zustand's own `useStore(sim.store, selector)` — it is the path
// ui/domain/state/README.md names and needs nothing from this file. `useStoreSubscribe` exists for
// the many places that already hold a `StoreSubscribe` (the helpers in state/subscriptions.ts,
// including `subscribeAll`'s folded tuple selector) and want to bind it to a component.
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Binds a `StoreSubscribe` source to a component and re-renders when it fires.
 *
 * `read` MUST return a value that is stable while the underlying state is unchanged — a primitive,
 * or a reference the model already holds. Returning a freshly built object or array on every call
 * makes React see a new snapshot each render and loop forever.
 */
export function useStoreSubscribe<T>(subscribe: StoreSubscribe, read: () => T): T {
	// `read` is usually an inline arrow, so its identity changes every render. Keeping it in a ref
	// means only `subscribe` decides when React re-subscribes.
	const readRef = useRef(read);
	readRef.current = read;

	const subscribeFn = useCallback((onStoreChange: () => void) => subscribe(onStoreChange), [subscribe]);
	const getSnapshot = useCallback(() => readRef.current(), []);

	return useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);
}
