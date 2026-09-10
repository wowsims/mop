import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownPicker } from './DropdownPicker';
import type { DropdownOption } from './types';

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

	// Vanilla's `popperConfig: { strategy: 'fixed' }` plus `extraClassNames: ['dropup']`, which is what
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
	describe('submenus', () => {
		interface Kind {
			id: string;
		}
		const sameKind = (a: Kind | undefined, b: Kind | undefined) => a?.id === b?.id;
		const kinds: Array<DropdownOption<Kind>> = [
			{ value: { id: 'none' }, label: 'None' },
			{ value: { id: 'and' }, label: 'And', submenu: ['logic'] },
			{ value: { id: 'or' }, label: 'Or', submenu: ['logic'] },
			{ value: { id: 'chi' }, label: 'Chi', submenu: ['resources', 'chi'] },
		];

		const mountKinds = (onChange = vi.fn()) =>
			render(<DropdownPicker options={kinds} value={undefined} onChange={onChange} equals={sameKind} defaultLabel="Pick" />);

		it('puts categorised options behind a submenu trigger and leaves the rest at the root', async () => {
			mountKinds();
			await open();

			const rows = [...root().querySelectorAll<HTMLElement>('.dropdown-picker-list > *')];
			expect(rows.map(row => row.textContent)).toEqual(['None', 'logic »', 'resources »']);
			// Only the root-level option is a radio item; a trigger is a button in a `.dropend`.
			expect(rows[0].getAttribute('role')).toBe('menuitemradio');
			expect(rows[1].querySelector('.dropend > button.dropdown-item')).not.toBeNull();
		});

		it('renders the submenu contents once it is opened', async () => {
			mountKinds();
			await open();
			const trigger = [...root().querySelectorAll<HTMLElement>('.dropdown-picker-list > * button.dropdown-item')][0];

			await act(() => void fireEvent.click(trigger));

			const popup = document.querySelector('.dropdown-submenu')!;
			expect([...popup.querySelectorAll('.dropdown-picker-item')].map(item => item.textContent)).toEqual(['And', 'Or']);
			expect(popup.tagName).toBe('UL');
		});

		it('nests a two-segment path', async () => {
			mountKinds();
			await open();
			const resources = [...root().querySelectorAll<HTMLElement>('.dropdown-picker-list > * button.dropdown-item')][1];

			await act(() => void fireEvent.click(resources));
			const inner = [...document.querySelectorAll('.dropdown-submenu button.dropdown-item')];
			expect(inner.map(node => node.textContent)).toEqual(['chi »']);
		});

		it('selects the option a submenu trigger stands for, when it stands for one', async () => {
			const onChange = vi.fn();
			const self = { value: { id: 'self' }, label: 'Self' };
			const pet = { value: { id: 'pet' }, label: 'Pet', submenu: [{ id: 'self' }] };
			render(<DropdownPicker options={[self, pet]} value={undefined} onChange={onChange} equals={sameKind} defaultLabel="Unit" />);
			await open();

			const trigger = root().querySelector('.dropend > button.dropdown-item')!;
			expect(trigger.textContent).toBe('Self');
			await act(() => void fireEvent.click(trigger));

			expect(onChange).toHaveBeenCalledWith({ id: 'self' });
		});
	});

	describe('per-option tooltips', () => {
		const withTooltip: Array<DropdownOption<Unit>> = [
			{ value: { id: 0, name: 'All' }, label: 'All Targets' },
			{ value: { id: 1, name: 'One' }, label: 'Target 1', tooltip: '<p>short</p> full' },
		];

		it('renders no tooltip at all when no option carries one', async () => {
			mount({ id: 0, name: 'All' });
			expect(root().querySelector('.sim-tooltip')).toBeNull();
			await open();
			expect(items().every(item => !item.hasAttribute('data-tooltip-id'))).toBe(true);
		});

		it("anchors only the options that carry one on the list's single tooltip", async () => {
			mount({ id: 0, name: 'All' }, vi.fn(), withTooltip);
			await open();

			expect(items()[0].hasAttribute('data-tooltip-id')).toBe(false);
			expect(items()[1].getAttribute('data-tooltip-content')).toBe('<p>short</p> full');
			// One tooltip for the whole menu, not one per option.
			expect(root().querySelectorAll('[id$="-option"]')).toHaveLength(0);
			expect(items()[1].getAttribute('data-tooltip-id')).toMatch(/-option$/);
		});
	});

	describe('hideLabelWhenDefault', () => {
		it('keeps the icon but drops the label on the trigger for the default selection', () => {
			render(
				<DropdownPicker
					options={units}
					value={{ id: 0, name: 'All' }}
					onChange={vi.fn()}
					equals={sameId}
					defaultLabel="Unit"
					hideLabelWhenDefault={value => value.id === 0}
				/>,
			);

			expect(trigger().textContent).toBe('');
		});

		it('shows the label for any other selection', () => {
			render(
				<DropdownPicker
					options={units}
					value={{ id: 1, name: 'One' }}
					onChange={vi.fn()}
					equals={sameId}
					defaultLabel="Unit"
					hideLabelWhenDefault={value => value.id === 0}
				/>,
			);

			expect(trigger().textContent).toBe('Target 1');
			expect(trigger().querySelectorAll('img.unit-picker-item-icon')).toHaveLength(1);
		});
	});
});
