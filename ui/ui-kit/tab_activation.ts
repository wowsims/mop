// Which sim tab is open. The tabs themselves are a render tree (`app/SimTabsSection`); this is only
// the seam an imperative caller reaches through, so an unknown id is resolved by the view.
export class SimTabActivation {
	private activeId: string | null = null;
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getActiveId = (): string | null => this.activeId;

	activate(id: string) {
		if (id === this.activeId) return;
		this.activeId = id;
		this.listeners.forEach(listener => listener());
	}
}
