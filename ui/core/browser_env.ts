// The browser implementation of the state layer's `Env` adapter (state/env.ts).
// Every access is lazy so importing this module never touches a global.
import type { Env } from './state/env';

export const browserEnv: Env = {
	get storage() {
		return window.localStorage;
	},
	location: {
		get hash() {
			return window.location.hash;
		},
		get search() {
			return window.location.search;
		},
		setHash(hash: string) {
			window.location.hash = hash;
		},
	},
	onPageHide(fn: () => void) {
		window.addEventListener('pagehide', fn);
		return () => window.removeEventListener('pagehide', fn);
	},
};
