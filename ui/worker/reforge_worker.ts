/**
 * Reforge LP Solver WorkerPool worker
 *
 * Uses HiGHS WASM for high-performance linear programming solving
 */

import * as workerpool from 'workerpool';

import type { LPModel, LPSolution, SolverOptions } from './reforge_types';
import { modelToLPFormat, highsSolutionToLPSolution, type HighsSolution } from './lp_format';

// HiGHS module type
interface HighsModule {
	solve: (problem: string, options?: Record<string, unknown>) => HighsSolution;
}

// Factory function type returned by our custom highs.js
type HighsFactory = (options?: { locateFile?: (file: string) => string }) => Promise<HighsModule>;

// Will be set after WASM loads
let highs: HighsModule | null = null;
let cachedWasmUrl: string | undefined = undefined;
let initPromise: Promise<boolean> | null = null;

/**
 * Get the base URL for loading WASM files
 */
function getBaseUrl(): string {
	try {
		const url = new URL(import.meta.url);
		return url.origin + url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
	} catch {
		return '/mop/';
	}
}

/**
 * Initialize HiGHS WASM module
 */
async function initHiGHS(wasmUrl?: string): Promise<boolean> {
	// Already initialized
	if (highs) {
		return true;
	}

	if (wasmUrl) {
		cachedWasmUrl = wasmUrl;
	}

	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		const baseUrl = getBaseUrl();
		const locateFile = (file: string) => {
			if (file.endsWith('.wasm')) {
				return cachedWasmUrl || `${baseUrl}highs.wasm`;
			}
			return `${baseUrl}${file}`;
		};

		// @ts-ignore - Custom build module
		const highsModule = await import('./highs.js');
		const highsFactory = (highsModule.default || highsModule) as HighsFactory;
		highs = await highsFactory({ locateFile });
		return true;
	})().catch(error => {
		initPromise = null;
		console.error('[ReforgeWorker] Failed to initialize HiGHS:', error);
		return false;
	});

	try {
		return await initPromise;
	} catch (error) {
		console.error('[ReforgeWorker] Failed to initialize HiGHS:', error);
		return false;
	}
}

/**
 * Solve LP problem using HiGHS
 */
async function solveProblem(model: LPModel, options: SolverOptions = {}, wasmUrl?: string): Promise<LPSolution> {
	try {
		const initSuccess = await initHiGHS(wasmUrl);
		if (!initSuccess || !highs) {
			throw new Error('Failed to initialize HiGHS');
		}

		const { lpString, reverseNameMap } = modelToLPFormat(model);

		const highsOptions: Record<string, unknown> = {
			presolve: 'on',
		};

		if (options.timeout) {
			highsOptions['time_limit'] = options.timeout / 1000;
		}

		if (options.tolerance) {
			// Leaving this as default for now, can adjust later if needed
			//highsOptions['mip_rel_gap'] = options.tolerance;
			//highsOptions['mip_abs_gap'] = options.tolerance;
		}

		const highsSolution = highs.solve(lpString, highsOptions);
		const solution = highsSolutionToLPSolution(highsSolution, reverseNameMap, 0.5);

		return solution;
	} catch (error) {
		console.error('[ReforgeWorker] Error:', error);
		throw error;
	}
}

workerpool.worker({
	initHiGHS,
	solveProblem,
});

export {};
