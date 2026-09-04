export class VisibilityState {
	private readonly keys = new Set<string>();
	private readonly listeners: Array<() => void> = [];

	get hidden(): ReadonlySet<string> {
		return this.keys;
	}

	get size(): number {
		return this.keys.size;
	}

	isHidden(key: string): boolean {
		return this.keys.has(key);
	}

	set(key: string, hidden: boolean) {
		this.setMany([key], hidden);
	}

	setMany(keys: ReadonlyArray<string>, hidden: boolean) {
		let changed = false;
		for (const key of keys) {
			if (hidden) {
				if (!this.keys.has(key)) {
					this.keys.add(key);
					changed = true;
				}
			} else if (this.keys.delete(key)) {
				changed = true;
			}
		}
		if (changed) this.notify();
	}

	showAll() {
		if (!this.keys.size) return;
		this.keys.clear();
		this.notify();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index >= 0) this.listeners.splice(index, 1);
		};
	}

	private notify() {
		for (const listener of this.listeners.slice()) listener();
	}
}
