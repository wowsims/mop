import { trackPageView } from '../tracking/analytics';
import { Component } from './component';
import type { SimUIHost } from './sim_host';

export interface SimTabConfig {
	identifier: string;
	title: string;
}

export abstract class SimTab extends Component {
	protected simUI: SimUIHost;
	protected config: SimTabConfig;

	readonly navItem: HTMLElement;
	readonly navLink: HTMLElement;
	readonly contentContainer: HTMLElement;

	constructor(simUI: SimUIHost, config: SimTabConfig) {
		// No parent: the pane is handed to the tab registry, and React decides where it goes and
		// whether it is the active one.
		super(null, 'sim-tab');

		this.rootElem.classList.add(config.identifier);

		this.simUI = simUI;
		this.config = config;

		this.rootElem.id = this.config.identifier;
		this.rootElem.classList.add('tab-pane', 'fade');

		this.navItem = this.buildNavItem();
		this.navLink = this.navItem.children[0] as HTMLElement;
		this.contentContainer = document.createElement('div');
		this.contentContainer.classList.add('tab-pane-content-container');
		this.rootElem.appendChild(this.contentContainer);

		this.simUI.tabs.attach({
			id: config.identifier,
			title: config.title,
			navItem: this.navItem,
			navLink: this.navLink,
			pane: this.rootElem,
		});

		this.navItem.addEventListener('click', () => {
			trackPageView(config.title, config.identifier);
		});
	}

	private buildNavItem(): HTMLElement {
		const tabFragment = document.createElement('fragment');
		tabFragment.innerHTML = `
			<li class="${this.config.identifier} nav-item" role="presentation">
				<button
					class="nav-link"
					type="button"
					role="tab"
					aria-controls="${this.config.identifier}"
				>${this.config.title}</button>
			</li>
		`;

		return tabFragment.children[0] as HTMLElement;
	}

	protected abstract buildTabContent(): void;

	protected buildColumn(index: number, customCssClass: string): HTMLElement {
		const column = document.createElement('div');
		column.classList.add('tab-panel-col', `${customCssClass}-${index}`);
		return column;
	}
}
