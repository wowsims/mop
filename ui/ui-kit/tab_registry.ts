// The set of top-level sim tabs, and which one is open. React reads it through
// useSyncExternalStore; see app/sim_tabs.tsx.

export interface SimTabEntry {
	/** Also the pane element's DOM id, and the class the header list item carries. */
	id: string;
	title: string;
	navItem: HTMLElement;
	navLink: HTMLElement;
	pane: HTMLElement;
}

export class SimTabRegistry {
	private entries: ReadonlyArray<SimTabEntry> = [];
	private activeId: string | null = null;
	private readonly listeners = new Set<() => void>();

	constructor(
		private readonly strip: HTMLElement,
		private readonly panes: HTMLElement,
	) {}

	// Bound for useSyncExternalStore.
	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getEntries = (): ReadonlyArray<SimTabEntry> => this.entries;
	readonly getActiveId = (): string | null => this.activeId;

	/**
	 * Records the tab and puts its elements in the page. Attaching here rather than from React is
	 * required: a tab builds its contents in its constructor and some of that reads the live
	 * document (`DetailedResults` looks up `.dr-toolbar`). Attach order is display order, and the
	 * first tab attached is the one open on load.
	 */
	attach(entry: SimTabEntry) {
		this.entries = [...this.entries, entry];
		if (this.activeId === null) this.activeId = entry.id;
		this.strip.appendChild(entry.navItem);
		this.panes.appendChild(entry.pane);
		this.emit();
	}

	activate(id: string) {
		if (id === this.activeId || !this.entries.some(entry => entry.id === id)) return;
		this.activeId = id;
		this.emit();
	}

	private emit() {
		this.listeners.forEach(listener => listener());
	}
}
