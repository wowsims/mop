import type { SimWarning } from '@domain/sim_host';
import type { StoreSubscribe } from '@domain/state/subscriptions';

export class WarningsRegistry {
	private readonly warnings: Array<SimWarning> = [];
	private readonly listeners: Array<() => void> = [];

	readonly subscribe: StoreSubscribe = (onChange: () => void) => {
		this.listeners.push(onChange);
		return () => {
			const index = this.listeners.indexOf(onChange);
			if (index != -1) this.listeners.splice(index, 1);
		};
	};

	// A fresh array per call, so a React consumer must read it through
	// useStoreSubscribe's snapshot cache rather than useSyncExternalStore.
	readonly getContents = (): Array<string> =>
		this.warnings
			.map(warning => warning.getContent())
			.flat()
			.filter(content => content !== '');

	add(warning: SimWarning): () => void {
		this.warnings.push(warning);
		const unsubscribe = warning.updateOn(() => this.notify());
		this.notify();
		return () => {
			unsubscribe();
			const index = this.warnings.indexOf(warning);
			if (index != -1) this.warnings.splice(index, 1);
			this.notify();
		};
	}

	private notify() {
		this.listeners.slice().forEach(listener => listener());
	}
}
