import type { BulkSimProgressConfig } from '@sim/bulk/types';
import { BulkSimStage, ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';

export interface BulkProgress {
	stage: string;
	title: string;
	current?: number;
	total?: number;
	secondsRemaining?: number;
	/** Only the sim stages carry these; the candidate stages report a time estimate alone. */
	iterations?: { completed: number; total: number };
}

export interface CandidateGearProgressInput {
	completed?: number;
	total?: number;
	title?: string;
	stage?: string;
	startedAt?: number;
	now: number;
}

export const candidateGearProgress = ({
	completed,
	total,
	title = i18n.t('bulk_tab.progress.building_candidate_gear_sets'),
	stage = 'preparing',
	startedAt,
	now,
}: CandidateGearProgressInput): BulkProgress => {
	if (completed === undefined || total === undefined) return { stage, title };

	const secondsRemaining = startedAt !== undefined && completed > 0 ? ((now - startedAt) / 1000 / completed) * Math.max(0, total - completed) : undefined;
	return { stage, title, current: completed, total, secondsRemaining };
};

/** Null where the vanilla tracker returned without updating: an unusable estimate leaves the last frame up. */
export const simProgress = (progress: ProgressMetrics, config: BulkSimProgressConfig, simStart: number, now: number): BulkProgress | null => {
	const stageCurrentRound = config.stageCurrentRound ?? config.currentRound;
	const stageRounds = config.stageRounds ?? config.totalRounds;
	const isBaselineRound = stageCurrentRound === 1;
	const stage = progress.bulkStage == BulkSimStage.BulkSimStageReforge ? 'reforging' : 'sim';
	const totalElapsedSeconds = (now - (config.aggregateStartedAt ?? simStart)) / 1000;
	const completedIterations = config.aggregateCompletedIterations ?? progress.completedIterations;
	const totalIterations = config.aggregateTotalIterations ?? progress.totalIterations;
	const completedRoundsFromIterations = Math.max(
		0,
		config.aggregateTotalIterations && config.aggregateTotalIterations > 0
			? (completedIterations / config.aggregateTotalIterations) * stageRounds
			: stageCurrentRound - 1 + (progress.totalIterations > 0 ? progress.completedIterations / progress.totalIterations : 0),
	);
	const completedSimsFromIterations =
		config.useSimCountProgress && progress.totalSims > 0 && progress.totalIterations > 0
			? (progress.completedIterations / progress.totalIterations) * progress.totalSims
			: 0;
	const completedRounds =
		config.useSimCountProgress && progress.totalSims > 0 ? Math.max(progress.completedSims, completedSimsFromIterations) : completedRoundsFromIterations;
	const totalRounds = config.useSimCountProgress && progress.totalSims > 0 ? progress.totalSims : stageRounds;
	const secondsRemaining = completedRounds > 0 ? (totalElapsedSeconds / completedRounds) * Math.max(0, totalRounds - completedRounds) : 0;

	if (isNaN(Number(secondsRemaining))) return null;

	return {
		stage,
		title: config.title ?? (isBaselineRound ? i18n.t('bulk_tab.progress.baseline_round') : i18n.t('bulk_tab.progress.refining_rounds')),
		current: completedRounds,
		total: totalRounds,
		secondsRemaining,
		iterations: { completed: completedIterations, total: totalIterations },
	};
};
