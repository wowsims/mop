// In-memory implementation of the domain's Env adapter (ui/domain/state/env.ts)
// for the snapshot / contract harnesses: no window, no localStorage, no page.
import type { Env } from '../../ui/domain/state/env';

export interface MemoryEnv extends Env {
	// The backing map, so tests can assert what was written.
	readonly items: Map<string, string>;
}

export function makeMemoryEnv(opts: { hash?: string; search?: string; href?: string; hostname?: string } = {}): MemoryEnv {
	const items = new Map<string, string>();
	let hash = opts.hash ?? '';
	return {
		items,
		storage: {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => void items.set(key, value),
			removeItem: (key: string) => void items.delete(key),
		},
		location: {
			get hash() {
				return hash;
			},
			get search() {
				return opts.search ?? '';
			},
			get href() {
				return opts.href ?? 'https://wowsims.github.io/mop/';
			},
			get hostname() {
				return opts.hostname ?? 'wowsims.github.io';
			},
			setHash(next: string) {
				hash = next;
			},
		},
		// The harness is single-threaded; no wasm worker concurrency.
		hardwareConcurrency: 1,
		onPageHide: () => () => {},
	};
}
