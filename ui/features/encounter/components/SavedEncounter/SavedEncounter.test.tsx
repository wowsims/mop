import { SimHostProvider } from '@sim/context/SimHostContext';
import { Encounter as EncounterProto } from '@generated/proto/common';
import { SavedEncounter as SavedEncounterProto } from '@generated/proto/ui';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedEncounter } from './SavedEncounter';

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
	subscribeEncounterChange: () => source.subscribe,
}));

const STRINGS = vi.hoisted(
	() =>
		({
			'settings_tab.saved_encounters.encounter': 'Encounter',
			'settings_tab.saved_encounters.title': 'Saved Encounters',
			'settings_tab.saved_encounters.encounter_name': 'Encounter Name',
			'settings_tab.saved_encounters.save_encounter': 'Save Encounter',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const STORAGE_KEY = 'mop-encounter-saved';

const encounterWith = (duration: number) => EncounterProto.create({ duration });
const storedJson = (duration: number) => SavedEncounterProto.toJson(SavedEncounterProto.create({ encounter: encounterWith(duration) }));

class FakeEncounter {
	proto = encounterWith(300);
	toProto() {
		return this.proto;
	}
	fromProto = vi.fn((proto: EncounterProto) => {
		this.proto = proto;
		source.notify();
	});
}

let encounter: FakeEncounter;
let host: any;
let presets: Array<any>;
let waitForInit: () => Promise<void>;

const setup = () => {
	source.listeners.clear();
	trackEvent.mockClear();
	window.localStorage.clear();
	encounter = new FakeEncounter();
	presets = [];
	waitForInit = () => Promise.resolve();
	host = {
		sim: { waitForInit: () => waitForInit(), encounter },
		get individualConfig() {
			return { presets: { encounters: presets } };
		},
		getSavedEncounterStorageKey: () => STORAGE_KEY,
	};
};

const renderPanel = async () => {
	const result = render(
		<SimHostProvider host={host}>
			<SavedEncounter />
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

describe('SavedEncounter', () => {
	describe('saving', () => {
		it('writes the current encounter under the typed name and shows it as a chip', async () => {
			encounter.proto = encounterWith(500);
			await renderPanel();

			fireEvent.change(nameInput(), { target: { value: 'Council' } });
			fireEvent.click(saveButton());

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Council']);
			expect(stored()).toEqual({ Council: storedJson(500) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'save', label: 'Encounter' });
		});
	});

	describe('loading', () => {
		it('restores a stored set and reports it', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Council: storedJson(400) }));
			await renderPanel();

			fireEvent.click(chipNamed('Council').querySelector('.saved-data-set-name')!);

			expect(encounter.fromProto).toHaveBeenCalledTimes(1);
			expect(encounter.fromProto.mock.calls[0]![0].duration).toBe(400);
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'load', label: 'Encounter' });
		});

		it("shows a preset's tooltip on its anchor", async () => {
			presets = [{ name: 'Council', encounter: encounterWith(400), tooltip: 'Tank swaps at 3s' }];
			await renderPanel();

			expect(chipNamed('Council').querySelector('.saved-data-set-name')!.getAttribute('data-tooltip-content')).toBe('Tank swaps at 3s');
		});

		// Vanilla `SettingsTabBody` never passes `enableWhen`/`onLoad` for encounter presets, only
		// `tooltip`. Adding either back here would silently diverge from what the tab always sent.
		it('never disables an encounter preset', async () => {
			presets = [{ name: 'Council', encounter: encounterWith(400) }];
			await renderPanel();

			expect(chipNamed('Council').classList.contains('disabled')).toBe(false);
		});

		it('holds the presets back until the sim is ready', () => {
			presets = [{ name: 'Council', encounter: encounterWith(400) }];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Mine: storedJson(200) }));
			let resolveInit = () => {};
			waitForInit = () => new Promise(resolve => (resolveInit = resolve));

			render(
				<SimHostProvider host={host}>
					<SavedEncounter />
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
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Council: storedJson(400), Other: storedJson(200) }));
			await renderPanel();

			fireEvent.click(chipNamed('Council').querySelector('.saved-data-set-delete')!);

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Other']);
			expect(stored()).toEqual({ Other: storedJson(200) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'delete', label: 'Encounter' });
			vi.unstubAllGlobals();
		});
	});
});
