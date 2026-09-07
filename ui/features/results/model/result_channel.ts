import { Emitter } from '@domain/state/events';

import type { SimResultData } from './result_data';

// `getSnapshot` must keep returning the same object until the next `emit`: `useSyncExternalStore`
// reads a new snapshot identity as a change, so a getter that built one would re-render forever.
export class ResultChannel extends Emitter<SimResultData | null> {
	private snapshot: SimResultData | null = null;

	readonly subscribe = (listener: () => void): (() => void) => this.on(listener);

	readonly getSnapshot = (): SimResultData | null => this.snapshot;

	emit(value: SimResultData | null) {
		this.snapshot = value;
		super.emit(value);
	}
}
