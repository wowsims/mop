import { Constraint, Model, Options, Solution, solve } from 'yalps';
import { SimRequest } from './types';
import { WorkerInterface, type HandlerProgressCallback } from './worker_interface';

// Type definitions for reforge optimization data
export interface ReforgeOptimizationRequest {
	model: Model;
	options: Options;
	maxIterations: number;
	constraintIteration: number;
}

export interface ReforgeOptimizationResult {
	solution: Solution;
	elapsedMs: number;
	iterations: number;
}

export interface ReforgeProgressUpdate {
	stage: 'solving' | 'completed';
	iteration?: number;
	maxIterations?: number;
	constraintIteration?: number;
	message?: string;
	elapsedMs?: number;
}

// Encode/decode functions for worker communication
function encodeRequest(request: ReforgeOptimizationRequest): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(request));
}

function decodeRequest(data: Uint8Array): ReforgeOptimizationRequest {
	return JSON.parse(new TextDecoder().decode(data));
}

function encodeResult(result: ReforgeOptimizationResult): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(result));
}

function encodeProgress(progress: ReforgeProgressUpdate): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(progress));
}

// Main reforge optimization handler
async function handleReforgeOptimize(
	data: Uint8Array,
	progress: HandlerProgressCallback,
	id: string,
	msg: SimRequest,
): Promise<Uint8Array> {
	const request = decodeRequest(data);
	const { model, options, maxIterations, constraintIteration } = request;

	console.log('Worker received optimization request:', {
		modelVariableCount: model.variables && typeof model.variables === 'object' ? Object.keys(model.variables).length : 'undefined',
		modelConstraintCount: model.constraints && typeof model.constraints === 'object' ? Object.keys(model.constraints).length : 'undefined',
		maxIterations,
		constraintIteration,
		modelObjective: model.objective,
		modelDirection: model.direction
	});

	// Debug: Log first few variables
	if (model.variables && typeof model.variables === 'object') {
		const variableEntries = Object.entries(model.variables);
		if (variableEntries.length > 0) {
			console.log('First few variables:', variableEntries.slice(0, 3));
		} else {
			console.error('ERROR: Model has no variables! Cannot optimize.');
			const errorResult: ReforgeOptimizationResult = {
				solution: { status: 'infeasible', result: 0, variables: [] },
				elapsedMs: 0,
				iterations: 0,
			};
			return encodeResult(errorResult);
		}
	} else {
		console.error('ERROR: Model variables is not a valid object! Cannot optimize.');
		const errorResult: ReforgeOptimizationResult = {
			solution: { status: 'infeasible', result: 0, variables: [] },
			elapsedMs: 0,
			iterations: 0,
		};
		return encodeResult(errorResult);
	}

	const startTime = Date.now();

	// Send initial progress update
	progress(encodeProgress({
		stage: 'solving',
		iteration: 0,
		maxIterations,
		constraintIteration,
		message: `Solving optimization (iteration ${constraintIteration})...`,
	}));

	// Since YALPS solve() is synchronous and doesn't provide progress callbacks,
	// we'll run it in chunks with periodic progress updates using setTimeout
	let solution: Solution;

	// Create a promise that resolves when solve completes
	solution = await new Promise<Solution>((resolve, reject) => {
		// Use setTimeout to yield to event loop before starting intensive computation
		setTimeout(() => {
			try {
				const startSolveTime = Date.now();

				// Send progress update indicating intensive computation is starting
				progress(encodeProgress({
					stage: 'solving',
					iteration: Math.floor(maxIterations * 0.1),
					maxIterations,
					constraintIteration,
					message: 'Computing optimal solution...',
					elapsedMs: Date.now() - startTime,
				}));

				// Run the actual solve operation
				console.log('About to call YALPS solve with model:', {
					variableCount: model.variables && typeof model.variables === 'object' ? Object.keys(model.variables).length : 'unknown',
					constraintCount: model.constraints && typeof model.constraints === 'object' ? Object.keys(model.constraints).length : 'unknown',
					objective: model.objective
				});
				const result = solve(model, options);
				console.log('YALPS solve completed:', result);

				// Send final progress update
				const elapsedMs = Date.now() - startTime;
				progress(encodeProgress({
					stage: 'completed',
					iteration: maxIterations,
					maxIterations,
					constraintIteration,
					message: `Solution found in ${(elapsedMs / 1000).toFixed(1)}s`,
					elapsedMs,
				}));

				resolve(result);
			} catch (error) {
				console.error('YALPS solve error:', error);
				reject(error);
			}
		}, 10); // Small delay to allow UI update
	});

	const elapsedMs = Date.now() - startTime;

	const result: ReforgeOptimizationResult = {
		solution,
		elapsedMs,
		iterations: maxIterations, // YALPS doesn't report actual iterations used
	};

	return encodeResult(result);
}

// No-op handler for requests this worker doesn't handle
const noOpHandler = (data: Uint8Array): Uint8Array => {
	console.error('Reforge worker received unsupported request type');
	return new Uint8Array();
};

// Create worker interface
const workerInterface = new WorkerInterface({
	[SimRequest.computeStats]: noOpHandler,
	[SimRequest.computeStatsJson]: noOpHandler,
	[SimRequest.raidSim]: noOpHandler,
	[SimRequest.raidSimJson]: noOpHandler,
	[SimRequest.raidSimAsync]: noOpHandler,
	[SimRequest.statWeights]: noOpHandler,
	[SimRequest.statWeightsAsync]: noOpHandler,
	[SimRequest.statWeightRequests]: noOpHandler,
	[SimRequest.statWeightCompute]: noOpHandler,
	[SimRequest.raidSimRequestSplit]: noOpHandler,
	[SimRequest.raidSimResultCombination]: noOpHandler,
	[SimRequest.reforgeOptimize]: handleReforgeOptimize,
	[SimRequest.abortById]: noOpHandler,
});

// Signal that worker is ready (not using WASM)
workerInterface.ready(false);
