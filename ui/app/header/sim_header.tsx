import { Component } from '@ui-kit/component';
import type { SimTabRegistry } from '@ui-kit/tab_registry';

import { ImportExportRegistry } from './import_export_registry';

export class SimHeader extends Component {
	private tabs: SimTabRegistry;
	readonly importExport = new ImportExportRegistry();

	constructor(headerElem: HTMLElement, tabs: SimTabRegistry) {
		super(null, undefined, headerElem);
		this.tabs = tabs;
	}

	activateTab(className: string) {
		this.tabs.activate(className);
	}
}
