// The browser implementation of the domain's `Env` adapter (domain/state/env.ts).
// Every access is lazy so importing this module never touches a global.
import type { Env } from '@domain/state/env';

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
		get href() {
			return window.location.href;
		},
		get hostname() {
			return window.location.hostname;
		},
		setHash(hash: string) {
			window.location.hash = hash;
		},
	},
	get hardwareConcurrency() {
		return navigator.hardwareConcurrency;
	},
	onPageHide(fn: () => void) {
		window.addEventListener('pagehide', fn);
		return () => window.removeEventListener('pagehide', fn);
	},
};
