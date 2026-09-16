import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { act, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
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

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(source.subscribe));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const placeholderAction = (name: string) => ({
	hide: false,
	notes: '',
	action: { value: { oneofKind: 'variablePlaceholder', variablePlaceholder: { name } } } as any,
});

let player: ReturnType<typeof makePlayer>;
let parentValue: { groupName?: string; variables: Array<any> };

const setup = (opts: { groupName?: string; placeholders?: Array<string>; existingVariables?: Array<any> } = {}) => {
	source.listeners.clear();
	const rotation = {
		groups: opts.placeholders ? [{ name: 'g1', actions: opts.placeholders.map(placeholderAction), variables: [] }] : [],
		valueVariables: [],
	} as unknown as APLRotation;
	player = makePlayer(rotation, () => source.notify());
	parentValue = { groupName: opts.groupName, variables: opts.existingVariables || [] };
};

const mount = () =>
	render(
		<StrictMode>
			<GroupVariablesField
				player={player as never}
				config={{ id: 'gv', getValue: () => parentValue.variables, setValue: () => player.touchRotation() } as never}
				groupNameField="groupName"
				getParentValue={() => parentValue}
			/>
		</StrictMode>,
	);

const rows = () => Array.from(document.querySelectorAll('[data-testid="apl-group-variable-picker-root"]'));
const labels = () => rows().map(row => row.querySelector('label')!.textContent);

const clickItemAction = (index: number, action: string) => {
	const item = document.querySelectorAll('[data-testid="list-picker-item-container"]')[index];
	act(() => {
		fireEvent.click(item.querySelector('[data-testid="list-picker-item-actions"]')!);
	});
	act(() => {
		fireEvent.click(document.querySelector(action)!);
	});
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('GroupVariablesField under StrictMode (bug 2 — reconcile is a write on a read path)', () => {
	it('mounts with exactly one row per placeholder, no duplicates from the double-invoked read', () => {
		setup({ groupName: 'g1', placeholders: ['a', 'b'] });
		mount();

		expect(labels()).toEqual(['a:', 'b:']);
		expect(parentValue.variables.map(entry => entry.name)).toEqual(['a', 'b']);
	});

	it('keeps existing entries by identity through the StrictMode double render', () => {
		const existingA = { name: 'a', value: { uuid: { value: 'keep-a' }, value: { oneofKind: 'variableRef', variableRef: { name: 'x' } } } };
		setup({ groupName: 'g1', placeholders: ['a', 'b'], existingVariables: [existingA] });
		mount();

		expect(parentValue.variables[0]).toBe(existingA);
		expect(parentValue.variables).toHaveLength(2);
	});

	it('reconciles a delete correctly under StrictMode, with no duplicate or dropped rows', () => {
		const existingA = { name: 'a', value: { uuid: { value: 'keep-a' }, value: { oneofKind: 'variableRef', variableRef: { name: 'x' } } } };
		setup({ groupName: 'g1', placeholders: ['a', 'b'], existingVariables: [existingA] });
		mount();

		clickItemAction(0, '[data-testid="list-picker-item-delete"]');

		expect(labels()).toEqual(['a:', 'b:']);
		expect(parentValue.variables.map(entry => entry.name)).toEqual(['a', 'b']);
	});
});
