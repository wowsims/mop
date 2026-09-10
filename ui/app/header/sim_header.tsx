import { Exporter } from '@features/import-export/view/exporter';
import { Component } from '@ui-kit/component';

import type { ShellDom } from '../shell_dom';
import { SimUI } from '../sim_ui';
import { ImportExportKind, ImportExportRegistry } from './import_export_registry';

export class SimHeader extends Component {
	private simUI: SimUI;
	readonly importExport = new ImportExportRegistry();

	constructor(dom: ShellDom, simUI: SimUI) {
		super(null, undefined, dom.header);
		this.simUI = simUI;
	}

	activateTab(className: string) {
		this.simUI.tabs.activate(className);
	}

	addExportLink(label: string, exporter: Exporter, isUnsupported = false) {
		this.importExport.add(ImportExportKind.Export, label, exporter, isUnsupported);
	}
}
