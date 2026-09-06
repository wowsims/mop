export interface SimTabEntry {
	id: string;
	title: string;
	badge?: string;
	pane: HTMLElement;
	ariaControlsOnItem?: boolean;
}

export class SimTabRegistry {
	private entries: ReadonlyArray<SimTabEntry> = [];
	private activeId: string | null = null;
	private readonly listeners = new Set<() => void>();

	constructor(private readonly panes: HTMLElement) {}

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getEntries = (): ReadonlyArray<SimTabEntry> => this.entries;
	readonly getActiveId = (): string | null => this.activeId;

	attach(entry: SimTabEntry) {
		this.entries = [...this.entries, entry];
		if (this.activeId === null) this.activeId = entry.id;
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
