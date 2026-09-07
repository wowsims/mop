import type { ProgressMetrics, StatWeightsResult } from '@generated/proto/api';
import type { PseudoStat, Stat } from '@generated/proto/common';
import { useCallback, useRef } from 'react';

import { usePlayer } from '../context/SimHostContext';
import { useSim } from '../context/SimHostContext';
import type { SimRunState } from './useSimRun';
import { useSimRun } from './useSimRun';
import { SimRunKind } from '../state/sim_store';

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
