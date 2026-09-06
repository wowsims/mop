import { Exporter } from '../../exporter';
import { SimUI } from '../../../sim_ui';

export class LogExporter extends Exporter {
	protected readonly simUI: SimUI;

	constructor(
		parent: HTMLElement,
		simUI: SimUI,
		private readonly getLogData: () => string,
	) {
		super(parent, {
			title: 'Export Log',
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
