import { SimHostProvider } from '@sim/context/SimHostContext';
import { subscribeGated } from '@sim/state/batch';
import { Stats } from '@sim/proto/stats';
import { EquipmentSpec, ItemSpec } from '@generated/proto/common';
import { SavedGearSet } from '@generated/proto/ui';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedGear } from './SavedGear';

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
	subscribePlayerChange: () => (onChange: () => void) => subscribeGated(source.subscribe, v => v, onChange),
}));

const STRINGS = vi.hoisted(
	() =>
		({
			'gear_tab.gear_sets.gear_set': 'Gear Set',
			'gear_tab.gear_sets.title': 'Gear Sets',
			'gear_tab.gear_sets.gear_set_name': 'Gear Set Name',
			'gear_tab.gear_sets.save_gear_set': 'Save Gear Set',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackEvent }));

const STORAGE_KEY = 'mop-warrior-savedGearSets';

const gearWith = (itemId: number) => EquipmentSpec.create({ items: [ItemSpec.create({ id: itemId })] });
const storedJson = (itemId: number) => SavedGearSet.toJson(SavedGearSet.create({ gear: gearWith(itemId), bonusStatsStats: new Stats().toProto() }));

class FakeGear {
	constructor(private readonly spec: EquipmentSpec) {}
	asSpec() {
		return this.spec;
	}
}

class FakePlayer {
	gear = new FakeGear(EquipmentSpec.create());
	bonusStats = new Stats();
	getGear() {
		return this.gear;
	}
	getBonusStats() {
		return this.bonusStats;
	}
	setGear = vi.fn((gear: FakeGear) => {
		this.gear = gear;
		source.bump();
	});
	setBonusStats = vi.fn((stats: Stats) => {
		this.bonusStats = stats;
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
		sim: {
			waitForInit: () => waitForInit(),
			db: { lookupEquipmentSpec: (spec: EquipmentSpec) => new FakeGear(spec) },
		},
		get individualConfig() {
			return { presets: { gear: presets } };
		},
		getSavedGearStorageKey: () => STORAGE_KEY,
	};
};

const renderPanel = async () => {
	const result = render(
		<SimHostProvider host={host}>
			<SavedGear />
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
const popoverButtons = () => [...(popover()?.querySelectorAll<HTMLButtonElement>('.sim-confirm-popover-actions button') ?? [])];

beforeEach(setup);

describe('SavedGear', () => {
	describe('saving', () => {
		it('writes the current gear under the typed name and shows it as a chip', async () => {
			player.gear = new FakeGear(gearWith(5));
			await renderPanel();

			fireEvent.change(nameInput(), { target: { value: 'Raiding' } });
			fireEvent.click(saveButton());

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			expect(stored()).toEqual({ Raiding: storedJson(5) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'save', label: 'Gear Set' });
		});

		it('refuses an empty name with an alert and writes nothing', async () => {
			await renderPanel();

			fireEvent.click(saveButton());

			expect(popover()).not.toBeNull();
			expect(popoverButtons()).toHaveLength(1);
			expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
		});
	});

	describe('loading', () => {
		it('restores a stored set and reports it', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-name')!);

			expect(player.setGear).toHaveBeenCalledTimes(1);
			expect(player.setBonusStats).toHaveBeenCalledTimes(1);
			expect(player.getGear().asSpec().items[0]!.id).toBe(4);
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'load', label: 'Gear Set' });
		});

		// This is the one thing a JSON-string diff of the two writes can't see: whether they land as
		// one store notification or two. Deleting `batch()` around setGear/setBonusStats in
		// SavedGear.tsx makes this fail with `notified` = 2, because setGear's own write fires the
		// gated listener before setBonusStats runs.
		it('fires the store subscriber once for the combined gear+bonusStats write, not twice', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
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

		it('hides a preset whose enableWhen is false and runs onLoad for an enabled one', async () => {
			const onLoad = vi.fn();
			presets = [
				{ name: 'On', gear: gearWith(1), enableWhen: () => true, onLoad },
				{ name: 'Off', gear: gearWith(2), enableWhen: () => false },
			];
			await renderPanel();

			expect(chipNamed('On').classList.contains('disabled')).toBe(false);
			expect(chipNamed('Off').classList.contains('disabled')).toBe(true);

			fireEvent.click(chipNamed('On').querySelector('.saved-data-set-name')!);
			expect(onLoad).toHaveBeenCalledWith(player);
		});

		it("shows a preset's tooltip on its anchor", async () => {
			presets = [{ name: 'On', gear: gearWith(1), tooltip: 'Best in slot' }];
			await renderPanel();

			expect(chipNamed('On').querySelector('.saved-data-set-name')!.getAttribute('data-tooltip-content')).toBe('Best in slot');
		});

		it('holds the presets back until the sim is ready', () => {
			presets = [{ name: 'Default', gear: gearWith(1) }];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4) }));
			let resolveInit = () => {};
			waitForInit = () => new Promise(resolve => (resolveInit = resolve));

			render(
				<SimHostProvider host={host}>
					<SavedGear />
				</SimHostProvider>,
			);

			expect(chips('presets')).toHaveLength(0);
			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Raiding']);
			resolveInit();
		});
	});

	describe('deleting', () => {
		it('removes the set and rewrites storage once confirmed', async () => {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Raiding: storedJson(4), Other: storedJson(2) }));
			await renderPanel();

			fireEvent.click(chipNamed('Raiding').querySelector('.saved-data-set-delete')!);
			const [, confirm] = popoverButtons();
			fireEvent.click(confirm);

			expect(chips('custom').map(chip => chip.textContent)).toEqual(['Other']);
			expect(stored()).toEqual({ Other: storedJson(2) });
			expect(trackEvent).toHaveBeenCalledWith({ action: 'settings', category: 'delete', label: 'Gear Set' });
		});

		it('gives a preset no delete button', async () => {
			presets = [{ name: 'Default', gear: gearWith(1) }];
			await renderPanel();

			expect(chipNamed('Default').querySelector('.saved-data-set-delete')).toBeNull();
		});
	});
});
