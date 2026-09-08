import { UnitReference, UnitReference_Type as UnitType } from '@generated/proto/common';
import { ActionId } from '@sim/proto/action_id';
import { act, fireEvent, render } from '@testing-library/react';
import type { UnitValue } from '@ui-kit/pickers/unit_picker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnitPicker } from './UnitPicker';

// A filled ActionId as fill() returns one, so useActionId renders synchronously and no test touches
// the network — the same pattern MultiIconPicker.test.tsx uses.
const filled = (actionId: ActionId, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name: '', iconUrl }) as ActionId;

const allTargets = UnitReference.create({ type: UnitType.AllTargets });
const targetRef = (index: number) => UnitReference.create({ type: UnitType.Target, index });

const options: Array<UnitValue> = [
	{ value: allTargets, text: 'All Targets', iconUrl: '' },
	{ value: targetRef(0), text: 'Target 1', iconUrl: 'boss.jpg', color: 'warrior' },
	{ value: targetRef(1), text: 'Target 2', iconUrl: 'fa-users' },
	{ value: targetRef(2), text: 'Target 3', iconUrl: filled(ActionId.fromSpellId(1), 'spell.jpg') },
];

const mount = (value: UnitReference | undefined, onChange = vi.fn(), values = options) =>
	render(<UnitPicker id="results-filter-target-filter" options={values} value={value} onChange={onChange} className="target-filter-root" />);

const root = () => document.querySelector('.unit-picker-root') as HTMLElement;
const trigger = () => root().querySelector('.dropdown-picker-button') as HTMLButtonElement;
const items = () => [...root().querySelectorAll<HTMLElement>('.dropdown-picker-item')];
const open = () => act(() => void fireEvent.click(trigger()));

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});

describe('UnitPicker', () => {
	it('keeps the class names the unit-picker stylesheet selects on', () => {
		mount(allTargets);

		expect(root().className).toBe('dropdown-picker-root dropdown unit-picker-root target-filter-root');
		expect(trigger().id).toBe('results-filter-target-filter');
	});

	it('matches the selection on the unit reference, not on the display fields around it', () => {
		// A second reference to the same target, built fresh and labelled differently.
		mount(UnitReference.create({ type: UnitType.Target, index: 1 }));

		expect(trigger().textContent).toBe('Target 2');
	});

	it('falls back to the default label for a unit the options do not hold', () => {
		mount(targetRef(9));

		expect(trigger().textContent).toBe('Unit');
	});

	it('renders each icon shape the UnitValue contract allows, and none for an empty url', async () => {
		mount(allTargets);
		await open();

		expect(items()[0].querySelector('.unit-picker-item-icon')).toBeNull();
		expect(items()[1].querySelector('img.unit-picker-item-icon')!.getAttribute('src')).toBe('boss.jpg');
		expect(items()[2].querySelector('i.unit-picker-item-icon')!.className).toBe('fa fa-users unit-picker-item-icon');
		expect(items()[3].querySelector('img.unit-picker-item-icon')!.getAttribute('src')).toBe('spell.jpg');
	});

	it('puts a unit colour on the option and on the trigger that shows it', async () => {
		mount(targetRef(0));
		expect(trigger().className).toContain('text-warrior');

		await open();
		expect(items()[1].className).toContain('text-warrior');
		expect(items()[0].className).not.toContain('text-');
	});

	it('hands back the reference of the unit that was chosen', async () => {
		const onChange = vi.fn();
		mount(allTargets, onChange);
		await open();

		await act(() => void fireEvent.click(items()[2]));

		expect(onChange).toHaveBeenCalledWith(targetRef(1));
	});

	it('leaves every icon out of the accessible name', async () => {
		mount(allTargets);
		await open();

		expect([...root().querySelectorAll('img')].every(image => image.getAttribute('alt') === '')).toBe(true);
	});
});
