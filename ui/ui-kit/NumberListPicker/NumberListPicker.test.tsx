import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NumberListPickerConfig } from '@ui-kit/pickers/number_list_picker';
import { describe, expect, it } from 'vitest';

import { NumberListPicker } from './NumberListPicker';

// Stands in for a domain facade: a value plus the (onChange) => unsubscribe contract every
// storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	/** Counts writes through the config, so "committed nothing" is testable. */
	writes = 0;
	constructor(public value: Array<number> = []) {}
	set(next: Array<number>) {
		this.value = next;
		this.notify();
	}
	/** Fires a notification without touching the value — what a batch() on a sibling slice looks like. */
	notify() {
		this.listeners.forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
	get listenerCount() {
		return this.listeners.size;
	}
}

const configFor = (extra: Partial<NumberListPickerConfig<Settings>> = {}): NumberListPickerConfig<Settings> => ({
	id: 'thresholds',
	label: 'Thresholds',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => {
		settings.writes++;
		settings.set(value);
	},
	...extra,
});

const input = () => screen.getByRole('textbox') as HTMLInputElement;

describe('NumberListPicker', () => {
	it('shows the source value and writes back through setValue on commit', () => {
		const settings = new Settings([1, 2, 3]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		expect(input().value).toBe('1,2,3');

		fireEvent.change(input(), { target: { value: '4,5' } });
		expect(settings.value).toEqual([4, 5]);
		expect(input().value).toBe('4,5');
	});

	it('re-renders when the source changes underneath it', () => {
		const settings = new Settings([1]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		act(() => settings.set([9, 10]));
		expect(input().value).toBe('9,10');
	});

	it('subscribes once and unsubscribes on unmount', () => {
		const settings = new Settings();
		const { unmount } = render(<NumberListPicker modObject={settings} config={configFor()} />);
		expect(settings.listenerCount).toBe(1);
		unmount();
		expect(settings.listenerCount).toBe(0);
	});

	it('hides with the `hide` class when showWhen is false, keeping the node', () => {
		const settings = new Settings();
		render(<NumberListPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(input().closest('.input-root')!.classList.contains('hide')).toBe(true);
		// The node stays in the DOM; hiding is a class, not an unmount.
		expect(document.body.contains(input())).toBe(true);
	});

	it('disables the input and marks the root when enableWhen is false', () => {
		const settings = new Settings();
		render(<NumberListPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(input().disabled).toBe(true);
		expect(input().closest('.input-root')!.classList.contains('disabled')).toBe(true);
	});

	it('renders the same shape as the vanilla picker: label, description, then the input', () => {
		const settings = new Settings();
		const { container } = render(<NumberListPicker modObject={settings} config={configFor({ description: 'Comma separated' })} />);
		const root = container.firstElementChild!;
		expect([...root.classList]).toEqual(expect.arrayContaining(['input-root', 'number-list-picker-root']));
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'INPUT']);
		expect(root.querySelector('label')!.className).toBe('form-label');
		expect(input().className).toBe('number-list-picker-input form-control');
		expect(input().type).toBe('text');
	});

	it('assigns an empty placeholder attribute when config.placeholder is absent', () => {
		const settings = new Settings();
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		// The vanilla picker always sets the attribute (config.placeholder || ''), so it must be
		// present (not simply undefined) even with no configured placeholder.
		expect(input().getAttribute('placeholder')).toBe('');
	});

	it('uses config.placeholder as the placeholder text when given', () => {
		const settings = new Settings();
		render(<NumberListPicker modObject={settings} config={configFor({ placeholder: 'e.g. 1,2,3' })} />);
		expect(input().getAttribute('placeholder')).toBe('e.g. 1,2,3');
	});

	it('reads back an empty string as an empty array', () => {
		const settings = new Settings([1, 2]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.change(input(), { target: { value: '' } });
		expect(settings.value).toEqual([]);
	});

	it('parses a comma-separated list with parseFloat, dropping entries that parse to NaN', () => {
		const settings = new Settings([]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.change(input(), { target: { value: '1,2,x,3' } });
		expect(settings.value).toEqual([1, 2, 3]);
	});

	it('parses floats, not just integers', () => {
		const settings = new Settings([]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.change(input(), { target: { value: '1.5,2.25' } });
		expect(settings.value).toEqual([1.5, 2.25]);
	});

	// The vanilla picker commits on the native `change` event — blur *after an edit*, and Enter — so a
	// plain focus/blur writes nothing, and typing alone (the `input` event) does not commit either.
	it('writes nothing when the field is blurred without an edit', () => {
		const settings = new Settings([1, 2]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.focus(input());
		fireEvent.blur(input());
		expect(settings.writes).toBe(0);
		expect(settings.value).toEqual([1, 2]);
	});

	it('does not commit on the input event alone, only on change', () => {
		const settings = new Settings([1]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: '5,6' } });
		expect(settings.writes).toBe(0);

		fireEvent.change(input());
		expect(settings.value).toEqual([5, 6]);
	});

	// This is the arrayEquals guard from setInputValue: without it, every notification (even one
	// that leaves the value equal) would stomp the field the user is mid-edit on, e.g. typing the
	// trailing comma in '1,2,'.
	it('does not rewrite the field while typing an edit that still parses to the current value', () => {
		const settings = new Settings([1, 2]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);

		fireEvent.input(input(), { target: { value: '1,2,' } });
		act(() => settings.set([1, 2]));
		expect(input().value).toBe('1,2,');
	});

	it('re-syncs the field on any notification, even one that does not change the value', () => {
		const settings = new Settings([7]);
		render(<NumberListPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: '12,x' } });

		act(() => settings.set([7]));
		expect(input().value).toBe('7');
	});
});

// The value here is an array, so `settings.set([7])` changes the snapshot identity and would re-sync
// even without `revision`. Only a notification that leaves the value alone tells the two apart.
it('re-syncs on a notification that does not change the value at all', () => {
	const settings = new Settings([1, 2]);
	render(<NumberListPicker modObject={settings} config={configFor()} />);
	const field = input();
	field.value = '9,9,9';

	act(() => settings.notify());
	expect(field.value).toBe('1,2');
});
