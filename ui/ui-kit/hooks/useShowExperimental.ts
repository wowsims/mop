import { useMemo } from 'react';

import { useStoreSubscribe } from './useStoreSubscribe';

import type { Sim } from '@sim/sim';
import { subscribeUiField } from '@sim/state/subscriptions';

/** Takes the sim for the same reason `useDisplayMetrics` does — `SimShell` renders outside the provider. */
export const useShowExperimental = (sim: Sim): boolean =>
	useStoreSubscribe(
		useMemo(() => subscribeUiField(sim, 'showExperimental'), [sim]),
		() => sim.getShowExperimental(),
	);
