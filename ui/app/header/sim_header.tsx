/** @jsxImportSource @jsx-vanilla */
import { Exporter } from '@features/import-export/view/exporter';
import { Importer } from '@features/import-export/view/importer';
import { Component } from '@ui-kit/component';

import { trackPageView } from '../../tracking/analytics';
import { SettingsMenu } from '../settings_menu';
import type { ShellDom } from '../shell_dom';
import { SimUI } from '../sim_ui';
import { ImportExportRegistry } from './import_export_registry';

export class SimHeader extends Component {
	private simUI: SimUI;
	private settingsMenu: SettingsMenu;
	readonly importExport = new ImportExportRegistry();

	readonly simTabsContainer: HTMLElement;
	readonly importExportContainer: HTMLElement;

	constructor(dom: ShellDom, simUI: SimUI) {
		super(null, undefined, dom.header);
		this.simUI = simUI;
		this.simTabsContainer = dom.tabsMount;
		this.importExportContainer = dom.importExport;
		this.settingsMenu = new SettingsMenu(this.simUI.rootElem, this.simUI);
	}

	activateTab(className: string) {
		this.simUI.tabs.activate(className);
	}

	openSettings() {
		trackPageView('Options', '/settings-menu');
		this.settingsMenu.open();
	}

	addImportLink(label: string, importer: Importer, isUnsupported = false) {
		this.importExport.add('import', label, importer, isUnsupported);
	}
	addExportLink(label: string, exporter: Exporter, isUnsupported = false) {
		this.importExport.add('export', label, exporter, isUnsupported);
	}
}
