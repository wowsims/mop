export type CacheHandlerOptions = {
	keysToKeep?: number;
};

export class CacheHandler<T> {
	keysToKeep: CacheHandlerOptions['keysToKeep'];
	private data = new Map<string, T>();

	constructor(options: CacheHandlerOptions = {}) {
		this.keysToKeep = options.keysToKeep;
	}

	has(id: string): boolean {
		return this.data.has(id);
	}

	get(id: string): T | undefined {
		return this.data.get(id);
	}

	delete(id: string): boolean {
		return this.data.delete(id);
	}

	set(id: string, result: T) {
		this.data.set(id, result);
		if (this.keysToKeep) this.keepMostRecent();
	}

	// Map iterates in insertion order, so the oldest key is simply the first one. Building
	// the full key array here cost an allocation on every set once the cap was reached.
	// Note this is insertion-order eviction, not LRU: get() does not refresh recency.
	private keepMostRecent() {
		if (!this.keysToKeep) return;
		while (this.data.size > this.keysToKeep) {
			const oldest = this.data.keys().next();
			if (oldest.done) return;
			this.data.delete(oldest.value);
		}
	}
}
