import type { StoreSubscribe } from '@domain/state/subscriptions';
import { fireEvent } from '@testing-library/dom';
import { act } from '@testing-library/react';
import { BooleanPicker as VanillaBooleanPicker, type BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { mountBoth, type PickerPair } from '@ui-kit/react/PickerOracle';
import { describe, expect, it } from 'vitest';

import { BooleanPicker } from './BooleanPicker';

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract.
class Settings {
	private listeners = new Set<() => void>();
	visible = true;
	enabled = true;
	constructor(public flag = false) {}
	set(next: boolean) {
		if (next === this.flag) return;
		this.flag = next;
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

const configFor = (extra: Partial<BooleanPickerConfig<Settings>> = {}): BooleanPickerConfig<Settings> => ({
	id: 'my-flag',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.flag,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (flag: boolean, extra: Partial<BooleanPickerConfig<Settings>>) =>
	mountBoth({ Vanilla: VanillaBooleanPicker, React: BooleanPicker, config: configFor(extra), makeModObject: () => new Settings(flag) });

// Two decided divergences, each stripped by name rather than with anything looser.
//
// A tooltip anchor carries `data-tooltip-id` on the React side only, and neither side renders any
// further DOM until the tooltip is opened.
//
// A checkbox mounted already checked also carries the `checked` ATTRIBUTE on the React side, which
// sets it through `defaultChecked`; vanilla's `setInputValue` writes only the `.checked` property.
// The attribute is inert here — nothing in `ui/` uses a `[checked]` selector or resets a form, and
// the two `:checked` rules in `_bootstrap_style_overrides.scss` read the property. The property
// itself is compared, by the oracle, on every line.
const stripDecided = (line: string) => line.replace(/\s*data-tooltip-id="[^"]*"/g, '').replace(/\s*checked=""/g, '');

const stripSide = (line: string) => line.replace(/^\s*(?:vanilla|react):\s+/, '');

const diffIgnoringTooltipId = (pair: PickerPair<Settings>): string[] =>
	pair.diff().filter(line => {
		const [vanillaLine, reactLine] = line.split('\n').slice(1);
		return stripDecided(stripSide(vanillaLine)) !== stripDecided(stripSide(reactLine));
	});

describe('BooleanPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<BooleanPickerConfig<Settings>>]> = [
		['bare config', {}],
		['label', { label: 'Enable Foo' }],
		['label and labelTooltip', { label: 'Enable Foo', labelTooltip: 'Some tooltip text' }],
		['inline', { inline: true }],
		['extraCssClasses', { extraCssClasses: ['x-a', 'x-b'] }],
		['description', { description: 'Some description' }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
		['defaultValue', { defaultValue: true }],
		// A label is required to see the reversal at all — with no label the checkbox is the only
		// child and its position can't diverge from anything.
		['reverse with label', { reverse: true, label: 'Enable Foo' }],
		['not reversed with label', { reverse: false, label: 'Enable Foo' }],
	];

	for (const [name, extra] of cases) {
		for (const flag of [false, true]) {
			it(`${name}, at ${flag}`, async () => {
				const pair = await both(flag, extra);
				expect(diffIgnoringTooltipId(pair), pair.allDiffs().join('\n')).toEqual([]);
				pair.dispose();
			});
		}
	}

	it('stays identical across every value transition', async () => {
		const pair = await both(false, {});
		for (const flag of [true, false, true]) {
			await pair.step(settings => settings.set(flag));
			expect(diffIgnoringTooltipId(pair), `at ${flag}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('stays identical while enableWhen flips', async () => {
		const pair = await both(true, { enableWhen: (settings: Settings) => settings.enabled });
		for (const enabled of [false, true]) {
			await pair.step(settings => settings.setEnabled(enabled));
			expect(diffIgnoringTooltipId(pair), `enabled=${enabled}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('stays identical while showWhen flips', async () => {
		const pair = await both(true, { showWhen: (settings: Settings) => settings.visible });
		for (const visible of [false, true]) {
			await pair.step(settings => settings.setVisible(visible));
			expect(diffIgnoringTooltipId(pair), `visible=${visible}:\n${pair.allDiffs().join('\n')}`).toEqual([]);
		}
		pair.dispose();
	});

	it('writes the same value as the vanilla picker on click, both orientations', async () => {
		for (const reverse of [false, true]) {
			const writes: Record<'vanilla' | 'react', boolean[]> = { vanilla: [], react: [] };
			const config = configFor({
				reverse,
				setValue: (settings, value) => {
					writes[settings === pair.vanilla.modObject ? 'vanilla' : 'react'].push(value);
					settings.set(value);
				},
			});
			const pair = await mountBoth({ Vanilla: VanillaBooleanPicker, React: BooleanPicker, config, makeModObject: () => new Settings(false) });

			const vanillaInput = pair.vanilla.rootElem.querySelector('input[type="checkbox"]') as HTMLInputElement;
			const reactInput = pair.react.rootElem.querySelector('input[type="checkbox"]') as HTMLInputElement;

			await act(async () => {
				fireEvent.click(vanillaInput);
				fireEvent.click(reactInput);
			});

			expect(writes.vanilla).toEqual([true]);
			expect(writes.react).toEqual([true]);
			expect(diffIgnoringTooltipId(pair), pair.allDiffs().join('\n')).toEqual([]);
			pair.dispose();
		}
	});
});
