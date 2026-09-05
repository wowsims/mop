import { ActionId } from '@domain/proto_utils/action_id';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { IconPicker as VanillaIconPicker, type IconPickerConfig } from '@ui-kit/pickers/icon_picker';
import { mountBoth } from '@ui-kit/react/PickerOracle';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IconPicker } from './IconPicker';

const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const buffId = filled(ActionId.fromSpellId(1), 'Buff', 'buff.jpg');
const improvedId = filled(ActionId.fromSpellId(2), 'Improved Buff', 'improved.jpg');
const improvedId2 = filled(ActionId.fromSpellId(3), 'Greater Buff', 'greater.jpg');

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract.
class Settings {
	private listeners = new Set<() => void>();
	visible = true;
	enabled = true;
	constructor(public level: number | boolean = 0) {}
	set(next: number | boolean) {
		if (next === this.level) return;
		this.level = next;
		this.notify();
	}
	setVisible(next: boolean) {
		this.visible = next;
		this.notify();
	}
	setEnabled(next: boolean) {
		this.enabled = next;
		this.notify();
	}
	notify() {
		Array.from(this.listeners).forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
}

const configFor = (extra: Partial<IconPickerConfig<Settings, number>> = {}): IconPickerConfig<Settings, number> => ({
	id: 'buff-icon',
	actionId: buffId,
	states: 2,
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => Number(settings.level),
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (level: number, extra: Partial<IconPickerConfig<Settings, number>>) =>
	mountBoth({ Vanilla: VanillaIconPicker, React: IconPicker, config: configFor(extra), makeModObject: () => new Settings(level) });

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});

// Class ORDER differs by design: vanilla adds `icon-picker` after the base constructor has added
// the inline and extra classes, and PickerShell has no slot for that. The class SET matches, which
// is what the Playwright parity harness compares.
describe('IconPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<IconPickerConfig<Settings, number>>, number]> = [
		['states 2', { states: 2 }, 1],
		['states 3 with improvedId', { states: 3, improvedId }, 2],
		['states 4 with both', { states: 4, improvedId, improvedId2 }, 3],
		['states 3 with no improved id', { states: 3 }, 2],
		['states 4 with no improved id', { states: 4 }, 3],
		['unlimited states', { states: 0 }, 5],
		['states 4 with improvedId only', { states: 4, improvedId }, 3],
		['states 2 with an improvedId the gate never reaches', { states: 2, improvedId }, 1],
		[
			'label, inline, extra classes and enableWhen false',
			{
				states: 2,
				label: 'Buff',
				inline: true,
				extraCssClasses: ['x-a', 'x-b'],
				enableWhen: () => false,
			},
			1,
		],
		['label and description', { states: 3, improvedId, label: 'Buff', description: 'desc' }, 2],
	];

	for (const [name, extra, top] of cases) {
		for (const level of [0, top]) {
			it(`${name}, at ${level}`, async () => {
				const pair = await both(level, extra);
				expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
				pair.dispose();
			});
		}
	}

	it('stays identical across every value transition at states 4', async () => {
		const pair = await both(0, { states: 4, improvedId, improvedId2 });
		for (const level of [1, 2, 3, 0]) {
			await pair.step(settings => settings.set(level));
			expect(pair.diff(), `at ${level}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('stays identical while enableWhen flips', async () => {
		const pair = await both(1, { states: 2, enableWhen: (settings: Settings) => settings.enabled });
		for (const enabled of [false, true]) {
			await pair.step(settings => settings.setEnabled(enabled));
			expect(pair.diff(), `enabled=${enabled}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('writes the same values as the vanilla picker across a hide and a show', async () => {
		const writes: Record<'vanilla' | 'react', Array<number | boolean>> = { vanilla: [], react: [] };
		const config = configFor({
			states: 3,
			showWhen: (settings: Settings) => settings.visible,
			setValue: (settings, value) => {
				writes[settings === pair.vanilla.modObject ? 'vanilla' : 'react'].push(value);
				settings.set(value);
			},
		});
		const pair = await mountBoth({ Vanilla: VanillaIconPicker, React: IconPicker, config, makeModObject: () => new Settings(2) });

		expect(writes).toEqual({ vanilla: [], react: [] });

		await pair.step(settings => settings.setVisible(false));
		expect(writes.react).toEqual([0]);
		expect(writes.vanilla).toEqual([0]);

		await pair.step(settings => settings.setVisible(true));
		// Vanilla notifies before it clears its stored value, so it re-enters restoreValue once and
		// writes 2 twice; the second write is dropped by any real setter's equality check.
		expect(writes.react).toEqual([0, 2]);
		expect(new Set(writes.vanilla)).toEqual(new Set([0, 2]));
		expect((pair.vanilla.modObject as Settings).level).toBe((pair.react.modObject as Settings).level);
		pair.dispose();
	});
});
