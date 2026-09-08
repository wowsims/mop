import { useMemo } from 'react';

import type { Sim } from '../sim';
import { subscribeUiField } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

/** Takes the sim for the same reason `useDisplayMetrics` does — `SimShell` renders outside the provider. */
export const useShowExperimental = (sim: Sim): boolean =>
	useStoreSubscribe(
		useMemo(() => subscribeUiField(sim, 'showExperimental'), [sim]),
		() => sim.getShowExperimental(),
	);
