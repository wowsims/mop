import { SimHostProvider } from '@sim/context/SimHostContext';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import type { IconEnumPickerConfig } from '@ui-kit/IconEnumPicker/types';
import { describe, expect, it } from 'vitest';

import { ConsumeRow } from './ConsumeRow';

const KEY = 2;

/** Stands in for the player: the one flag the configs below ask about, over a store the row can select from. */
class Options {
	engineer = true;
	readonly storeKey = KEY;
	readonly sim: { store: SimStore };

	constructor() {
		const store = createSimStore();
		seedKeyed(store, 'players', KEY, { profession1: 0, profession2: 0, v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);
		this.sim = { store };
	}

	changeProfession(next: number) {
		patchKeyed(this.sim.store, 'players', KEY, { profession1: next }, ['profession1']);
	}

	changeSomethingElse() {
		patchKeyed(this.sim.store, 'players', KEY, { name: 'Other' }, ['name']);
	}
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

describe('ConsumeRow', () => {
	it('builds vanilla’s row: the caption first, then whatever it was given', () => {
		const element = row(new Options(), [configFor(() => true)]);

		expect(element.className.split(' ').sort().join(' ')).toBe('consumes-row input-inline input-root');
		// A <span>: it names the row's icon group, not a form control.
		expect(Array.from(element.children).map(child => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
			'span.form-label',
			'div.picker-group icon-group consumes-row-inputs consumes-engi',
		]);
	});

	it('names the row group with its caption', () => {
		const element = row(new Options(), [configFor(() => true)]);
		const caption = element.querySelector('span.form-label')!;

		expect(element.getAttribute('role')).toBe('group');
		expect(element.getAttribute('aria-labelledby')).toBe(caption.id);
		expect(caption.id).not.toBe('');
	});

	it('hides the row when every picker in it is hidden, and shows it again', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer), configFor(opts => opts.engineer)]);
		expect(element.classList.contains('hide')).toBe(false);

		options.engineer = false;
		act(() => options.changeProfession(1));
		expect(element.classList.contains('hide')).toBe(true);
		// `updateRow` toggles a class; the row and its pickers stay in the document either way.
		expect(document.querySelector('.consumes-engi')).toBeTruthy();

		options.engineer = true;
		act(() => options.changeProfession(2));
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('keeps the row shown while any one of its pickers is', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer), configFor(() => true)]);

		options.engineer = false;
		act(() => options.changeProfession(1));
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('never hides a row that names no pickers', () => {
		const options = new Options();
		const element = row(options);
		expect(element.classList.contains('hide')).toBe(false);

		act(() => options.changeProfession(1));
		expect(element.classList.contains('hide')).toBe(false);
	});

	it('watches the two professions and nothing else', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer)]);

		options.engineer = false;
		act(() => options.changeSomethingElse());
		expect(element.classList.contains('hide')).toBe(false);

		act(() => options.changeProfession(1));
		expect(element.classList.contains('hide')).toBe(true);
	});
});
