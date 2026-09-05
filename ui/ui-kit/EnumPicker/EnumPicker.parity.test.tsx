import type { StoreSubscribe } from '@domain/state/subscriptions';
import { EnumPicker as VanillaEnumPicker, type EnumPickerConfig, type EnumValueConfig } from '@ui-kit/pickers/enum_picker';
import { mountBoth } from '@ui-kit/react/picker_oracle';
import { describe, expect, it } from 'vitest';

import { EnumPicker } from './EnumPicker';

// The real facades drop equal writes (Player.setBuffs returns early on equals), and so must this —
// see mountBoth's contract: vanilla's restoreValue-style writes notify before clearing, and without
// this guard a re-notifying picker re-enters itself without bound.
class Settings {
	private listeners = new Set<() => void>();
	constructor(public mode = 0) {}
	set(next: number) {
		if (next === this.mode) return;
		this.mode = next;
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

const VALUES: Array<EnumValueConfig> = [
	{ name: 'Passive', value: 0 },
	{ name: 'Aggressive', value: 1, tooltip: 'Attack everything' },
	{ name: 'Defensive', value: 2 },
];

const configFor = (extra: Partial<EnumPickerConfig<Settings>> = {}): EnumPickerConfig<Settings> => ({
	id: 'pet-mode',
	values: VALUES,
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.mode,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const both = (mode: number, extra: Partial<EnumPickerConfig<Settings>> = {}) =>
	mountBoth({ Vanilla: VanillaEnumPicker, React: EnumPicker, config: configFor(extra), makeModObject: () => new Settings(mode) });

// Two known, decided divergences — real, but not something to fix here (see the task write-up):
//
// 1. The vanilla `@jsx-vanilla` pragma stringifies `title={value.tooltip}` even when `tooltip` is
//    `undefined`, so every `<option>` with no tooltip gets a literal `title="undefined"`. React
//    omits the attribute for an `undefined` prop. Found empirically (this test failed on every
//    case until it was filtered) — recorded as a real divergence, not asserted away silently.
// 2. The tooltip anchor carries `data-tooltip-id` in React only, and renders no other DOM until
//    first opened (see PickerShell's and Tooltip's doc comments).
//
// Each is stripped explicitly, one exact attribute at a time, rather than matched with a loose
// substring check that would pass on any diff touching that word.
const stripKnownDivergences = (line: string) => line.replace(/\stitle="undefined"/, '').replace(/\sdata-tooltip-id="[^"]*"/, '');

const isOnlyKnownDiff = (line: string) => {
	const match = line.match(/vanilla: ([\s\S]*)\n\s*react:   ([\s\S]*)$/);
	if (!match) return false;
	const [, vanilla, react] = match;
	return stripKnownDivergences(vanilla) === stripKnownDivergences(react);
};

// VALUES has 2 entries with no tooltip, so the title="undefined" divergence fires twice on every
// mount; asserting the exact count keeps the filter from silently swallowing a third, unexplained
// diff line.
const expectOnlyKnownDivergences = (pair: Awaited<ReturnType<typeof both>>, expectedCount: number) => {
	const diffs = pair.diff();
	expect(
		diffs.filter(line => !isOnlyKnownDiff(line)),
		pair.allDiffs().join('\n'),
	).toEqual([]);
	expect(diffs, pair.allDiffs().join('\n')).toHaveLength(expectedCount);
};

describe('EnumPicker matches the vanilla picker', () => {
	const cases: Array<[string, Partial<EnumPickerConfig<Settings>>]> = [
		['bare config', {}],
		['label', { label: 'Pet Mode' }],
		['label + labelTooltip', { label: 'Pet Mode', labelTooltip: 'Explains it' }],
		['inline', { inline: true }],
		['extraCssClasses', { extraCssClasses: ['x-a', 'x-b'] }],
		['description', { description: 'Controls pet behaviour' }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
		['defaultValue', { defaultValue: 2 }],
	];

	for (const [name, extra] of cases) {
		it(name, async () => {
			const pair = await both(1, extra);
			// Every case renders the same 3 options, 2 of which have no tooltip (the title="undefined"
			// divergence); labelTooltip adds the one data-tooltip-id line on top of those two.
			expectOnlyKnownDivergences(pair, name === 'label + labelTooltip' ? 3 : 2);
			pair.dispose();
		});
	}

	it('matches vanilla for a value that is in the option list', async () => {
		const pair = await both(2, {});
		expectOnlyKnownDivergences(pair, 2);
		pair.dispose();
	});

	// A model value with no matching <option> is a real, documented divergence point for a select
	// (EnumPicker.test.tsx asserts vanilla's own behavior for it): recorded here rather than asserted
	// away. See the `divergences` note in the task write-up for what mountBoth's attribute-only diff
	// can and cannot see for this case — neither side's <option> attributes reflect selectedness, so
	// the `selectedIndex`/`value` properties are compared directly instead.
	it('records what happens for a value that is not in the option list', async () => {
		const pair = await both(99, {});
		expectOnlyKnownDivergences(pair, 2);

		const vanillaSelect = pair.vanilla.rootElem.querySelector('select')!;
		const reactSelect = pair.react.rootElem.querySelector('select')!;
		expect(reactSelect.selectedIndex).toBe(vanillaSelect.selectedIndex);
		expect(reactSelect.value).toBe(vanillaSelect.value);
		pair.dispose();
	});

	it('stays identical across every value transition, including one outside the option list', async () => {
		const pair = await both(0, {});
		for (const mode of [1, 2, 99, 0]) {
			await pair.step(settings => settings.set(mode));
			expectOnlyKnownDivergences(pair, 2);
		}
		pair.dispose();
	});

	it('stays identical while enableWhen flips', async () => {
		const pair = await both(1, { enableWhen: (settings: Settings) => settings.mode !== 2 });
		await pair.step(settings => settings.set(2));
		expectOnlyKnownDivergences(pair, 2);

		await pair.step(settings => settings.set(1));
		expectOnlyKnownDivergences(pair, 2);
		pair.dispose();
	});

	it('stays identical across a hide/show transition', async () => {
		const pair = await both(1, { showWhen: (settings: Settings) => settings.mode !== 2 });
		await pair.step(settings => settings.set(2));
		expectOnlyKnownDivergences(pair, 2);

		await pair.step(settings => settings.set(0));
		expectOnlyKnownDivergences(pair, 2);
		pair.dispose();
	});
});
