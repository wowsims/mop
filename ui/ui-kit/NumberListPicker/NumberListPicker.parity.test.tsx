import type { StoreSubscribe } from '@domain/state/subscriptions';
import { NumberListPicker as VanillaNumberListPicker, type NumberListPickerConfig } from '@ui-kit/pickers/number_list_picker';
import { mountBoth } from '@ui-kit/react/picker_oracle';
import { describe, expect, it } from 'vitest';

import { NumberListPicker } from './NumberListPicker';

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract: vanilla's restoreValue-style writes notify before clearing, and without
// this guard the picker re-enters itself without bound.
class Settings {
	private listeners = new Set<() => void>();
	constructor(public value: Array<number> = []) {}
	set(next: Array<number>) {
		if (next.length === this.value.length && next.every((val, i) => val === this.value[i])) return;
		this.value = next;
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

const configFor = (extra: Partial<NumberListPickerConfig<Settings>> = {}): NumberListPickerConfig<Settings> => ({
	id: 'thresholds',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (value: Array<number>, extra: Partial<NumberListPickerConfig<Settings>> = {}) =>
	mountBoth({
		Vanilla: VanillaNumberListPicker,
		React: NumberListPicker,
		config: configFor(extra),
		makeModObject: () => new Settings(value),
	});

// The tooltip anchor carries `data-tooltip-id` in React only, and renders no other DOM until first
// opened — a decided divergence (see PickerShell's doc comment), not something to fix here.
const knownTooltipDivergence = (line: string) => line.includes('data-tooltip-id');

describe('NumberListPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<NumberListPickerConfig<Settings>>]> = [
		['bare config', {}],
		['label', { label: 'Thresholds' }],
		['label + labelTooltip', { label: 'Thresholds', labelTooltip: 'Explains it' }],
		['inline', { inline: true }],
		['extraCssClasses', { extraCssClasses: ['x-a', 'x-b'] }],
		['description', { description: 'Comma separated' }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
		['defaultValue', { defaultValue: [9, 9] }],
	];

	for (const [name, extra] of cases) {
		it(name, async () => {
			const pair = await both([1, 2, 3], extra);
			const diffs = name.includes('labelTooltip') ? pair.diff().filter(line => !knownTooltipDivergence(line)) : pair.diff();
			expect(diffs, pair.allDiffs().join('\n')).toEqual([]);
			if (name.includes('labelTooltip')) {
				expect(pair.diff().every(knownTooltipDivergence), pair.allDiffs().join('\n')).toBe(true);
			}
			pair.dispose();
		});
	}

	it('stays identical with an empty array', async () => {
		const pair = await both([]);
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('stays identical with a single value', async () => {
		const pair = await both([42]);
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('stays identical after a store notification changes the list', async () => {
		const pair = await both([1, 2]);
		await pair.step(settings => settings.set([4, 5, 6]));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);

		await pair.step(settings => settings.set([]));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	// A notification that leaves the array equal by value still fires — refresh() re-reads and
	// setInputValue's arrayEquals guard is what keeps the field from being rewritten.
	it('stays identical across a notification whose value is unchanged', async () => {
		const pair = await both([1, 2, 3]);
		await pair.step(settings => settings.notify());
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('stays identical across a hide/show transition', async () => {
		const pair = await both([1, 2], { showWhen: (settings: Settings) => settings.value.length !== 0 });
		await pair.step(settings => settings.set([]));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);

		await pair.step(settings => settings.set([7]));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});
});
