import { useMemo } from 'react';

import type { StoreSubscribe } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

const NEVER: StoreSubscribe = () => () => {};

/**
 * `useStoreSubscribe` for a snapshot that cannot run before the sim is initialised — anything
 * reaching `sim.db`, which is null until then.
 *
 * Gating the read alone is not enough, and that is the whole reason this exists.
 * `useSyncExternalStore` calls `getSnapshot` on the **first render**, long before a `useSimReady`
 * gate turns true, and `useStoreSubscribe` then caches whatever it got until the *subscription*
 * changes. So the read is gated and `ready` is folded into the subscription's identity, which is
 * what makes the cached `null` get dropped the moment the database lands.
 */
export const useReadyStoreSubscribe = <T>(subscribe: StoreSubscribe, read: () => T, ready: boolean): T | null => {
	const gated = useMemo(() => (ready ? subscribe : NEVER), [subscribe, ready]);
	return useStoreSubscribe<T | null>(gated, () => (ready ? read() : null));
};
