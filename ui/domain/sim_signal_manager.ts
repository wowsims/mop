export const enum RequestTypes {
	RaidSim = 0x1,
	StatWeights = 0x2,
	ReforgeOptimize = 0x4,
	All = 0xf,
}

class TriggerSignal {
	private readonly callbacks: (() => Promise<void>)[] = [];
	private triggered = false;

	async trigger() {
		if (this.triggered) return;
		this.triggered = true;
		return await Promise.all(this.callbacks.map(cb => cb()));
	}

	isTriggered() {
		return this.triggered;
	}

	/**
	 * Register an abort callback.
	 * @returns A function that removes the callback again. Callers that register per
	 * request against long-lived signals (a bulk run registers one per candidate) must
	 * call it when the request settles, or the list grows for the life of the run and a
	 * cancel fans out to every request that finished long ago.
	 */
	onTrigger(cb: () => Promise<void>): () => void {
		this.callbacks.push(cb);
		if (this.triggered) cb();
		return () => {
			const index = this.callbacks.indexOf(cb);
			if (index >= 0) this.callbacks.splice(index, 1);
		};
	}
}

export type SimSignals = {
	readonly abort: TriggerSignal;
};

const newSignals = (): SimSignals => {
	return {
		abort: new TriggerSignal(),
	};
};

export class SimSignalManager {
	private readonly running = new Map<SimSignals, { type: RequestTypes; signals: SimSignals }>();

	/**
	 * Create signals to control async requests with.
	 * @param type The type of the request.
	 * @returns The SimSignals object.
	 */
	registerRunning(type: RequestTypes): SimSignals {
		const signals = newSignals();
		this.running.set(signals, { type, signals: signals });
		return signals;
	}

	/**
	 * Remove signals from internal registry.
	 * @param signals The previously registered signals.
	 */
	unregisterRunning(signals: SimSignals) {
		this.running.delete(signals);
	}

	/**
	 * Trigger abort for all registered request ids.
	 * @param typeMask Limit to specific types of requests or all requests.
	 */
	async abortType(typeMask: RequestTypes) {
		for (const info of this.running.values()) {
			if (!(info.type & typeMask)) continue;
			await info.signals.abort.trigger();
		}
	}
}
