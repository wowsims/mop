import { Model, Options, Solution } from 'yalps';
import { generateRequestId } from '../worker_pool';
import { SimRequest, WorkerReceiveMessage, WorkerSendMessage } from '../../worker/types';
import { REPO_NAME } from '../constants/other';

// Types for reforge worker communication
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

export type ReforgeProgressCallback = (progress: ReforgeProgressUpdate) => void;

const REFORGE_WORKER_URL = `/${REPO_NAME}/reforge_worker.js`;

export class ReforgeWorker {
	private worker: Worker | null = null;
	private activeRequests = new Map<string, {
		resolve: (result: ReforgeOptimizationResult) => void;
		reject: (error: Error) => void;
		progressCallback?: ReforgeProgressCallback;
	}>();

	constructor() {
		this.initWorker();
	}

	private initWorker() {
		this.worker = new Worker(REFORGE_WORKER_URL);

		this.worker.onmessage = ({ data }: MessageEvent<WorkerSendMessage>) => {
			const { msg, id, outputData } = data;

			console.log('Received message from worker:', { msg, id: id?.substring(0, 20), hasData: !!outputData });

			if (msg === 'ready') {
				console.log('Reforge worker ready');
				return;
			}

			if (!id || !outputData) {
				console.log('Missing id or outputData in worker message');
				return;
			}

			if (msg === 'progress') {
				// Handle progress updates - the worker interface adds 'progress' to the end of the ID
				const progressId = id.replace(/progress$/, '');
				const request = this.activeRequests.get(progressId);
				if (request?.progressCallback) {
					try {
						const progress: ReforgeProgressUpdate = JSON.parse(new TextDecoder().decode(outputData));
						request.progressCallback(progress);
					} catch (error) {
						console.error('Failed to parse progress data:', error);
					}
				}
				return;
			}

			if (msg === 'reforgeOptimize') {
				// Handle completion
				const request = this.activeRequests.get(id);
				if (request) {
					try {
						const result: ReforgeOptimizationResult = JSON.parse(new TextDecoder().decode(outputData));
						console.log('Worker optimization completed:', result);
						request.resolve(result);
					} catch (error) {
						console.error('Failed to parse result data:', error);
						request.reject(new Error('Failed to parse result data'));
					}
					this.activeRequests.delete(id);
				} else {
					console.error('No active request found for id:', id);
				}
				return;
			}

			console.error('Unknown message type from worker:', msg);
		};

		this.worker.onerror = (error) => {
			console.error('Reforge worker error:', error);
			// Reject all active requests
			for (const [id, request] of this.activeRequests.entries()) {
				request.reject(new Error('Worker error'));
				this.activeRequests.delete(id);
			}
		};

		// Set worker ID
		const workerId = 'reforge-worker-1';
		this.sendMessage({
			id: workerId,
			msg: 'setID',
		});
	}

	async optimizeReforges(
		request: ReforgeOptimizationRequest,
		progressCallback?: ReforgeProgressCallback
	): Promise<ReforgeOptimizationResult> {
		if (!this.worker) {
			throw new Error('Reforge worker not initialized');
		}

		console.log('Sending optimization request to worker...');
		console.log('Original request model:', {
			variableCount: request.model.variables instanceof Map ? request.model.variables.size : Object.keys(request.model.variables).length,
			constraintCount: request.model.constraints instanceof Map ? request.model.constraints.size : Object.keys(request.model.constraints).length,
			objectiveType: request.model.objective
		});

		const requestId = generateRequestId(SimRequest.reforgeOptimize);
		const inputData = new TextEncoder().encode(JSON.stringify(request));

		console.log('Request ID:', requestId);
		console.log('Request data size:', inputData.length, 'bytes');
		console.log('Serialized request:', JSON.stringify(request, null, 2));

		return new Promise<ReforgeOptimizationResult>((resolve, reject) => {
			this.activeRequests.set(requestId, {
				resolve,
				reject,
				progressCallback,
			});

			console.log('Active requests count:', this.activeRequests.size);

			this.sendMessage({
				id: requestId,
				msg: SimRequest.reforgeOptimize,
				inputData,
			});

			// Add timeout - give extra buffer beyond solver timeout
			setTimeout(() => {
				if (this.activeRequests.has(requestId)) {
					this.activeRequests.delete(requestId);
					reject(new Error('Worker request timed out after 210 seconds'));
				}
			}, 210000);
		});
	}

	private sendMessage(message: WorkerReceiveMessage) {
		if (this.worker) {
			this.worker.postMessage(message);
		}
	}

	destroy() {
		if (this.worker) {
			// Reject all active requests
			for (const [id, request] of this.activeRequests.entries()) {
				request.reject(new Error('Worker destroyed'));
			}
			this.activeRequests.clear();

			this.worker.terminate();
			this.worker = null;
		}
	}
}

// Singleton instance
let reforgeWorkerInstance: ReforgeWorker | null = null;

export function getReforgeWorker(): ReforgeWorker {
	if (!reforgeWorkerInstance) {
		reforgeWorkerInstance = new ReforgeWorker();
	}
	return reforgeWorkerInstance;
}

export function destroyReforgeWorker() {
	if (reforgeWorkerInstance) {
		reforgeWorkerInstance.destroy();
		reforgeWorkerInstance = null;
	}
}
