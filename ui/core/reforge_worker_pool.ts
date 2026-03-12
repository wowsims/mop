/**
 * Reforge Worker Pool
 *
 * Manages communication with the HiGHS-based reforge solver worker.
 */

import { REPO_NAME } from './constants/other.js';
import type { LPModel, LPSolution, ReforgeWorkerReceiveMessage, ReforgeWorkerSendMessage, SolverOptions } from '../worker/reforge_types';

const REFORGE_WORKER_URL = `/${REPO_NAME}/reforge_worker.js`;

/**
 * Generate random request ID
 */
function generateRequestId(prefix: string = 'reforge'): string {
	const chars = Array.from(Array(4)).map(() => Math.floor(Math.random() * 0x10000).toString(16));
	return prefix + '-' + chars.join('');
}

/**
 * Single reforge worker instance
 */
class ReforgeWorker {
	private worker: Worker | null = null;
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (reason: unknown) => void;
		}
	>();
	private isReady = false;
	private readyPromise: Promise<void>;
	private readyResolve!: () => void;
	private workerId: string;

	constructor(id: number) {
		this.workerId = `reforge-worker-${id}`;
		this.readyPromise = new Promise(resolve => {
			this.readyResolve = resolve;
		});
		this.init();
	}

	private init() {
		this.worker = new Worker(REFORGE_WORKER_URL, { type: 'module' });

		this.worker.addEventListener('message', (event: MessageEvent<ReforgeWorkerSendMessage>) => {
			this.handleMessage(event.data);
		});

		this.worker.addEventListener('error', error => {
			console.error(`[${this.workerId}] Worker error:`, error);
		});
	}

	private handleMessage(data: ReforgeWorkerSendMessage) {
		switch (data.msg) {
			case 'ready':
				this.isReady = true;
				this.readyResolve();
				break;

			case 'idConfirm':
				break;

			case 'init':
				if (data.id) {
					const pending = this.pendingRequests.get(data.id);
					if (pending) {
						pending.resolve(data.success);
						this.pendingRequests.delete(data.id);
					}
				}
				break;

			case 'solve':
				if (data.id) {
					const pending = this.pendingRequests.get(data.id);
					if (pending) {
						pending.resolve(data.solution);
						this.pendingRequests.delete(data.id);
					}
				}
				break;

			case 'error':
				if (data.id) {
					const pending = this.pendingRequests.get(data.id);
					if (pending) {
						pending.reject(new Error(data.error));
						this.pendingRequests.delete(data.id);
					}
				}
				break;

			case 'progress':
				// Progress updates - could be used for UI feedback
				break;
		}
	}

	private postMessage(msg: ReforgeWorkerReceiveMessage) {
		this.worker?.postMessage(msg);
	}

	async waitForReady(): Promise<void> {
		return this.readyPromise;
	}

	async initHiGHS(wasmUrl?: string): Promise<boolean> {
		await this.readyPromise;

		const id = generateRequestId('init');

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
			});

			this.postMessage({
				id,
				msg: 'init',
				wasmUrl,
			});
		});
	}

	async solve(model: LPModel, options: SolverOptions): Promise<LPSolution> {
		await this.readyPromise;

		const id = generateRequestId('solve');

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
			});

			this.postMessage({
				id,
				msg: 'solve',
				model,
				options,
			});
		});
	}

	terminate() {
		this.worker?.terminate();
		this.worker = null;
		this.isReady = false;

		// Reject all pending requests
		for (const [id, pending] of this.pendingRequests) {
			pending.reject(new Error('Worker terminated'));
		}
		this.pendingRequests.clear();
	}
}

/**
 * Pool of reforge workers
 * Currently single-threaded since HiGHS WASM is already optimized
 * Worker is pre-warmed on getInstance() to reduce first-solve latency
 */
export class ReforgeWorkerPool {
	private worker: ReforgeWorker | null = null;
	private static instance: ReforgeWorkerPool | null = null;
	private initPromise: Promise<boolean> | null = null;
	private isWarmedUp = false;

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ReforgeWorkerPool {
		if (!ReforgeWorkerPool.instance) {
			ReforgeWorkerPool.instance = new ReforgeWorkerPool();
		}
		return ReforgeWorkerPool.instance;
	}

	/**
	 * Pre-warm the worker by loading HiGHS WASM in the background
	 * Call this early (e.g., when sim UI loads) to reduce first-solve latency
	 * Returns immediately - warming happens in background
	 */
	warmUp(wasmUrl?: string): void {
		if (this.isWarmedUp || this.initPromise) {
			return;
		}

		this.initPromise = this.init(wasmUrl).then(success => {
			this.isWarmedUp = success;
			return success;
		});
	}

	/**
	 * Check if worker is warmed up and ready
	 */
	isReady(): boolean {
		return this.isWarmedUp;
	}

	/**
	 * Initialize the worker
	 */
	async init(wasmUrl?: string): Promise<boolean> {
		// If already initializing, return existing promise
		if (this.initPromise) {
			return this.initPromise;
		}

		if (!this.worker) {
			this.worker = new ReforgeWorker(0);
		}

		await this.worker.waitForReady();
		const success = await this.worker.initHiGHS(wasmUrl);
		this.isWarmedUp = success;
		return success;
	}

	/**
	 * Solve an LP problem using HiGHS
	 */
	async solve(model: LPModel, options: SolverOptions = {}): Promise<LPSolution> {
		if (!this.worker) {
			await this.init();
		}

		return this.worker!.solve(model, options);
	}

	/**
	 * Terminate the worker
	 */
	terminate() {
		this.worker?.terminate();
		this.worker = null;
		ReforgeWorkerPool.instance = null;
	}
}

/**
 * Convenience function to get the reforge worker pool
 */
export function getReforgeWorkerPool(): ReforgeWorkerPool {
	return ReforgeWorkerPool.getInstance();
}
