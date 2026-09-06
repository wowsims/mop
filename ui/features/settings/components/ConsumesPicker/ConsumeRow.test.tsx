import { SimHostProvider } from '@features/SimHostContext';
import { act, render } from '@testing-library/react';
import type { IconEnumPickerConfig } from '@ui-kit/pickers/icon_enum_picker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsumeRow } from './ConsumeRow';

// The real sources read a zustand store off `player.sim`, which a unit test has no way to build.
// What this file is about is *which* fields the row watches and that it re-reads the row's
// visibility when one of them fires, so the source is stubbed and driven directly.
const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		fields: [] as Array<string>,
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@domain/state/subscriptions', () => ({
	subscribePlayerField: (_player: unknown, field: string) => {
		source.fields.push(field);
		return (onChange: () => void) => {
			source.listeners.add(onChange);
			return () => source.listeners.delete(onChange);
		};
	},
	subscribeAll: (subs: Array<(onChange: () => void) => () => void>) => (onChange: () => void) => {
		const unsubs = subs.map(sub => sub(onChange));
		return () => unsubs.forEach(unsub => unsub());
	},
}));

/** Stands in for the player: the one flag the configs below ask about. */
class Options {
	engineer = true;
}

// `iconEnumPickerShown` is satisfied only by a value that carries an actionId *and* is shown, so
// this is the shape of the engineering explosives: one real option behind a profession check.
const configFor = (shown: (options: Options) => boolean): IconEnumPickerConfig<Options, number> =>
	({
		values: [{ value: 0 }, { actionId: {} as never, value: 1, showWhen: shown }],
		equals: (a: number, b: number) => a === b,
		zeroValue: 0,
		storeSubscribe: () => (() => () => {}) as never,
		getValue: () => 0,
		setValue: () => {},
	}) as IconEnumPickerConfig<Options, number>;

const row = (options: Options, configs?: Array<IconEnumPickerConfig<Options, number>>) => {
	render(
		<SimHostProvider host={{ player: options } as never}>
			<ConsumeRow name="engineering" configs={configs as never}>
				<div className="picker-group icon-group consumes-row-inputs consumes-engi" />
			</ConsumeRow>
		</SimHostProvider>,
	);
	return document.querySelector('.consumes-row') as HTMLElement;
};

beforeEach(() => {
	source.listeners.clear();
	source.fields.length = 0;
});

describe('ConsumeRow', () => {
	it('builds vanilla’s row: the label first, then whatever it was given', () => {
		const element = row(new Options(), [configFor(() => true)]);

		expect(element.className.split(' ').sort().join(' ')).toBe('consumes-row input-inline input-root');
		expect(Array.from(element.children).map(child => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
			'label.form-label',
			'div.picker-group icon-group consumes-row-inputs consumes-engi',
		]);
	});

	it('hides the row when every picker in it is hidden, and shows it again', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer), configFor(opts => opts.engineer)]);
		expect(element.classList.contains('hide')).toBe(false);

		options.engineer = false;
		act(() => source.notify());
		expect(element.classList.contains('hide')).toBe(true);
		// `updateRow` toggles a class; the row and its pickers stay in the document either way.
		expect(document.querySelector('.consumes-engi')).toBeTruthy();

		options.engineer = true;
		act(() => source.notify());
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('keeps the row shown while any one of its pickers is', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer), configFor(() => true)]);

		options.engineer = false;
		act(() => source.notify());
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('never hides a row that names no pickers', () => {
		// Elixirs, food and pet: vanilla called `updateRow` for the potions and engineering rows only,
		// so nothing else in this block has ever hidden.
		const element = row(new Options());
		expect(element.classList.contains('hide')).toBe(false);

		act(() => source.notify());
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('watches the two professions and nothing else', () => {
		row(new Options(), [configFor(() => true)]);
		expect(source.fields).toEqual(['profession1', 'profession2']);
	});
});
