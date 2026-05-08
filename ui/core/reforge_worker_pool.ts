/**
 * Reforge Worker Pool
 *
 * Manages communication with the HiGHS-based reforge solver worker.
 */

import { REPO_NAME } from './constants/other.js';
import type { LPModel, LPSolution, ReforgeWorkerReceiveMessage, ReforgeWorkerSendMessage, SolverOptions } from '../worker/reforge_types';
import { WorkerPoolManager } from './concurrent_worker_pool';

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
	private readyPromise: Promise<void>;
	private readyResolve!: () => void;
	private workerId: string;
	private solveTasksRunning = 0;
	private initialized = false;

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
				resolve: value => {
					this.initialized = !!value;
					resolve(value as boolean);
				},
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
		this.solveTasksRunning += 1;

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve: value => {
					this.solveTasksRunning = Math.max(0, this.solveTasksRunning - 1);
					resolve(value as LPSolution);
				},
				reject: reason => {
					this.solveTasksRunning = Math.max(0, this.solveTasksRunning - 1);
					reject(reason);
				},
			});

			this.postMessage({
				id,
				msg: 'solve',
				model,
				options,
			});
		});
	}

	getSolveTaskWorkAmount(): number {
		return this.solveTasksRunning;
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	abort() {
		if (!this.pendingRequests.size) return;

		for (const [_, pending] of this.pendingRequests) {
			pending.reject(new Error('Solve cancelled'));
		}

		this.pendingRequests.clear();
		this.worker?.terminate();
		this.solveTasksRunning = 0;
	}

	terminate() {
		this.worker?.terminate();
		this.worker = null;
		this.solveTasksRunning = 0;
		this.initialized = false;

		// Reject all pending requests
		for (const [_, pending] of this.pendingRequests) {
			pending.reject(new Error('Worker terminated'));
		}
		this.pendingRequests.clear();
	}
}

/**
 * Pool of reforge workers
 * Multi-threaded and load-balanced across dedicated HiGHS worker instances.
 * Workers are pre-warmed on warmUp() to reduce first-solve latency.
 */
export class ReforgeWorkerPool {
	private readonly concurrencyPool: WorkerPoolManager<ReforgeWorker>;
	private static instance: ReforgeWorkerPool | null = null;
	private initPromise: Promise<boolean> | null = null;
	private isWarmedUp = false;
	private wasmUrl?: string;

	private constructor(numWorkers: number) {
		this.concurrencyPool = new WorkerPoolManager<ReforgeWorker>({
			create: i => new ReforgeWorker(i),
			getWorkAmount: worker => worker.getSolveTaskWorkAmount(),
			destroy: worker => worker.terminate(),
		});
		this.setNumWorkers(numWorkers);
	}

	async setNumWorkers(numWorkers: number): Promise<void> {
		const { added: addedWorkers } = this.concurrencyPool.resize(numWorkers);

		if (addedWorkers.length > 0 && (this.isWarmedUp || this.initPromise)) {
			await Promise.all(
				addedWorkers.map(async worker => {
					await worker.waitForReady();
					return worker.initHiGHS(this.wasmUrl);
				}),
			);
		}
	}

	getNumWorkers(): number {
		return this.concurrencyPool.getNumWorkers();
	}

	private getLeastBusyWorker(): ReforgeWorker {
		return this.concurrencyPool.getLeastBusyWorker(worker => worker.isInitialized());
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ReforgeWorkerPool {
		if (!ReforgeWorkerPool.instance) {
			ReforgeWorkerPool.instance = new ReforgeWorkerPool(1);
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

		this.wasmUrl = wasmUrl;

		this.initPromise = (async () => {
			const initResults = await Promise.all(
				this.concurrencyPool.getWorkers().map(async worker => {
					await worker.waitForReady();
					return worker.initHiGHS(wasmUrl);
				}),
			);

			const success = initResults.some(Boolean);
			this.isWarmedUp = success;
			return success;
		})();

		return this.initPromise;
	}

	/**
	 * Solve an LP problem using HiGHS
	 */
	async solve(model: LPModel, options: SolverOptions = {}): Promise<LPSolution> {
		if (this.concurrencyPool.getNumWorkers() === 0) {
			await this.init();
		}

		if (!this.concurrencyPool.hasWorker(worker => worker.isInitialized())) {
			this.initPromise = null;
			await this.init(this.wasmUrl);
		}

		if (this.concurrencyPool.hasWorker(worker => !worker.isInitialized())) {
			this.initPromise = null;
			await this.init(this.wasmUrl);
		}

		if (!this.concurrencyPool.hasWorker(worker => worker.isInitialized())) {
			throw new Error('Failed to initialize reforge workers');
		}

		const worker = this.getLeastBusyWorker();
		return worker.solve(model, options);
	}

	async abort() {
		const workerCount = Math.max(1, this.concurrencyPool.getNumWorkers());
		const wasmUrl = this.wasmUrl;
		const shouldWarmUp = this.isWarmedUp || !!this.initPromise;
		this.concurrencyPool.clear();
		this.initPromise = null;
		this.isWarmedUp = false;

		await this.setNumWorkers(workerCount);
		if (shouldWarmUp) {
			await this.init(wasmUrl);
		}
	}

	/**
	 * Terminate the worker
	 */
	terminate() {
		this.concurrencyPool.clear();
		this.initPromise = null;
		this.isWarmedUp = false;
		this.wasmUrl = undefined;
		ReforgeWorkerPool.instance = null;
	}
}

/**
 * Convenience function to get the reforge worker pool
 */
export function getReforgeWorkerPool(): ReforgeWorkerPool {
	return ReforgeWorkerPool.getInstance();
}
