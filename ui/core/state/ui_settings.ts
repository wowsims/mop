import { LOCAL_STORAGE_PREFIX } from '../constants/other';
import { EventID } from '../state/batch';
import { SimStore, UISlice } from './sim_store';
export const WASM_CONCURRENCY_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_wasmconcurrency`;

// Presentation settings, moved out of Sim so the domain layer stays UI-free.
// State lives in the Zustand store's `ui` slice. Getters return the raw stored
// flags; Sim keeps its derived views (e.g. getShowHealingMetrics folding in
// the tank-spec check, getShowQuickSwap folding in hasTouch()).
export class UISettings {
	private readonly store: SimStore;
	constructor(store: SimStore) {
		this.store = store;
	}

	private get ui(): UISlice {
		return this.store.getState().ui;
	}

	private set(eventID: EventID, patch: Partial<UISlice>) {
		this.store.setState(s => ({ ui: { ...s.ui, ...patch } }));
	}

	getShowDamageMetrics(): boolean {
		return this.ui.showDamageMetrics;
	}
	setShowDamageMetrics(eventID: EventID, newShowDamageMetrics: boolean) {
		if (newShowDamageMetrics != this.ui.showDamageMetrics) {
			this.set(eventID, { showDamageMetrics: newShowDamageMetrics });
		}
	}

	getShowThreatMetrics(): boolean {
		return this.ui.showThreatMetrics;
	}
	setShowThreatMetrics(eventID: EventID, newShowThreatMetrics: boolean) {
		if (newShowThreatMetrics != this.ui.showThreatMetrics) {
			this.set(eventID, { showThreatMetrics: newShowThreatMetrics });
		}
	}

	getShowHealingMetrics(): boolean {
		return this.ui.showHealingMetrics;
	}
	setShowHealingMetrics(eventID: EventID, newShowHealingMetrics: boolean) {
		if (newShowHealingMetrics != this.ui.showHealingMetrics) {
			this.set(eventID, { showHealingMetrics: newShowHealingMetrics });
		}
	}

	getShowExperimental(): boolean {
		return this.ui.showExperimental;
	}
	setShowExperimental(eventID: EventID, newShowExperimental: boolean) {
		if (newShowExperimental != this.ui.showExperimental) {
			this.set(eventID, { showExperimental: newShowExperimental });
		}
	}

	getWasmConcurrency(): number {
		return this.ui.wasmConcurrency;
	}
	setWasmConcurrency(eventID: EventID, newWasmConcurrency: number) {
		if (newWasmConcurrency != this.ui.wasmConcurrency) {
			window.localStorage.setItem(WASM_CONCURRENCY_STORAGE_KEY, newWasmConcurrency.toString());
			this.set(eventID, { wasmConcurrency: newWasmConcurrency });
		}
	}

	getShowQuickSwap(): boolean {
		return this.ui.showQuickSwap;
	}
	setShowQuickSwap(eventID: EventID, newShowQuickSwap: boolean) {
		if (newShowQuickSwap != this.ui.showQuickSwap) {
			this.set(eventID, { showQuickSwap: newShowQuickSwap });
		}
	}

	getShowEPValues(): boolean {
		return this.ui.showEPValues;
	}
	setShowEPValues(eventID: EventID, newShowEPValues: boolean) {
		if (newShowEPValues != this.ui.showEPValues) {
			this.set(eventID, { showEPValues: newShowEPValues });
		}
	}

	getLanguage(): string {
		return this.ui.language;
	}
	setLanguage(eventID: EventID, newLanguage: string) {
		newLanguage = newLanguage || 'en';
		if (newLanguage != this.ui.language) {
			this.set(eventID, { language: newLanguage });
		}
	}

	// Initial language write (Sim's constructor); initialization, not a change.
	initLanguage(language: string) {
		this.store.setState(s => ({ ui: { ...s.ui, language } }));
	}
}
