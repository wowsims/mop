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

// The endpoints that run asynchronously (progress-id handshake + progress polling). Single
// source for the async/sync split; the HTTP worker derives its routing from this list.
export const ASYNC_SIM_REQUESTS = [SimRequest.raidSimAsync, SimRequest.statWeightsAsync, SimRequest.bulkSimAsync, SimRequest.reforgeOptimizeAsync] as const;
export type AsyncSimRequest = (typeof ASYNC_SIM_REQUESTS)[number];

/**
 * What the Worker receives from the UI
 */
export type WorkerReceiveMessageType = keyof typeof SimRequest | 'setID' | 'wasmModule';

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

// Reply to a worker's wasmModuleRequest: the compiled sim module, fetched and compiled once
// on the main thread and shared with every wasm worker via structured clone.
export interface WorkerReceiveMessageWasmModule {
	msg: 'wasmModule';
	module: WebAssembly.Module;
}

export type WorkerReceiveMessage = WorkerReceiveMessageSetId | WorkerReceiveMessageSimRequest | WorkerReceiveMessageWasmModule;

/**
 * What the Worker sends to the UI
 */
export type WorkerSendMessageType = 'ready' | 'idConfirm' | 'progress' | 'wasmModuleRequest' | keyof typeof SimRequest;

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

export interface WorkerSendMessageWasmModuleRequest extends WorkerSendMessageBodyBase {
	msg: 'wasmModuleRequest';
}

export type WorkerSendMessage =
	| WorkerSendMessageReady
	| WorkerSendMessageIdConfirm
	| WorkerSendMessageProgress
	| WorkerSendMessageSimRequest
	| WorkerSendMessageWasmModuleRequest;
