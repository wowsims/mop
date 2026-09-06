import type { StoreSubscribe } from '@domain/state/subscriptions';
import { AdaptiveStringPicker as VanillaAdaptiveStringPicker, type StringPickerConfig } from '@ui-kit/pickers/string_picker';
import { mountBoth } from '@ui-kit/testing/PickerOracle';
import { describe, expect, it } from 'vitest';

import { AdaptiveStringPicker } from './AdaptiveStringPicker';

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract: vanilla's restoreValue-style writes notify before clearing, and without
// this guard the picker re-enters itself without bound.
class Settings {
	private listeners = new Set<() => void>();
	constructor(public value = '') {}
	set(next: string) {
		if (next === this.value) return;
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

const configFor = (extra: Partial<StringPickerConfig<Settings>> = {}): StringPickerConfig<Settings> => ({
	id: 'custom-name',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (value: string, extra: Partial<StringPickerConfig<Settings>> = {}) =>
	mountBoth({
		Vanilla: VanillaAdaptiveStringPicker,
		React: AdaptiveStringPicker,
		config: configFor(extra),
		makeModObject: () => new Settings(value),
	});

// The tooltip anchor carries `data-tooltip-id` in React only, and renders no other DOM until first
// opened — a decided divergence (see PickerShell's doc comment), not something to fix here.
const knownTooltipDivergence = (line: string) => line.includes('data-tooltip-id');

describe('AdaptiveStringPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<StringPickerConfig<Settings>>]> = [
		['bare config', {}],
		['label', { label: 'Custom Name' }],
		['label + labelTooltip', { label: 'Custom Name', labelTooltip: 'Explains it' }],
		['inline', { inline: true }],
		['extraCssClasses', { extraCssClasses: ['x-a', 'x-b'] }],
		['description', { description: 'A custom name' }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
		['defaultValue', { defaultValue: 'seeded-value' }],
	];

	for (const [name, extra] of cases) {
		it(name, async () => {
			const pair = await both('abc', extra);
			const diffs = name.includes('labelTooltip') ? pair.diff().filter(line => !knownTooltipDivergence(line)) : pair.diff();
			expect(diffs, pair.allDiffs().join('\n')).toEqual([]);
			if (name.includes('labelTooltip')) {
				expect(pair.diff().every(knownTooltipDivergence), pair.allDiffs().join('\n')).toBe(true);
			}
			pair.dispose();
		});
	}

	it('stays identical after a store notification changes the text, including the width it drives', async () => {
		const pair = await both('abc');
		await pair.step(settings => settings.set('a much longer value'));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);

		await pair.step(settings => settings.set('ab'));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('stays identical across a hide/show transition', async () => {
		const pair = await both('abc', { showWhen: (settings: Settings) => settings.value !== 'hide-me' });
		await pair.step(settings => settings.set('hide-me'));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);

		await pair.step(settings => settings.set('shown-again'));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});
});
