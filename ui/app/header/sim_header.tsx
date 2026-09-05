/** @jsxImportSource @jsx-vanilla */
import { Exporter } from '@features/import-export/view/exporter';
import { Importer } from '@features/import-export/view/importer';
import { Component } from '@ui-kit/component';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { trackPageView } from '../../tracking/analytics';
import { SettingsMenu } from '../settings_menu';
import type { ShellDom } from '../shell_dom';
import { SimUI } from '../sim_ui';

export class SimHeader extends Component {
	private simUI: SimUI;
	private settingsMenu: SettingsMenu;

	readonly simTabsContainer: HTMLElement;

	constructor(dom: ShellDom, simUI: SimUI) {
		// Adopted from the shell bundle. No `rootCssClass`: the header's class list, `.stuck`
		// included, is React's (app/SimShell.tsx).
		super(null, undefined, dom.header);
		this.simUI = simUI;
		this.simTabsContainer = dom.tabsMount;
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
		this.addImportExportLink('.import-dropdown', label, importer, isUnsupported);
	}
	addExportLink(label: string, exporter: Exporter, isUnsupported = false) {
		this.addImportExportLink('.export-dropdown', label, exporter, isUnsupported);
	}
	private addImportExportLink(cssClass: string, label: string, importerExporter: Importer | Exporter, isUnsupported?: boolean) {
		const dropdownElem = this.rootElem.querySelector<HTMLElement>(cssClass)!;
		const menuElem = dropdownElem.querySelector<HTMLElement>('.dropdown-menu')!;
		const buttonRef = ref<HTMLButtonElement>();

		menuElem.appendChild(
			<li>
				<button type="button" ref={buttonRef} className={clsx('dropdown-item', isUnsupported && 'disabled')}>
					{label}
				</button>
			</li>,
		);
		if (buttonRef.value) {
			if (isUnsupported) {
				tippy(buttonRef.value, { content: 'Currently unsupported' });
				return;
			}
			buttonRef.value.addEventListener('click', () => importerExporter.open());
		}
	}
}
