import type { SimSettingCategories } from '@domain/constants/sim_settings';
import type { IndividualSimHost } from '@features/sim_host';

/** Which export categories are ticked. Only the two exporters that show the pickers read it. */
export type ExportCategories = Record<SimSettingCategories, boolean>;

/**
 * One exporter, as data.
 *
 * The vanilla stack expressed this as a class hierarchy — `Exporter` built the textarea and the
 * footer, `IndividualExporter` prepended the category pickers, and seven subclasses added a
 * `getData()` and nothing else. Everything above `getData` was the same for all of them, so it is a
 * component's props here and the concrete exporters are these three fields plus a function.
 */
export interface ExporterDefinition {
	/** The dialog's heading, and — kebab-cased — the analytics slug. */
	title: string;
	/** Adds the download button beside the copy button. */
	allowDownload?: boolean;
	/** Prepends the row of category checkboxes to the body, and feeds them to `getData`. */
	selectCategories?: boolean;
	getData: (host: IndividualSimHost<any>, categories: ExportCategories) => string;
}
