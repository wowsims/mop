import type { SimSettingCategories } from '@domain/constants/sim_settings';
import type { IndividualSimHost } from '@features/sim_host';

export type ExportCategories = Record<SimSettingCategories, boolean>;

export interface ExporterDefinition {
	title: string;
	allowDownload?: boolean;
	selectCategories?: boolean;
	getData: (host: IndividualSimHost<any>, categories: ExportCategories) => string;
}
