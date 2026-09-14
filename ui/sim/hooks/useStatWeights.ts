import type { ProgressMetrics, StatWeightsResult } from '@generated/proto/api';
import type { PseudoStat, Stat } from '@generated/proto/common';
import { useCallback, useRef } from 'react';

import { usePlayer, useSim } from '../context/SimHostContext';
import { SimRunKind } from '../state/sim_store';
import { type SimRunState, useSimRun } from './useSimRun';

export interface StatWeightsArgs {
	epStats: Array<Stat>;
	epPseudoStats: Array<PseudoStat>;
	epReferenceStat: Stat;
}

export interface UseStatWeightsOptions {
	onProgress?: (metrics: ProgressMetrics) => void;
}

export interface UseStatWeightsResult extends SimRunState {
	start: (args: StatWeightsArgs) => Promise<StatWeightsResult>;
}

export const useStatWeights = ({ onProgress }: UseStatWeightsOptions = {}): UseStatWeightsResult => {
	const sim = useSim();
	const player = usePlayer();
	const run = useSimRun(SimRunKind.StatWeights);

	// Read at emit time, so a caller may pass a fresh closure every render without restarting.
	const progressRef = useRef(onProgress);
	progressRef.current = onProgress;

	const start = useCallback(
		(args: StatWeightsArgs) =>
			sim.runs.start<StatWeightsResult, ProgressMetrics>(SimRunKind.StatWeights, ctx =>
				player.computeStatWeights(args.epStats, args.epPseudoStats, args.epReferenceStat, metrics => {
					ctx.emit(metrics);
					progressRef.current?.(metrics);
				}),
			),
		[sim, player],
	);

	return { ...run, start };
};
