/**
 * Types for the Reforge LP Solver Worker
 */

/**
 * Constraint matching YALPS semantics: { equal?: number, min?: number, max?: number }
 */
export interface SerializedConstraint {
	equal?: number;
	min?: number;
	max?: number;
}

/**
 * Serializable version of YALPS coefficients (Map<string, number>)
 */
export type SerializedCoefficients = Record<string, number>;

/**
 * Serializable version of YALPS variables (Map<string, YalpsCoefficients>)
 */
export type SerializedVariables = Record<string, SerializedCoefficients>;

/**
 * Serializable version of YALPS constraints (Map<string, Constraint>)
 */
export type SerializedConstraints = Record<string, SerializedConstraint>;

/**
 * LP Model to be solved - serializable version of YALPS Model
 */
export interface LPModel {
	direction: 'maximize' | 'minimize';
	objective: string;
	constraints: SerializedConstraints;
	variables: SerializedVariables;
	binaries: boolean;
}

/**
 * Solver options
 */
export interface SolverOptions {
	/** Timeout in milliseconds */
	timeout?: number;
	/** Solution tolerance */
	tolerance?: number;
}

/**
 * Solution status
 */
export type SolutionStatus = 'optimal' | 'infeasible' | 'unbounded' | 'timedout' | 'error' | 'unknown';

/**
 * LP Solution result - compatible with YALPS Solution type
 */
export interface LPSolution {
	status: SolutionStatus;
	/** Objective value (NaN if no solution) */
	result: number;
	/** Map of variable name to coefficient (1 = selected in binary case) */
	variables: Array<[string, number]>;
	/** Whether the solver reached optimal */
	bounded: boolean;
	/** Whether the problem is feasible */
	feasible: boolean;
}

/**
 * Request types for the worker
 */
export enum ReforgeRequest {
	solve = 'solve',
	init = 'init',
}

/**
 * Worker receive message types
 */
export type ReforgeWorkerReceiveMessageType = keyof typeof ReforgeRequest | 'setID';

export interface ReforgeWorkerReceiveMessageBase {
	id: string;
	msg: ReforgeWorkerReceiveMessageType;
}

export interface ReforgeWorkerReceiveMessageSetId extends ReforgeWorkerReceiveMessageBase {
	msg: 'setID';
}

export interface ReforgeWorkerReceiveMessageInit extends ReforgeWorkerReceiveMessageBase {
	msg: 'init';
	wasmUrl?: string;
}

export interface ReforgeWorkerReceiveMessageSolve extends ReforgeWorkerReceiveMessageBase {
	msg: 'solve';
	model: LPModel;
	options: SolverOptions;
}

export type ReforgeWorkerReceiveMessage = ReforgeWorkerReceiveMessageSetId | ReforgeWorkerReceiveMessageInit | ReforgeWorkerReceiveMessageSolve;

/**
 * Worker send message types
 */
export type ReforgeWorkerSendMessageType = 'ready' | 'idConfirm' | 'progress' | 'solve' | 'init' | 'error';

export interface ReforgeWorkerSendMessageBase {
	id?: string;
	msg: ReforgeWorkerSendMessageType;
}

export interface ReforgeWorkerSendMessageReady extends ReforgeWorkerSendMessageBase {
	msg: 'ready';
}

export interface ReforgeWorkerSendMessageIdConfirm extends ReforgeWorkerSendMessageBase {
	msg: 'idConfirm';
}

export interface ReforgeWorkerSendMessageProgress extends ReforgeWorkerSendMessageBase {
	msg: 'progress';
	id: string;
	progress: number;
}

export interface ReforgeWorkerSendMessageSolve extends ReforgeWorkerSendMessageBase {
	msg: 'solve';
	id: string;
	solution: LPSolution;
}

export interface ReforgeWorkerSendMessageInit extends ReforgeWorkerSendMessageBase {
	msg: 'init';
	id: string;
	success: boolean;
}

export interface ReforgeWorkerSendMessageError extends ReforgeWorkerSendMessageBase {
	msg: 'error';
	id: string;
	error: string;
}

export type ReforgeWorkerSendMessage =
	| ReforgeWorkerSendMessageReady
	| ReforgeWorkerSendMessageIdConfirm
	| ReforgeWorkerSendMessageProgress
	| ReforgeWorkerSendMessageSolve
	| ReforgeWorkerSendMessageInit
	| ReforgeWorkerSendMessageError;
