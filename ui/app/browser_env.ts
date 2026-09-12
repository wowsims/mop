// The browser implementation of the domain's `Env` adapter (domain/state/env.ts).
// Every access is lazy so importing this module never touches a global.
import type { Env } from '@sim/state/env';
import { notifyStorageWrite } from '@ui-kit/hooks/useTypedLocalStorage';

// The model layer writes through here, so announcing each write is what lets a React reader of the
// same key see it. Without this the two doors into localStorage keep separate views of it.
const notifyingStorage: Env['storage'] = {
	getItem: key => window.localStorage.getItem(key),
	setItem: (key, value) => {
		window.localStorage.setItem(key, value);
		notifyStorageWrite(key);
	},
	removeItem: key => {
		window.localStorage.removeItem(key);
		notifyStorageWrite(key);
	},
};

export const browserEnv: Env = {
	get storage() {
		return notifyingStorage;
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
