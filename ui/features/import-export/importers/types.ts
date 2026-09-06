import type { IndividualSimHost } from '@features/sim_host';

/**
 * One importer, as data — the mirror of `ExporterDefinition` beside it.
 *
 * The vanilla stack expressed this as a three-level class hierarchy: `Importer` built the textarea,
 * the upload control and the import button, `IndividualImporter` added the host reference and the
 * shared "apply this character" tail, and each concrete importer added a description and an
 * `onImport`. Everything above `onImport` was the same for all of them, so it is a component's
 * props here.
 *
 * The description is the one part that stays JSX, so it is a component's children rather than a
 * field here — which is why each importer has a small dialog component of its own instead of the
 * `exporterDialog(def)` binder the exporters use.
 */
export interface ImporterDefinition {
	/** The dialog's heading, the analytics slug (kebab-cased) and the upload input's id. */
	title: string;
	/** Adds the "Upload File" label in front of the import button. */
	allowFileUpload?: boolean;
	/**
	 * Throwing is how an importer reports a problem: the shell catches and shows the error toast,
	 * and the dialog stays open. Resolving closes it.
	 */
	onImport: (host: IndividualSimHost<any>, data: string) => Promise<void>;
}
