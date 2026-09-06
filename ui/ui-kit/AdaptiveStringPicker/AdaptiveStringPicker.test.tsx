import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { StringPickerConfig } from '@ui-kit/pickers/string_picker';
import { describe, expect, it } from 'vitest';

import { AdaptiveStringPicker } from './AdaptiveStringPicker';

// Stands in for a domain facade: a value plus the (onChange) => unsubscribe contract every
// storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	/** Counts writes through the config, so "committed nothing" is testable. */
	writes = 0;
	constructor(public value = '') {}
	set(next: string) {
		this.value = next;
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

const configFor = (extra: Partial<StringPickerConfig<Settings>> = {}): StringPickerConfig<Settings> => ({
	id: 'custom-name',
	label: 'Custom Name',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => {
		settings.writes++;
		settings.set(value);
	},
	...extra,
});

const input = () => screen.getByRole('textbox') as HTMLInputElement;

describe('AdaptiveStringPicker', () => {
	it('shows the source value and writes back through setValue on commit', () => {
		const settings = new Settings('abc');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		expect(input().value).toBe('abc');

		fireEvent.change(input(), { target: { value: 'xyz' } });
		expect(settings.value).toBe('xyz');
		expect(input().value).toBe('xyz');
	});

	// The vanilla picker commits on the native `change` event — blur *after an edit*, and Enter — so
	// a plain focus/blur writes nothing. Committing on blur instead would write on any touch.
	it('writes nothing when the field is blurred without an edit', () => {
		const settings = new Settings('abc');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);

		fireEvent.focus(input());
		fireEvent.blur(input());
		expect(settings.writes).toBe(0);
		expect(settings.value).toBe('abc');
	});

	it('re-syncs the field on any notification, even one that does not change the value', () => {
		const settings = new Settings('abc');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: 'typed-but-uncommitted' } });

		act(() => settings.set('abc'));
		expect(input().value).toBe('abc');
	});

	// React's onChange is the input event, not the native change event the vanilla picker commits
	// on; a port that wires `onChange={e => setValue(e.currentTarget.value)}` writes per keystroke
	// and passes a `fireEvent.change`-only test, since that helper dispatches change (which React's
	// onChange also listens for). This pins the native-change contract directly against `input`.
	it('commits on the native change event, not on every input event', () => {
		const settings = new Settings('');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: 'typed' } });
		expect(settings.writes).toBe(0);

		fireEvent.change(input());
		expect(settings.value).toBe('typed');
	});

	it('subscribes once and unsubscribes on unmount', () => {
		const settings = new Settings();
		const { unmount } = render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		expect(settings.listenerCount).toBe(1);
		unmount();
		expect(settings.listenerCount).toBe(0);
	});

	it('seeds from defaultValue, sizing to it, then hands over to the source on its first change', () => {
		const settings = new Settings('abc');
		render(<AdaptiveStringPicker modObject={settings} config={configFor({ defaultValue: 'seeded-value' })} />);
		expect(input().value).toBe('seeded-value');
		expect(input().size).toBe('seeded-value'.length);

		act(() => settings.set('xyz'));
		expect(input().value).toBe('xyz');
	});

	it('sets the input id from config.id', () => {
		const settings = new Settings('abc');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		expect(input().id).toBe('custom-name');
	});

	it('hides with the `hide` class when showWhen is false, keeping the node', () => {
		const settings = new Settings();
		render(<AdaptiveStringPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(input().closest('.input-root')!.classList.contains('hide')).toBe(true);
	});

	it('disables the input and marks the root when enableWhen is false', () => {
		const settings = new Settings();
		render(<AdaptiveStringPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(input().disabled).toBe(true);
		expect(input().closest('.input-root')!.classList.contains('disabled')).toBe(true);
	});

	it('reads the value back raw, with no parsing', () => {
		const settings = new Settings('');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		fireEvent.change(input(), { target: { value: '  raw 123 text  ' } });
		expect(settings.value).toBe('  raw 123 text  ');
	});

	it('renders the same shape as the vanilla picker: label, description, then a bare form-control input', () => {
		const settings = new Settings();
		const { container } = render(<AdaptiveStringPicker modObject={settings} config={configFor({ description: 'A custom name' })} />);
		const root = container.firstElementChild!;
		expect([...root.classList]).toEqual(expect.arrayContaining(['input-root', 'adaptive-string-picker-root']));
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'INPUT']);
		expect(root.querySelector('label')!.className).toBe('form-label');
		expect(input().className).toBe('form-control');
		expect(input().type).toBe('text');
	});

	// Vanilla's setInputValue calls updateSize, so unlike NumberPicker, a source-driven change moves
	// size too, not only typing.
	it('sizes to the value length with a minimum of 3, and updates size on a source-driven change too', () => {
		const settings = new Settings('');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		expect(input().size).toBe(3);

		fireEvent.input(input(), { target: { value: '123456' } });
		expect(input().size).toBe(6);

		act(() => settings.set('ab'));
		expect(input().value).toBe('ab');
		expect(input().size).toBe(3);

		act(() => settings.set('a much longer value'));
		expect(input().size).toBe('a much longer value'.length);
	});

	it('sizes to the initial value length in the constructor, before any typing', () => {
		const settings = new Settings('initial-value');
		render(<AdaptiveStringPicker modObject={settings} config={configFor()} />);
		expect(input().size).toBe('initial-value'.length);
	});
});
