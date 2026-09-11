import { useMemo } from 'react';

import type { Sim } from '../sim';
import { subscribeAll, subscribeUiField } from '../state/subscriptions';
import { useStoreSubscribe } from './useStoreSubscribe';

export interface DisplayMetrics {
	damage: boolean;
	threat: boolean;
	healing: boolean;
}

const DAMAGE = 1;
const HEALING = 2;
const THREAT = 4;

/**
 * The three metric columns the results tables and the shell root agree on, read through one
 * subscription rather than one each. Anything derived from them — `showsEpRatios`, the shell's
 * `hide-*` classes — derives from the returned object and stays reactive for free.
 *
 * The snapshot is a bitmask rather than the object, so the object is rebuilt only when a flag
 * actually changes: `useStoreSubscribe` re-reads whenever the *subscription* identity changes, and a
 * fresh object there is a re-render, which for a caller holding an unstable `sim` is a loop.
 *
 * Takes the sim rather than reading the host: `SimShell` renders before `SimHostObject` adopts its
 * DOM, so there is no `SimHostProvider` above it. Inside one, call `useDisplayMetrics(useSim())`.
 */
export const useDisplayMetrics = (sim: Sim): DisplayMetrics => {
	const subscribe = subscribeAll([
		subscribeUiField(sim, 'showDamageMetrics'),
		subscribeUiField(sim, 'showHealingMetrics'),
		subscribeUiField(sim, 'showThreatMetrics'),
	]);

	const flags = useStoreSubscribe(
		subscribe,
		() => (sim.getShowDamageMetrics() ? DAMAGE : 0) | (sim.getShowHealingMetrics() ? HEALING : 0) | (sim.getShowThreatMetrics() ? THREAT : 0),
	);

	return useMemo(() => ({ damage: !!(flags & DAMAGE), healing: !!(flags & HEALING), threat: !!(flags & THREAT) }), [flags]);
};
