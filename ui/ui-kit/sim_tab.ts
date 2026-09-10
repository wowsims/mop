import type { SimUIHost } from '@sim/sim_host';
import type { ReactNode } from 'react';

import { Component } from './component';

export interface SimTabConfig {
	identifier: string;
	title: string;
	badge?: string;
	pane: ReactNode;
}

export abstract class SimTab extends Component {
	protected simUI: SimUIHost;
	protected config: SimTabConfig;

	constructor(simUI: SimUIHost, config: SimTabConfig) {
		super(null);

		this.simUI = simUI;
		this.config = config;

		this.simUI.tabs.attach({ id: config.identifier, title: config.title, badge: config.badge, pane: config.pane });
	}

	protected abstract buildTabContent(): void;

	protected buildColumn(index: number, customCssClass: string): HTMLElement {
		const column = document.createElement('div');
		column.classList.add('tab-panel-col', `${customCssClass}-${index}`);
		return column;
	}
}
