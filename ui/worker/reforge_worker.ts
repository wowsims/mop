/**
 * Reforge LP Solver Web Worker
 *
 * Uses HiGHS WASM for high-performance linear programming solving
 */

import type { LPSolution, ReforgeWorkerReceiveMessage, ReforgeWorkerSendMessage } from './reforge_types';
import { modelToLPFormat, highsSolutionToLPSolution, type HighsSolution } from './lp_format';

// HiGHS module type
interface HighsModule {
	solve: (problem: string, options?: Record<string, unknown>) => HighsSolution;
}

// Factory function type returned by our custom highs.js
type HighsFactory = (options?: { locateFile?: (file: string) => string }) => Promise<HighsModule>;

// Will be set after WASM loads
let highs: HighsModule | null = null;
let workerId = '';
let cachedWasmUrl: string | undefined = undefined;

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

	try {
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
	} catch (error) {
		console.error('[ReforgeWorker] Failed to initialize HiGHS:', error);
		return false;
	}
}

/**
 * Post message back to main thread
 */
function postMsg(msg: ReforgeWorkerSendMessage) {
	postMessage(msg);
}

/**
 * Solve LP problem using HiGHS
 */
async function solveProblem(msg: Extract<ReforgeWorkerReceiveMessage, { msg: 'solve' }>): Promise<void> {
	const { id, model, options } = msg;

	try {
		const initSuccess = await initHiGHS();
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

		postMsg({
			msg: 'solve',
			id,
			solution,
		});
	} catch (error) {
		console.error('[ReforgeWorker] Error:', error);
		postMsg({
			msg: 'error',
			id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Handle incoming messages
 */
addEventListener('message', async ({ data }: MessageEvent<ReforgeWorkerReceiveMessage>) => {
	const { id, msg } = data;

	switch (msg) {
		case 'setID':
			workerId = id;
			postMsg({ msg: 'idConfirm' });
			break;

		case 'init': {
			const initMsg = data as Extract<ReforgeWorkerReceiveMessage, { msg: 'init' }>;
			const success = await initHiGHS(initMsg.wasmUrl);
			postMsg({
				msg: 'init',
				id,
				success,
			});
			break;
		}

		case 'solve':
			await solveProblem(data as Extract<ReforgeWorkerReceiveMessage, { msg: 'solve' }>);
			break;
	}
});

// Auto-initialize on load
initHiGHS().then(() => {
	postMsg({ msg: 'ready' });
});

export {};
