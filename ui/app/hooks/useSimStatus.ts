import type { Sim } from '@domain/sim';
import { useEffect, useState } from 'react';

export type SimStatus = 'loading' | 'ready' | 'error';

export interface SimStatusResult {
	status: SimStatus;
	error: unknown;
}

/**
 * The init state of `sim.waitForInit()` as a status rather than a boolean, so a view can tell
 * "still loading" apart from "loaded" and render a skeleton for the first.
 *
 * `waitForInit` rejects when the database load fails, and until this hook nothing caught it: the
 * shell simply stayed unready forever with no error shown. The rejection is surfaced here instead.
 *
 * See `useSimReady` for the boolean form and for why this lives in `app/` rather than `ui-kit/`.
 */
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
