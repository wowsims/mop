import type { StoreSubscribe } from '@sim/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { BooleanPicker } from './BooleanPicker';
import type { AnyBooleanPickerConfig, BooleanPickerConfig, ControlledBooleanPickerConfig } from './types';

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

	it('renders nothing when showWhen is false', () => {
		const settings = new Settings();
		const { container } = render(<BooleanPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(container.querySelector('.input-root')).toBeNull();
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

	it('puts the input last when reverse is set, after the description', () => {
		const settings = new Settings();
		const { container } = render(<BooleanPicker modObject={settings} config={configFor({ reverse: true, description: 'Swaps mid-fight' })} />);
		const root = container.firstElementChild!;
		expect(root.classList.contains('form-check-reverse')).toBe(true);
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'INPUT']);
	});

	// InputConfig types both of these as string | Element. The reforge panel was the last caller to
	// pass an Element and it is React now, so nothing does today — but the type still allows it, and
	// stringifying one renders "[object HTMLDivElement]" with nothing to notice it.
	it('renders an Element description and tooltip rather than stringifying them', async () => {
		const settings = new Settings();
		const description = document.createElement('div');
		description.textContent = 'Built elsewhere';
		const tooltip = document.createElement('span');
		tooltip.textContent = 'Node tooltip';

		render(<BooleanPicker modObject={settings} config={configFor({ description, labelTooltip: tooltip })} />);
		expect(screen.getByText('Built elsewhere')).toBeTruthy();
		expect(document.body.textContent).not.toContain('[object');

		fireEvent.mouseEnter(screen.getByText('Enable Item Swap'));
		expect(await screen.findByText('Node tooltip')).toBeTruthy();
	});
});

describe('BooleanPicker controlled', () => {
	it('renders the value it is handed and reports every click, with no source of its own', () => {
		const onChange = vi.fn();
		const settings = new Settings();
		render(<BooleanPicker modObject={settings} config={{ id: 'controlled', label: 'Controlled', value: true, onChange }} />);

		expect(checkbox().checked).toBe(true);
		expect(settings.listenerCount).toBe(0);

		fireEvent.click(checkbox());
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it('follows the value the parent hands back, not the click', () => {
		const Host = () => {
			const [flag, setFlag] = useState(false);
			return <BooleanPicker modObject={{}} config={{ id: 'controlled', label: 'Controlled', value: flag, onChange: setFlag }} />;
		};
		render(<Host />);

		act(() => {
			checkbox().click();
		});
		expect(checkbox().checked).toBe(true);
	});
});

describe('BooleanPickerConfig', () => {
	type Sourced = BooleanPickerConfig<Settings>;
	type Controlled = ControlledBooleanPickerConfig<Settings>;
	type Both = Omit<Sourced, 'value' | 'onChange'> & { value: boolean; onChange: (next: boolean) => void };
	type Neither = Omit<Sourced, 'getValue' | 'setValue' | 'storeSubscribe' | 'storeField'>;

	it('takes one end or the other, and refuses both at once or neither', () => {
		expectTypeOf<Sourced>().toExtend<AnyBooleanPickerConfig<Settings>>();
		expectTypeOf<Controlled>().toExtend<AnyBooleanPickerConfig<Settings>>();
		expectTypeOf<Both>().not.toExtend<AnyBooleanPickerConfig<Settings>>();
		expectTypeOf<Neither>().not.toExtend<AnyBooleanPickerConfig<Settings>>();
	});
});
