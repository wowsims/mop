import { SimUI } from '../../../sim_ui';
import { Exporter } from '../../exporter';

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
		});

		this.simUI = simUI;
	}

	getData(): string {
		return this.getLogData();
	}
}
