/**
 * API endpoints and exposed wasm function names. Also used as request identifier.
 */
export enum SimRequest {
	computeStats = 'computeStats',
	computeStatsJson = 'computeStatsJson',
	reforgeOptimizeAsync = 'reforgeOptimizeAsync',
	raidSim = 'raidSim',
	raidSimJson = 'raidSimJson',
	raidSimAsync = 'raidSimAsync',
	bulkSimAsync = 'bulkSimAsync',
	bulkCombinationCount = 'bulkCombinationCount',
	bulkCandidates = 'bulkCandidates',
	statWeights = 'statWeights',
	statWeightsAsync = 'statWeightsAsync',
	statWeightRequests = 'statWeightRequests',
	statWeightCompute = 'statWeightCompute',
	raidSimRequestSplit = 'raidSimRequestSplit',
	raidSimResultCombination = 'raidSimResultCombination',
	abortById = 'abortById',
}

/**
 * What the Worker receives from the UI
 */
export type WorkerReceiveMessageType = keyof typeof SimRequest | 'setID';

export interface WorkerReceiveMessageBodyBase {
	id: string;
	msg: WorkerReceiveMessageType;
	inputData?: Uint8Array;
}

export interface WorkerReceiveMessageSetId extends WorkerReceiveMessageBodyBase {
	msg: 'setID';
}

export interface WorkerReceiveMessageSimRequest extends Required<WorkerReceiveMessageBodyBase> {
	msg: SimRequest;
}

export type WorkerReceiveMessage = WorkerReceiveMessageSetId | WorkerReceiveMessageSimRequest;

/**
 * What the Worker sends to the UI
 */
export type WorkerSendMessageType = 'ready' | 'idConfirm' | 'progress' | keyof typeof SimRequest;

export interface WorkerSendMessageBodyBase {
	id?: string;
	msg: WorkerSendMessageType;
	outputData?: Uint8Array;
	error?: string;
}

export interface WorkerSendMessageIdConfirm extends WorkerSendMessageBodyBase {
	msg: 'idConfirm';
}

export interface WorkerSendMessageReady extends WorkerSendMessageBodyBase {
	msg: 'ready';
}

export interface WorkerSendMessageProgress extends WorkerSendMessageBodyBase {
	id: string;
	msg: 'progress';
	outputData: Uint8Array;
}

export interface WorkerSendMessageSimRequest extends WorkerSendMessageBodyBase {
	id: string;
	msg: SimRequest;
	outputData: Uint8Array;
}

export type WorkerSendMessage = WorkerSendMessageReady | WorkerSendMessageIdConfirm | WorkerSendMessageProgress | WorkerSendMessageSimRequest;
