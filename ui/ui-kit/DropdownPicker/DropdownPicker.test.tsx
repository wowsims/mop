import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type DropdownOption, DropdownPicker } from './DropdownPicker';

interface Unit {
	id: number;
	name: string;
}

const units: Array<DropdownOption<Unit>> = [
	{ value: { id: 0, name: 'All' }, label: 'All Targets' },
	{ value: { id: 1, name: 'One' }, label: 'Target 1', icon: <img className="unit-picker-item-icon" alt="" />, className: 'text-warrior' },
	{ value: { id: 2, name: 'Two' }, label: 'Target 2' },
];

const sameId = (a: Unit | undefined, b: Unit | undefined) => a?.id === b?.id;

const mount = (value: Unit | undefined, onChange = vi.fn(), options = units, equals = sameId) =>
	render(
		<DropdownPicker
			id="target-filter"
			options={options}
			value={value}
			onChange={onChange}
			equals={equals}
			defaultLabel="Unit"
			className="unit-picker-root"
		/>,
	);

const root = () => document.querySelector('.dropdown-picker-root') as HTMLElement;
const trigger = () => root().querySelector('.dropdown-picker-button') as HTMLButtonElement;
const items = () => [...root().querySelectorAll<HTMLElement>('.dropdown-picker-item')];
const open = () => act(() => void fireEvent.click(trigger()));

describe('DropdownPicker', () => {
	it('renders the root and trigger the stylesheets select on', () => {
		mount(undefined);

		expect(root().className).toBe('dropdown-picker-root dropdown unit-picker-root');
		expect(trigger().className).toBe('dropdown-picker-button btn dropdown-toggle');
		expect(trigger().id).toBe('target-filter');
		expect(trigger().getAttribute('type')).toBe('button');
	});

	it('shows the default label while no option matches the value', () => {
		mount({ id: 9, name: 'Missing' });

		expect(trigger().textContent).toBe('Unit');
	});

	it('shows the selected option on the trigger, its icon and its class with it', () => {
		mount({ id: 1, name: 'One' });

		expect(trigger().textContent).toBe('Target 1');
		expect(trigger().querySelectorAll('img.unit-picker-item-icon')).toHaveLength(1);
		expect(trigger().className).toContain('text-warrior');
	});

	it('builds no options until it is opened, and drops them again on close', async () => {
		mount({ id: 0, name: 'All' });
		expect(items()).toHaveLength(0);

		await open();
		expect(items().map(item => item.textContent)).toEqual(['All Targets', 'Target 1', 'Target 2']);

		await act(() => void fireEvent.keyDown(root().querySelector('[role=menu]')!, { key: 'Escape' }));
		expect(items()).toHaveLength(0);
	});

	it('marks the option the value selects, and only that one', async () => {
		mount({ id: 2, name: 'Two' });
		await open();

		expect(items().map(item => item.getAttribute('role'))).toEqual(['menuitemradio', 'menuitemradio', 'menuitemradio']);
		expect(items().map(item => item.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
	});

	it('reads the selection through `equals`, not by identity', async () => {
		// A different object with the same id: the picker must still call it selected.
		mount({ id: 1, name: 'a different object' });
		await open();

		expect(items()[1].getAttribute('aria-checked')).toBe('true');
		expect(trigger().textContent).toBe('Target 1');
	});

	it('reports the chosen option and closes', async () => {
		const onChange = vi.fn();
		mount({ id: 0, name: 'All' }, onChange);
		await open();

		await act(() => void fireEvent.click(items()[2]));

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ id: 2, name: 'Two' });
		expect(items()).toHaveLength(0);
	});

	it('carries an option class onto the option as well as the trigger', async () => {
		mount({ id: 0, name: 'All' });
		await open();

		expect(items()[1].className).toContain('text-warrior');
		expect(items()[0].className).toBe('dropdown-picker-item');
	});

	// Vanilla's `popperConfig: { strategy: 'fixed' }` plus `extraCssClasses: ['dropup']`, which is what
	// a picker sitting in an overflow-clipped drawer at the bottom of the page needs.
	describe('side and positionMethod', () => {
		const positioner = () => root().querySelector('.dropdown-picker-positioner') as HTMLElement;

		it('opens below the trigger, positioned in flow, by default', async () => {
			mount({ id: 0, name: 'All' });
			await open();

			expect(positioner().getAttribute('data-side')).toBe('bottom');
			expect(positioner().style.position).toBe('absolute');
		});

		it('opens above the trigger and out of flow when asked', async () => {
			render(
				<DropdownPicker
					id="log-search-add-filter"
					options={units}
					value={undefined}
					onChange={vi.fn()}
					equals={sameId}
					defaultLabel="Add filter"
					side="top"
					positionMethod="fixed"
				/>,
			);
			await open();

			expect(positioner().getAttribute('data-side')).toBe('top');
			expect(positioner().style.position).toBe('fixed');
		});
	});
});
