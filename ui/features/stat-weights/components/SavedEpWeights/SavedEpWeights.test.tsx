import { SimHostProvider } from '@sim/context/SimHostContext';
import { Stats } from '@sim/proto/stats';
import { Stat } from '@generated/proto/common';
import { SavedEPWeights } from '@generated/proto/ui';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedEpWeights } from './SavedEpWeights';

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
	subscribePlayerField: () => source.subscribe,
}));

const STRINGS = vi.hoisted(
	() =>
		({
			'sidebar.buttons.stat_weights.modal.ep': 'EP',
			'sidebar.buttons.stat_weights.title': 'Stat Weights',
			'sidebar.buttons.stat_weights.saved_ep_weights.title': 'Saved EP weights',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));
vi.mock('tippy.js', () => ({ default: () => ({ destroy: () => undefined }) }));

const STORAGE_KEY = 'mop-warrior-savedEPWeights';

const weights = (agility: number) => new Stats().withStat(Stat.StatAgility, agility);
const storedJson = (agility: number) => SavedEPWeights.toJson(SavedEPWeights.create({ epWeights: weights(agility).toProto() }));
const MIXED = new Stats().withStat(Stat.StatAgility, 4).withStat(Stat.StatCritRating, 1.75).withStat(Stat.StatStrength, 2);
const MIXED_JSON = SavedEPWeights.toJson(SavedEPWeights.create({ epWeights: MIXED.toProto() }));

class FakePlayer {
	epWeights = new Stats();
	getEpWeights() {
		return this.epWeights;
	}
	setEpWeights = vi.fn((next: Stats) => {
		this.epWeights = next;
		source.notify();
	});
}

let player: FakePlayer;
let host: any;
let presets: Array<any>;
let waitForInit: () => Promise<void>;

const setup = () => {
	source.listeners.clear();
	trackEvent.mockClear();
	window.localStorage.clear();
	player = new FakePlayer();
	presets = [];
	waitForInit = () => Promise.resolve();
	host = {
		player,
		sim: { waitForInit: () => waitForInit() },
		get individualConfig() {
			return { presets: { epWeights: presets } };
		},
		getSavedEPWeightsStorageKey: () => STORAGE_KEY,
	};
};

// The presets and the stored sets both land on `waitForInit`, so every assertion about a chip has to
// come after that microtask.
const renderManager = async () => {
	const result = render(
		<SimHostProvider host={host}>
			<SavedEpWeights />
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
const popover = () => document.querySelector('.sim-confirm-popover');
const popoverText = () => popover()?.querySelector('.sim-confirm-popover-message')?.textContent ?? '';
const popoverButtons = () => [...(popover()?.querySelectorAll<HTMLButtonElement>('.sim-confirm-popover-actions button') ?? [])];

beforeEach(setup);

describe('SavedEpWeights', () => {
	describe('saving', () => {
		it('writes the current weights under the typed name and shows them as a chip', async () => {
			player.epWeights = weights(5);
			await renderManager();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			expect(stored()).toEqual({ Raiding: storedJson(5) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'save', label: 'EP' });
		});

		it('marks the freshly saved set active, because it matches the current weights', async () => {
			player.epWeights = weights(5);
			await renderManager();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chipNamed('Raiding').classList.contains('active')).toBe(true);
		});

		it('refuses an empty name with an alert and writes nothing', async () => {
			await renderManager();

			fireEvent.click(saveButton());

			expect(popover()).not.toBeNull();
			expect(popoverButtons()).toHaveLength(1);
			expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
			expect(trackEvent).not.toHaveBeenCalled();
		});

		it('replaces a set of the same name instead of adding a second chip', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(1) }));
			player.epWeights = weights(9);
			await renderManager();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chips('custom')).toHaveLength(1);
			expect(stored()).toEqual({ Raiding: storedJson(9) });
		});
	});

	describe('loading', () => {
		it('restores a stored set and reports it', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			await renderManager();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);

			expect(player.setEpWeights).toHaveBeenCalledTimes(1);
			expect(player.getEpWeights().equals(weights(4))).toBe(true);
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'load', label: 'EP' });
		});

		it("runs a preset's onLoad", async () => {
			const onLoad = vi.fn();
			presets = [{ name: 'Default', epWeights: weights(3), onLoad }];
			await renderManager();

			fireEvent.click(chipNamed('Default').querySelector('.saved-data-set-name')!);

			expect(onLoad).toHaveBeenCalledWith(player);
		});

		it('leaves the clicked set in the name input even when a preset holds the same weights', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Mine: storedJson(3) }));
			presets = [{ name: 'Default', epWeights: weights(3) }];
			await renderManager();

			fireEvent.click(chipNamed('Mine').querySelector('.saved-data-set-name')!);

			expect(nameInput().value).toBe('Mine');
		});

		it('marks every set holding the current weights active, not just the one that named the input', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Mine: storedJson(3) }));
			presets = [{ name: 'Default', epWeights: weights(3) }];
			player.epWeights = weights(3);
			await renderManager();

			expect(chipNamed('Mine').classList.contains('active')).toBe(true);
			expect(chipNamed('Default').classList.contains('active')).toBe(true);
		});

		it('stamps the name input with the set the current weights match', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			player.epWeights = weights(4);
			await renderManager();

			expect(nameInput().value).toBe('Raiding');
			expect(chipNamed('Raiding').classList.contains('active')).toBe(true);
		});

		it('skips an unparseable entry and keeps the rest', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Broken: 'not-a-message', Raiding: storedJson(4) }));
			await renderManager();

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			expect(warn).toHaveBeenCalled();
		});

		it('shows nothing when the whole value is not json', async () => {
			window.localStorage.setItem(STORAGE_KEY, '{oops');
			await renderManager();

			expect(chips('custom')).toHaveLength(0);
		});

		// The only part of this that can lose data, and no gate covers it: an entry saved under the old
		// storage key has to keep loading. Every stat, not just the one the rest of these tests carry.
		it('reads a set stored under the key the vanilla manager wrote', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: MIXED_JSON }));
			await renderManager();

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);
			expect(player.getEpWeights().equals(MIXED)).toBe(true);
		});

		it('writes a set back in that same shape', async () => {
			player.epWeights = MIXED;
			await renderManager();
			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(stored()).toEqual({ Raiding: MIXED_JSON });
		});
	});

	describe('deleting', () => {
		it('removes the set and rewrites storage once confirmed', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4), Other: storedJson(2) }));
			await renderManager();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);
			const [, confirm] = popoverButtons();
			fireEvent.click(confirm);

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Other']);
			expect(stored()).toEqual({ Other: storedJson(2) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'delete', label: 'EP' });
		});

		it('keeps the set when the confirm is declined', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			await renderManager();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);
			expect(popoverText()).not.toBe('');
			const [cancel] = popoverButtons();
			fireEvent.click(cancel);

			expect(chips('custom')).toHaveLength(1);
			expect(stored()).toEqual({ Raiding: storedJson(4) });
			expect(trackEvent).not.toHaveBeenCalled();
		});

		it('gives a preset no delete button', async () => {
			presets = [{ name: 'Default', epWeights: weights(3) }];
			await renderManager();

			expect(chipNamed('Default').querySelector('.saved-data-set-delete')).toBeNull();
		});
	});

	describe('presets', () => {
		it('hides a preset whose enableWhen is false', async () => {
			presets = [
				{ name: 'On', epWeights: weights(1), enableWhen: () => true },
				{ name: 'Off', epWeights: weights(2), enableWhen: () => false },
			];
			await renderManager();

			expect(chipNamed('On').classList.contains('disabled')).toBe(false);
			expect(chipNamed('Off').classList.contains('disabled')).toBe(true);
		});

		it('hides each section until it has a chip', async () => {
			presets = [{ name: 'Default', epWeights: weights(3) }];
			await renderManager();

			expect(document.querySelector('.saved-data-presets')!.classList.contains('hide')).toBe(false);
			expect(document.querySelector('.saved-data-custom')!.classList.contains('hide')).toBe(true);
		});

		it('holds the presets back until the sim is ready, as the vanilla manager did', () => {
			presets = [{ name: 'Default', epWeights: weights(3) }];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			let resolveInit = () => {};
			waitForInit = () => new Promise(resolve => (resolveInit = resolve));

			render(
				<SimHostProvider host={host}>
					<SavedEpWeights />
				</SimHostProvider>,
			);

			expect(chips('presets')).toHaveLength(0);
			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			resolveInit();
		});
	});
});
