/**
 * Reforge Worker Pool
 *
 * Manages a workerpool-backed queue for HiGHS-based reforge solver workers.
 */

import * as workerpool from 'workerpool';
import type { Pool } from 'workerpool';

import { REPO_NAME } from './constants/other.js';
import type { LPModel, LPSolution, SolverOptions } from '../worker/reforge_types';

const REFORGE_WORKER_URL = `/${REPO_NAME}/reforge_worker.js`;

type WorkerpoolTask<T> = PromiseLike<T> & {
	cancel: () => WorkerpoolTask<T>;
	timeout: (delay: number) => WorkerpoolTask<T>;
};

type ReforgeWorkerTasks = {
	initHiGHS: (wasmUrl?: string) => Promise<boolean>;
	solveProblem: (model: LPModel, options?: SolverOptions, wasmUrl?: string) => Promise<LPSolution>;
};

type ReforgeWorkerTaskName = keyof ReforgeWorkerTasks;
type ReforgeWorkerTaskParams<T extends ReforgeWorkerTaskName> = Parameters<ReforgeWorkerTasks[T]>;
type ReforgeWorkerTaskResult<T extends ReforgeWorkerTaskName> = Awaited<ReturnType<ReforgeWorkerTasks[T]>>;

/**
 * Pool of reforge workers
 * Multi-threaded and load-balanced across dedicated HiGHS worker instances.
 * Workers are pre-warmed on warmUp() to reduce first-solve latency.
 */
export class ReforgeWorkerPool {
	private static instance: ReforgeWorkerPool | null = null;
	private pool: Pool | null = null;
	private initPromise: Promise<boolean> | null = null;
	private isWarmedUp = false;
	private wasmUrl?: string;
	private numWorkers = 1;
	private resizePromise: Promise<void> = Promise.resolve();
	private readonly activeTasks = new Set<WorkerpoolTask<unknown>>();

	private constructor(numWorkers: number) {
		this.setNumWorkers(numWorkers);
	}

	async setNumWorkers(numWorkers: number): Promise<void> {
		const nextWorkerCount = Math.max(1, Math.floor(numWorkers || 1));
		if (nextWorkerCount === this.numWorkers) return this.resizePromise;

		const shouldWarmUp = this.isWarmedUp || !!this.initPromise;
		const wasmUrl = this.wasmUrl;

		this.resizePromise = this.resizePromise.then(async () => {
			if (nextWorkerCount === this.numWorkers) return;

			const oldPool = this.pool;

			this.pool = null;
			this.initPromise = null;
			this.isWarmedUp = false;
			this.numWorkers = nextWorkerCount;

			if (oldPool) {
				await oldPool.terminate(false).catch(error => {
					console.error('[ReforgeWorkerPool] Failed to terminate old pool:', error);
				});
			}
		});

		await this.resizePromise;

		if (shouldWarmUp) {
			await this.init(wasmUrl);
		}
	}

	getNumWorkers(): number {
		return this.numWorkers;
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
			await this.resizePromise;

			const initResults = await Promise.allSettled(
				Array.from({ length: this.numWorkers }, () => this.execTask('initHiGHS', [wasmUrl])),
			);

			const success = initResults.some(result => result.status === 'fulfilled' && result.value);
			this.isWarmedUp = success;
			return success;
		})();

		return this.initPromise;
	}

	/**
	 * Solve an LP problem using HiGHS
	 */
	async solve(model: LPModel, options: SolverOptions = {}): Promise<LPSolution> {
		await this.resizePromise;
		return await this.execTask('solveProblem', [model, options, this.wasmUrl]);
	}

	async abort() {
		const workerCount = Math.max(1, this.numWorkers);
		const wasmUrl = this.wasmUrl;
		const shouldWarmUp = this.isWarmedUp || !!this.initPromise;
		const pool = this.pool;

		for (const task of this.activeTasks) {
			task.cancel();
		}
		this.activeTasks.clear();

		this.pool = null;
		this.initPromise = null;
		this.isWarmedUp = false;

		if (pool) {
			await pool.terminate(true).catch(error => {
				console.error('[ReforgeWorkerPool] Failed to abort pool:', error);
			});
		}

		this.numWorkers = workerCount;
		if (shouldWarmUp) {
			await this.init(wasmUrl);
		}
	}

	/**
	 * Terminate the worker
	 */
	terminate() {
		for (const task of this.activeTasks) {
			task.cancel();
		}
		this.activeTasks.clear();

		this.pool?.terminate(true).catch(error => {
			console.error('[ReforgeWorkerPool] Failed to terminate pool:', error);
		});
		this.pool = null;
		this.initPromise = null;
		this.isWarmedUp = false;
		this.wasmUrl = undefined;
		ReforgeWorkerPool.instance = null;
	}

	private getPool(): Pool {
		if (!this.pool) {
			this.pool = workerpool.pool(REFORGE_WORKER_URL, {
				workerType: 'web',
				workerOpts: { type: 'module', name: 'reforge-worker' },
				minWorkers: 1,
				maxWorkers: this.numWorkers,
			});
		}

		return this.pool;
	}

	private execTask<T extends ReforgeWorkerTaskName>(method: T, params: ReforgeWorkerTaskParams<T>): WorkerpoolTask<ReforgeWorkerTaskResult<T>> {
		const task = this.getPool().exec(method, params) as WorkerpoolTask<ReforgeWorkerTaskResult<T>>;
		this.activeTasks.add(task);

		task.then(
			() => this.activeTasks.delete(task),
			() => this.activeTasks.delete(task),
		);

		return task;
	}
}

/**
 * Convenience function to get the reforge worker pool
 */
export function getReforgeWorkerPool(): ReforgeWorkerPool {
	return ReforgeWorkerPool.getInstance();
}
