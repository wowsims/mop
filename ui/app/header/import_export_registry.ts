import type { Exporter } from '@features/import-export/view/exporter';
import type { Importer } from '@features/import-export/view/importer';
import type { ComponentType } from 'react';

export type ImportExportKind = 'import' | 'export';

/** What the menu hands a React dialog. Nothing else about it is the menu's business. */
export interface ImportExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export interface ImportExportEntry {
	label: string;
	/** Rendered greyed out with a "Currently unsupported" tooltip instead of opening anything. */
	isUnsupported: boolean;
	/**
	 * A vanilla importer or exporter: it owns a Bootstrap modal and shows it itself. Exactly one of
	 * this and `Dialog` is set.
	 */
	open?: () => void;
	/**
	 * A React dialog. It has no `open()` — it has state — so the menu renders it and owns which one
	 * is open, the same way it owns whether the menu itself is.
	 */
	Dialog?: ComponentType<ImportExportDialogProps>;
}

/**
 * The two header menus' contents, as data.
 *
 * They cannot be props: `IndividualSimUI` registers them from `addTopbarComponents()`, which runs in
 * a `waitForInit` callback — long after the shell has rendered. So React subscribes, the same way
 * `SimTabRegistry` solves the same problem for the tab strip.
 *
 * Entries are only ever appended, which is why there is no removal path.
 */
export class ImportExportRegistry {
	private entries: Record<ImportExportKind, ReadonlyArray<ImportExportEntry>> = { import: [], export: [] };
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getEntries = (kind: ImportExportKind): ReadonlyArray<ImportExportEntry> => this.entries[kind];

	/** A vanilla importer or exporter. Both expose `open()`; nothing here needs to know which it has. */
	add(kind: ImportExportKind, label: string, importerExporter: Importer | Exporter, isUnsupported: boolean) {
		this.push(kind, { label, isUnsupported, open: () => importerExporter.open() });
	}

	/** A React dialog, rendered by the menu. */
	addDialog(kind: ImportExportKind, label: string, Dialog: ComponentType<ImportExportDialogProps>, isUnsupported = false) {
		this.push(kind, { label, isUnsupported, Dialog });
	}

	private push(kind: ImportExportKind, entry: ImportExportEntry) {
		this.entries = { ...this.entries, [kind]: [...this.entries[kind], entry] };
		for (const listener of this.listeners) listener();
	}
}
