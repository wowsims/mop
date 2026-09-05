import { Component } from './component';
import type { SimUIHost } from './sim_host';

export interface SimTabConfig {
	identifier: string;
	title: string;
}

export abstract class SimTab extends Component {
	protected simUI: SimUIHost;
	protected config: SimTabConfig;

	readonly contentContainer: HTMLElement;

	constructor(simUI: SimUIHost, config: SimTabConfig) {
		// No parent: the registry attaches the pane, React decides whether it is the active one.
		super(null, 'sim-tab');

		this.rootElem.classList.add(config.identifier);

		this.simUI = simUI;
		this.config = config;

		this.rootElem.id = this.config.identifier;
		this.rootElem.classList.add('tab-pane', 'fade');
		// Bootstrap's tab plugin used to stamp this on load, following data-bs-target.
		this.rootElem.setAttribute('role', 'tabpanel');

		this.contentContainer = document.createElement('div');
		this.contentContainer.classList.add('tab-pane-content-container');
		this.rootElem.appendChild(this.contentContainer);

		// The nav item is React's: see app/sim_tabs.tsx.
		this.simUI.tabs.attach({ id: config.identifier, title: config.title, pane: this.rootElem });
	}

	protected abstract buildTabContent(): void;

	protected buildColumn(index: number, customCssClass: string): HTMLElement {
		const column = document.createElement('div');
		column.classList.add('tab-panel-col', `${customCssClass}-${index}`);
		return column;
	}
}
