import { RequestTypes } from './sim_signal_manager';
import type { SimRunKind, SimStore } from './state/sim_store';
import { patchRun, SIM_RUN_KINDS } from './state/sim_store';

const REQUEST_TYPE: Record<SimRunKind, RequestTypes> = {
	'individual-sim': RequestTypes.IndividualSim,
	'bulk-sim': RequestTypes.BulkSim,
	'stat-weights': RequestTypes.StatWeights,
	'reforge-optimize': RequestTypes.ReforgeOptimize,
};

export interface RunContext<TProgress> {
	emit: (progress: TProgress) => void;
}

interface SignalHost {
	abortType(typeMask: RequestTypes): Promise<void>;
}

// Runs a store write inside a caller-supplied wrapper. React commits an update
// scheduled from outside React on a microtask, so `app/` passes `flushSync`; the
// sim layer keeps no React import.
export type RunFlush = (write: () => void) => void;

export class SimRuns {
	private readonly listeners = new Map<SimRunKind, Set<(progress: never) => void>>();
	private readonly last = new Map<SimRunKind, unknown>();
	// Which start owns a kind right now. A start aborts the previous run, whose
	// `finally` then lands after the new one has already flagged itself running.
	private readonly owner = new Map<SimRunKind, symbol>();
	private flush: RunFlush = write => write();

	constructor(
		private readonly store: SimStore,
		private readonly signals: SignalHost,
	) {}

	setFlush(flush: RunFlush) {
		this.flush = flush;
	}

	isRunning(kind: SimRunKind): boolean {
		return this.store.getState().runs[kind].isRunning;
	}

	isAborting(kind: SimRunKind): boolean {
		return this.store.getState().runs[kind].isAborting;
	}

	// Deliberately not `async`: the running flag has to land in the caller's own task, because
	// `sidebar-loading.mjs` asserts the spinner is up before the click handler returns and an
	// injected `flushSync` cannot reach a write that happens a microtask later.
	start<T, TProgress = never>(kind: SimRunKind, run: (ctx: RunContext<TProgress>) => Promise<T>): Promise<T> {
		const token = Symbol(kind);
		this.owner.set(kind, token);
		this.last.delete(kind);
		this.write(kind, this.isRunning(kind) ? { isAborting: true } : { isRunning: true, isAborting: false });
		return (async () => {
			try {
				// Unconditional, and not `abort()`: the store only knows about runs this facade
				// started, and a request left over from a previous abort has to be cleared before the
				// worker will answer a new one. Inside the `try`, so a rejecting abort still clears.
				await this.signals.abortType(REQUEST_TYPE[kind]);
				this.write(kind, { isRunning: true, isAborting: false });
				return await run({ emit: progress => this.emit(kind, progress) });
			} finally {
				if (this.owner.get(kind) === token) {
					this.owner.delete(kind);
					this.write(kind, { isRunning: false, isAborting: false });
				}
			}
		})();
	}

	async abort(kind: SimRunKind | 'all'): Promise<void> {
		const kinds = (kind === 'all' ? SIM_RUN_KINDS : [kind]).filter(k => this.isRunning(k));
		if (!kinds.length) return;
		kinds.forEach(k => this.write(k, { isAborting: true }));
		await this.signals.abortType(kinds.reduce<RequestTypes>((mask, k) => (mask | REQUEST_TYPE[k]) as RequestTypes, 0 as RequestTypes));
	}

	onProgress<TProgress>(kind: SimRunKind, callback: (progress: TProgress) => void): () => void {
		const set = this.listeners.get(kind) ?? new Set();
		this.listeners.set(kind, set);
		set.add(callback as (progress: never) => void);
		return () => set.delete(callback as (progress: never) => void);
	}

	lastProgress<TProgress>(kind: SimRunKind): TProgress | null {
		return (this.last.get(kind) as TProgress) ?? null;
	}

	private emit<TProgress>(kind: SimRunKind, progress: TProgress) {
		this.last.set(kind, progress);
		this.listeners.get(kind)?.forEach(callback => (callback as (progress: TProgress) => void)(progress));
	}

	private write(kind: SimRunKind, patch: { isRunning?: boolean; isAborting?: boolean }) {
		this.flush(() => patchRun(this.store, kind, patch));
	}
}
