import { BulkGearCandidate, BulkSimRequest, BulkSimStage, BulkSimStageMetrics, DistributionMetrics, ErrorOutcome } from '@core/proto/api';
import { EquipmentSpec } from '@core/proto/common';

export const getBulkSimBaselineGear = (request: BulkSimRequest) => request.baseRequest!.raid!.parties[0].players[0].equipment!;

export type ConcurrentBulkSimCandidate = {
	index: number;
	gear: EquipmentSpec;
};

export type ConcurrentBulkSimCandidateResult = {
	candidate: ConcurrentBulkSimCandidate;
	dpsMetrics?: DistributionMetrics;
	error?: ErrorOutcome;
};

export type ConcurrentBulkSimStageConfig = {
	stage: BulkSimStage;
	minIterations?: number;
	targetErrorPct: number;
	minSurvivors?: number;
	maxSurvivors?: number;
	cullingCoefficient?: number;
};

export type ConcurrentBulkSimStageResult = {
	baseline?: ConcurrentBulkSimCandidateResult;
	results: ConcurrentBulkSimCandidateResult[];
	iterations: number;
	metrics: BulkSimStageMetrics;
};

export type ConcurrentBulkSimCandidateTask = {
	candidate: ConcurrentBulkSimCandidate;
	idx: number;
};

export type BulkSimReforgeCandidateTask = {
	candidate: BulkGearCandidate;
	position: number;
};
