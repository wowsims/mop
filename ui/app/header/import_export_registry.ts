import type { Exporter } from '@features/import-export/view/exporter';
import type { ComponentType } from 'react';

export enum ImportExportKind {
	Import = 'import',
	Export = 'export',
}

export interface ImportExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export interface ImportExportEntry {
	label: string;
	isUnsupported: boolean;
	open?: () => void;
	Dialog?: ComponentType<ImportExportDialogProps>;
}

export class ImportExportRegistry {
	private entries: Record<ImportExportKind, ReadonlyArray<ImportExportEntry>> = { [ImportExportKind.Import]: [], [ImportExportKind.Export]: [] };
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getEntries = (kind: ImportExportKind): ReadonlyArray<ImportExportEntry> => this.entries[kind];

	add(kind: ImportExportKind, label: string, exporter: Exporter, isUnsupported: boolean) {
		this.push(kind, { label, isUnsupported, open: () => exporter.open() });
	}

	addDialog(kind: ImportExportKind, label: string, Dialog: ComponentType<ImportExportDialogProps>, isUnsupported = false) {
		this.push(kind, { label, isUnsupported, Dialog });
	}

	private push(kind: ImportExportKind, entry: ImportExportEntry) {
		this.entries = { ...this.entries, [kind]: [...this.entries[kind], entry] };
		for (const listener of this.listeners) listener();
	}
}
