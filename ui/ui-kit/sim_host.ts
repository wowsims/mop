import type { Sim } from '@domain/sim';

import type { SimTab } from './sim_tab';

// The slice of the sim shell (app/sim_ui.tsx) that ui-kit widgets reach for.
// ui-kit must not name the shell itself (see ui/README.md dependency direction).
export interface SimHeaderHost {
	readonly rootElem: HTMLElement;
	addSimTabLink(tab: SimTab): void;
	activateTab(className: string): void;
}

export interface SimUIHost {
	readonly sim: Sim;
	readonly simHeader: SimHeaderHost;
}
