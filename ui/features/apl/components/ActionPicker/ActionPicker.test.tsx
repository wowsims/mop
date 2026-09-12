import { actionKindOptions } from '@features/apl/model/kind_options';
import { makePlayer } from '@features/apl/testing';
import { APLAction, APLRotation } from '@generated/proto/apl';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

let rotation: APLRotation;
let player: ReturnType<typeof makePlayer>;

const setup = (action: APLAction) => {
	source.listeners.clear();
	rotation = APLRotation.create({ priorityList: [{ action }] });
	player = makePlayer(rotation, () => source.notify());
};

const configForRoot = () => ({
	getValue: () => player.aplRotation.priorityList[0].action,
	setValue: (_subject: unknown, next: APLAction) => {
		player.aplRotation.priorityList[0].action = next;
		source.notify();
	},
});

import { ActionPicker } from './ActionPicker';

// Statically imported for every test that is not about the module cycle: a dynamic import inside
// a test body re-transforms the whole value/action graph and counts against that test's timeout.
const roots = () => Array.from(document.querySelectorAll('.apl-action-picker-root'));

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ActionPicker', () => {
	it('renders the condition, then the kind picker and its fields, in that order', () => {
		setup(APLAction.create({ action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } } }));
		render(<ActionPicker player={player as never} config={configForRoot() as never} />);

		const root = roots()[0];
		expect(root.children[0].className).toContain('apl-value-picker-root');
		expect(root.children[0].className).toContain('apl-action-condition');
		expect(root.children[0].className).toContain('apl-priority-list-only');

		const actionContainer = root.children[1];
		expect(actionContainer.className).toBe('apl-action-picker-action');
		expect(actionContainer.children[0].className).toContain('dropdown-picker-root');
		expect(actionContainer.children[1].className).toContain('apl-picker-builder-root');
	});

	it('carries apl-action-<kind> on the field group', () => {
		setup(APLAction.create({ action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } } }));
		render(<ActionPicker player={player as never} config={configForRoot() as never} />);

		expect(document.querySelector('.apl-picker-builder-root')!.className.split(' ')).toContain('apl-action-resetSequence');
	});

	it('renders no field group while the action has no kind', () => {
		setup(APLAction.create());
		render(<ActionPicker player={player as never} config={configForRoot() as never} />);

		expect(roots()).toHaveLength(1);
		expect(document.querySelector('.apl-picker-builder-root')).toBeNull();
	});

	it('re-reads the action when the rotation notifies', () => {
		setup(APLAction.create());
		render(<ActionPicker player={player as never} config={configForRoot() as never} />);

		expect(document.querySelector('.apl-picker-builder-root')).toBeNull();

		act(() => {
			player.aplRotation.priorityList[0].action!.action = { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } };
			source.notify();
		});

		expect(document.querySelector('.apl-picker-builder-root')).not.toBeNull();
	});

	// The action half of the value/action cycle: ActionPicker -> FieldGroup -> AplField ->
	// ActionListField -> ActionPicker (again), for a sequence's own action list. Importing
	// ActionPicker cold, first, after a module registry reset is what makes the cycle observable.
	it('resolves the action tree’s own module cycle when ActionPicker is imported cold, first', async () => {
		vi.resetModules();
		setup(
			APLAction.create({
				action: { oneofKind: 'sequence', sequence: { name: '', actions: [{ action: { oneofKind: 'castSpell', castSpell: {} } }] } },
			}),
		);
		const cold = await import('./ActionPicker');
		render(<cold.ActionPicker player={player as never} config={configForRoot() as never} />);

		expect(roots()).toHaveLength(2);
	}, 30000);

	// The value picker prepends an explicit `undefined`-valued entry; the action picker has no
	// reachable "no kind" option at all.
	it('offers no "none" entry in the action kind options', () => {
		setup(APLAction.create());
		const options = actionKindOptions(player as never, false);

		expect(options.length).toBeGreaterThan(0);
		expect(options.every(option => option.value !== undefined)).toBe(true);
	});
});
