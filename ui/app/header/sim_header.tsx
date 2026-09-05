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
	/** The two dropdowns' contents. React renders them — see header/ImportExportMenu. */
	readonly importExport = new ImportExportRegistry();

	readonly simTabsContainer: HTMLElement;
	readonly importExportContainer: HTMLElement;

	constructor(dom: ShellDom, simUI: SimUI) {
		// Adopted from the shell bundle. No `rootCssClass`: the header's class list, `.stuck`
		// included, is React's (app/SimShell.tsx).
		super(null, undefined, dom.header);
		this.simUI = simUI;
		this.simTabsContainer = dom.tabsMount;
		this.importExportContainer = dom.importExport;
		// Built here rather than on first open so it joins the modal set at construction time, which
		// is when every other modal joins it.
		this.settingsMenu = new SettingsMenu(this.simUI.rootElem, this.simUI);
	}

	// Tab identifiers double as a class name on the tab button, which is what callers pass.
	activateTab(className: string) {
		this.simUI.tabs.activate(className);
	}

	/** The toolbar's cog. React owns the button; the modal behind it is still vanilla. */
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
