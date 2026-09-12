import type { MouseEvent, ReactNode } from 'react';

interface SidebarEntryBase {
	id: string;
	// Entries sort by `order` and the sort is stable, so entries that leave it unset keep the
	// sequence they were registered in — which is the order the sidebar was appended in before.
	order?: number;
}

export interface SidebarButtonEntry extends SidebarEntryBase {
	label: ReactNode;
	className?: string;
	onClick: (event: MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	loading?: boolean;
}

export interface SidebarCustomEntry extends SidebarEntryBase {
	render: () => ReactNode;
}

export type SidebarEntry = SidebarButtonEntry | SidebarCustomEntry;

export type SidebarButtonState = Pick<SidebarButtonEntry, 'disabled' | 'loading'>;

export interface SidebarEntryHandle {
	update: (state: SidebarButtonState) => void;
}

export const isCustomEntry = (entry: SidebarEntry): entry is SidebarCustomEntry => 'render' in entry;

export class SidebarRegistry {
	private entries: ReadonlyArray<SidebarEntry> = [];
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getEntries = (): ReadonlyArray<SidebarEntry> => this.entries;

	add(entry: SidebarEntry): SidebarEntryHandle {
		this.entries = [...this.entries, entry].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		this.emit();
		return { update: state => this.update(entry.id, state) };
	}

	private update(id: string, state: SidebarButtonState) {
		this.entries = this.entries.map(entry => (entry.id === id ? { ...entry, ...state } : entry));
		this.emit();
	}

	private emit() {
		this.listeners.forEach(listener => listener());
	}
}
