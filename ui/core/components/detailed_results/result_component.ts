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
	private readonly deferUntilShown: boolean;
	private tabShown: boolean;
	private pendingSimResult = false;

	constructor(config: ResultComponentConfig) {
		super(config.parent, config.rootCssClass || 'result-component');
		this.lastSimResult = null;
		this.deferUntilShown = !!config.deferUntilShown;
		this.tabShown = !this.deferUntilShown;

		config.resultsEmitter.on((_, resultData) => {
			if (!resultData) return;

			this.lastSimResult = resultData;
			if (this.tabShown) {
				this.onSimResult(resultData);
			} else {
				this.pendingSimResult = true;
			}
		});
	}

	onTabShown() {
		this.tabShown = true;
		if (!this.pendingSimResult) return;
		this.pendingSimResult = false;
		if (this.lastSimResult) this.onSimResult(this.lastSimResult);
	}

	onTabHidden() {
		if (this.deferUntilShown) this.tabShown = false;
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
