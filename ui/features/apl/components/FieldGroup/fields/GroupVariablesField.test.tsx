import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupVariablesField } from './GroupVariablesField';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeAll: () => source.subscribe,
	subscribePlayerField: () => source.subscribe,
	subscribeUnitMetadata: () => source.subscribe,
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const placeholderAction = (name: string) => ({
	hide: false,
	notes: '',
	action: { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name } } } as any,
});

let player: ReturnType<typeof makePlayer>;
let parentValue: { groupName?: string; variables: Array<any> };

/** `groupName` names a group in `rotation.groups`; the referenced group defines the placeholders. */
const setup = (opts: { groupName?: string; placeholders?: Array<string>; existingVariables?: Array<any>; variableNames?: Array<string> } = {}) => {
	source.listeners.clear();
	// Built as a plain object, not `APLRotation.create(...)`: `placeholderAction`'s `action.value`
	// shape is what `visitObjects`/`isPlaceholder` (see placeholders.test.ts) walk, and `.create()`
	// only knows the real `APLAction` field set — it would drop the fixture's `value` key.
	const rotation = {
		groups: opts.placeholders ? [{ name: 'g1', actions: opts.placeholders.map(placeholderAction), variables: [] }] : [],
		valueVariables: (opts.variableNames || []).map(name => ({ name })),
	} as unknown as APLRotation;
	player = makePlayer(rotation, () => source.notify());
	parentValue = { groupName: opts.groupName, variables: opts.existingVariables || [] };
};

const mount = () =>
	render(
		<GroupVariablesField
			player={player as never}
			config={{ id: 'gv', getValue: () => parentValue.variables, setValue: () => player.touchRotation() } as never}
			groupNameField="groupName"
			getParentValue={() => parentValue}
		/>,
	);

const container = () => document.querySelector('.group-reference-variables-container') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll('.apl-group-variable-picker-root'));
const labels = () => rows().map(row => row.querySelector('label')!.textContent);

const clickItemAction = (index: number, action: string) => {
	const item = document.querySelectorAll('.list-picker-item-container')[index];
	act(() => {
		fireEvent.click(item.querySelector('.list-picker-item-actions')!);
	});
	act(() => {
		fireEvent.click(item.querySelector(action)!);
	});
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('GroupVariablesField', () => {
	it('derives one row per placeholder the selected group defines, labelled by name', () => {
		setup({ groupName: 'g1', placeholders: ['a', 'b'] });
		mount();

		expect(rows()).toHaveLength(2);
		expect(rows()[0].querySelector('label')!.textContent).toBe('a:');
		expect(rows()[1].querySelector('label')!.textContent).toBe('b:');
	});

	it('is d-none with no group selected', () => {
		setup({ placeholders: ['a'] });
		mount();

		expect(container().className.split(' ')).toContain('d-none');
	});

	it('is d-none when the selected group defines no placeholders', () => {
		setup({ groupName: 'g1', placeholders: [] });
		mount();

		expect(container().className.split(' ')).toContain('d-none');
		expect(rows()).toHaveLength(0);
	});

	it('keeps an existing variables entry by identity, and creates the missing one', () => {
		const existingA = { name: 'a', value: { uuid: { value: 'keep-a' }, value: { oneofKind: 'variableRef', variableRef: { name: 'x' } } } };
		setup({ groupName: 'g1', placeholders: ['a', 'b'], existingVariables: [existingA] });
		mount();

		expect(parentValue.variables[0]).toBe(existingA);
		expect(parentValue.variables[1]).not.toBe(existingA);
		expect(parentValue.variables[1].name).toBe('b');
	});

	it('syncs parentValue.variables to exactly the derived rows after render', () => {
		setup({ groupName: 'g1', placeholders: ['a', 'b'], existingVariables: [] });
		mount();

		expect(parentValue.variables.map(entry => entry.name)).toEqual(['a', 'b']);
	});

	it('reconciles a deleted row back, so no label ever names another row entry', () => {
		const existingA = { name: 'a', value: { uuid: { value: 'keep-a' }, value: { oneofKind: 'variableRef', variableRef: { name: 'x' } } } };
		setup({ groupName: 'g1', placeholders: ['a', 'b'], existingVariables: [existingA] });
		mount();

		clickItemAction(0, '.list-picker-item-delete');

		expect(labels()).toEqual(['a:', 'b:']);
		expect(parentValue.variables.map(entry => entry.name)).toEqual(['a', 'b']);
		// The deleted row comes back empty: delete resets the assignment, it does not drop the row.
		expect(parentValue.variables[0]).not.toBe(existingA);
		expect(parentValue.variables[0].value.value.variableRef.name).toBe('');
	});

	it('offers no copy action, because a duplicate entry is dropped by the next reconcile', () => {
		setup({ groupName: 'g1', placeholders: ['a', 'b'] });
		mount();

		const item = document.querySelectorAll('.list-picker-item-container')[0];
		act(() => {
			fireEvent.click(item.querySelector('.list-picker-item-actions')!);
		});

		// Delete is asserted present so a popover that never opened fails here rather than passing.
		expect(item.querySelector('.list-picker-item-delete')).not.toBeNull();
		expect(item.querySelector('.list-picker-item-copy')).toBeNull();
	});

	it('writes a variableRef and touches the rotation when a row picks a variable', () => {
		setup({ groupName: 'g1', placeholders: ['a'], variableNames: ['x', 'y'] });
		const touched = vi.spyOn(player, 'touchRotation');
		mount();

		const trigger = rows()[0].querySelector('.dropdown-picker-button') as HTMLButtonElement;
		act(() => {
			fireEvent.click(trigger);
		});
		const items = Array.from(document.querySelectorAll('.dropdown-picker-item'));
		expect(items.map(el => el.textContent)).toEqual(['x', 'y']);
		act(() => {
			fireEvent.click(items[1]);
		});

		expect(parentValue.variables[0].value).toEqual({ uuid: expect.anything(), value: { oneofKind: 'variableRef', variableRef: { name: 'y' } } });
		expect(touched).toHaveBeenCalled();
	});

	it('gives the row label an htmlFor naming the dropdown trigger', () => {
		setup({ groupName: 'g1', placeholders: ['a'] });
		mount();

		const label = rows()[0].querySelector('label') as HTMLLabelElement;
		const trigger = rows()[0].querySelector('.dropdown-picker-button') as HTMLButtonElement;
		expect(label.getAttribute('for')).toBe(trigger.id);
		expect(label.getAttribute('for')).toBeTruthy();
	});
});
