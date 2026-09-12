import type { Sim } from '@sim/sim';
import { createSimStore } from '@sim/state/sim_store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from './SettingsDialog';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const toasts = vi.hoisted(() => [] as Array<{ variant: string; body: unknown }>);
vi.mock('@ui-kit/Toast', async importOriginal => ({
	...(await importOriginal<typeof import('@ui-kit/Toast')>()),
	toastManager: {
		add: (options: { variant: string; body: unknown }) => {
			toasts.push(options);
			return '';
		},
		close: () => {},
	},
}));
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../tracking/analytics', () => ({ trackEvent }));

class FakeSim {
	readonly store = createSimStore();
	wasm = Promise.resolve(true);

	isWasm() {
		return this.wasm;
	}
	getFixedRngSeed() {
		return this.store.getState().sim.fixedRngSeed;
	}
	setFixedRngSeed(value: number) {
		this.store.setState(state => ({ sim: { ...state.sim, fixedRngSeed: value } }));
	}
	getLastUsedRngSeed() {
		return this.store.getState().sim.lastUsedRngSeed;
	}
	recordLastUsedRngSeed(value: number) {
		this.store.setState(state => ({
			sim: { ...state.sim, lastUsedRngSeed: value, lastUsedRngSeedVersion: state.sim.lastUsedRngSeedVersion + 1 },
		}));
	}
	getLanguage() {
		return this.store.getState().ui.language;
	}
	setLanguage(value: string) {
		this.store.setState(state => ({ ui: { ...state.ui, language: value } }));
	}
	getShowThreatMetrics() {
		return this.store.getState().ui.showThreatMetrics;
	}
	setShowThreatMetrics(value: boolean) {
		this.store.setState(state => ({ ui: { ...state.ui, showThreatMetrics: value } }));
	}
	getShowExperimental() {
		return this.store.getState().ui.showExperimental;
	}
	setShowExperimental(value: boolean) {
		this.store.setState(state => ({ ui: { ...state.ui, showExperimental: value } }));
	}
	getShowQuickSwap() {
		return this.store.getState().ui.showQuickSwap;
	}
	setShowQuickSwap(value: boolean) {
		this.store.setState(state => ({ ui: { ...state.ui, showQuickSwap: value } }));
	}
	getWasmConcurrency() {
		return this.store.getState().ui.wasmConcurrency;
	}
	setWasmConcurrency(value: number) {
		this.store.setState(state => ({ ui: { ...state.ui, wasmConcurrency: value } }));
	}
}

const mount = (sim: FakeSim, applyDefaults = vi.fn()) => {
	const host = { rootElem: document.body, sim: sim as unknown as Sim, applyDefaults } as never;
	const rendered = render(<SettingsDialog open onOpenChange={() => {}} host={host} />);
	return { ...rendered, applyDefaults };
};

const container = () => document.querySelector('.use-concurrency-container') as HTMLElement;

describe('SettingsDialog', () => {
	it('renders every picker under the id the vanilla menu used', () => {
		mount(new FakeSim());

		for (const id of [
			'simui-fixed-rng-seed',
			'simui-language-picker',
			'simui-show-threat-metrics',
			'simui-show-experimental',
			'simui-show-quick-swap',
			'simui-concurrent-workers-picker',
		]) {
			expect(document.getElementById(id), id).toBeTruthy();
		}
	});

	it('keeps the concurrency row mounted and hides it with the attribute when the sim is not wasm', async () => {
		const sim = new FakeSim();
		sim.wasm = Promise.resolve(false);
		mount(sim);

		expect(container().hidden).toBe(false);
		await waitFor(() => expect(container().hidden).toBe(true));
		expect(container().isConnected).toBe(true);
	});

	it('keeps the worker note mounted and hidden off firefox', () => {
		mount(new FakeSim());

		const note = container().querySelector('.form-text') as HTMLElement;
		expect(note.hidden).toBe(true);
		expect(note.textContent).toBe('');
	});

	it('writes a toggle through to the sim', () => {
		const sim = new FakeSim();
		mount(sim);

		act(() => {
			fireEvent.click(document.getElementById('simui-show-threat-metrics')!);
		});
		expect(sim.getShowThreatMetrics()).toBe(true);
	});

	it('follows the last used rng seed', async () => {
		const sim = new FakeSim();
		mount(sim);

		expect(document.querySelector('.last-used-rng-seed')!.textContent).toBe('0');
		act(() => {
			sim.recordLastUsedRngSeed(1234);
		});
		await waitFor(() => expect(document.querySelector('.last-used-rng-seed')!.textContent).toBe('1234'));
	});

	it('restores defaults, reports it and toasts', () => {
		toasts.length = 0;
		trackEvent.mockClear();
		const { applyDefaults } = mount(new FakeSim());

		act(() => {
			fireEvent.click(screen.getByRole('button', { name: 'info.options.restore_defaults.button' }));
		});

		expect(applyDefaults).toHaveBeenCalledTimes(1);
		expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'restore-defaults', label: 'restore' });
		expect(toasts).toEqual([{ variant: 'success', body: 'info.options.restore_defaults.success_message' }]);
	});
});
