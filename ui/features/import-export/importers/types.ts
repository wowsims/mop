import type { IndividualSimHost } from '@features/sim_host';

export interface ImporterDefinition {
	title: string;
	allowFileUpload?: boolean;
	/** Throw to report a problem; the shell shows it as the error toast. */
	onImport: (host: IndividualSimHost<any>, data: string) => Promise<void>;
}
