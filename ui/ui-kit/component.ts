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

export abstract class Component extends Disposable {
	protected customRootElement?(): HTMLElement;

	readonly rootElem: HTMLElement;

	constructor(parentElem: HTMLElement | DocumentFragment | null, rootCssClass?: string, rootElem?: HTMLElement) {
		super();
		this.rootElem = rootElem || this.customRootElement?.() || document.createElement('div');
		if (rootCssClass) this.rootElem.classList.add(rootCssClass);
		if (parentElem) {
			parentElem.appendChild(this.rootElem);
		}
	}

	// Disposes a registered child and removes its root element from the DOM.
	removeChild(child: Component) {
		this.disposeChild(child);
		child.rootElem.remove();
	}
}
