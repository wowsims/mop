import type { SimUIHost } from '@sim/sim_host';
import type { ReactNode } from 'react';

import { Disposable } from './component';

export interface SimTabConfig {
	identifier: string;
	title: string;
	badge?: string;
	pane: ReactNode;
}

export abstract class SimTab extends Disposable {
	protected simUI: SimUIHost;
	protected config: SimTabConfig;

	constructor(simUI: SimUIHost, config: SimTabConfig) {
		super();

		this.simUI = simUI;
		this.config = config;

		this.simUI.tabs.attach({ id: config.identifier, title: config.title, badge: config.badge, pane: config.pane });
	}
}
