import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { describe, expect, it } from 'vitest';

import { BooleanPicker } from './BooleanPicker';

// Stands in for a domain facade: a value plus the (onChange) => unsubscribe contract every
// storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	constructor(public flag = false) {}
	set(next: boolean) {
		this.flag = next;
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

const configFor = (extra: Partial<BooleanPickerConfig<Settings>> = {}): BooleanPickerConfig<Settings> => ({
	id: 'use-item-swap',
	label: 'Enable Item Swap',
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.flag,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const checkbox = () => screen.getByRole('checkbox') as HTMLInputElement;

describe('BooleanPicker', () => {
	it('shows the source value and writes back through setValue', () => {
		const settings = new Settings(true);
		render(<BooleanPicker modObject={settings} config={configFor()} />);
		expect(checkbox().checked).toBe(true);

		fireEvent.click(checkbox());
		expect(settings.flag).toBe(false);
		expect(checkbox().checked).toBe(false);
	});

	it('re-renders when the source changes underneath it', () => {
		const settings = new Settings(false);
		render(<BooleanPicker modObject={settings} config={configFor()} />);
		act(() => settings.set(true));
		expect(checkbox().checked).toBe(true);
	});

	it('subscribes once and unsubscribes on unmount', () => {
		const settings = new Settings();
		const { unmount } = render(<BooleanPicker modObject={settings} config={configFor()} />);
		expect(settings.listenerCount).toBe(1);
		unmount();
		expect(settings.listenerCount).toBe(0);
	});

	// showWhen hides rather than unmounts, which is what the vanilla Input.update() does. Phase 3
	// compares DOM against the vanilla build, so the node has to stay.
	it('hides with the `hide` class when showWhen is false, keeping the node', () => {
		const settings = new Settings();
		render(<BooleanPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(checkbox().closest('.input-root')!.classList.contains('hide')).toBe(true);
	});

	it('disables the input and marks the root when enableWhen is false', () => {
		const settings = new Settings();
		render(<BooleanPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(checkbox().disabled).toBe(true);
		expect(checkbox().closest('.input-root')!.classList.contains('disabled')).toBe(true);
	});

	it('seeds from defaultValue, then hands over to the source on its first change', () => {
		const settings = new Settings(false);
		render(<BooleanPicker modObject={settings} config={configFor({ defaultValue: true })} />);
		expect(checkbox().checked).toBe(true);

		act(() => settings.set(false));
		expect(checkbox().checked).toBe(false);
	});

	it('renders the same shape as the vanilla picker', () => {
		const settings = new Settings();
		const { container } = render(<BooleanPicker modObject={settings} config={configFor({ description: 'Swaps mid-fight' })} />);
		const root = container.firstElementChild!;
		expect([...root.classList]).toEqual(expect.arrayContaining(['input-root', 'boolean-picker-root', 'form-check']));
		expect([...root.children].map(el => el.tagName)).toEqual(['INPUT', 'LABEL', 'DIV']);
		expect(root.querySelector('label')!.className).toBe('form-label');
	});

	it('puts the input last when reverse is set', () => {
		const settings = new Settings();
		const { container } = render(<BooleanPicker modObject={settings} config={configFor({ reverse: true })} />);
		const root = container.firstElementChild!;
		expect(root.classList.contains('form-check-reverse')).toBe(true);
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'INPUT']);
	});
});
