import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

export type LocalStorageParser<T> = (value: unknown) => T | undefined;

/**
 * The raw string per key, shared by every hook instance. `useSyncExternalStore` needs a snapshot that
 * is stable between notifications and a string is; parsing sits above it, keyed on that string.
 */
const raw = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();

const readKey = (key: string): string | null => {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const refresh = (key: string) => {
	const next = readKey(key);
	if (raw.has(key) && raw.get(key) === next) return;
	raw.set(key, next);
	listeners.get(key)?.forEach(notify => notify());
};

/**
 * The other door into the same storage: `Env.storage` writes from the model layer (the settings
 * envelope, stat weights, bulk settings) land here too, so a React reader of that key sees them.
 * `ui/app/browser_env.ts` is what routes them through.
 */
export const notifyStorageWrite = (key: string) => refresh(key);

let watching = false;
const watchOtherTabs = () => {
	if (watching || typeof window === 'undefined') return;
	watching = true;
	// Only fires for writes made by other tabs; `key` is null when one of them called `clear()`.
	window.addEventListener('storage', event => {
		if (event.key === null) [...listeners.keys()].forEach(refresh);
		else if (listeners.has(event.key)) refresh(event.key);
	});
};

const subscribeTo = (key: string) => (notify: () => void) => {
	watchOtherTabs();
	const forKey = listeners.get(key) ?? new Set<() => void>();
	listeners.set(key, forKey);
	forKey.add(notify);
	// A key nothing was watching may have been written since it was last read.
	refresh(key);
	return () => {
		forKey.delete(notify);
		if (!forKey.size) listeners.delete(key);
	};
};

// While nobody is subscribed nothing is keeping the cache honest — storage can move underneath it — so
// the cached string is only trusted once a listener exists to refresh it.
const snapshotOf = (key: string) => () => {
	if (!listeners.has(key) || !raw.has(key)) raw.set(key, readKey(key));
	return raw.get(key) ?? null;
};

/** `initialValue` is returned when the key is absent; it is never written. */
export const useTypedLocalStorage = <T>(key: string, parse: LocalStorageParser<T>, initialValue?: T): [T | undefined, (value: T) => void, () => void] => {
	const parseRef = useRef(parse);
	parseRef.current = parse;
	const initialRef = useRef(initialValue);
	initialRef.current = initialValue;

	const subscribe = useMemo(() => subscribeTo(key), [key]);
	const snapshot = useMemo(() => snapshotOf(key), [key]);
	const stored = useSyncExternalStore(subscribe, snapshot, snapshot);

	const value = useMemo(() => {
		if (stored === null) return initialRef.current;
		try {
			return parseRef.current(JSON.parse(stored));
		} catch {
			return undefined;
		}
	}, [stored]);

	// Both writes refresh unconditionally: when storage is blocked nothing was written, and re-reading
	// is what leaves every reader on the old value rather than on a value only this tab believes in.
	const set = useCallback(
		(next: T) => {
			try {
				window.localStorage.setItem(key, JSON.stringify(next));
			} catch {}
			refresh(key);
		},
		[key],
	);

	const remove = useCallback(() => {
		try {
			window.localStorage.removeItem(key);
		} catch {}
		refresh(key);
	}, [key]);

	return [value, set, remove];
};
