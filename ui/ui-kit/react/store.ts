// For a plain selector read, prefer zustand's own `useStore(sim.store, selector)`.
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Binds a `StoreSubscribe` source to a component.
 *
 * `read` runs once per notification and its result is held in between, so a getter that builds a
 * fresh value each call — `getTargets().slice()`, `getGear().asSpec()` — is safe. Returning a new
 * object from `getSnapshot` on every render is what React reports as "The result of getSnapshot
 * should be cached to avoid an infinite loop", and most model getters here do exactly that.
 */
export function useStoreSubscribe<T>(subscribe: StoreSubscribe, read: () => T): T {
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
}
