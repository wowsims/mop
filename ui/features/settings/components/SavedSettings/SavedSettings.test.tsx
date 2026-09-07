import { SimHostProvider } from '@sim/context/SimHostContext';
import { ItemSwap, Race } from '@generated/proto/common';
import { SavedSettings as SavedSettingsProto } from '@generated/proto/ui';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedSettings } from './SavedSettings';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeAll: () => source.subscribe,
	subscribePartyBuffs: () => () => () => undefined,
	subscribePlayerField: () => () => () => undefined,
	subscribeRaidField: () => () => () => undefined,
}));

const savedSettingsModel = vi.hoisted(() => ({
	readSavedSettings: vi.fn(),
	applySavedSettings: vi.fn(),
}));
vi.mock('@features/settings/model/saved_settings', () => savedSettingsModel);

const STRINGS = vi.hoisted(
	() =>
		({
			'settings_tab.saved_settings.settings': 'Settings',
			'settings_tab.saved_settings.title': 'Saved Settings',
			'settings_tab.saved_settings.settings_name': 'Settings Name',
			'settings_tab.saved_settings.save_settings': 'Save Settings',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const STORAGE_KEY = 'mop-warrior-savedSettings';

const settingsWith = (race: Race) => SavedSettingsProto.create({ race });
const storedJson = (race: Race) => SavedSettingsProto.toJson(settingsWith(race));

let host: any;
let presets: Array<any>;
let itemSwapPresets: Array<any>;
let waitForInit: () => Promise<void>;

const setup = () => {
	source.listeners.clear();
	trackEvent.mockClear();
	window.localStorage.clear();
	presets = [];
	itemSwapPresets = [];
	waitForInit = () => Promise.resolve();

	let current = settingsWith(Race.RaceHuman);
	savedSettingsModel.readSavedSettings.mockImplementation(() => current);
	savedSettingsModel.applySavedSettings.mockImplementation((_h: unknown, settings: SavedSettingsProto) => {
		current = settings;
		source.notify();
	});

	host = {
		player: { getParty: () => ({}) },
		sim: { waitForInit: () => waitForInit(), raid: {} },
		get individualConfig() {
			return { presets: { settings: presets, itemSwaps: itemSwapPresets } };
		},
		getSavedSettingsStorageKey: () => STORAGE_KEY,
	};
};

const renderPanel = async () => {
	const result = render(
		<SimHostProvider host={host}>
			<SavedSettings />
		</SimHostProvider>,
	);
	await act(async () => {});
	return result;
};

const nameInput = () => document.querySelector<HTMLInputElement>('.saved-data-save-input')!;
const saveButton = () => document.querySelector<HTMLButtonElement>('.saved-data-save-button')!;
const chips = (section: 'presets' | 'custom') => [...document.querySelectorAll(`.saved-data-${section} .saved-data-set-chip`)];
const chipNamed = (name: string) => [...document.querySelectorAll('.saved-data-set-chip')].find(chip => chip.textContent?.startsWith(name))!;
const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');

beforeEach(setup);

describe('SavedSettings', () => {
	describe('saving', () => {
		it('writes the current settings under the typed name and shows it as a chip', async () => {
			savedSettingsModel.readSavedSettings.mockReturnValue(settingsWith(Race.RaceOrc));
			await renderPanel();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			expect(stored()).toEqual({ Raiding: storedJson(Race.RaceOrc) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'save', label: 'Settings' });
		});
	});

	describe('loading', () => {
		it('applies a stored set through applySavedSettings and reports it', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(Race.RaceOrc) }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);

			expect(savedSettingsModel.applySavedSettings).toHaveBeenCalledTimes(1);
			expect(savedSettingsModel.applySavedSettings.mock.calls[0]![1].race).toBe(Race.RaceOrc);
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'load', label: 'Settings' });
		});

		it("shows a settings preset's tooltip", async () => {
			presets = [{ name: 'Council', race: Race.RaceOrc, tooltip: 'For the council fight' }];
			await renderPanel();

			expect(chipNamed('Council').querySelector('.saved-data-set-name')!.getAttribute('data-tooltip-content')).toBe('For the council fight');
		});

		// The item-swap preset bakes in a snapshot of load-time settings via `readSavedSettings(host)`,
		// so it must NOT track the live subscribed value. If the presets memo depended on `settings`
		// instead of only `[ready, host, config]`, every itemSwap preset's `json` would track the
		// current settings and the chip would read "active" forever.
		it("bakes the item-swap preset's snapshot at build time, not the live settings", async () => {
			itemSwapPresets = [{ name: 'Council Swap', itemSwap: ItemSwap.create() }];
			await renderPanel();

			expect(chipNamed('Council Swap').classList.contains('active')).toBe(false);

			await act(async () => {
				savedSettingsModel.applySavedSettings(host, settingsWith(Race.RaceOrc));
			});

			expect(chipNamed('Council Swap').classList.contains('active')).toBe(false);
		});

		it('holds the presets back until the sim is ready', () => {
			presets = [{ name: 'Council', race: Race.RaceOrc }];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Mine: storedJson(Race.RaceOrc) }));
			let resolveInit = () => {};
			waitForInit = () => new Promise(resolve => (resolveInit = resolve));

			render(
				<SimHostProvider host={host}>
					<SavedSettings />
				</SimHostProvider>,
			);

			expect(chips('presets')).toHaveLength(0);
			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Mine']);
			resolveInit();
		});
	});

	describe('deleting', () => {
		it('removes the set and rewrites storage once confirmed', async () => {
			vi.stubGlobal(
				'confirm',
				vi.fn(() => true),
			);
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(Race.RaceOrc), Other: storedJson(Race.RaceHuman) }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Other']);
			expect(stored()).toEqual({ Other: storedJson(Race.RaceHuman) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'delete', label: 'Settings' });
			vi.unstubAllGlobals();
		});
	});
});
