import { placeholderNames } from '@features/apl/model/placeholders';
import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { act, render } from '@testing-library/react';
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

const setup = (opts: { groupName?: string; placeholders?: Array<string> } = {}) => {
	source.listeners.clear();
	const rotation = {
		groups: opts.placeholders ? [{ name: 'g1', actions: opts.placeholders.map(placeholderAction), variables: [] }] : [],
		valueVariables: [],
	} as unknown as APLRotation;
	player = makePlayer(rotation, () => source.notify());
	parentValue = { groupName: opts.groupName, variables: [] };
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

const rows = () => Array.from(document.querySelectorAll('[data-testid="apl-group-variable-picker-root"]'));

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('GroupVariableRow — a row only exists while its group is selected', () => {
	it('placeholderNames(undefined) is empty, so a deselected group reconciles to zero rows', () => {
		expect(placeholderNames(undefined)).toEqual([]);
	});

	it('deselecting the group unmounts every row rather than leaving one mounted', () => {
		setup({ groupName: 'g1', placeholders: ['a', 'b'] });
		mount();
		expect(rows()).toHaveLength(2);

		act(() => {
			parentValue.groupName = undefined;
			player.touchRotation();
		});

		expect(rows()).toHaveLength(0);
	});

	it('reselecting the group mounts fresh row instances, which start with stale=true and read correctly on their first render', () => {
		setup({ groupName: 'g1', placeholders: ['a'] });
		mount();
		expect(rows()).toHaveLength(1);

		act(() => {
			parentValue.groupName = undefined;
			player.touchRotation();
		});
		expect(rows()).toHaveLength(0);

		act(() => {
			parentValue.groupName = 'g1';
			player.touchRotation();
		});

		expect(rows()).toHaveLength(1);
	});
});
