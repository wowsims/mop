import { Component } from '../../components/component.js';
import { SimResult, SimResultFilter } from '../../proto_utils/sim_result.js';
import { EventID, TypedEvent } from '../../typed_event.js';

export interface SimResultData {
	eventID: EventID;
	result: SimResult;
	filter: SimResultFilter;
}

export interface ResultComponentConfig {
	parent: HTMLElement;
	rootCssClass?: string;
	resultsEmitter: TypedEvent<SimResultData | null>;
	deferUntilShown?: boolean;
}

export abstract class ResultComponent extends Component {
	lastSimResult: SimResultData | null;
	private resetCallbacks: (() => void)[] = [];
	private tabShown: boolean;

	constructor(config: ResultComponentConfig) {
		super(config.parent, config.rootCssClass || 'result-component');
		this.lastSimResult = null;
		this.tabShown = !config.deferUntilShown;

		config.resultsEmitter.on((_, resultData) => {
			if (!resultData) return;

			this.lastSimResult = resultData;
			if (this.tabShown) this.onSimResult(resultData);
		});
	}

	onTabShown() {
		if (this.tabShown) return;
		this.tabShown = true;
		if (this.lastSimResult) this.onSimResult(this.lastSimResult);
	}

	hasLastSimResult(): boolean {
		return !!this.lastSimResult;
	}

	getLastSimResult(): SimResultData {
		if (this.lastSimResult) {
			return this.lastSimResult;
		} else {
			throw new Error('No last sim result!');
		}
	}

	abstract onSimResult(resultData: SimResultData): void;

	addOnResetCallback(callback: () => void) {
		this.resetCallbacks.push(callback);
	}

	reset() {
		this.resetCallbacks.forEach(callback => callback());
		this.resetCallbacks = [];
	}
}
