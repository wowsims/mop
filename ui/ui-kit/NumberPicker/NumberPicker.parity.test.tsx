import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act } from '@testing-library/react';
import { NumberPicker as VanillaNumberPicker, type NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import type { PickerPair } from '@ui-kit/react/picker_oracle';
import { mountBoth } from '@ui-kit/react/picker_oracle';
import { describe, expect, it } from 'vitest';

import { NumberPicker } from './NumberPicker';

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract: vanilla's restoreValue notifies before it clears its stored value, so
// without this guard a re-entrant write would recurse without bound.
class Settings {
	private listeners = new Set<() => void>();
	visible = true;
	enabled = true;
	constructor(public value: number = 0) {}
	set(next: number) {
		if (next === this.value) return;
		this.value = next;
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

const configFor = (extra: Partial<NumberPickerConfig<Settings>> = {}): NumberPickerConfig<Settings> => ({
	id: 'number-picker',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (value: number, extra: Partial<NumberPickerConfig<Settings>> = {}) =>
	mountBoth({ Vanilla: VanillaNumberPicker, React: NumberPicker, config: configFor(extra), makeModObject: () => new Settings(value) });

const inputOf = (rootElem: Element) => rootElem.querySelector('input') as HTMLInputElement;

// Drives the `input` event on both inputs directly (not through `pair.step`, which is for mod-object
// mutations) — this is what `updateSize` listens for.
const typeBoth = async (pair: PickerPair<Settings>, text: string) => {
	await act(async () => {
		for (const rootElem of [pair.vanilla.rootElem, pair.react.rootElem]) {
			const input = inputOf(rootElem);
			input.value = text;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
};

// Drives the native `change` event both pickers commit on.
const changeBoth = async (pair: PickerPair<Settings>, text: string) => {
	await act(async () => {
		for (const rootElem of [pair.vanilla.rootElem, pair.react.rootElem]) {
			const input = inputOf(rootElem);
			input.value = text;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
	});
};

describe('NumberPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<NumberPickerConfig<Settings>>]> = [
		['bare config', {}],
		['label', { label: 'Amount' }],
		['inline', { inline: true }],
		['extraCssClasses', { extraCssClasses: ['x-a', 'x-b'] }],
		['description', { description: 'desc' }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
	];

	for (const [name, extra] of cases) {
		for (const value of [0, 5]) {
			it(`${name}, at ${value}`, async () => {
				const pair = await both(value, extra);
				expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
				pair.dispose();
			});
		}
	}

	it('defaultValue seeds the field ahead of the source value, on both sides', async () => {
		const pair = await both(5, { defaultValue: 7 });
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	// A known, decided divergence: react-tooltip anchors carry a `data-tooltip-id` the vanilla
	// element does not, and renders no other DOM until first opened. Filtered to that one attribute,
	// not to any diff on the label line.
	it('label + labelTooltip: only the documented data-tooltip-id divergence appears', async () => {
		const pair = await both(5, { label: 'Amount', labelTooltip: 'Explains it' });
		const known = (line: string) => line.includes('<label') && line.includes('data-tooltip-id');
		expect(
			pair.diff().filter(line => !known(line)),
			pair.allDiffs().join('\n'),
		).toEqual([]);
		expect(pair.diff()).toHaveLength(1);
		pair.dispose();
	});

	it('formats float values identically, including decimals, across a store notification', async () => {
		const pair = await both(5.5, { float: true });
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		await pair.step(settings => settings.set(3));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('hides zero values in the field when showZeroes is false', async () => {
		const pair = await both(0, { showZeroes: false });
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('commits only on the native change event, not on input', async () => {
		const pair = await both(0, {});
		await typeBoth(pair, '42');
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(pair.vanilla.modObject.value).toBe(0);
		expect(pair.react.modObject.value).toBe(0);

		await changeBoth(pair, '42');
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(pair.vanilla.modObject.value).toBe(42);
		expect(pair.react.modObject.value).toBe(42);
		pair.dispose();
	});

	it('commits a float through the change event, on both sides', async () => {
		const pair = await both(0, { float: true });
		await changeBoth(pair, '3.75');

		expect(pair.vanilla.modObject.value).toBe(3.75);
		expect(pair.react.modObject.value).toBe(3.75);
		expect(inputOf(pair.react.rootElem).value).toBe(inputOf(pair.vanilla.rootElem).value);
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('applies the positive handler to a float, matching the vanilla one', async () => {
		const pair = await both(0, { float: true, positive: true });
		await changeBoth(pair, '-2.5');

		expect(inputOf(pair.react.rootElem).value).toBe(inputOf(pair.vanilla.rootElem).value);
		expect(pair.react.modObject.value).toBe(pair.vanilla.modObject.value);
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		pair.dispose();
	});

	it('rewrites negative input to positive on change, matching the vanilla positive handler', async () => {
		const pair = await both(0, { positive: true });
		await changeBoth(pair, '-7');
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(pair.vanilla.modObject.value).toBe(7);
		expect(pair.react.modObject.value).toBe(7);
		pair.dispose();
	});

	// The vanilla positive+integer branch is `Math.abs(parseInt(text)).toString()`; on an empty
	// field that's the literal string "NaN" written back in — immediately overwritten by the
	// picker's own store subscription firing off the commit it triggers (`setValue(0)` → notify →
	// `refresh()` → `setInputValue(0)`), on both sides identically, so the field settles on "0".
	it('reproduces the vanilla positive handler on an empty field, settling on "0" on both sides', async () => {
		const pair = await both(5, { positive: true });
		await changeBoth(pair, '');
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(inputOf(pair.vanilla.rootElem).value).toBe('0');
		expect(inputOf(pair.react.rootElem).value).toBe('0');
		expect(pair.vanilla.modObject.value).toBe(0);
		expect(pair.react.modObject.value).toBe(0);
		pair.dispose();
	});

	// Vanilla's `updateSize` only runs from the constructor and the `input` listener — `refresh()`
	// (a store notification) re-applies the value but leaves the size where typing last put it. Both
	// axes are driven here since one, alone, would hide a component that resized on the wrong one.
	it('resizes on construction and on typing, but not on a store notification, matching vanilla', async () => {
		const pair = await both(5, {});
		const initialSize = inputOf(pair.vanilla.rootElem).size;
		expect(inputOf(pair.react.rootElem).size).toBe(initialSize);

		await pair.step(settings => settings.set(123456));
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(inputOf(pair.vanilla.rootElem).size).toBe(initialSize);
		expect(inputOf(pair.react.rootElem).size).toBe(initialSize);

		await typeBoth(pair, '1234567890');
		expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
		expect(inputOf(pair.vanilla.rootElem).size).toBe(10);
		expect(inputOf(pair.react.rootElem).size).toBe(10);
		pair.dispose();
	});

	it('stays identical while enableWhen flips', async () => {
		const pair = await both(1, { enableWhen: (settings: Settings) => settings.enabled });
		for (const enabled of [false, true]) {
			await pair.step(settings => settings.setEnabled(enabled));
			expect(pair.diff(), `enabled=${enabled}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('stays identical while showWhen flips', async () => {
		const pair = await both(1, { showWhen: (settings: Settings) => settings.visible });
		for (const visible of [false, true]) {
			await pair.step(settings => settings.setVisible(visible));
			expect(pair.diff(), `visible=${visible}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});
});
