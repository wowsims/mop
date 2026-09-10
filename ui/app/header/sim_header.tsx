import { Component } from '@ui-kit/component';
import type { SimTabActivation } from '@ui-kit/tab_activation';

export class SimHeader extends Component {
	private tabs: SimTabActivation;

	constructor(headerElem: HTMLElement, tabs: SimTabActivation) {
		super(null, undefined, headerElem);
		this.tabs = tabs;
	}

	activateTab(className: string) {
		this.tabs.activate(className);
	}
}
