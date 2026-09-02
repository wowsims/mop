// Minimal event emitter for things that *happen* (not state): no EventIDs, no
// freezing. State change notification belongs to the store; this is only for
// genuine events (sim results, crashes, UI-local signals).
export class Emitter<T = void> {
	private listeners: Array<(value: T) => void> = [];

	// Arrow property so `emitter.on` can be passed around unbound (e.g. as a
	// picker's storeSubscribe source).
	readonly on = (listener: (value: T) => void): (() => void) => {
		this.listeners.push(listener);
		return () => this.off(listener);
	};

	private off(listener: (value: T) => void) {
		const idx = this.listeners.indexOf(listener);
		if (idx != -1) this.listeners.splice(idx, 1);
	}

	emit(value: T) {
		this.listeners.slice().forEach(listener => listener(value));
	}
}
