import { Component } from './component';
import type { SimUIHost } from './sim_host';

export interface SimTabConfig {
	identifier: string;
	title: string;
	/** Rendered after the title, in green. Kept out of `title` so neither is markup. */
	badge?: string;
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
		// No `tab-pane`/`fade`: the Base UI panel wrapping this owns `role="tabpanel"`, visibility and
		// the fade. `.fade:not(.show) { opacity: 0 }` is global, so leaving it would hide every pane.

		this.contentContainer = document.createElement('div');
		this.contentContainer.classList.add('tab-pane-content-container');
		this.rootElem.appendChild(this.contentContainer);

		// The nav item is React's: see app/sim_tabs.tsx.
		this.simUI.tabs.attach({ id: config.identifier, title: config.title, badge: config.badge, pane: this.rootElem });
	}

	protected abstract buildTabContent(): void;

	protected buildColumn(index: number, customCssClass: string): HTMLElement {
		const column = document.createElement('div');
		column.classList.add('tab-panel-col', `${customCssClass}-${index}`);
		return column;
	}
}
