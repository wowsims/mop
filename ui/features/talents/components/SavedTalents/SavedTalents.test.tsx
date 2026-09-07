import { SimHostProvider } from '@sim/context/SimHostContext';
import { subscribeGated } from '@sim/state/batch';
import { Glyphs } from '@generated/proto/common';
import { SavedTalents as SavedTalentsProto } from '@generated/proto/ui';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedTalents } from './SavedTalents';

const source = vi.hoisted(() => {
	let version = 0;
	const entries = new Set<{ listener: (next: any, prev: any) => void }>();
	return {
		entries,
		subscribe: <U,>(_selector: (v: number) => U, listener: (next: U, prev: U) => void) => {
			const entry = { listener };
			entries.add(entry);
			return () => entries.delete(entry);
		},
		bump: () => {
			version++;
			entries.forEach(entry => entry.listener(version, version - 1));
		},
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: () => () => () => undefined,
	subscribeAll: () => (onChange: () => void) => subscribeGated(source.subscribe, v => v, onChange),
}));

const STRINGS = vi.hoisted(
	() =>
		({
			'talents_tab.saved_talents.label': 'Talents',
			'talents_tab.saved_talents.title': 'Saved Talents',
			'talents_tab.saved_talents.name_label': 'Name',
			'talents_tab.saved_talents.save_button': 'Save Talents',
			'talents_tab.saved_talents.delete.tooltip': 'Delete saved talents',
			'talents_tab.saved_talents.delete.confirm': "Delete saved talents '{{name}}'?",
			'talents_tab.saved_talents.alerts.choose_name': 'Choose a label for your saved talents!',
			'talents_tab.saved_talents.alerts.name_exists': 'Talents with name {{name}} already exists.',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const STORAGE_KEY = 'mop-warrior-savedTalents';

const talentsWith = (talentsString: string) => SavedTalentsProto.create({ talentsString, glyphs: Glyphs.create() });
const storedJson = (talentsString: string) => SavedTalentsProto.toJson(talentsWith(talentsString));

class FakePlayer {
	talentsString = '';
	glyphs = Glyphs.create();
	getTalentsString() {
		return this.talentsString;
	}
	getGlyphs() {
		return this.glyphs;
	}
	setTalentsString = vi.fn((next: string) => {
		this.talentsString = next;
		source.bump();
	});
	setGlyphs = vi.fn((next: Glyphs) => {
		this.glyphs = next;
		source.bump();
	});
}

let player: FakePlayer;
let host: any;
let presets: Array<any>;
let waitForInit: () => Promise<void>;

const setup = () => {
	source.entries.clear();
	trackEvent.mockClear();
	window.localStorage.clear();
	player = new FakePlayer();
	presets = [];
	waitForInit = () => Promise.resolve();
	host = {
		player,
		sim: { waitForInit: () => waitForInit() },
		get individualConfig() {
			return { presets: { talents: presets } };
		},
		getSavedTalentsStorageKey: () => STORAGE_KEY,
	};
};

const renderPanel = async () => {
	const result = render(
		<SimHostProvider host={host}>
			<SavedTalents />
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

describe('SavedTalents', () => {
	describe('saving', () => {
		it('writes the current talents under the typed name and shows it as a chip', async () => {
			player.talentsString = '12321';
			await renderPanel();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			expect(stored()).toEqual({ Raiding: storedJson('12321') });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'save', label: 'Talents' });
		});

		it('refuses an empty name with an alert and writes nothing', async () => {
			const alert = vi.fn();
			vi.stubGlobal('alert', alert);
			await renderPanel();

			fireEvent.click(saveButton());

			expect(alert).toHaveBeenCalledWith('Choose a label for your saved talents!');
			expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
			vi.unstubAllGlobals();
		});
	});

	describe('loading', () => {
		it('restores a stored set and reports it', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson('111') }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);

			expect(player.setTalentsString).toHaveBeenCalledWith('111');
			expect(player.setGlyphs).toHaveBeenCalledTimes(1);
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'load', label: 'Talents' });
		});

		// The talentsString and glyphs writes are wrapped in `batch()` in SavedTalents.tsx so the
		// store fires once per load, not once per field. Deleting that wrapper makes this fail with
		// `notified` = 2.
		it('fires the store subscriber once for the combined talentsString+glyphs write, not twice', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson('111') }));
			await renderPanel();

			let notified = 0;
			const unsub = subscribeGated(
				source.subscribe,
				v => v,
				() => notified++,
			);

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);

			expect(notified).toBe(1);
			unsub();
		});

		it("runs a preset's onLoad and never gives it a delete button", async () => {
			const onLoad = vi.fn();
			presets = [{ name: 'Default', data: talentsWith('222'), onLoad }];
			await renderPanel();

			fireEvent.click(chipNamed('Default').querySelector('.saved-data-set-name')!);
			expect(onLoad).toHaveBeenCalledWith(player);
			expect(chipNamed('Default').querySelector('.saved-data-set-delete')).toBeNull();
		});

		it('substitutes {{name}} in the delete-confirm message', async () => {
			vi.stubGlobal(
				'confirm',
				vi.fn(() => false),
			);
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson('111') }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);

			expect(confirm).toHaveBeenCalledWith("Delete saved talents 'Raiding'?");
			vi.unstubAllGlobals();
		});

		it('holds the presets back until the sim is ready', () => {
			presets = [{ name: 'Default', data: talentsWith('222') }];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson('111') }));
			let resolveInit = () => {};
			waitForInit = () => new Promise(resolve => (resolveInit = resolve));

			render(
				<SimHostProvider host={host}>
					<SavedTalents />
				</SimHostProvider>,
			);

			expect(chips('presets')).toHaveLength(0);
			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			resolveInit();
		});
	});

	describe('deleting', () => {
		it('removes the set and rewrites storage once confirmed', async () => {
			vi.stubGlobal(
				'confirm',
				vi.fn(() => true),
			);
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson('111'), Other: storedJson('222') }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Other']);
			expect(stored()).toEqual({ Other: storedJson('222') });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'delete', label: 'Talents' });
			vi.unstubAllGlobals();
		});
	});
});
