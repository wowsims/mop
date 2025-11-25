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

// Main reforge optimization handler with optimized progress tracking
async function handleReforgeOptimize(
	data: Uint8Array,
	progress: HandlerProgressCallback,
	id: string,
	msg: SimRequest,
): Promise<Uint8Array> {
	const request = decodeRequest(data);
	const { model, options, maxIterations, constraintIteration } = request;

	const modelStats = {
		variableCount: model.variables && typeof model.variables === 'object' ? Object.keys(model.variables).length : 0,
		constraintCount: model.constraints && typeof model.constraints === 'object' ? Object.keys(model.constraints).length : 0,
	};

	console.log('Worker received optimization request:', {
		modelVariableCount: modelStats.variableCount,
		modelConstraintCount: modelStats.constraintCount,
		maxIterations,
		constraintIteration,
		modelObjective: model.objective,
	});

	// Validate model data
	if (!model.variables || typeof model.variables !== 'object' || modelStats.variableCount === 0) {
		console.error('ERROR: Model has no valid variables! Cannot optimize.');
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
		message: `Starting optimization (${modelStats.variableCount} vars, ${modelStats.constraintCount} constraints)...`,
	}));

	// Create a custom YALPS solve with progress reporting
	let solution: Solution;

	solution = await new Promise<Solution>((resolve, reject) => {
		// Use shorter delay for better responsiveness
		setTimeout(() => {
			try {
				// Send progress update for start of intensive computation
				progress(encodeProgress({
					stage: 'solving',
					iteration: Math.floor(maxIterations * 0.05),
					maxIterations,
					constraintIteration,
					message: 'Initializing linear programming solver...',
					elapsedMs: Date.now() - startTime,
				}));

				// Set up periodic progress updates during solve
				const progressInterval = setInterval(() => {
					const elapsedMs = Date.now() - startTime;
					const estimatedProgress = Math.min(
						Math.floor(maxIterations * (elapsedMs / (options.timeout || 180000))),
						maxIterations * 0.9
					);

					progress(encodeProgress({
						stage: 'solving',
						iteration: estimatedProgress,
						maxIterations,
						constraintIteration,
						message: `Solving... (${(elapsedMs / 1000).toFixed(1)}s elapsed)`,
						elapsedMs,
					}));
				}, 2000); // Update every 2 seconds

				console.log('About to call YALPS solve with model:', {
					variableCount: modelStats.variableCount,
					constraintCount: modelStats.constraintCount,
					objective: model.objective
				});

				// Run the actual solve operation
				const result = solve(model, options);

				// Clear progress interval
				clearInterval(progressInterval);

				console.log('YALPS solve completed:', result);

				// Send final progress update
				const elapsedMs = Date.now() - startTime;
				progress(encodeProgress({
					stage: 'completed',
					iteration: maxIterations,
					maxIterations,
					constraintIteration,
					message: `Optimization completed (${result.status}) in ${(elapsedMs / 1000).toFixed(1)}s`,
					elapsedMs,
				}));

				resolve(result);
			} catch (error) {
				console.error('YALPS solve error:', error);
				reject(error);
			}
		}, 5); // Minimal delay for event loop yielding
	});

	const elapsedMs = Date.now() - startTime;

	const result: ReforgeOptimizationResult = {
		solution,
		elapsedMs,
		iterations: maxIterations,
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
