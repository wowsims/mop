import i18n from '@i18n/config';

import type { SimHost } from '../../../sim_host';
import { Exporter } from '../exporter';

export class LogExporter extends Exporter {
	protected readonly simUI: SimHost;

	constructor(
		parent: HTMLElement,
		simUI: SimHost,
		private readonly getLogData: () => string,
	) {
		super(parent, {
			title: i18n.t('results_tab.details.logs.export_button'),
			allowDownload: true,
			downloadFileName: 'wowsims-log.csv',
			downloadMimeType: 'text/csv',
		});

		this.simUI = simUI;
	}

	getData(): string {
		return this.getLogData();
	}
}
