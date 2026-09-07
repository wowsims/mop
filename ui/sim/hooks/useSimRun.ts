import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useSim } from '../context/SimHostContext';
import type { SimRunKind } from '../state/sim_store';
import { subscribeRunState } from '../state/subscriptions';

export interface SimRunState {
	isRunning: boolean;
	isAborting: boolean;
	abort: () => Promise<void>;
}

// Observe or stop any kind of run, from anywhere. Deliberately returns no `start`: a run can only
// be begun through the named hook that knows its arguments.
export const useSimRun = (kind: SimRunKind): SimRunState => {
	const sim = useSim();
	const subscribe = useMemo(() => subscribeRunState(sim, kind), [sim, kind]);
	const isRunning = useSyncExternalStore(subscribe, () => sim.runs.isRunning(kind));
	const isAborting = useSyncExternalStore(subscribe, () => sim.runs.isAborting(kind));
	const abort = useCallback(() => sim.runs.abort(kind), [sim, kind]);
	return { isRunning, isAborting, abort };
};
