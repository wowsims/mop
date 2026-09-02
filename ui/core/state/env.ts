// The browser surface the state layer is allowed to touch, as an injected
// adapter instead of ambient globals. `ui/core/state/**` is lint-banned from
// `window` / `document` / `localStorage` / `location` / `navigator`; anything
// here that needs one of those takes an `Env` (reachable from any facade as
// `sim.env`). The browser implementation lives in `ui/core/browser_env.ts`,
// test harnesses pass an in-memory one.
export interface Env {
	// Persistent key/value store (browser: window.localStorage).
	storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

	// The page location: the settings link lives in the hash, the exported
	// category list in the query string.
	location: {
		readonly hash: string;
		readonly search: string;
		setHash(hash: string): void;
	};

	// Registers a "page is going away" callback; returns an unsubscribe.
	onPageHide(fn: () => void): () => void;
}
