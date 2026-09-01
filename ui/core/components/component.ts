export abstract class Component {
	protected customRootElement?(): HTMLElement;

	private disposeCallbacks: Array<() => void> = [];
	private disposed = false;
	// Child components disposed together with this one (cascade before own callbacks).
	protected readonly children: Array<Component> = [];

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
