import type { Exporter } from '@features/import-export/view/exporter';
import type { Importer } from '@features/import-export/view/importer';

export type ImportExportKind = 'import' | 'export';

export interface ImportExportEntry {
	label: string;
	/** Both expose `open()`; nothing here needs to know which it has. */
	open: () => void;
	/** Rendered greyed out with a "Currently unsupported" tooltip instead of opening anything. */
	isUnsupported: boolean;
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

	add(kind: ImportExportKind, label: string, importerExporter: Importer | Exporter, isUnsupported: boolean) {
		this.entries = { ...this.entries, [kind]: [...this.entries[kind], { label, open: () => importerExporter.open(), isUnsupported }] };
		for (const listener of this.listeners) listener();
	}
}
