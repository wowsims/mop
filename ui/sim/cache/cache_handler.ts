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
		const value = this.data.get(id);
		if (this.keysToKeep && value !== undefined) {
			this.data.delete(id);
			this.data.set(id, value);
		}
		return value;
	}

	delete(id: string): boolean {
		return this.data.delete(id);
	}

	set(id: string, result: T) {
		this.data.set(id, result);
		if (this.keysToKeep) this.keepMostRecent();
	}

	private keepMostRecent() {
		if (!this.keysToKeep) return;
		while (this.data.size > this.keysToKeep) {
			const oldest = this.data.keys().next();
			if (oldest.done) return;
			this.data.delete(oldest.value);
		}
	}
}
