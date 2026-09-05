import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { EnumPickerConfig } from '@ui-kit/pickers/enum_picker';
import { describe, expect, it } from 'vitest';

import { EnumPicker } from './EnumPicker';

// Stands in for a domain facade: a value plus the (onChange) => unsubscribe contract every
// storeSubscribe helper in state/subscriptions.ts returns.
class Settings {
	private listeners = new Set<() => void>();
	constructor(public mode = 0) {}
	set(next: number) {
		this.mode = next;
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

const values = [
	{ name: 'Passive', value: 0, tooltip: 'Do nothing' },
	{ name: 'Aggressive', value: 1, tooltip: 'Attack everything' },
	{ name: 'Defensive', value: 2, tooltip: 'Attack when attacked' },
];

const configFor = (extra: Partial<EnumPickerConfig<Settings>> = {}): EnumPickerConfig<Settings> => ({
	id: 'pet-mode',
	label: 'Pet Mode',
	values,
	storeSubscribe: settings => settings.subscribe,
	getValue: settings => settings.mode,
	setValue: (settings, value) => settings.set(value),
	...extra,
});

const select = () => screen.getByRole('combobox') as HTMLSelectElement;

describe('EnumPicker', () => {
	it('renders one option per value, in order, with their titles', () => {
		const settings = new Settings();
		render(<EnumPicker modObject={settings} config={configFor()} />);
		const options = select().querySelectorAll('option');
		expect(options).toHaveLength(3);
		expect([...options].map(o => o.value)).toEqual(['0', '1', '2']);
		expect([...options].map(o => o.textContent)).toEqual(['Passive', 'Aggressive', 'Defensive']);
		expect([...options].map(o => o.title)).toEqual(['Do nothing', 'Attack everything', 'Attack when attacked']);
	});

	it('shows the source value and writes back through setValue', () => {
		const settings = new Settings(1);
		render(<EnumPicker modObject={settings} config={configFor()} />);
		expect(select().value).toBe('1');

		fireEvent.change(select(), { target: { value: '2' } });
		expect(settings.mode).toBe(2);
		expect(select().value).toBe('2');
	});

	it('writes back a number, not a string', () => {
		const settings = new Settings(0);
		render(<EnumPicker modObject={settings} config={configFor()} />);
		fireEvent.change(select(), { target: { value: '1' } });
		expect(settings.mode).toBe(1);
		expect(typeof settings.mode).toBe('number');
	});

	it('re-renders when the source changes underneath it', () => {
		const settings = new Settings(0);
		render(<EnumPicker modObject={settings} config={configFor()} />);
		act(() => settings.set(2));
		expect(select().value).toBe('2');
	});

	// Assigning select.value with no matching option deselects everything, which is what the vanilla
	// picker does with the same assignment. A React-controlled select would keep the first option.
	it('selects nothing when the model value is not in the list, as the vanilla picker does', () => {
		const settings = new Settings(99);
		render(<EnumPicker modObject={settings} config={configFor()} />);
		expect(select().selectedIndex).toBe(-1);
		expect(select().value).toBe('');
	});

	it('links the label to the select, and carries inline and extra classes', () => {
		const settings = new Settings();
		const { container } = render(
			<EnumPicker modObject={settings} config={configFor({ inline: true, extraCssClasses: ['encounter-picker-field'] })} />,
		);
		const root = container.firstElementChild!;
		expect(root.classList.contains('input-inline')).toBe(true);
		expect(root.classList.contains('encounter-picker-field')).toBe(true);
		expect(root.querySelector('label')!.getAttribute('for')).toBe(select().id);
	});

	it('subscribes once and unsubscribes on unmount', () => {
		const settings = new Settings();
		const { unmount } = render(<EnumPicker modObject={settings} config={configFor()} />);
		expect(settings.listenerCount).toBe(1);
		unmount();
		expect(settings.listenerCount).toBe(0);
	});

	it('hides with the `hide` class when showWhen is false, keeping the node', () => {
		const settings = new Settings();
		render(<EnumPicker modObject={settings} config={configFor({ showWhen: () => false })} />);
		expect(select().closest('.input-root')!.classList.contains('hide')).toBe(true);
	});

	it('disables the input and marks the root when enableWhen is false', () => {
		const settings = new Settings();
		render(<EnumPicker modObject={settings} config={configFor({ enableWhen: () => false })} />);
		expect(select().disabled).toBe(true);
		expect(select().closest('.input-root')!.classList.contains('disabled')).toBe(true);
	});

	it('seeds from defaultValue, then hands over to the source on its first change', () => {
		const settings = new Settings(0);
		render(<EnumPicker modObject={settings} config={configFor({ defaultValue: 2 })} />);
		expect(select().value).toBe('2');

		act(() => settings.set(1));
		expect(select().value).toBe('1');
	});

	it('renders the same shape as the vanilla picker', () => {
		const settings = new Settings();
		const { container } = render(<EnumPicker modObject={settings} config={configFor({ description: 'Controls pet behaviour' })} />);
		const root = container.firstElementChild!;
		expect([...root.classList]).toEqual(expect.arrayContaining(['input-root', 'enum-picker-root']));
		expect([...root.children].map(el => el.tagName)).toEqual(['LABEL', 'DIV', 'SELECT']);
		expect(root.querySelector('label')!.className).toBe('form-label');
		expect(root.querySelector('select')!.className).toBe('enum-picker-selector form-select');
	});

	// InputConfig types both of these as string | Element, and reforge_panel.tsx:527 passes an
	// Element. Stringifying it renders "[object HTMLDivElement]" with nothing to notice it.
	it('renders an Element description and tooltip rather than stringifying them', async () => {
		const settings = new Settings();
		const description = document.createElement('div');
		description.textContent = 'Built elsewhere';
		const tooltip = document.createElement('span');
		tooltip.textContent = 'Node tooltip';

		render(<EnumPicker modObject={settings} config={configFor({ description, labelTooltip: tooltip })} />);
		expect(screen.getByText('Built elsewhere')).toBeTruthy();
		expect(document.body.textContent).not.toContain('[object');

		fireEvent.mouseEnter(screen.getByText('Pet Mode'));
		expect(await screen.findByText('Node tooltip')).toBeTruthy();
	});
});
