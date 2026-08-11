import { WorkerInterface } from './worker_interface';

type HighsLoader = typeof import('highs').default;
type Highs = Awaited<ReturnType<HighsLoader>>;

// highs's own solution type is a union whose every member allows Status: 'Infeasible', so it
// cannot be narrowed to the variants that carry Primal. Read the columns through this structural
// type instead; a variable missing from the result is already an error on the Go side (see
// sim/core/reforge_optimizer/highs_js.go).
type HighsSolutionColumns = Record<string, { Primal: number }>;

type SimRequestAsync = (data: Uint8Array, progress: (result: Uint8Array) => void, id: string) => Uint8Array;
type SimRequestSync = (data: Uint8Array) => Uint8Array;

const unsupportedBulkSimAsync = () => {
	console.error('bulkSimAsync is only supported by the HTTP worker.');
	return new Uint8Array();
};

let highs: Highs | null = null;
let highsInitPromise: Promise<void> | null = null;

async function initHiGHS(): Promise<void> {
	if (highs) {
		return;
	}
	if (highsInitPromise) {
		return highsInitPromise;
	}

	highsInitPromise = (async () => {
		// highs ships CommonJS, so which of these holds the loader depends on the interop the
		// bundler applies.
		const highsModule = await import('highs');
		const loadHighs = (highsModule.default ?? highsModule) as HighsLoader;
		// highs.wasm is copied next to this worker by vite.build-workers.mts.
		highs = await loadHighs({
			locateFile: file => (file.endsWith('.wasm') ? 'highs.wasm' : file),
		});
	})();
	return highsInitPromise;
}

function solveHiGHSLP(lp: string, timeoutSeconds: number, mipRelGap: number): string {
	try {
		if (!highs) {
			throw new Error('HiGHS has not been initialized.');
		}
		const options: { presolve: 'on'; time_limit?: number; mip_rel_gap?: number } = { presolve: 'on' };
		if (timeoutSeconds > 0) {
			options.time_limit = timeoutSeconds;
		}
		if (mipRelGap > 0) {
			options.mip_rel_gap = mipRelGap;
		}
		const solution = highs.solve(lp, options);
		const columns = solution.Columns as HighsSolutionColumns;
		return JSON.stringify({
			status: solution.Status,
			values: Object.fromEntries(Object.entries(columns).map(([name, column]) => [name, column.Primal])),
		});
	} catch (error) {
		return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
	}
}

// Functions provided or used by the wasm lib.
declare global {
	function wasmready(): void;
	const computeStats: SimRequestSync;
	const computeStatsJson: SimRequestSync;
	const reforgeOptimizeAsync: SimRequestAsync;
	const raidSim: SimRequestSync;
	const raidSimJson: SimRequestSync;
	const raidSimAsync: SimRequestAsync;
	const statWeights: SimRequestSync;
	const statWeightsAsync: SimRequestAsync;
	const statWeightRequests: SimRequestSync;
	const statWeightCompute: SimRequestSync;
	var __wowsimsSolveHiGHSLP: (lp: string, timeoutSeconds: number, mipRelGap: number) => string;
	const raidSimResultCombination: SimRequestSync;
	const bulkCombinationCount: SimRequestSync;
	const bulkCandidates: SimRequestSync;
	const raidSimRequestSplit: SimRequestSync;
	const abortById: SimRequestSync;
}

// Wasm binary calls this function when its done loading.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
globalThis.wasmready = function () {
	globalThis.__wowsimsSolveHiGHSLP = solveHiGHSLP;
	setupWorkerInterface();
};

function setupWorkerInterface() {
	new WorkerInterface({
		computeStats: computeStats,
		computeStatsJson: computeStatsJson,
		reforgeOptimizeAsync: async (inputData, progress, id) => {
			await initHiGHS();
			reforgeOptimizeAsync(inputData, progress, id);
			return new Uint8Array();
		},
		raidSim: raidSim,
		raidSimJson: raidSimJson,
		raidSimAsync: raidSimAsync,
		bulkSimAsync: unsupportedBulkSimAsync,
		bulkCombinationCount: bulkCombinationCount,
		bulkCandidates: bulkCandidates,
		statWeights: statWeights,
		statWeightsAsync: statWeightsAsync,
		statWeightRequests: statWeightRequests,
		statWeightCompute: statWeightCompute,
		raidSimRequestSplit: raidSimRequestSplit,
		raidSimResultCombination: raidSimResultCombination,
		abortById: abortById,
	}).ready(true);
}

const go = new Go();
let inst: WebAssembly.Instance | null = null;

WebAssembly.instantiateStreaming(fetch('lib.wasm'), go.importObject).then(async result => {
	inst = result.instance;
	// console.log("loading wasm...")
	await go.run(inst);
});

export {};
