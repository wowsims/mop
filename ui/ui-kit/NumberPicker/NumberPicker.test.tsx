import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { describe, expect, it } from 'vitest';

import { NumberPicker } from './NumberPicker';

// Stands in for a domain facade: a value plus the (onChange) => unsubscribe contract every
// storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	/** Counts writes through the config, so "committed nothing" is testable. */
	writes = 0;
	constructor(public value = 0) {}
	set(next: number) {
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

const configFor = (extra: Partial<NumberPickerConfig<Settings>> = {}): NumberPickerConfig<Settings> => ({
	id: 'cast-delay',
	label: 'Cast Delay',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.value,
	setValue: (settings, value) => {
		settings.writes++;
		settings.set(value);
	},
	...extra,
});

const input = () => screen.getByRole('textbox') as HTMLInputElement;

describe('NumberPicker', () => {
	it('shows the source value and writes back through setValue on commit', () => {
		const settings = new Settings(5);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		expect(input().value).toBe('5');

		fireEvent.change(input(), { target: { value: '7' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(7);
		expect(input().value).toBe('7');
	});

	it('re-renders when the source changes underneath it', () => {
		const settings = new Settings(1);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		act(() => settings.set(9));
		expect(input().value).toBe('9');
	});

	it('subscribes once and unsubscribes on unmount', () => {
		const settings = new Settings();
		const { unmount } = render(<NumberPicker modObject={settings} config={configFor()} />);
		expect(settings.listenerCount).toBe(1);
		unmount();
		expect(settings.listenerCount).toBe(0);
	});

	it('hides with the `hide` class when showWhen is false, keeping the node', () => {
		const settings = new Settings();
		render(<NumberPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(input().closest('.input-root')!.classList.contains('hide')).toBe(true);
	});

	it('disables the input and marks the root when enableWhen is false', () => {
		const settings = new Settings();
		render(<NumberPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(input().disabled).toBe(true);
		expect(input().closest('.input-root')!.classList.contains('disabled')).toBe(true);
	});

	it('seeds from defaultValue, then hands over to the source on its first change', () => {
		const settings = new Settings(1);
		render(<NumberPicker modObject={settings} config={configFor({ defaultValue: 42 })} />);
		expect(input().value).toBe('42');

		act(() => settings.set(2));
		expect(input().value).toBe('2');
	});

	it('renders the same shape as the vanilla picker: label, description, then the input', () => {
		const settings = new Settings();
		const { container } = render(<NumberPicker modObject={settings} config={configFor({ description: 'How long to delay' })} />);
		const root = container.firstElementChild!;
		expect([...root.classList]).toEqual(expect.arrayContaining(['input-root', 'number-picker-root']));
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'INPUT']);
		expect(root.querySelector('label')!.className).toBe('form-label');
		expect(input().className).toBe('form-control number-picker-input');
		expect(input().type).toBe('text');
	});

	// InputConfig types both of these as string | Element, and reforge_panel.tsx:527 passes an
	// Element. Stringifying it renders "[object HTMLDivElement]" with nothing to notice it.
	it('renders an Element description and tooltip rather than stringifying them', async () => {
		const settings = new Settings();
		const description = document.createElement('div');
		description.textContent = 'Built elsewhere';
		const tooltip = document.createElement('span');
		tooltip.textContent = 'Node tooltip';

		render(<NumberPicker modObject={settings} config={configFor({ description, labelTooltip: tooltip })} />);
		expect(screen.getByText('Built elsewhere')).toBeTruthy();
		expect(document.body.textContent).not.toContain('[object');

		fireEvent.mouseEnter(screen.getByText('Cast Delay'));
		expect(await screen.findByText('Node tooltip')).toBeTruthy();
	});

	it('renders a non-float value with String(value)', () => {
		const settings = new Settings(42);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		expect(input().value).toBe('42');
	});

	it('formats a float value with formatToNumber, ungrouped, at 2 decimal digits by default', () => {
		const settings = new Settings(3);
		render(<NumberPicker modObject={settings} config={configFor({ float: true })} />);
		expect(input().value).toBe('3.00');
	});

	it('honors a custom maxDecimalDigits for float values', () => {
		const settings = new Settings(3.14159);
		render(<NumberPicker modObject={settings} config={configFor({ float: true, maxDecimalDigits: 4 })} />);
		expect(input().value).toBe('3.1416');
	});

	it('renders zero as an empty string when showZeroes is false', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ showZeroes: false })} />);
		expect(input().value).toBe('');
	});

	it('renders zero normally when showZeroes is true (the default)', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		expect(input().value).toBe('0');
	});

	it('rewrites a negative integer to its absolute value on commit when positive is set', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ positive: true })} />);
		fireEvent.change(input(), { target: { value: '-8' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(8);
		expect(input().value).toBe('8');
	});

	it('rewrites a negative float to its absolute value when positive and float are set', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ positive: true, float: true })} />);
		fireEvent.change(input(), { target: { value: '-12.5' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(12.5);
	});

	// The positive-float rewrite formats with grouping (formatToNumber's default), unlike the
	// normal display format above. Reading the rewritten field back with Number(value) then chokes
	// on the thousands separator and silently falls back to 0 — an odd vanilla quirk, reproduced
	// rather than fixed.
	it('loses a positive-float value at 1000+ to the thousands separator, matching the vanilla bug', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ positive: true, float: true })} />);
		fireEvent.change(input(), { target: { value: '-1234.5' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(0);
	});

	it('reads back a float value with Number(value||"")||0, falling back to 0 on garbage', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ float: true })} />);
		fireEvent.change(input(), { target: { value: 'abc' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(0);
	});

	it('reads back an integer value with parseInt(value||"")||0', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		fireEvent.change(input(), { target: { value: '12abc' } });
		fireEvent.blur(input());
		expect(settings.value).toBe(12);
	});

	// Vanilla updates size in the constructor and on the `input` event only, so a source-driven change
	// leaves it where typing put it.
	it('tracks the size attribute while typing, with a minimum of 3, and leaves it alone on a source change', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		expect(input().size).toBe(3);

		fireEvent.input(input(), { target: { value: '123456' } });
		expect(input().size).toBe(6);

		act(() => settings.set(1));
		expect(input().size).toBe(6);
	});

	// The vanilla picker commits on the native `change` event — blur *after an edit*, and Enter — so a
	// plain focus/blur writes nothing. Committing on blur instead would write defaultValue, or
	// rewrite a `positive` field to "NaN", without the user touching anything.
	it('writes nothing when the field is blurred without an edit', () => {
		const settings = new Settings(1);
		render(<NumberPicker modObject={settings} config={configFor({ defaultValue: 42 })} />);
		expect(input().value).toBe('42');

		fireEvent.focus(input());
		fireEvent.blur(input());
		expect(settings.writes).toBe(0);
		expect(settings.value).toBe(1);
	});

	it('commits on the native change event, which is what Enter and blur-after-edit both fire', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: '25' } });
		expect(settings.writes).toBe(0);

		fireEvent.change(input());
		expect(settings.value).toBe(25);
	});

	it('formats a float above the grouping threshold without separators', () => {
		const settings = new Settings(1234.5);
		render(<NumberPicker modObject={settings} config={configFor({ float: true })} />);
		expect(input().value).toBe('1234.50');
	});

	it('reads a float back as a float, not an integer', () => {
		const settings = new Settings(0);
		render(<NumberPicker modObject={settings} config={configFor({ float: true })} />);
		fireEvent.input(input(), { target: { value: '12.5' } });
		fireEvent.change(input());
		expect(settings.value).toBe(12.5);
	});

	it('re-syncs the field on any notification, even one that does not change the value', () => {
		const settings = new Settings(7);
		render(<NumberPicker modObject={settings} config={configFor()} />);
		fireEvent.input(input(), { target: { value: '12abc' } });

		act(() => settings.set(7));
		expect(input().value).toBe('7');
	});
});
