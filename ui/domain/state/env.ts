// The browser surface the domain layer is allowed to touch, as an injected
// adapter instead of ambient globals. `ui/domain/**` is lint-banned from
// `window` / `document` / `localStorage` / `location` / `navigator`; anything
// here that needs one of those takes an `Env` (reachable from any facade as
// `sim.env`). The browser implementation lives in `ui/app/browser_env.ts`,
// test harnesses pass an in-memory one.
export interface Env {
	// Persistent key/value store (browser: window.localStorage).
	storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

	// The page location: the settings link lives in the hash, the exported
	// category list in the query string.
	location: {
		readonly hash: string;
		readonly search: string;
		// Absolute URL of the page, used as the base when resolving a stored
		// (possibly relative) settings link.
		readonly href: string;
		// Host name of the page; 'localhost' means the local Go server.
		readonly hostname: string;
		setHash(hash: string): void;
	};

	// Logical cores the platform reports (browser: navigator.hardwareConcurrency).
	readonly hardwareConcurrency: number;

	// Registers a "page is going away" callback; returns an unsubscribe.
	onPageHide(fn: () => void): () => void;
}
