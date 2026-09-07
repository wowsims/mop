import { useEffect, useState } from 'react';

import type { Sim } from '../sim';

export type SimStatus = 'loading' | 'ready' | 'error';

export interface SimStatusResult {
	status: SimStatus;
	error: unknown;
}

export const useSimStatus = (sim: Sim): SimStatusResult => {
	const [state, setState] = useState<SimStatusResult>({ status: 'loading', error: null });
	useEffect(() => {
		let live = true;
		setState({ status: 'loading', error: null });
		sim.waitForInit().then(
			() => live && setState({ status: 'ready', error: null }),
			(error: unknown) => live && setState({ status: 'error', error }),
		);
		return () => {
			live = false;
		};
	}, [sim]);
	return state;
};
