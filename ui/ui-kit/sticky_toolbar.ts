import { Component } from './component';
import type { SimUIHost } from './sim_host';

export class StickyToolbar extends Component {
	constructor(rootElem: HTMLElement, simUI: SimUIHost | null) {
		super(null, 'sticky-toolbar-root', rootElem);

		new IntersectionObserver(
			([e]) => {
				e.target.classList.toggle('stuck', e.target.clientHeight > 0 && e.intersectionRatio < 1);
			},
			{
				// Intersect with the sim header or top of the separate tab
				rootMargin: simUI ? `-${simUI.simHeader.rootElem.offsetHeight + 1}px 0px 0px 0px` : '0px',
				threshold: [1],
			},
		).observe(this.rootElem);
	}
}
