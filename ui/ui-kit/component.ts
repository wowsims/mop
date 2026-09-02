export abstract class Component {
	protected customRootElement?(): HTMLElement;

	private disposeCallbacks: Array<() => void> = [];
	private disposed = false;
	// Child components disposed together with this one (explicit registration
	// via addChild; parentElem is a raw element so it cannot be inferred).
	private readonly children: Array<Component> = [];

	readonly rootElem: HTMLElement;

	constructor(parentElem: HTMLElement | DocumentFragment | null, rootCssClass?: string, rootElem?: HTMLElement) {
		this.rootElem = rootElem || this.customRootElement?.() || document.createElement('div');
		if (rootCssClass) this.rootElem.classList.add(rootCssClass);
		if (parentElem) {
			parentElem.appendChild(this.rootElem);
		}
	}

	addOnDisposeCallback(callback: () => void) {
		this.disposeCallbacks.push(callback);
	}

	addChild<C extends Component>(child: C): C {
		this.children.push(child);
		return child;
	}

	// Disposes a registered child ahead of this component's own disposal.
	disposeChild(child: Component) {
		const idx = this.children.indexOf(child);
		if (idx >= 0) this.children.splice(idx, 1);
		child.dispose();
	}

	// Disposes a registered child and removes its root element from the DOM.
	removeChild(child: Component) {
		this.disposeChild(child);
		child.rootElem.remove();
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
