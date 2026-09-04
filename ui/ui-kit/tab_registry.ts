// The set of top-level sim tabs, and which one is open.
//
// Tabs used to append themselves straight into the header's `.sim-tabs` list and the sim's
// `.sim-main` pane container, and Bootstrap's tab plugin drove activation off `data-bs-toggle`.
// Now they attach here instead, and React reads this registry to decide the order and active state
// of both containers.
//
// The elements themselves are still built imperatively by SimTab and SimUI.addTab, which is why
// this holds elements rather than descriptions of them. When those components become React in a
// later phase, the entries become props, `attach` goes away and this can hold plain data.

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

	/**
	 * The containers are needed at attach time, not at render, because a tab builds its contents in
	 * its constructor and parts of that content read the live document — `DetailedResults` looks up
	 * `.dr-toolbar` through `document`, for one. Putting the pane in the page as the tab is created
	 * preserves the invariant those call sites were written against. React still decides order and
	 * which tab is open; it simply does not decide membership.
	 */
	constructor(
		private readonly strip: HTMLElement,
		private readonly panes: HTMLElement,
	) {}

	// Bound so they can be handed straight to useSyncExternalStore.
	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	// Identity is stable between attachments, which is what useSyncExternalStore requires.
	readonly getEntries = (): ReadonlyArray<SimTabEntry> => this.entries;
	readonly getActiveId = (): string | null => this.activeId;

	/**
	 * Records the tab *and* puts its two elements in the page — hence `attach` rather than
	 * `register`: the side effect is the point, not an implementation detail.
	 *
	 * Attach order is display order, and the first tab attached is the one open on load — the same
	 * rule the old code expressed as "am I being appended into an empty container?".
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
