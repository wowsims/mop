export abstract class Disposable {
	private disposeCallbacks: Array<() => void> = [];
	private disposed = false;
	// Children disposed together with this one (explicit registration via
	// addChild; parentElem is a raw element so it cannot be inferred).
	private readonly children: Array<Disposable> = [];

	addOnDisposeCallback(callback: () => void) {
		if (this.disposed) {
			callback();
			return;
		}
		this.disposeCallbacks.push(callback);
	}

	addChild<C extends Disposable>(child: C): C {
		if (this.disposed) {
			child.dispose();
			return child;
		}
		this.children.push(child);
		return child;
	}

	// Disposes a registered child ahead of this one's own disposal.
	disposeChild(child: Disposable) {
		const idx = this.children.indexOf(child);
		if (idx >= 0) this.children.splice(idx, 1);
		child.dispose();
	}

	protected get isDisposed(): boolean {
		return this.disposed;
	}

	dispose() {
		if (this.disposed) {
			return;
		}
		this.disposed = true;

		this.children.splice(0).forEach(child => child.dispose());
		this.disposeCallbacks.forEach(callback => callback());
		this.disposeCallbacks = [];
	}
}
